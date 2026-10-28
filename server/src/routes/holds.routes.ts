import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { BookingService } from '../services/booking.service.js';

const router = Router();

// POST /api/holds - Atomically creates pending booking and holds all seats
router.post('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { journeyType, changeAcknowledged, passengers, legs } = req.body;
    const userId = req.user!.id;

    const result = await BookingService.createHold({
      userId,
      journeyType,
      changeAcknowledged: Boolean(changeAcknowledged),
      passengers,
      legs
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/holds/:id
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await BookingService.getBookingDetails(req.params.id, req.user!.id, req.user!.role === 'ORGANISER');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/holds/:id
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    await BookingService.releaseHold(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Hold successfully released.' });
  } catch (err) {
    next(err);
  }
});

export default router;
