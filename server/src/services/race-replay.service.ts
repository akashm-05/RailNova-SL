import { getDb } from '../db/connection.js';
import { BookingService } from './booking.service.js';

export interface RaceContenderResult {
  contenderId: string;
  contenderName: string;
  avatarColor: string;
  requestedAt: string;
  completedAt: string;
  durationMs: number;
  statusCode: number;
  outcome: 'WON_HOLD' | 'REJECTED_CONFLICT';
  pnrReference?: string;
  errorMessage?: string;
  seatId: string;
  berthLabel: string;
}

export interface RaceReplayReport {
  timestamp: string;
  targetSeatId: string;
  coachCode: string;
  seatNumber: number;
  berthType: string;
  runId: string;
  contendersCount: number;
  winnerContenderId: string;
  contenders: RaceContenderResult[];
  databaseVerification: {
    totalAllocationsInDatabase: number;
    doubleBookingPrevented: boolean;
    activeAllocationId: string;
    allocatedToUser: string;
  };
  technicalDeepDive: {
    acidIsolation: string;
    lockMechanism: string;
    exclusionConstraintRule: string;
    sqlStatementSnippet: string;
  };
}

export class RaceReplayService {
  static async executeLiveRace(contendersCount = 3): Promise<RaceReplayReport> {
    const db = await getDb();
    const count = Math.max(2, Math.min(5, contendersCount));

    // 1. Pick an available seat on an upcoming scheduled run
    const seatRes = await db.query(`
      SELECT rs.id, rs.run_id, rs.coach_code, rs.seat_number, rs.berth_type, tr.run_date
      FROM run_seats rs
      JOIN train_runs tr ON tr.id = rs.run_id AND tr.status = 'SCHEDULED' AND tr.run_date > CURRENT_DATE
      WHERE rs.coach_code = 'S1' 
        AND rs.seat_number BETWEEN 10 AND 20
        AND rs.id NOT IN (
          SELECT run_seat_id FROM seat_allocations 
          WHERE status IN ('HELD', 'CONFIRMED')
        )
      ORDER BY tr.run_date ASC
      LIMIT 1
    `);

    let targetSeat = seatRes.rows[0];
    if (!targetSeat) {
      // Pick any upcoming run seat and clean its allocations
      const fallback = await db.query(`
        SELECT rs.id, rs.run_id, rs.coach_code, rs.seat_number, rs.berth_type 
        FROM run_seats rs
        JOIN train_runs tr ON tr.id = rs.run_id AND tr.status = 'SCHEDULED' AND tr.run_date > CURRENT_DATE
        WHERE rs.coach_code = 'S1' 
        ORDER BY tr.run_date ASC
        LIMIT 1
      `);
      targetSeat = fallback.rows[0];
      await db.query("DELETE FROM seat_allocations WHERE run_seat_id = $1", [targetSeat.id]);
    }

    const targetSeatId = targetSeat.id;
    const runId = targetSeat.run_id;
    const berthLabel = `${targetSeat.coach_code}-${targetSeat.seat_number} (${targetSeat.berth_type})`;

    // Pre-clean previous allocations for this seat to ensure fair race
    await db.query("DELETE FROM seat_allocations WHERE run_seat_id = $1", [targetSeatId]);

    // 2. Setup Contender Profiles
    const contenderProfiles = [
      { id: 'contender-1', name: 'Aarav (Delhi Client)', color: '#2563eb' },
      { id: 'contender-2', name: 'Priya (Mumbai Client)', color: '#d97706' },
      { id: 'contender-3', name: 'Vikram (Bangalore Client)', color: '#7c3aed' },
      { id: 'contender-4', name: 'Ananya (Kolkata Client)', color: '#0d9488' },
      { id: 'contender-5', name: 'Rohan (Chennai Client)', color: '#e11d48' },
    ].slice(0, count);

    // Ensure contender user accounts exist in users table for FK integrity
    for (let i = 0; i < count; i++) {
      const uId = `usr-race-${i + 1}`;
      await db.query(`
        INSERT INTO users (id, email, password_hash, name, role)
        VALUES ($1, $2, 'mockpass', $3, 'PASSENGER')
        ON CONFLICT (id) DO UPDATE SET name = $3
      `, [uId, `race${i + 1}@railnova.demo`, contenderProfiles[i].name]);
      await db.query("DELETE FROM bookings WHERE user_id = $1", [uId]);
    }

    // 3. Fire parallel simultaneous booking requests using Promise.all
    console.log(`[RaceReplay] Starting concurrency race with ${count} simultaneous claims on ${berthLabel}...`);

    const contendersPromises = contenderProfiles.map(async (profile, idx) => {
      const startIso = new Date().toISOString();
      const t0 = performance.now();
      const tempUserId = `usr-race-${idx + 1}`;

      try {
        const holdRes = await BookingService.createHold({
          userId: tempUserId,
          journeyType: 'DIRECT',
          changeAcknowledged: false,
          passengers: [{ fullName: profile.name, age: 26 + idx, gender: 'M' }],
          legs: [{
            legOrder: 1,
            runId,
            fromStationCode: 'NDLS',
            toStationCode: 'HWH',
            fromStopSeq: 0,
            toStopSeq: 4,
            seatAllocations: [{ passengerIndex: 0, seatId: targetSeatId }]
          }]
        });

        const t1 = performance.now();
        return {
          contenderId: profile.id,
          contenderName: profile.name,
          avatarColor: profile.color,
          requestedAt: startIso,
          completedAt: new Date().toISOString(),
          durationMs: Math.round(t1 - t0),
          statusCode: 201,
          outcome: 'WON_HOLD' as const,
          pnrReference: holdRes.booking.reference,
          seatId: targetSeatId,
          berthLabel
        };
      } catch (err: any) {
        const t1 = performance.now();
        return {
          contenderId: profile.id,
          contenderName: profile.name,
          avatarColor: profile.color,
          requestedAt: startIso,
          completedAt: new Date().toISOString(),
          durationMs: Math.round(t1 - t0),
          statusCode: err.status || 409,
          outcome: 'REJECTED_CONFLICT' as const,
          errorMessage: err.message || 'Seat unavailable (Conflict detected).',
          seatId: targetSeatId,
          berthLabel
        };
      }
    });

    const results = await Promise.all(contendersPromises);

    // 4. Inspect Database Verification
    const allocCheck = await db.query(`
      SELECT sa.id, sa.booking_id, b.user_id, sa.status, sa.journey_interval
      FROM seat_allocations sa
      JOIN bookings b ON b.id = sa.booking_id
      WHERE sa.run_seat_id = $1 AND sa.status IN ('HELD', 'CONFIRMED')
    `, [targetSeatId]);

    const winner = results.find(r => r.outcome === 'WON_HOLD') || results[0];

    return {
      timestamp: new Date().toISOString(),
      targetSeatId,
      coachCode: targetSeat.coach_code,
      seatNumber: targetSeat.seat_number,
      berthType: targetSeat.berth_type,
      runId,
      contendersCount: count,
      winnerContenderId: winner.contenderId,
      contenders: results,
      databaseVerification: {
        totalAllocationsInDatabase: allocCheck.rows.length,
        doubleBookingPrevented: allocCheck.rows.length === 1,
        activeAllocationId: allocCheck.rows[0]?.id || 'none',
        allocatedToUser: winner.contenderName
      },
      technicalDeepDive: {
        acidIsolation: 'READ COMMITTED with deterministic SELECT ... FOR UPDATE row-level locking',
        lockMechanism: 'Ordered Run & Seat Locks: All competing transactions acquire locks on run_seats in identical deterministic sequence, eliminating deadlock and serializing conflicting claims.',
        exclusionConstraintRule: 'int4range(from_seq, to_seq) overlap check ensures: existing.from < requested.to AND requested.from < existing.to',
        sqlStatementSnippet: `SELECT id FROM seat_allocations WHERE run_seat_id = $1 AND status IN ('HELD', 'CONFIRMED') AND (from_stop_seq < $3 AND to_stop_seq > $2) FOR UPDATE;`
      }
    };
  }
}
