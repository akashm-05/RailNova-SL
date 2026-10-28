import { getDb, withTransaction } from '../db/connection.js';

export class OrganiserService {
  /**
   * Record action into audit_logs table
   */
  static async recordAuditLog(
    actorId: string,
    actorName: string,
    action: string,
    entityType: string,
    entityId: string | null,
    outcome: string,
    metadata: any = {}
  ): Promise<string> {
    const db = await getDb();
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    try {
      await db.query(`
        INSERT INTO audit_logs (id, actor_id, actor_name, action, entity_type, entity_id, outcome, metadata, details, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      `, [
        id,
        actorId,
        actorName || 'Railway Administrator',
        action,
        entityType,
        entityId,
        outcome,
        JSON.stringify(metadata),
        `${action} on ${entityType} ${entityId || ''}`
      ]);
    } catch (err: any) {
      console.error('[OrganiserService] Failed to record audit log:', err.message);
    }
    return id;
  }

  /**
   * Get filtered audit logs
   */
  static async getAuditLogs(filters?: { action?: string; limit?: number }): Promise<any[]> {
    const db = await getDb();
    let query = 'SELECT * FROM audit_logs';
    const params: any[] = [];
    if (filters?.action && filters.action !== 'ALL') {
      params.push(filters.action);
      query += ` WHERE action = $${params.length}`;
    }
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(filters?.limit || 100);

    const res = await db.query(query, params);
    return res.rows.map(row => ({
      ...row,
      formattedDate: new Date(row.created_at).toLocaleString(),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    }));
  }

  /**
   * Get accurate database-derived financial and occupancy metrics across railway division
   */
  static async getAnalytics(organiserId: string): Promise<any> {
    const db = await getDb();

    // 1. Financial collections across railway runs
    const finRes = await db.query(`
      SELECT 
        COALESCE(SUM(bl.leg_fare), 0) as gross_collections,
        COALESCE(COUNT(DISTINCT b.id), 0) as total_bookings,
        COALESCE(COUNT(DISTINCT bl.id), 0) as total_passenger_legs
      FROM booking_legs bl
      JOIN bookings b ON b.id = bl.booking_id AND b.status = 'CONFIRMED'
      JOIN train_runs tr ON tr.id = bl.run_id
      JOIN trains t ON t.id = tr.train_id
    `);

    // 2. Refunds
    const refRes = await db.query(`
      SELECT 
        COALESCE(SUM(r.amount), 0) as completed_refunds
      FROM refunds r
      JOIN bookings b ON b.id = r.booking_id
      WHERE r.status = 'SUCCEEDED'
    `);

    const gross = Number(finRes.rows[0]?.gross_collections || 0);
    const refunds = Number(refRes.rows[0]?.completed_refunds || 0);
    const net = gross - refunds;

    // 3. Active holds vs Confirmed occupancy count
    const statusCounts = await db.query(`
      SELECT 
        sa.status,
        COUNT(*) as count
      FROM seat_allocations sa
      GROUP BY sa.status
    `);

    let activeHoldsCount = 0;
    let confirmedAllocationsCount = 0;
    for (const row of statusCounts.rows) {
      if (row.status === 'HELD') activeHoldsCount = Number(row.count);
      if (row.status === 'CONFIRMED') confirmedAllocationsCount = Number(row.count);
    }

    // 4. Scheduled Runs with segment occupancy heatmap
    const runsRes = await db.query(`
      SELECT 
        tr.id as run_id, tr.run_date, tr.status,
        t.train_number, t.name as train_name,
        (SELECT COUNT(*) FROM run_seats WHERE run_id = tr.id) as total_seats
      FROM train_runs tr
      JOIN trains t ON t.id = tr.train_id
      ORDER BY tr.run_date ASC, t.train_number ASC
      LIMIT 15
    `);

    const runSummaries: any[] = [];
    for (const run of runsRes.rows) {
      // Calculate segment by segment occupancy
      const stops = await db.query(`
        SELECT rs.stop_sequence, rs.arrival_time, rs.departure_time, s.code, s.name
        FROM run_stops rs
        JOIN stations s ON s.id = rs.station_id
        WHERE rs.run_id = $1
        ORDER BY rs.stop_sequence ASC
      `, [run.run_id]);

      const segments: any[] = [];
      const totalSeats = Number(run.total_seats || 1);

      for (let i = 0; i < stops.rows.length - 1; i++) {
        const fromStop = stops.rows[i];
        const toStop = stops.rows[i + 1];

        const occ = await db.query(`
          SELECT COUNT(DISTINCT sa.run_seat_id) as occupied_count
          FROM seat_allocations sa
          WHERE sa.status = 'CONFIRMED'
            AND sa.run_seat_id IN (SELECT id FROM run_seats WHERE run_id = $1)
            AND sa.from_stop_seq <= $2 
            AND sa.to_stop_seq >= $3
        `, [run.run_id, fromStop.stop_sequence, toStop.stop_sequence]);

        const occupied = Number(occ.rows[0]?.occupied_count || 0);
        const percent = Math.round((occupied / totalSeats) * 100);

        segments.push({
          fromCode: fromStop.code,
          fromName: fromStop.name,
          toCode: toStop.code,
          toName: toStop.name,
          occupiedSeats: occupied,
          totalCapacity: totalSeats,
          occupancyPercent: percent
        });
      }

      runSummaries.push({
        ...run,
        segments
      });
    }

    return {
      financialMetrics: {
        grossCollectionsPaise: gross,
        completedRefundsPaise: refunds,
        netCollectionsPaise: net,
        totalCustomerBookings: Number(finRes.rows[0]?.total_bookings || 0),
        totalPassengerLegs: Number(finRes.rows[0]?.total_passenger_legs || 0),
        note: 'Live database metrics derived from active bookings and refund transactions.'
      },
      inventoryMetrics: {
        activeHolds: activeHoldsCount,
        confirmedOccupiedSegments: confirmedAllocationsCount
      },
      runs: runSummaries
    };
  }

