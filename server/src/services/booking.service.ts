import { withTransaction, getDb } from '../db/connection.js';
import { PricingService } from './pricing.service.js';

export interface PassengerInput {
  fullName: string;
  age: number;
  gender: string;
  berthPreference?: string;
}

export interface LegAllocationRequest {
  legOrder: number;
  runId: string;
  fromStationCode: string;
  toStationCode: string;
  fromStopSeq: number;
  toStopSeq: number;
  seatAllocations: Array<{
    passengerIndex: number;
    seatId: string;
  }>;
}

export interface CreateHoldParams {
  userId: string;
  journeyType: 'DIRECT' | 'SAME_TRAIN_CHANGE' | 'TWO_TRAIN_CONNECTION';
  changeAcknowledged: boolean;
  passengers: PassengerInput[];
  legs: LegAllocationRequest[];
  idempotencyKey?: string;
}

export class BookingService {
  /**
   * Cleans up expired holds in database.
   */
  static async reapExpiredHolds(): Promise<number> {
    const db = await getDb();
    const res = await db.query(`
      UPDATE seat_allocations
      SET status = 'RELEASED'
      WHERE status = 'HELD' AND expires_at <= CURRENT_TIMESTAMP
    `);
    await db.query(`
      UPDATE bookings
      SET status = 'EXPIRED'
      WHERE status = 'PENDING_PAYMENT' AND hold_expires_at <= CURRENT_TIMESTAMP
    `);
    return res.rowCount || 0;
  }

