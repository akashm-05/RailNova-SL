import { AutopilotService } from '../src/services/autopilot.service.js';
import { RiskService } from '../src/services/risk.service.js';
import { SimulatorService } from '../src/services/simulator.service.js';
import { RaceReplayService } from '../src/services/race-replay.service.js';
import { AssistantService } from '../src/services/assistant.service.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runUpgradesTest() {
  console.log('\n=======================================================');
  console.log('🧪 RAILNOVA 5-FEATURE EXTENSION VERIFICATION SUITE');
  console.log('=======================================================\n');

  await runMigrations();
  await seedDatabase();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  // --- 1. Autopilot Graph Search & Multi-Objective Ranking ---
  console.log('--- 1. Testing Journey Autopilot ---');
  const autopilotRes = await AutopilotService.planJourney({
    origin: 'NDLS',
    destination: 'HWH',
    date: dateStr,
    coachClass: '3A',
    passengerCount: 1,
    maxTransfers: 2,
    minConnectionMinutes: 30,
    objectiveWeight: 'BALANCED'
  });

  assert(autopilotRes.itineraries.length > 0, 'Autopilot finds valid routes across timetable graph');
  assert(autopilotRes.itineraries[0].rankingScore > 0, 'Itineraries contain computed multi-objective ranking scores');
  assert(Boolean(autopilotRes.itineraries[0].rankingExplanation), 'Ranked itineraries provide transparent explanation');

  // Test constraints filtering: Max Transfers = 0 (Direct only)
  const directOnlyRes = await AutopilotService.planJourney({
    origin: 'NDLS',
    destination: 'HWH',
    date: dateStr,
    coachClass: 'SL',
    maxTransfers: 0
  });
  assert(directOnlyRes.itineraries.every(it => it.transfersCount === 0), 'Autopilot strictly obeys maxTransfers = 0 constraint');

  // --- 2. Connection Risk Engine ---
  console.log('\n--- 2. Testing Connection Risk Engine ---');
  const safeRisk = RiskService.assessConnectionRisk({
    scheduledArrival: new Date('2026-10-29T12:00:00Z'),
    scheduledDeparture: new Date('2026-10-29T13:30:00Z'), // 90 min buffer
    transferStationName: 'PRYJ',
    isSameTrain: false
  });
  assert(safeRisk.level === 'SAFE' && safeRisk.isFeasible, '90-minute buffer is assessed as SAFE and feasible');

  const tightRisk = RiskService.assessConnectionRisk({
    scheduledArrival: new Date('2026-10-29T12:00:00Z'),
    scheduledDeparture: new Date('2026-10-29T12:20:00Z'), // 20 min buffer
    transferStationName: 'PRYJ',
    isSameTrain: false
  });
  assert(tightRisk.score >= 70 && tightRisk.level === 'HIGH', '20-minute buffer correctly triggers HIGH risk score');

  // --- 3. What-If Journey Simulator ---
  console.log('\n--- 3. Testing What-If Simulator ---');
  SimulatorService.resetSimulation();
  
  // Inject 45 min delay on Train 12301
  const run1Id = `run-12301-${dateStr}`;
  SimulatorService.setTrainDelay(run1Id, 45);

  const delayedState = SimulatorService.getSimulationState();
  assert(delayedState.delays[run1Id] === 45, 'Simulator accurately tracks injected train delays');

  // Autopilot evaluation under simulated delay
  const simAutopilot = await AutopilotService.planJourney({
    origin: 'NDLS',
    destination: 'HWH',
    date: dateStr,
    coachClass: '3A',
    useSimulation: true
  });
  assert(simAutopilot.activeSimulationApplied === true, 'Autopilot incorporates active simulation state');

  SimulatorService.resetSimulation();
  assert(Object.keys(SimulatorService.getSimulationState().delays).length === 0, 'Simulator reset cleanly restores baseline operational state');

  // --- 4. Booking Race Replay (Real PostgreSQL Concurrency) ---
  console.log('\n--- 4. Testing Booking Race Replay (Live Concurrency) ---');
  const raceReport = await RaceReplayService.executeLiveRace(3);
  assert(raceReport.contenders.length === 3, 'Race Replay fired 3 simultaneous contender requests');
  assert(raceReport.databaseVerification.doubleBookingPrevented === true, 'Race Replay verified exactly 1 allocation created in PostgreSQL');
  assert(raceReport.databaseVerification.totalAllocationsInDatabase === 1, 'Physical database contains exactly 1 active allocation');

  // --- 5. Explainable Travel Assistant (NLP Parser) ---
  console.log('\n--- 5. Testing Explainable Travel Assistant ---');
  const query = 'Find the cheapest route from Delhi to Howrah arriving before 10 PM with no more than 1 transfer';
  const assistantRes = await AssistantService.processRequest(query);

  assert(assistantRes.parsedConstraints.origin === 'NDLS', 'NLP parser correctly mapped Delhi to NDLS');
  assert(assistantRes.parsedConstraints.destination === 'HWH', 'NLP parser correctly mapped Howrah to HWH');
  assert(assistantRes.parsedConstraints.maxTransfers === 1, 'NLP parser extracted maxTransfers = 1');
  assert(assistantRes.parsedConstraints.objectiveWeight === 'CHEAPEST', 'NLP parser extracted CHEAPEST goal');
  assert(assistantRes.explainabilitySteps.length >= 4, 'Assistant provided step-by-step explainability trace');
  assert(assistantRes.recommendedItineraries.length > 0, 'Assistant returned verified bookable itineraries');

  console.log(`\n=======================================================`);
  console.log(`📊 UPGRADES TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=======================================================\n`);

  if (failed > 0) process.exit(1);
}

runUpgradesTest().catch(err => {
  console.error('Upgrade test fatal error:', err);
  process.exit(1);
});
