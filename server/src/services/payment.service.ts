import { withTransaction, getDb } from '../db/connection.js';

export interface ProcessPaymentParams {
  bookingId: string;
  userId: string;
  idempotencyKey: string;
  scenario: 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'DELAYED_SUCCESS';
  paymentMethod?: string;
}

export class PaymentService {
  static async processMockPayment(params: ProcessPaymentParams): Promise<any> {
    const { bookingId, userId, idempotencyKey, scenario } = params;

    return await withTransaction(async (tx) => {
      // 1. Check idempotency record
      const idempRes = await tx.query(`
        SELECT response_payload FROM idempotency_records 
        WHERE idempotency_key = $1
      `, [idempotencyKey]);

      if (idempRes.rows.length > 0) {
        return JSON.parse(idempRes.rows[0].response_payload);
      }

      // 2. Lock and retrieve booking
      const bRes = await tx.query(`
        SELECT * FROM bookings WHERE id = $1
      `, [bookingId]);

      if (bRes.rows.length === 0) {
        throw { status: 404, code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' };
      }

      const booking = bRes.rows[0];

      if (booking.user_id !== userId) {
        throw { status: 403, code: 'FORBIDDEN', message: 'Unauthorized payment attempt.' };
      }

      // Record payment attempt
      const attemptId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const gatewayRef = `MOCK-GATEWAY-TX-${Math.floor(1000000 + Math.random() * 9000000)}`;

      // Scenario: TIMEOUT
      if (scenario === 'TIMEOUT') {
        await tx.query(`
          INSERT INTO payment_attempts (id, booking_id, idempotency_key, amount, status, scenario, gateway_ref, error_message)
          VALUES ($1, $2, $3, $4, 'PROCESSING', $5, $6, 'Simulated gateway network timeout')
        `, [attemptId, bookingId, idempotencyKey, booking.total_amount, scenario, gatewayRef]);

        const timeoutResponse = {
          success: false,
          status: 'PAYMENT_PENDING',
          message: 'Payment request timed out with bank. The transaction is processing. Please check status.',
          paymentAttemptId: attemptId,
          gatewayRef
        };

        await tx.query(`
          INSERT INTO idempotency_records (id, idempotency_key, user_id, operation_type, request_fingerprint, response_payload, status)
          VALUES ($1, $2, $3, 'PAYMENT', $4, $5, 'PROCESSING')
        `, [`idemp-${Date.now()}`, idempotencyKey, userId, bookingId, JSON.stringify(timeoutResponse)]);

        return timeoutResponse;
      }

      // Scenario: FAILURE
      if (scenario === 'FAILURE') {
        await tx.query(`
          INSERT INTO payment_attempts (id, booking_id, idempotency_key, amount, status, scenario, gateway_ref, error_message)
          VALUES ($1, $2, $3, $4, 'FAILED', $5, $6, 'Simulated card declined or insufficient funds')
        `, [attemptId, bookingId, idempotencyKey, booking.total_amount, scenario, gatewayRef]);

        // Mark booking failed and release seats immediately
        await tx.query(`
          UPDATE bookings SET status = 'PAYMENT_FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = $1
        `, [bookingId]);

        await tx.query(`
          UPDATE seat_allocations SET status = 'RELEASED' WHERE booking_id = $1
        `, [bookingId]);

        const failResponse = {
          success: false,
          status: 'PAYMENT_FAILED',
          message: 'Simulated payment failed (Card declined / Insufficient funds). Seats have been released.',
          paymentAttemptId: attemptId,
          gatewayRef
        };

        await tx.query(`
          INSERT INTO idempotency_records (id, idempotency_key, user_id, operation_type, request_fingerprint, response_payload, status)
          VALUES ($1, $2, $3, 'PAYMENT', $4, $5, 'FAILED')
        `, [`idemp-${Date.now()}`, idempotencyKey, userId, bookingId, JSON.stringify(failResponse)]);

        return failResponse;
      }

      // Late payment after expiry or cancellation
      const now = new Date();
      const isExpired = booking.status === 'EXPIRED' || (booking.hold_expires_at && new Date(booking.hold_expires_at) < now);

      if (isExpired || booking.status === 'CANCELLED') {
        // Late success: Record payment, create refund obligation, DO NOT reclaim seats!
        await tx.query(`
          INSERT INTO payment_attempts (id, booking_id, idempotency_key, amount, status, scenario, gateway_ref, error_message)
          VALUES ($1, $2, $3, $4, 'SUCCEEDED', $5, $6, 'Payment arrived after hold expired/cancelled')
        `, [attemptId, bookingId, idempotencyKey, booking.total_amount, scenario, gatewayRef]);

        const refundId = `ref-late-${Date.now()}`;
        await tx.query(`
          INSERT INTO refunds (id, booking_id, payment_attempt_id, amount, status, reason)
          VALUES ($1, $2, $3, $4, 'SUCCEEDED', 'Automatic refund: payment received after hold expired.')
        `, [refundId, bookingId, attemptId, booking.total_amount]);

        const lateResponse = {
          success: false,
          status: 'HOLD_EXPIRED',
          message: 'Seat hold expired before payment was completed. Your payment was automatically refunded.',
          paymentAttemptId: attemptId,
          refundId,
          gatewayRef
        };

        return lateResponse;
      }

      // Check current booking state
      if (booking.status !== 'PENDING_PAYMENT') {
        throw { status: 400, code: 'INVALID_STATE', message: `Booking cannot be paid (current status: ${booking.status}).` };
      }

      // SUCCESS SCENARIO:
      // Verify held allocations still belong to booking
      const allocs = await tx.query(`
        SELECT id, run_seat_id, status FROM seat_allocations WHERE booking_id = $1
      `, [bookingId]);

      if (allocs.rows.length === 0 || allocs.rows.some((a: any) => a.status !== 'HELD')) {
        throw { status: 409, code: 'SEAT_UNAVAILABLE', message: 'Held allocations are no longer active.' };
      }

      // Atomically transition allocations to CONFIRMED
      await tx.query(`
        UPDATE seat_allocations 
        SET status = 'CONFIRMED' 
        WHERE booking_id = $1
      `, [bookingId]);

      // Atomically transition booking to CONFIRMED
      await tx.query(`
        UPDATE bookings 
        SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [bookingId]);

      // Record successful payment
      await tx.query(`
        INSERT INTO payment_attempts (id, booking_id, idempotency_key, amount, status, scenario, gateway_ref)
        VALUES ($1, $2, $3, $4, 'SUCCEEDED', $5, $6)
      `, [attemptId, bookingId, idempotencyKey, booking.total_amount, scenario, gatewayRef]);

      const successResponse = {
        success: true,
        status: 'CONFIRMED',
        message: 'Mock payment verified successfully. Ticket confirmed!',
        bookingId,
        reference: booking.reference,
        paymentAttemptId: attemptId,
        gatewayRef,
        amount: booking.total_amount
      };

      // Record idempotency
      await tx.query(`
        INSERT INTO idempotency_records (id, idempotency_key, user_id, operation_type, request_fingerprint, response_payload, status)
        VALUES ($1, $2, $3, 'PAYMENT', $4, $5, 'SUCCEEDED')
      `, [`idemp-${Date.now()}`, idempotencyKey, userId, bookingId, JSON.stringify(successResponse)]);

      return successResponse;
    });
  }
}
