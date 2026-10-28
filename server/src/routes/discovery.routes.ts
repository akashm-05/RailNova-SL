import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { SearchService } from '../services/search.service.js';

const router = Router();

// GET /api/stations
router.get('/stations', async (req, res, next) => {
  try {
    const db = await getDb();
    const result = await db.query('SELECT id, code, name, city, state FROM stations ORDER BY city ASC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/itineraries/search
router.get('/itineraries/search', async (req, res, next) => {
  try {
    const { origin, destination, date, coachClass, passengerCount, preference } = req.query;

    if (!origin || !destination || !date) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'origin, destination, and date (YYYY-MM-DD) are required.' }
      });
    }

    const results = await SearchService.searchItineraries({
      origin: String(origin),
      destination: String(destination),
      date: String(date),
      coachClass: coachClass ? String(coachClass) : '3A',
      passengerCount: passengerCount ? Number(passengerCount) : 1,
      preference: preference as any
    });

    res.json(results);
  } catch (err) {
    next(err);
  }
});

// GET /api/runs/:id
router.get('/runs/:id', async (req, res, next) => {
  try {
    const db = await getDb();
    const runRes = await db.query(`
      SELECT tr.*, t.train_number, t.name as train_name, t.source_station_code, t.dest_station_code
      FROM train_runs tr
      JOIN trains t ON t.id = tr.train_id
      WHERE tr.id = $1
    `, [req.params.id]);

    if (runRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Train run not found.' } });
    }

    const stopsRes = await db.query(`
      SELECT rs.*, s.code as station_code, s.name as station_name, s.city
      FROM run_stops rs
      JOIN stations s ON s.id = rs.station_id
      WHERE rs.run_id = $1
      ORDER BY rs.stop_sequence ASC
    `, [req.params.id]);

    res.json({
      run: runRes.rows[0],
      stops: stopsRes.rows
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/runs/:id/seats?fromStopSeq=0&toStopSeq=2&class=3A
router.get('/runs/:id/seats', async (req, res, next) => {
  try {
    const { fromStopSeq, toStopSeq, class: coachClass } = req.query;
    const runId = req.params.id;
    const fromSeq = Number(fromStopSeq ?? 0);
    const toSeq = Number(toStopSeq ?? 99);

    const db = await getDb();

    let sql = `
      SELECT 
        rs.id, rs.coach_code, rs.coach_type, rs.seat_number, rs.berth_type, rs.base_fare,
        EXISTS (
          SELECT 1 FROM seat_allocations sa
          WHERE sa.run_seat_id = rs.id 
            AND sa.status = 'CONFIRMED'
            AND sa.from_stop_seq < $3 AND sa.to_stop_seq > $2
        ) as is_confirmed_booked,
        EXISTS (
          SELECT 1 FROM seat_allocations sa
          WHERE sa.run_seat_id = rs.id 
            AND sa.status = 'HELD' 
            AND sa.expires_at > CURRENT_TIMESTAMP
            AND sa.from_stop_seq < $3 AND sa.to_stop_seq > $2
        ) as is_held
      FROM run_seats rs
      WHERE rs.run_id = $1
    `;

    const params: any[] = [runId, fromSeq, toSeq];
    if (coachClass) {
      sql += ' AND rs.coach_type = $4';
      params.push(String(coachClass));
    }
    sql += ' ORDER BY rs.coach_code ASC, rs.seat_number ASC';

    const seatsRes = await db.query(sql, params);

    // Group seats by coach_code for visual UI rendering
    const coachesMap: Record<string, any> = {};
    for (const seat of seatsRes.rows) {
      if (!coachesMap[seat.coach_code]) {
        coachesMap[seat.coach_code] = {
          coachCode: seat.coach_code,
          coachType: seat.coach_type,
          seats: []
        };
      }
      
      let status = 'AVAILABLE';
      if (seat.is_confirmed_booked) {
        status = 'CONFIRMED';
      } else if (seat.is_held) {
        status = 'HELD';
      }

      coachesMap[seat.coach_code].seats.push({
        id: seat.id,
        seatNumber: seat.seat_number,
        berthType: seat.berth_type,
        baseFare: seat.base_fare,
        status
      });
    }

    res.json({
      runId,
      fromStopSeq: fromSeq,
      toStopSeq: toSeq,
      coaches: Object.values(coachesMap)
    });
  } catch (err) {
    next(err);
  }
});

export default router;
