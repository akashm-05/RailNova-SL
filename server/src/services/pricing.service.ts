import { DbClient, getDb } from '../db/connection.js';

export interface PricingBreakdown {
  baseFare: number;           // in minor currency units (paise)
  distanceKm: number;
  timeBucketMultiplier: number;
  timeBucketLabel: string;
  occupancyMultiplier: number;
  occupancyLabel: string;
  finalFare: number;          // in minor currency units (paise)
  currency: string;
  explanation: string;
}

export class PricingService {
  /**
   * Calculates dynamic fare for a single journey segment on a run.
   */
  static async calculateLegFare(
    db: DbClient,
    runId: string,
    coachType: string,
    fromStopSeq: number,
    toStopSeq: number,
    departureTime: Date
  ): Promise<PricingBreakdown> {
    // 1. Get distance and fare rules
    const distRes = await db.query(`
      SELECT 
        (SELECT distance_from_origin_km FROM run_stops WHERE run_id = $1 AND stop_sequence = $3) -
        (SELECT distance_from_origin_km FROM run_stops WHERE run_id = $1 AND stop_sequence = $2) as dist
    `, [runId, fromStopSeq, toStopSeq]);

    const distanceKm = Math.max(50, Math.round(Number(distRes.rows[0]?.dist || 200)));

    const ruleRes = await db.query(
      'SELECT base_rate_per_km, min_fare FROM fare_rules WHERE class_code = $1',
      [coachType]
    );

    const baseRatePerKm = ruleRes.rows[0] ? Number(ruleRes.rows[0].base_rate_per_km) : 0.8;
    const minFare = ruleRes.rows[0] ? Number(ruleRes.rows[0].min_fare) : 25000;

    // Base fare in paise (distance * rate * 100 paise)
    let calculatedBase = Math.round(distanceKm * baseRatePerKm * 100);
    const baseFare = Math.max(minFare, calculatedBase);

    // 2. Time-to-departure bucket
    const now = new Date();
    const msUntilDeparture = departureTime.getTime() - now.getTime();
    const hoursUntil = msUntilDeparture / (1000 * 60 * 60);

    if (hoursUntil <= 0) {
      throw { status: 400, code: 'DEPARTURE_PASSED', message: 'The train has already departed.' };
    }

    let timeBucketMultiplier = 1.00;
    let timeBucketLabel = 'Standard (>7d)';

    if (hoursUntil <= 24) {
      timeBucketMultiplier = 1.15;
      timeBucketLabel = 'Last 24 Hours (+15%)';
    } else if (hoursUntil <= 72) {
      timeBucketMultiplier = 1.10;
      timeBucketLabel = '1 to 3 Days Before (+10%)';
    } else if (hoursUntil <= 168) {
      timeBucketMultiplier = 1.05;
      timeBucketLabel = '3 to 7 Days Before (+5%)';
    }

    // 3. Occupancy calculation for this class on this run
    const occRes = await db.query(`
      SELECT 
        COUNT(DISTINCT rs.id) as total_seats,
        COUNT(DISTINCT CASE WHEN sa.status = 'CONFIRMED' THEN sa.run_seat_id END) as booked_seats
      FROM run_seats rs
      LEFT JOIN seat_allocations sa ON sa.run_seat_id = rs.id 
        AND sa.status = 'CONFIRMED'
        AND sa.from_stop_seq < $3 
        AND sa.to_stop_seq > $2
      WHERE rs.run_id = $1 AND rs.coach_type = $4
    `, [runId, fromStopSeq, toStopSeq, coachType]);

    const totalSeats = Number(occRes.rows[0]?.total_seats || 20);
    const bookedSeats = Number(occRes.rows[0]?.booked_seats || 0);
    const occupancyRatio = totalSeats > 0 ? (bookedSeats / totalSeats) : 0;

    let occupancyMultiplier = 1.00;
    let occupancyLabel = 'Moderate Demand (<50%)';

    if (occupancyRatio > 0.80) {
      occupancyMultiplier = 1.05;
      occupancyLabel = 'High Demand (>80% occupied, +5%)';
    } else if (occupancyRatio >= 0.50) {
      occupancyMultiplier = 1.03;
      occupancyLabel = 'Medium Demand (50-80% occupied, +3%)';
    }

    // 4. Combined fare with cap (max 2.0x base fare)
    const combinedMultiplier = Math.min(2.0, timeBucketMultiplier * occupancyMultiplier);
    const finalFare = Math.round(baseFare * combinedMultiplier);

    const explanation = `Base: ₹${(baseFare / 100).toFixed(2)} (${distanceKm} km) | Timing: ${timeBucketLabel} | Occupancy: ${occupancyLabel}`;

    return {
      baseFare,
      distanceKm,
      timeBucketMultiplier,
      timeBucketLabel,
      occupancyMultiplier,
      occupancyLabel,
      finalFare,
      currency: 'INR',
      explanation
    };
  }
}
