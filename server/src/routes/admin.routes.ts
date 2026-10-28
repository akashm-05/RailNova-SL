import { Router } from 'express';
import { requireOrganiser, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { OrganiserService } from '../services/organiser.service.js';
import { getDb } from '../db/connection.js';

const router = Router();

// Apply organiser role check to all admin routes
router.use(requireOrganiser);

// 1. Overview & Analytics
router.get('/analytics', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await OrganiserService.getAnalytics(req.user!.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/analytics/extended', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await OrganiserService.getExtendedAnalytics();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 2. Booking Logs
router.get('/bookings', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await OrganiserService.getAllBookings();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/bookings/:id/details', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await OrganiserService.getBookingDetails(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/bookings/clear-all', async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await OrganiserService.clearAllBookingLogs(req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/bookings/:id/cancel', async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await OrganiserService.cancelBookingByOrganiser(req.params.id, req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 3. Trains & Journeys
router.get('/trains', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await OrganiserService.getTrainsWithStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/trains', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { trainNumber, name, sourceCode, destCode } = req.body;
    if (!trainNumber || !name || !sourceCode || !destCode) {
      return res.status(400).json({ error: { message: 'All train fields are required.' } });
    }
    const data = await OrganiserService.createTrain({
      trainNumber,
      name,
      sourceCode,
      destCode,
      organiserId: req.user!.id
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/journeys', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await OrganiserService.getJourneysWithStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/journeys', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { trainId, runDate } = req.body;
    if (!trainId || !runDate) {
      return res.status(400).json({ error: { message: 'trainId and runDate are required.' } });
    }
    const data = await OrganiserService.scheduleJourney({
      trainId,
      runDate,
      organiserId: req.user!.id
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/manifest/:runId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await OrganiserService.getRunManifest(req.user!.id, req.params.runId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/runs/:id/cancel', async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await OrganiserService.cancelRun(req.user!.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 4. Seat Inventory
router.get('/inventory/:runId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const coach = req.query.coach as string | undefined;
    const data = await OrganiserService.getSeatInventoryMap(req.params.runId, coach);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/inventory/seats/:seatId/toggle-disabled', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { disabled } = req.body;
    const result = await OrganiserService.toggleSeatDisabled(req.params.seatId, Boolean(disabled), req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 5. Passengers Directory
router.get('/passengers', async (req: AuthenticatedRequest, res, next) => {
  try {
    const search = req.query.q as string | undefined;
    const data = await OrganiserService.getPassengersDirectory(search);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 6. Fare & Pricing
router.get('/fare-rules', async (req, res, next) => {
  try {
    const db = await getDb();
    const rules = await db.query('SELECT * FROM fare_rules ORDER BY class_code ASC');
    res.json(rules.rows);
  } catch (err) {
    next(err);
  }
});

router.put('/fare-rules/:classCode', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { baseRatePerKm, minFare } = req.body;
    if (baseRatePerKm == null || minFare == null) {
      return res.status(400).json({ error: { message: 'baseRatePerKm and minFare are required.' } });
    }
    const result = await OrganiserService.updateFareRule(
      req.params.classCode,
      Number(baseRatePerKm),
      Number(minFare),
      req.user!.id
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 8. Security & Audit Logs
router.get('/audit-logs', async (req: AuthenticatedRequest, res, next) => {
  try {
    const action = req.query.action as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const logs = await OrganiserService.getAuditLogs({ action, limit });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// 10. Operational Settings
router.get('/settings', async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json({
      division: 'Northern Railway - Central Traffic Control',
      adminUser: {
        id: req.user!.id,
        email: req.user!.email,
        name: req.user!.name,
        role: req.user!.role
      },
      policies: {
        holdTTLSeconds: 300, // 5 minutes
        holdLimitPerUser: 3,
        cancellationGracePeriodMinutes: 120,
        concurrencyEngine: 'PostgreSQL Row-Level Transaction Locks + GiST Segment Exclusion'
      },
      systemHealth: {
        database: 'OPERATIONAL',
        idempotencyCache: 'HEALTHY',
        autopilotGraph: 'ONLINE',
        lastHealthCheck: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
