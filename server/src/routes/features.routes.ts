import { Router } from 'express';
import { AutopilotService } from '../services/autopilot.service.js';
import { RiskService } from '../services/risk.service.js';
import { SimulatorService } from '../services/simulator.service.js';
import { RaceReplayService } from '../services/race-replay.service.js';
import { AssistantService } from '../services/assistant.service.js';
import { requireAuth, requireOrganiser, AuthenticatedRequest } from '../middleware/auth.middleware.js';

const router = Router();

// --- 1. Journey Autopilot ---
router.post('/autopilot/plan', async (req, res, next) => {
  try {
    const result = await AutopilotService.planJourney(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// --- 2. Connection Risk Engine ---
router.post('/risk/assess', async (req, res, next) => {
  try {
    const {
      scheduledArrival,
      scheduledDeparture,
      arrivalTrainDelayMinutes,
      departureTrainDelayMinutes,
      isArrivalCancelled,
      isDepartureCancelled,
      transferStationName,
      isSameTrain
    } = req.body;

    const report = RiskService.assessConnectionRisk({
      scheduledArrival: new Date(scheduledArrival),
      scheduledDeparture: new Date(scheduledDeparture),
      arrivalTrainDelayMinutes: Number(arrivalTrainDelayMinutes || 0),
      departureTrainDelayMinutes: Number(departureTrainDelayMinutes || 0),
      isArrivalCancelled: Boolean(isArrivalCancelled),
      isDepartureCancelled: Boolean(isDepartureCancelled),
      transferStationName: transferStationName || 'Transfer Station',
      isSameTrain: Boolean(isSameTrain)
    });

    res.json(report);
  } catch (err) {
    next(err);
  }
});

// --- 3. What-If Journey Simulator ---
router.get('/simulator/state', (req, res) => {
  res.json(SimulatorService.getSimulationState());
});

router.post('/simulator/delay', (req, res) => {
  const { runId, delayMinutes } = req.body;
  if (!runId) return res.status(400).json({ error: { message: 'runId is required.' } });
  const state = SimulatorService.setTrainDelay(runId, Number(delayMinutes || 0));
  res.json({ success: true, state });
});

router.post('/simulator/cancel', (req, res) => {
  const { runId, cancelled } = req.body;
  if (!runId) return res.status(400).json({ error: { message: 'runId is required.' } });
  const state = SimulatorService.setTrainCancelled(runId, Boolean(cancelled));
  res.json({ success: true, state });
});

router.post('/simulator/block-seat', (req, res) => {
  const { seatId, blocked } = req.body;
  if (!seatId) return res.status(400).json({ error: { message: 'seatId is required.' } });
  const state = SimulatorService.setSeatBlocked(seatId, Boolean(blocked));
  res.json({ success: true, state });
});

router.post('/simulator/surge', (req, res) => {
  const { multiplier } = req.body;
  const state = SimulatorService.setDemandMultiplier(Number(multiplier || 1.0));
  res.json({ success: true, state });
});

router.post('/simulator/reset', (req, res) => {
  const state = SimulatorService.resetSimulation();
  res.json({ success: true, message: 'Simulation restored to baseline operational scenario.', state });
});

// --- 4. Booking Race Replay (Visual Concurrency Demo) ---
router.post('/concurrency/race-replay', async (req, res, next) => {
  try {
    const { contendersCount } = req.body;
    const report = await RaceReplayService.executeLiveRace(Number(contendersCount || 3));
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// --- 5. Explainable Travel Assistant ---
router.post('/assistant/ask', async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: { message: 'query string is required.' } });
    }
    const result = await AssistantService.processRequest(String(query));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