  /**
   * Get all customer bookings in real time for Organiser Dashboard
   */
  static async getAllBookings(): Promise<any[]> {
    const db = await getDb();
    const res = await db.query(`
      SELECT 
        b.id,
        b.reference as pnr,
        b.user_id,
        COALESCE(u.name, 'Passenger') as customer_name,
        COALESCE(u.email, 'demo@railnova.demo') as customer_email,
        b.journey_type,
        b.status,
        b.total_amount,
        b.created_at,
        b.disruption_status,
        (SELECT COUNT(*) FROM passengers WHERE booking_id = b.id) as passenger_count,
        (SELECT STRING_AGG(p.full_name, ', ') FROM passengers p WHERE p.booking_id = b.id) as passenger_names,
        (SELECT t.train_number || ' - ' || t.name FROM booking_legs bl JOIN train_runs tr ON tr.id = bl.run_id JOIN trains t ON t.id = tr.train_id WHERE bl.booking_id = b.id ORDER BY bl.leg_order ASC LIMIT 1) as train_name,
        (SELECT bl.from_station_code FROM booking_legs bl WHERE bl.booking_id = b.id ORDER BY bl.leg_order ASC LIMIT 1) as origin_station,
        (SELECT bl.to_station_code FROM booking_legs bl WHERE bl.booking_id = b.id ORDER BY bl.leg_order DESC LIMIT 1) as destination_station
      FROM bookings b
      LEFT JOIN users u ON u.id = b.user_id
      ORDER BY b.created_at DESC
      LIMIT 200
    `);

    return res.rows.map(row => ({
      ...row,
      fareRupees: (Number(row.total_amount || 0) / 100).toFixed(2),
      formattedDate: new Date(row.created_at).toLocaleString()
    }));
  }

