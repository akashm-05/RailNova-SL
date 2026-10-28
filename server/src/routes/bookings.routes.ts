import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { BookingService } from '../services/booking.service.js';
import { getDb } from '../db/connection.js';

const router = Router();

// GET /api/bookings/me
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const db = await getDb();
    const result = await db.query(`
      SELECT b.*, 
        (SELECT MIN(departure_time) FROM booking_legs WHERE booking_id = b.id) as first_dep,
        (SELECT MAX(arrival_time) FROM booking_legs WHERE booking_id = b.id) as last_arr,
        (SELECT COUNT(*) FROM passengers WHERE booking_id = b.id) as passenger_count,
        (SELECT string_agg(t.name, ' ➔ ') FROM booking_legs bl JOIN train_runs tr ON tr.id = bl.run_id JOIN trains t ON t.id = tr.train_id WHERE bl.booking_id = b.id) as trains_summary
      FROM bookings b
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `, [req.user!.id]);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/:id
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const isOrg = req.user!.role === 'ORGANISER';
    const details = await BookingService.getBookingDetails(req.params.id, req.user!.id, isOrg);
    res.json(details);
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/reference/:reference (Strict ownership protected)
router.get('/reference/:reference', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const db = await getDb();
    const bRes = await db.query('SELECT id FROM bookings WHERE reference = $1', [req.params.reference.toUpperCase().trim()]);
    if (bRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'BOOKING_NOT_FOUND', message: 'Booking reference not found.' } });
    }
    const isOrg = req.user!.role === 'ORGANISER';
    const details = await BookingService.getBookingDetails(bRes.rows[0].id, req.user!.id, isOrg);
    res.json(details);
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings/:id/cancel
router.post('/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const isOrg = req.user!.role === 'ORGANISER';
    const outcome = await BookingService.cancelBooking(req.params.id, req.user!.id, isOrg);
    res.json({
      success: true,
      message: 'Booking successfully cancelled. Full mock refund initiated.',
      ...outcome
    });
  } catch (err) {
    next(err);
  }
});

export default router;
