export interface ConnectionRiskReport {
  score: number; // 0 (Safe) to 100 (Disrupted / Critical)
  level: 'SAFE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  layoverMinutes: number;
  effectiveLayoverMinutes: number;
  isFeasible: boolean;
  factors: Array<{ factor: string; impact: string; detail: string }>;
  explanation: string;
}

export class RiskService {
  /**
   * Evaluates connection risk between arriving leg 1 and departing leg 2.
   * Takes into account scheduled layover buffer, injected delays, and transfer complexity.
   */
  static assessConnectionRisk(params: {
    scheduledArrival: Date;
    scheduledDeparture: Date;
    arrivalTrainDelayMinutes?: number;
    departureTrainDelayMinutes?: number;
    isArrivalCancelled?: boolean;
    isDepartureCancelled?: boolean;
    transferStationName: string;
    isSameTrain?: boolean;
  }): ConnectionRiskReport {
    const {
      scheduledArrival,
      scheduledDeparture,
      arrivalTrainDelayMinutes = 0,
      departureTrainDelayMinutes = 0,
      isArrivalCancelled = false,
      isDepartureCancelled = false,
      transferStationName,
      isSameTrain = false
    } = params;

    // Check cancellation
    if (isArrivalCancelled || isDepartureCancelled) {
      return {
        score: 100,
        level: 'CRITICAL',
        layoverMinutes: 0,
        effectiveLayoverMinutes: 0,
        isFeasible: false,
        factors: [{
          factor: 'Train Service Cancelled',
          impact: '+100 Risk',
          detail: `One of the connecting services at ${transferStationName} is cancelled in current operational schedule.`
        }],
        explanation: `Critical: Connecting service is cancelled. Connection at ${transferStationName} is impossible.`
      };
    }

    const scheduledLayoverMs = scheduledDeparture.getTime() - scheduledArrival.getTime();
    const layoverMinutes = Math.round(scheduledLayoverMs / 60000);

    // Effective layover accounting for delays:
    // Arrival delay reduces layover; departure delay increases layover
    const effectiveLayoverMinutes = layoverMinutes - arrivalTrainDelayMinutes + departureTrainDelayMinutes;

    const factors: Array<{ factor: string; impact: string; detail: string }> = [];
    let score = 0;

    // Same-train seat change is physically impossible to miss
    if (isSameTrain) {
      score = 5;
      factors.push({
        factor: 'Same-Train Journey',
        impact: 'Minimal Risk (Score: 5)',
        detail: `Passenger remains onboard the same train at ${transferStationName}. No platform transfer or train-miss risk.`
      });

      return {
        score,
        level: 'SAFE',
        layoverMinutes,
        effectiveLayoverMinutes,
        isFeasible: true,
        factors,
        explanation: `Safe: Same-train journey. You remain onboard at ${transferStationName} and simply walk to your assigned berth during station halt.`
      };
    }

    // Two-train transfer evaluation
    if (effectiveLayoverMinutes < 15) {
      score = 100;
      factors.push({
        factor: 'Critical Time Deficit',
        impact: '+100 Risk',
        detail: `Effective layover is only ${effectiveLayoverMinutes}m (less than the 15-minute platform traversal minimum).`
      });
    } else if (effectiveLayoverMinutes < 30) {
      score = 75;
      factors.push({
        factor: 'Tight Layover Window',
        impact: '+75 Risk',
        detail: `Effective buffer of ${effectiveLayoverMinutes}m is below standard 30-minute safety threshold.`
      });
    } else if (effectiveLayoverMinutes < 45) {
      score = 40;
      factors.push({
        factor: 'Moderate Layover Buffer',
        impact: '+40 Risk',
        detail: `Effective layover of ${effectiveLayoverMinutes}m provides moderate margin for delays.`
      });
    } else if (effectiveLayoverMinutes < 75) {
      score = 15;
      factors.push({
        factor: 'Comfortable Buffer',
        impact: '+15 Risk',
        detail: `Effective layover of ${effectiveLayoverMinutes}m provides reliable buffer for standard operations.`
      });
    } else {
      score = 5;
      factors.push({
        factor: 'Generous Transfer Buffer',
        impact: '+5 Risk',
        detail: `Effective layover of ${effectiveLayoverMinutes}m provides ample recovery time even under significant delays.`
      });
    }

    // Injected delay impacts
    if (arrivalTrainDelayMinutes > 0) {
      factors.push({
        factor: 'Feeder Train Delayed',
        impact: `-${arrivalTrainDelayMinutes}m Buffer`,
        detail: `Arriving service is delayed by ${arrivalTrainDelayMinutes} minutes, reducing available transfer window.`
      });
    }

    const isFeasible = effectiveLayoverMinutes >= 15;
    let level: 'SAFE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'SAFE';

    if (score >= 90) level = 'CRITICAL';
    else if (score >= 60) level = 'HIGH';
    else if (score >= 35) level = 'MODERATE';
    else if (score >= 15) level = 'LOW';
    else level = 'SAFE';

    let explanation = '';
    if (level === 'CRITICAL') {
      explanation = `Critical: Transfer at ${transferStationName} has an effective buffer of only ${effectiveLayoverMinutes}m (missed connection likely).`;
    } else if (level === 'HIGH') {
      explanation = `High Risk: Tight ${effectiveLayoverMinutes}m transfer at ${transferStationName}. Minor transit delays may break connection.`;
    } else if (level === 'MODERATE') {
      explanation = `Moderate Risk: ${effectiveLayoverMinutes}m transfer window at ${transferStationName}. Feasible under normal operations.`;
    } else {
      explanation = `Low Risk: Reliable ${effectiveLayoverMinutes}m transfer at ${transferStationName} with ample buffer.`;
    }

    return {
      score,
      level,
      layoverMinutes,
      effectiveLayoverMinutes,
      isFeasible,
      factors,
      explanation
    };
  }
}