  /**
   * Get extended booking details including passengers, legs, payment attempt, refund
   */
  static async getBookingDetails(bookingId: string): Promise<any> {
    const db = await getDb();
    const bRes = await db.query(`
      SELECT b.*, u.name as customer_name, u.email as customer_email
      FROM bookings b
      LEFT JOIN users u ON u.id = b.user_id
      WHERE b.id = $1
    `, [bookingId]);
    if (bRes.rows.length === 0) throw { status: 404, message: 'Booking not found' };

    const booking = bRes.rows[0];

    const passengers = await db.query(`
      SELECT p.*, sa.run_seat_id, sa.status as allocation_status, rs.coach_code, rs.seat_number, rs.berth_type, rs.coach_type
      FROM passengers p
      LEFT JOIN seat_allocations sa ON sa.passenger_id = p.id
      LEFT JOIN run_seats rs ON rs.id = sa.run_seat_id
      WHERE p.booking_id = $1
    `, [bookingId]);

    const legs = await db.query(`
      SELECT bl.*, t.train_number, t.name as train_name
      FROM booking_legs bl
      JOIN train_runs tr ON tr.id = bl.run_id
      JOIN trains t ON t.id = tr.train_id
      WHERE bl.booking_id = $1
      ORDER BY bl.leg_order ASC
    `, [bookingId]);

    const payments = await db.query(`
      SELECT * FROM payment_attempts WHERE booking_id = $1 ORDER BY created_at DESC
    `, [bookingId]);

    const refunds = await db.query(`
      SELECT * FROM refunds WHERE booking_id = $1 ORDER BY created_at DESC
    `, [bookingId]);

    return {
      booking: {
        ...booking,
        fareRupees: (Number(booking.total_amount || 0) / 100).toFixed(2),
        formattedDate: new Date(booking.created_at).toLocaleString()
      },
      passengers: passengers.rows,
      legs: legs.rows,
      payments: payments.rows,
      refunds: refunds.rows
    };
  }