  /**
   * Atomic Hold Creation with Strict Locking Hierarchy.
   */
  static async createHold(params: CreateHoldParams): Promise<{ booking: any; holdExpiresAt: string }> {
    if (!params.passengers || params.passengers.length === 0) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'At least one passenger is required.' };
    }
    if (!params.legs || params.legs.length === 0) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'At least one journey leg is required.' };
    }
    if ((params.journeyType === 'SAME_TRAIN_CHANGE' || params.journeyType === 'TWO_TRAIN_CONNECTION') && !params.changeAcknowledged) {
      throw { status: 400, code: 'CHANGE_NOT_PERMITTED', message: 'You must acknowledge the required seat/coach change or transfer.' };
    }

    // Rate-limit check: Limit active holds per user
    const db = await getDb();
    const userHolds = await db.query(`
      SELECT COUNT(*) as count FROM bookings 
      WHERE user_id = $1 AND status = 'PENDING_PAYMENT' AND hold_expires_at > CURRENT_TIMESTAMP
    `, [params.userId]);
    if (Number(userHolds.rows[0]?.count || 0) >= 3) {
      throw { status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Maximum 3 active seat holds allowed per user simultaneously. Please complete or release existing holds.' };
    }

    return await withTransaction(async (tx) => {
      // 1. Collect all unique run IDs in deterministic sorted order to prevent deadlocks
      const runIds = Array.from(new Set(params.legs.map(l => l.runId))).sort();

      // 2. Lock and verify train runs
      for (const runId of runIds) {
        const runRes = await tx.query(`
          SELECT id, status FROM train_runs 
          WHERE id = $1
        `, [runId]);

        if (runRes.rows.length === 0 || runRes.rows[0].status !== 'SCHEDULED') {
          throw { status: 400, code: 'ITINERARY_UNAVAILABLE', message: `Train run ${runId} is not open for booking.` };
        }
      }

      // 3. Collect all seat IDs across all legs in deterministic sorted order
      const allSeatIds = Array.from(new Set(
        params.legs.flatMap(l => l.seatAllocations.map(sa => sa.seatId))
      )).sort();

      // Lock all seats in deterministic order
      for (const seatId of allSeatIds) {
        await tx.query('SELECT id, coach_type, base_fare FROM run_seats WHERE id = $1', [seatId]);
      }

      // 4. Transition any relevant expired holds
      await tx.query(`
        UPDATE seat_allocations
        SET status = 'RELEASED'
        WHERE status = 'HELD' AND expires_at <= CURRENT_TIMESTAMP
      `);

      // 5. Validate that all seats are available for requested segment intervals
      for (const leg of params.legs) {
        if (leg.seatAllocations.length !== params.passengers.length) {
          throw { status: 400, code: 'SEAT_UNAVAILABLE', message: `Every passenger must be allocated a seat on leg ${leg.legOrder}.` };
        }

        for (const sa of leg.seatAllocations) {
          // Check for active overlapping allocations
          const conflict = await tx.query(`
            SELECT id, status, from_stop_seq, to_stop_seq 
            FROM seat_allocations
            WHERE run_seat_id = $1
              AND (status = 'CONFIRMED' OR (status = 'HELD' AND expires_at > CURRENT_TIMESTAMP))
              AND (from_stop_seq < $3 AND to_stop_seq > $2)
          `, [sa.seatId, leg.fromStopSeq, leg.toStopSeq]);

          if (conflict.rows.length > 0) {
            throw {
              status: 409,
              code: 'SEAT_UNAVAILABLE',
              message: `Requested seat is already held or booked for an overlapping segment (${leg.fromStopSeq} to ${leg.toStopSeq}).`
            };
          }
        }
      }

      // 6. Calculate authoritative server-side pricing
      let totalAmount = 0;
      const legCalculations: any[] = [];
      const holdDurationMinutes = 5;
      const holdExpiresDate = new Date(Date.now() + holdDurationMinutes * 60000);

      for (const leg of params.legs) {
        const runStopRes = await tx.query(`
          SELECT departure_time, arrival_time 
          FROM run_stops 
          WHERE run_id = $1 AND stop_sequence = $2
        `, [leg.runId, leg.fromStopSeq]);

        const arrStopRes = await tx.query(`
          SELECT arrival_time 
          FROM run_stops 
          WHERE run_id = $1 AND stop_sequence = $2
        `, [leg.runId, leg.toStopSeq]);

        const depTime = new Date(runStopRes.rows[0]?.departure_time || Date.now());
        const arrTime = new Date(arrStopRes.rows[0]?.arrival_time || Date.now());

        const sampleSeat = await tx.query('SELECT coach_type FROM run_seats WHERE id = $1', [leg.seatAllocations[0].seatId]);
        const coachType = sampleSeat.rows[0]?.coach_type || '3A';

        const pricing = await PricingService.calculateLegFare(tx, leg.runId, coachType, leg.fromStopSeq, leg.toStopSeq, depTime);
        const legTotal = pricing.finalFare * params.passengers.length;
        totalAmount += legTotal;

        legCalculations.push({
          leg,
          pricing,
          legTotal,
          depTime,
          arrTime
        });
      }

      // 7. Create Parent Booking
      const bookingId = `bk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const pnrRef = `RN-${Math.floor(100000 + Math.random() * 900000)}`;

      await tx.query(`
        INSERT INTO bookings (
          id, reference, user_id, journey_type, status, disruption_status, 
          total_amount, hold_expires_at, change_acknowledged, quote_snapshot
        )
        VALUES ($1, $2, $3, $4, 'PENDING_PAYMENT', 'NONE', $5, $6, $7, $8)
      `, [
        bookingId, pnrRef, params.userId, params.journeyType, totalAmount, 
        holdExpiresDate.toISOString(), params.changeAcknowledged, 
        JSON.stringify(legCalculations.map(lc => lc.pricing))
      ]);

      // 8. Create Passengers
      const passengerIds: string[] = [];
      for (let pIdx = 0; pIdx < params.passengers.length; pIdx++) {
        const p = params.passengers[pIdx];
        const paxId = `pax-${bookingId}-${pIdx + 1}`;
        passengerIds.push(paxId);

        await tx.query(`
          INSERT INTO passengers (id, booking_id, full_name, age, gender, berth_preference)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [paxId, bookingId, p.fullName, p.age, p.gender, p.berthPreference || null]);
      }

      // 9. Create Booking Legs and Seat Allocations
      for (const lc of legCalculations) {
        const legId = `leg-${bookingId}-${lc.leg.legOrder}`;
        
        await tx.query(`
          INSERT INTO booking_legs (
            id, booking_id, leg_order, run_id, from_station_code, to_station_code, 
            from_stop_seq, to_stop_seq, departure_time, arrival_time, leg_fare,
            requires_transfer, requires_seat_change
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          legId, bookingId, lc.leg.legOrder, lc.leg.runId, lc.leg.fromStationCode, lc.leg.toStationCode,
          lc.leg.fromStopSeq, lc.leg.toStopSeq, lc.depTime.toISOString(), lc.arrTime.toISOString(),
          lc.legTotal, params.journeyType === 'TWO_TRAIN_CONNECTION', params.journeyType === 'SAME_TRAIN_CHANGE'
        ]);

        // Create Held Allocations
        for (const sa of lc.leg.seatAllocations) {
          const allocId = `sa-${bookingId}-${lc.leg.legOrder}-${sa.passengerIndex}`;
          const paxId = passengerIds[sa.passengerIndex];

          await tx.query(`
            INSERT INTO seat_allocations (
              id, booking_id, leg_id, passenger_id, run_seat_id, 
              from_stop_seq, to_stop_seq, journey_interval, status, expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, int4range($6, $7), 'HELD', $8)
          `, [allocId, bookingId, legId, paxId, sa.seatId, lc.leg.fromStopSeq, lc.leg.toStopSeq, holdExpiresDate.toISOString()]);
        }
      }

      return {
        booking: {
          id: bookingId,
          reference: pnrRef,
          journeyType: params.journeyType,
          status: 'PENDING_PAYMENT',
          totalAmount,
          currency: 'INR',
          holdExpiresAt: holdExpiresDate.toISOString(),
          passengerCount: params.passengers.length
        },
        holdExpiresAt: holdExpiresDate.toISOString()
      };
    });
  }

  /**
   * Release hold manually or upon cancellation
   */
  static async releaseHold(bookingId: string, userId: string): Promise<void> {
    await withTransaction(async (tx) => {
      const bRes = await tx.query('SELECT id, user_id, status FROM bookings WHERE id = $1', [bookingId]);
      if (bRes.rows.length === 0) return;
      if (bRes.rows[0].user_id !== userId) {
        throw { status: 403, code: 'FORBIDDEN', message: 'You do not own this booking.' };
      }
      if (bRes.rows[0].status === 'PENDING_PAYMENT') {
        await tx.query("UPDATE seat_allocations SET status = 'RELEASED' WHERE booking_id = $1", [bookingId]);
        await tx.query("UPDATE bookings SET status = 'EXPIRED' WHERE id = $1", [bookingId]);
      }
    });
  }

  /**
   * Full Itinerary Cancellation with Automated Refund
   */
  static async cancelBooking(bookingId: string, userId: string, isOrganiser = false): Promise<{ refundAmount: number; status: string }> {
    return await withTransaction(async (tx) => {
      const bRes = await tx.query(`
        SELECT b.*, 
          (SELECT MIN(departure_time) FROM booking_legs WHERE booking_id = b.id) as first_dep
        FROM bookings b 
        WHERE b.id = $1
      `, [bookingId]);

      if (bRes.rows.length === 0) {
        throw { status: 404, code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' };
      }

      const booking = bRes.rows[0];

      if (!isOrganiser && booking.user_id !== userId) {
        throw { status: 403, code: 'FORBIDDEN', message: 'Unauthorized booking cancellation.' };
      }

      if (booking.status === 'CANCELLED') {
        // Idempotent return
        return { refundAmount: booking.total_amount, status: 'ALREADY_CANCELLED' };
      }

      if (booking.status !== 'CONFIRMED') {
        throw { status: 400, code: 'CANCELLATION_NOT_ALLOWED', message: `Cannot cancel booking with status ${booking.status}.` };
      }

      // Check departure deadline
      const firstDepTime = new Date(booking.first_dep).getTime();
      if (Date.now() >= firstDepTime && !isOrganiser) {
        throw { status: 400, code: 'CANCELLATION_NOT_ALLOWED', message: 'Cannot cancel after scheduled departure.' };
      }

      // Mark cancelled
      await tx.query(`
        UPDATE bookings 
        SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [bookingId]);

      // Release all allocations
      await tx.query(`
        UPDATE seat_allocations 
        SET status = 'RELEASED' 
        WHERE booking_id = $1
      `, [bookingId]);

      // Create Refund Record
      const refundId = `ref-${bookingId}-${Date.now()}`;
      await tx.query(`
        INSERT INTO refunds (id, booking_id, amount, status, reason)
        VALUES ($1, $2, $3, 'SUCCEEDED', 'Full passenger cancellation before departure (RailNova Demo Policy)')
      `, [refundId, bookingId, booking.total_amount]);

      return { refundAmount: booking.total_amount, status: 'CANCELLED' };
    });
  }

  /**
   * Get Full Booking Details
   */
  static async getBookingDetails(bookingId: string, userId: string, isOrganiser = false): Promise<any> {
    const db = await getDb();
    const bRes = await db.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
    if (bRes.rows.length === 0) {
      throw { status: 404, code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' };
    }
    const b = bRes.rows[0];
    if (!isOrganiser && b.user_id !== userId) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Unauthorized booking access.' };
    }

    const legsRes = await db.query(`
      SELECT bl.*, t.train_number, t.name as train_name,
             s1.name as from_name, s2.name as to_name
      FROM booking_legs bl
      JOIN train_runs tr ON tr.id = bl.run_id
      JOIN trains t ON t.id = tr.train_id
      JOIN stations s1 ON s1.code = bl.from_station_code
      JOIN stations s2 ON s2.code = bl.to_station_code
      WHERE bl.booking_id = $1
      ORDER BY bl.leg_order ASC
    `, [bookingId]);

    const paxRes = await db.query('SELECT * FROM passengers WHERE booking_id = $1', [bookingId]);

    const allocsRes = await db.query(`
      SELECT sa.*, rs.coach_code, rs.coach_type, rs.seat_number, rs.berth_type, p.full_name
      FROM seat_allocations sa
      JOIN run_seats rs ON rs.id = sa.run_seat_id
      JOIN passengers p ON p.id = sa.passenger_id
      WHERE sa.booking_id = $1
    `, [bookingId]);

    const paymentRes = await db.query('SELECT * FROM payment_attempts WHERE booking_id = $1 ORDER BY created_at DESC', [bookingId]);
    const refundRes = await db.query('SELECT * FROM refunds WHERE booking_id = $1', [bookingId]);

    return {
      booking: b,
      legs: legsRes.rows,
      passengers: paxRes.rows,
      allocations: allocsRes.rows,
      payments: paymentRes.rows,
      refunds: refundRes.rows
    };
  }
}
