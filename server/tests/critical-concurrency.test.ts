import { getDb, withTransaction } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { BookingService } from '../src/services/booking.service.js';
import { PaymentService } from '../src/services/payment.service.js';
import { SearchService } from '../src/services/search.service.js';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
    failedCount++;
  }
}

async function runAllTests() {
  console.log(`\n=======================================================`);
  console.log(`🧪 RAILNOVA CRITICAL INTEGRATION & CONCURRENCY TESTS`);
  console.log(`=======================================================\n`);

  await runMigrations();
  await seedDatabase();

  const db = await getDb();

  // Test 1: Search discovery for 3 journey types
  console.log(`\n--- Test Suite 1: Itinerary Discovery (Direct, Seat Change, Connection) ---`);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  const searchResults = await SearchService.searchItineraries({
    origin: 'NDLS',
    destination: 'HWH',
    date: dateStr,
    coachClass: '3A',
    passengerCount: 1,
    preference: 'ALL'
  });

  const hasSeatChange = searchResults.some(r => r.journeyType === 'SAME_TRAIN_CHANGE');
  const hasConnection = searchResults.some(r => r.journeyType === 'TWO_TRAIN_CONNECTION');
  assert(searchResults.length > 0, 'Itinerary search returns viable routes');
  assert(hasSeatChange, 'Discovers same-train seat change itinerary (Scenario 2)');
  assert(hasConnection, 'Discovers 2-train connection with valid layover (Scenario 3)');

  // Test 2: High-Concurrency Race Condition (20 simultaneous competing requests for the same seat)
  console.log(`\n--- Test Suite 2: High Concurrency Double-Booking Prevention ---`);
  await db.query("DELETE FROM bookings WHERE user_id LIKE 'usr-pass-%'");
  const runRes = await db.query("SELECT id FROM train_runs WHERE train_id = 'trn-12301' AND status = 'SCHEDULED' AND run_date > CURRENT_DATE ORDER BY run_date ASC LIMIT 1");
  const runId = runRes.rows[0].id;

  // Pick an available seat
  const seatRes = await db.query(`
    SELECT id FROM run_seats 
    WHERE run_id = $1 AND coach_code = 'S1' AND seat_number = 8
  `, [runId]);
  const targetSeatId = seatRes.rows[0].id;

  // Clean any existing allocations for this test seat
  await db.query('DELETE FROM seat_allocations WHERE run_seat_id = $1', [targetSeatId]);

  console.log(`  ⚡ Firing 20 concurrent booking requests for Seat ID: ${targetSeatId} on segment [0, 4)...`);
  const concurrencyAttempts = Array.from({ length: 20 }, (_, idx) => idx + 1);
  
  const results = await Promise.allSettled(
    concurrencyAttempts.map(userNum =>
      BookingService.createHold({
        userId: 'usr-pass-1',
        journeyType: 'DIRECT',
        changeAcknowledged: false,
        passengers: [{ fullName: `Concurrent User ${userNum}`, age: 25, gender: 'M' }],
        legs: [{
          legOrder: 1,
          runId,
          fromStationCode: 'NDLS',
          toStationCode: 'HWH',
          fromStopSeq: 0,
          toStopSeq: 4,
          seatAllocations: [{ passengerIndex: 0, seatId: targetSeatId }]
        }]
      })
    )
  );

  const succeeded = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  assert(succeeded.length === 1, `Exactly ONE concurrent hold succeeded (Got ${succeeded.length})`);
  assert(rejected.length === 19, `Remaining 19 concurrent requests were safely rejected with conflict (Got ${rejected.length})`);

  // Verify DB state: exactly 1 active allocation in DB
  const dbAllocCheck = await db.query(`
    SELECT COUNT(*) as count FROM seat_allocations 
    WHERE run_seat_id = $1 AND status IN ('HELD', 'CONFIRMED')
  `, [targetSeatId]);
  assert(Number(dbAllocCheck.rows[0].count) === 1, 'Database contains exactly 1 active allocation record for the contested seat');

  // Test 3: Segment Independence (Adjacent Non-Overlapping Bookings)
  console.log(`\n--- Test Suite 3: Segment Independence (Non-Overlapping Seat Reuse) ---`);
  await db.query("DELETE FROM bookings WHERE user_id LIKE 'usr-pass-%'");
  // Pick another test seat
  const seatRes2 = await db.query(`
    SELECT id FROM run_seats 
    WHERE run_id = $1 AND coach_code = 'S1' AND seat_number = 9
  `, [runId]);
  const reuseSeatId = seatRes2.rows[0].id;
  await db.query('DELETE FROM seat_allocations WHERE run_seat_id = $1', [reuseSeatId]);

  // Passenger A books [0, 2) (NDLS -> PRYJ)
  const holdA = await BookingService.createHold({
    userId: 'usr-pass-1',
    journeyType: 'DIRECT',
    changeAcknowledged: false,
    passengers: [{ fullName: 'Passenger A', age: 28, gender: 'F' }],
    legs: [{
      legOrder: 1,
      runId,
      fromStationCode: 'NDLS',
      toStationCode: 'PRYJ',
      fromStopSeq: 0,
      toStopSeq: 2,
      seatAllocations: [{ passengerIndex: 0, seatId: reuseSeatId }]
    }]
  });

  // Passenger B books [2, 4) (PRYJ -> HWH) on the EXACT SAME SEAT
  const holdB = await BookingService.createHold({
    userId: 'usr-pass-2',
    journeyType: 'DIRECT',
    changeAcknowledged: false,
    passengers: [{ fullName: 'Passenger B', age: 32, gender: 'M' }],
    legs: [{
      legOrder: 1,
      runId,
      fromStationCode: 'PRYJ',
      toStationCode: 'HWH',
      fromStopSeq: 2,
      toStopSeq: 4,
      seatAllocations: [{ passengerIndex: 0, seatId: reuseSeatId }]
    }]
  });

  assert(Boolean(holdA.booking.id && holdB.booking.id), 'Both adjacent non-overlapping bookings succeeded on the exact same seat');

  // Passenger C attempts overlapping segment [1, 3) (CNB -> DDU) on the same seat -> MUST FAIL
  let overlapFailed = false;
  try {
    await BookingService.createHold({
      userId: 'usr-pass-4',
      journeyType: 'DIRECT',
      changeAcknowledged: false,
      passengers: [{ fullName: 'Passenger C', age: 40, gender: 'M' }],
      legs: [{
        legOrder: 1,
        runId,
        fromStationCode: 'CNB',
        toStationCode: 'DDU',
        fromStopSeq: 1,
        toStopSeq: 3,
        seatAllocations: [{ passengerIndex: 0, seatId: reuseSeatId }]
      }]
    });
  } catch (err: any) {
    overlapFailed = err.code === 'SEAT_UNAVAILABLE';
  }
  assert(overlapFailed, 'Overlapping segment [1, 3) was correctly rejected by segment interval validation');

  // Test 4: Payment State Machine & Confirmation
  console.log(`\n--- Test Suite 4: Payment Confirmation and State Transitions ---`);
  const paymentOutcome = await PaymentService.processMockPayment({
    bookingId: holdA.booking.id,
    userId: 'usr-pass-1',
    idempotencyKey: `idemp-test-pay-${Date.now()}`,
    scenario: 'SUCCESS'
  });

  assert(paymentOutcome.success === true && paymentOutcome.status === 'CONFIRMED', 'Mock payment successfully confirms booking');

  // Check allocation transitioned to CONFIRMED
  const allocStatus = await db.query('SELECT status FROM seat_allocations WHERE booking_id = $1', [holdA.booking.id]);
  assert(allocStatus.rows[0]?.status === 'CONFIRMED', 'Seat allocation transitioned from HELD to CONFIRMED');

  // Test 5: Cancellation & Automated Refund
  console.log(`\n--- Test Suite 5: Booking Cancellation & Instant Refund ---`);
  const cancelOutcome = await BookingService.cancelBooking(holdA.booking.id, 'usr-pass-1');
  assert(cancelOutcome.status === 'CANCELLED', 'Booking cancellation successfully completed');

  const freedAlloc = await db.query('SELECT status FROM seat_allocations WHERE booking_id = $1', [holdA.booking.id]);
  assert(freedAlloc.rows[0]?.status === 'RELEASED', 'Seat allocations released back to inventory upon cancellation');

  const refundCheck = await db.query('SELECT status, amount FROM refunds WHERE booking_id = $1', [holdA.booking.id]);
  assert(refundCheck.rows.length > 0 && refundCheck.rows[0].status === 'SUCCEEDED', 'Full mock refund record created');

  // Summary
  console.log(`\n=======================================================`);
  console.log(`📊 TEST RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log(`=======================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('[RailNova Test Execution Error]', err);
  process.exit(1);
});