  /**
   * Cancel and refund a customer booking by Organiser
   */
  static async cancelBookingByOrganiser(bookingId: string, actorId: string = 'admin'): Promise<any> {
    return await withTransaction(async (tx) => {
      const bRes = await tx.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
      if (bRes.rows.length === 0) {
        throw { status: 404, code: 'NOT_FOUND', message: 'Booking not found.' };
      }
      const booking = bRes.rows[0];

      await tx.query(`
        UPDATE bookings 
        SET status = 'CANCELLED', disruption_status = 'CANCELLED_BY_ADMIN', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [bookingId]);

      await tx.query("UPDATE seat_allocations SET status = 'RELEASED' WHERE booking_id = $1", [bookingId]);

      if (booking.status === 'CONFIRMED') {
        await tx.query(`
          INSERT INTO refunds (id, booking_id, amount, status, reason)
          VALUES ($1, $2, $3, 'SUCCEEDED', 'Admin Cancellation & Full Refund')
          ON CONFLICT (id) DO NOTHING
        `, [`ref-admin-${bookingId}`, bookingId, booking.total_amount]);
      }

      await OrganiserService.recordAuditLog(
        actorId,
        'Railway Administrator',
        'BOOKING_CANCELLED',
        'BOOKING',
        bookingId,
        'SUCCESS',
        { pnr: booking.reference, amountPaise: booking.total_amount }
      );

      return {
        success: true,
        bookingId,
        message: `Booking ${booking.reference} has been cancelled and refunded.`
      };
    });
  }

  /**
   * Passenger directory
   */
  static async getPassengersDirectory(searchQuery?: string): Promise<any[]> {
    const db = await getDb();
    let sql = `
      SELECT 
        p.full_name,
        p.gender,
        MAX(p.age) as age,
        COUNT(DISTINCT b.id) as booking_count,
        MAX(b.created_at) as last_booking_date,
        STRING_AGG(DISTINCT b.reference, ', ') as pnrs
      FROM passengers p
      JOIN bookings b ON b.id = p.booking_id
    `;
    const params: any[] = [];
    if (searchQuery && searchQuery.trim()) {
      params.push(`%${searchQuery.trim().toLowerCase()}%`);
      sql += ` WHERE LOWER(p.full_name) LIKE $1 OR LOWER(b.reference) LIKE $1`;
    }
    sql += `
      GROUP BY p.full_name, p.gender
      ORDER BY last_booking_date DESC
      LIMIT 100
    `;
    const res = await db.query(sql, params);
    return res.rows.map(row => ({
      ...row,
      formattedLastDate: row.last_booking_date ? new Date(row.last_booking_date).toLocaleDateString() : 'N/A'
    }));
  }

  /**
   * Trains with statistics
   */
  static async getTrainsWithStats(): Promise<any[]> {
    const db = await getDb();
    const res = await db.query(`
      SELECT 
        t.id, t.train_number, t.name, t.source_station_code, t.dest_station_code,
        (SELECT COUNT(*) FROM routes r WHERE r.train_id = t.id) as routes_count,
        (SELECT COUNT(*) FROM train_runs tr WHERE tr.train_id = t.id) as scheduled_runs_count,
        t.created_at
      FROM trains t
      ORDER BY t.train_number ASC
    `);
    return res.rows;
  }

  /**
   * Create a new Train service
   */
  static async createTrain(data: {
    trainNumber: string;
    name: string;
    sourceCode: string;
    destCode: string;
    organiserId: string;
  }): Promise<any> {
    const db = await getDb();
    const id = `train-${Date.now()}`;
    await db.query(`
      INSERT INTO trains (id, organiser_id, train_number, name, source_station_code, dest_station_code)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, data.organiserId, data.trainNumber, data.name, data.sourceCode.toUpperCase(), data.destCode.toUpperCase()]);

    await OrganiserService.recordAuditLog(
      data.organiserId,
      'Railway Administrator',
      'TRAIN_CREATED',
      'TRAIN',
      id,
      'SUCCESS',
      { trainNumber: data.trainNumber, name: data.name }
    );

    return { id, ...data };
  }

  /**
   * Scheduled Journeys (Train Runs) with capacity & status stats
   */
  static async getJourneysWithStats(): Promise<any[]> {
    const db = await getDb();
    const res = await db.query(`
      SELECT 
        tr.id as run_id,
        tr.run_date,
        tr.status,
        t.train_number,
        t.name as train_name,
        t.source_station_code,
        t.dest_station_code,
        (SELECT COUNT(*) FROM run_seats rs WHERE rs.run_id = tr.id) as total_seats,
        (SELECT COUNT(*) FROM run_seats rs WHERE rs.run_id = tr.id AND rs.is_disabled = true) as disabled_seats,
        (SELECT COUNT(DISTINCT sa.run_seat_id) FROM seat_allocations sa WHERE sa.status = 'CONFIRMED' AND sa.run_seat_id IN (SELECT id FROM run_seats WHERE run_id = tr.id)) as booked_seats
      FROM train_runs tr
      JOIN trains t ON t.id = tr.train_id
      ORDER BY tr.run_date DESC, t.train_number ASC
    `);
    return res.rows;
  }

  /**
   * Schedule a new journey / train run
   */
  static async scheduleJourney(data: {
    trainId: string;
    runDate: string;
    organiserId: string;
  }): Promise<any> {
    const db = await getDb();
    const trainRes = await db.query('SELECT * FROM trains WHERE id = $1', [data.trainId]);
    if (trainRes.rows.length === 0) throw { status: 404, message: 'Train not found' };
    const train = trainRes.rows[0];

    // Find default route
    const routeRes = await db.query('SELECT id FROM routes WHERE train_id = $1 LIMIT 1', [data.trainId]);
    const routeId = routeRes.rows[0]?.id || `route-${train.id}`;

    const runId = `run-${train.train_number}-${data.runDate}`;
    await db.query(`
      INSERT INTO train_runs (id, train_id, route_id, run_date, status)
      VALUES ($1, $2, $3, $4, 'SCHEDULED')
      ON CONFLICT (train_id, run_date) DO UPDATE SET status = 'SCHEDULED'
    `, [runId, train.id, routeId, data.runDate]);

    // Copy stops from an existing run of this train if available
    const existingRunStops = await db.query(`
      SELECT rs.* FROM run_stops rs 
      JOIN train_runs tr ON tr.id = rs.run_id
      WHERE tr.train_id = $1 LIMIT 10
    `, [train.id]);

    if (existingRunStops.rows.length > 0) {
      for (const stop of existingRunStops.rows) {
        await db.query(`
          INSERT INTO run_stops (id, run_id, station_id, stop_sequence, arrival_time, departure_time, platform, is_change_permitted, distance_from_origin_km)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (run_id, stop_sequence) DO NOTHING
        `, [
          `stop-${runId}-${stop.stop_sequence}`,
          runId,
          stop.station_id,
          stop.stop_sequence,
          stop.arrival_time,
          stop.departure_time,
          stop.platform,
          stop.is_change_permitted,
          stop.distance_from_origin_km
        ]);
      }
    }

    // Seed realistic coach seats for this new run
    const coaches = [
      { code: 'CC1', type: '3A', count: 20 },
      { code: 'CC2', type: '3A', count: 20 },
      { code: 'SL1', type: 'SL', count: 24 }
    ];
    for (const c of coaches) {
      for (let s = 1; s <= c.count; s++) {
        const berth = s % 3 === 1 ? 'LOWER' : s % 3 === 2 ? 'MIDDLE' : 'UPPER';
        const seatId = `seat-${runId}-${c.code}-${s}`;
        await db.query(`
          INSERT INTO run_seats (id, run_id, coach_code, coach_type, seat_number, berth_type, base_fare, is_disabled)
          VALUES ($1, $2, $3, $4, $5, $6, 85000, false)
          ON CONFLICT (run_id, coach_code, seat_number) DO NOTHING
        `, [seatId, runId, c.code, c.type, s, berth]);
      }
    }

    await OrganiserService.recordAuditLog(
      data.organiserId,
      'Railway Administrator',
      'JOURNEY_SCHEDULED',
      'TRAIN_RUN',
      runId,
      'SUCCESS',
      { trainNumber: train.train_number, runDate: data.runDate }
    );

    return { success: true, runId, trainNumber: train.train_number, runDate: data.runDate };
  }

  /**
   * Interactive Seat Inventory Map
   */
  static async getSeatInventoryMap(runId: string, coachCode?: string): Promise<any> {
    const db = await getDb();
    const runInfo = await db.query(`
      SELECT tr.id, tr.run_date, tr.status, t.train_number, t.name as train_name
      FROM train_runs tr
      JOIN trains t ON t.id = tr.train_id
      WHERE tr.id = $1
    `, [runId]);
    if (runInfo.rows.length === 0) throw { status: 404, message: 'Train run not found' };

    const coachesRes = await db.query(`
      SELECT DISTINCT coach_code, coach_type, COUNT(*) as seat_count
      FROM run_seats
      WHERE run_id = $1
      GROUP BY coach_code, coach_type
      ORDER BY coach_code ASC
    `, [runId]);

    const activeCoach = coachCode || (coachesRes.rows[0]?.coach_code || 'CC1');

    const seatsRes = await db.query(`
      SELECT 
        rs.id, rs.coach_code, rs.coach_type, rs.seat_number, rs.berth_type, rs.base_fare,
        COALESCE(rs.is_disabled, false) as is_disabled,
        (
          SELECT json_build_object(
            'status', sa.status,
            'pnr', b.reference,
            'passenger_name', p.full_name,
            'from_station', bl.from_station_code,
            'to_station', bl.to_station_code,
            'expires_at', sa.expires_at
          )
          FROM seat_allocations sa
          JOIN bookings b ON b.id = sa.booking_id
          JOIN passengers p ON p.id = sa.passenger_id
          JOIN booking_legs bl ON bl.id = sa.leg_id
          WHERE sa.run_seat_id = rs.id AND sa.status IN ('CONFIRMED', 'HELD')
          LIMIT 1
        ) as allocation
      FROM run_seats rs
      WHERE rs.run_id = $1 AND rs.coach_code = $2
      ORDER BY rs.seat_number ASC
    `, [runId, activeCoach]);

    return {
      run: runInfo.rows[0],
      coaches: coachesRes.rows,
      activeCoach,
      seats: seatsRes.rows.map(s => {
        let state = 'AVAILABLE';
        if (s.is_disabled) {
          state = 'DISABLED';
        } else if (s.allocation) {
          state = s.allocation.status === 'CONFIRMED' ? 'CONFIRMED' : 'HELD';
        }
        return {
          ...s,
          state,
          fareRupees: (Number(s.base_fare || 0) / 100).toFixed(2)
        };
      })
    };
  }

  /**
   * Toggle seat disabled (for maintenance/inspection)
   */
  static async toggleSeatDisabled(seatId: string, disabled: boolean, actorId: string = 'admin'): Promise<any> {
    const db = await getDb();
    await db.query(`
      UPDATE run_seats
      SET is_disabled = $2
      WHERE id = $1
    `, [seatId, disabled]);

    await OrganiserService.recordAuditLog(
      actorId,
      'Railway Administrator',
      'SEAT_MAINTENANCE',
      'RUN_SEAT',
      seatId,
      'SUCCESS',
      { is_disabled: disabled }
    );

    return { success: true, seatId, disabled };
  }

  /**
   * Update fare rules
   */
  static async updateFareRule(
    classCode: string,
    baseRatePerKm: number,
    minFare: number,
    actorId: string = 'admin'
  ): Promise<any> {
    const db = await getDb();
    await db.query(`
      UPDATE fare_rules
      SET base_rate_per_km = $2, min_fare = $3
      WHERE class_code = $1
    `, [classCode, baseRatePerKm, minFare]);

    await OrganiserService.recordAuditLog(
      actorId,
      'Railway Administrator',
      'FARE_UPDATED',
      'FARE_RULE',
      classCode,
      'SUCCESS',
      { baseRatePerKm, minFare }
    );

    return { success: true, classCode, baseRatePerKm, minFare };
  }

  /**
   * Extended analytics & report metrics
   */
  static async getExtendedAnalytics(): Promise<any> {
    const db = await getDb();

    // Payment stats
    const paymentStats = await db.query(`
      SELECT status, COUNT(*) as count
      FROM payment_attempts
      GROUP BY status
    `);

    // Booking cancellation stats
    const cancelStats = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_bookings,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED') as confirmed_bookings,
        COUNT(*) FILTER (WHERE status = 'PENDING_PAYMENT') as pending_bookings,
        COUNT(*) as total_bookings
      FROM bookings
    `);

    // Class wise occupancy
    const classOccupancy = await db.query(`
      SELECT 
        rs.coach_type,
        COUNT(DISTINCT rs.id) as total_seats,
        COUNT(DISTINCT sa.id) as confirmed_count
      FROM run_seats rs
      LEFT JOIN seat_allocations sa ON sa.run_seat_id = rs.id AND sa.status = 'CONFIRMED'
      GROUP BY rs.coach_type
      ORDER BY rs.coach_type ASC
    `);

    return {
      payments: paymentStats.rows,
      bookingCounts: cancelStats.rows[0] || {
        cancelled_bookings: 0,
        confirmed_bookings: 0,
        pending_bookings: 0,
        total_bookings: 0
      },
      classOccupancy: classOccupancy.rows.map(r => ({
        ...r,
        occupancyPercent: Number(r.total_seats) > 0 ? Math.round((Number(r.confirmed_count) / Number(r.total_seats)) * 100) : 0
      }))
    };
  }

  /**
   * Get Passenger Manifest for a specific train run
   */
  static async getRunManifest(organiserId: string, runId: string): Promise<any> {
    const db = await getDb();
    
    const ownerRes = await db.query(`
      SELECT tr.id, t.train_number, t.name as train_name, tr.run_date, tr.status
      FROM train_runs tr
      JOIN trains t ON t.id = tr.train_id
      WHERE tr.id = $1
    `, [runId]);

    if (ownerRes.rows.length === 0) {
      throw { status: 404, code: 'NOT_FOUND', message: 'Train run not found.' };
    }

    const manifestRes = await db.query(`
      SELECT 
        b.reference as pnr,
        p.full_name as passenger_name,
        p.age,
        p.gender,
        rs.coach_code,
        rs.coach_type,
        rs.seat_number,
        rs.berth_type,
        sa.from_stop_seq,
        sa.to_stop_seq,
        sa.status as allocation_status,
        bl.from_station_code,
        bl.to_station_code
      FROM seat_allocations sa
      JOIN run_seats rs ON rs.id = sa.run_seat_id
      JOIN passengers p ON p.id = sa.passenger_id
      JOIN bookings b ON b.id = sa.booking_id
      JOIN booking_legs bl ON bl.id = sa.leg_id
      WHERE rs.run_id = $1 AND sa.status = 'CONFIRMED'
      ORDER BY rs.coach_code, rs.seat_number ASC
    `, [runId]);

    return {
      run: ownerRes.rows[0],
      passengersCount: manifestRes.rows.length,
      manifest: manifestRes.rows
    };
  }

  /**
   * Cancel an entire Train Run (Disruption scenario 10)
   */
  static async cancelRun(organiserId: string, runId: string): Promise<any> {
    return await withTransaction(async (tx) => {
      const ownerRes = await tx.query(`
        SELECT tr.id, t.train_number, t.name as train_name
        FROM train_runs tr
        JOIN trains t ON t.id = tr.train_id
        WHERE tr.id = $1
      `, [runId]);

      if (ownerRes.rows.length === 0) {
        throw { status: 404, code: 'NOT_FOUND', message: 'Train run not found.' };
      }

      await tx.query("UPDATE train_runs SET status = 'CANCELLED' WHERE id = $1", [runId]);

      const affectedBookings = await tx.query(`
        SELECT DISTINCT booking_id FROM booking_legs WHERE run_id = $1
      `, [runId]);

      let cancelledCount = 0;
      for (const bRow of affectedBookings.rows) {
        await tx.query(`
          UPDATE bookings 
          SET status = 'CANCELLED', disruption_status = 'DISRUPTED', updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND status IN ('CONFIRMED', 'PENDING_PAYMENT')
        `, [bRow.booking_id]);

        await tx.query(`
          UPDATE seat_allocations SET status = 'RELEASED' WHERE booking_id = $1
        `, [bRow.booking_id]);

        const b = await tx.query('SELECT total_amount FROM bookings WHERE id = $1', [bRow.booking_id]);
        if (b.rows[0]) {
          await tx.query(`
            INSERT INTO refunds (id, booking_id, amount, status, reason)
            VALUES ($1, $2, $3, 'SUCCEEDED', 'Train Run Cancelled by Railway Administration (Full Refund)')
            ON CONFLICT (id) DO NOTHING
          `, [`ref-disrupt-${bRow.booking_id}`, bRow.booking_id, b.rows[0].total_amount]);
        }
        cancelledCount++;
      }

      await OrganiserService.recordAuditLog(
        organiserId,
        'Railway Administrator',
        'RUN_CANCELLED',
        'TRAIN_RUN',
        runId,
        'SUCCESS',
        { trainNumber: ownerRes.rows[0].train_number, affectedBookingsCount: cancelledCount }
      );

      return {
        success: true,
        runId,
        status: 'CANCELLED',
        affectedBookingsCount: cancelledCount,
        message: `Train run cancelled. ${cancelledCount} affected customer bookings were automatically cancelled and refunded.`
      };
    });
  }

  /**
   * Clears all booking records, allocations, and mock refunds to reset registry to a fresh state.
   */
  static async clearAllBookingLogs(actorId: string = 'admin'): Promise<any> {
    return await withTransaction(async (tx) => {
      await tx.query('DELETE FROM refunds');
      await tx.query('DELETE FROM payment_attempts');
      await tx.query('DELETE FROM seat_allocations');
      await tx.query('DELETE FROM passengers');
      await tx.query('DELETE FROM booking_legs');
      await tx.query('DELETE FROM bookings');
      await tx.query('DELETE FROM audit_logs');

      await OrganiserService.recordAuditLog(
        actorId,
        'Railway Administrator',
        'LOGS_CLEARED',
        'SYSTEM',
        'REGISTRY_RESET',
        'SUCCESS',
        { 
          note: 'All prior booking records and previous logs cleared. Fresh tracking active from now on.',
          startedAt: new Date().toISOString()
        }
      );

      return {
        success: true,
        message: 'All booking history and previous logs have been cleared. Fresh tracking is now active from this moment on.'
      };
    });
  }
}

