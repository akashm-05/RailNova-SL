import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { PaymentService } from '../services/payment.service.js';
import { getDb } from '../db/connection.js';

const router = Router();

// POST /api/payments/mock
router.post('/mock', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { bookingId, idempotencyKey, scenario, paymentMethod } = req.body;

    if (!bookingId || !idempotencyKey) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'bookingId and idempotencyKey are required.' }
      });
    }

    const result = await PaymentService.processMockPayment({
      bookingId,
      userId: req.user!.id,
      idempotencyKey,
      scenario: scenario || 'SUCCESS',
      paymentMethod
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/:id
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const db = await getDb();
    const resPay = await db.query(`
      SELECT pa.* 
      FROM payment_attempts pa
      JOIN bookings b ON b.id = pa.booking_id
      WHERE pa.id = $1 AND (b.user_id = $2 OR $3 = 'ORGANISER')
    `, [req.params.id, req.user!.id, req.user!.role]);

    if (resPay.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Payment attempt not found.' } });
    }

    res.json(resPay.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
