import { getDb } from '../db/connection.js';
import { PricingService } from './pricing.service.js';
import { RiskService, ConnectionRiskReport } from './risk.service.js';
import { SimulatorService } from './simulator.service.js';

export interface AutopilotConstraints {
  origin: string;
  destination: string;
  date: string; // YYYY-MM-DD
  coachClass?: string;
  passengerCount?: number;
  maxFare?: number; // in rupees
  arrivalDeadlineTime?: string; // HH:mm format, e.g. "22:00" or "noon" (12:00)
  maxTransfers?: number; // 0, 1, 2
  minConnectionMinutes?: number; // default 30
  preferredBerth?: string; // LOWER, MIDDLE, UPPER, SIDE_LOWER, SIDE_UPPER
  objectiveWeight?: 'BALANCED' | 'CHEAPEST' | 'FASTEST' | 'SAFEST';
  useSimulation?: boolean;
}

export interface AutopilotLeg {
  legOrder: number;
  runId: string;
  trainNumber: string;
  trainName: string;
  fromStationCode: string;
  fromStationName: string;
  fromStopSeq: number;
  toStationCode: string;
  toStationName: string;
  toStopSeq: number;
  departureTime: string;
  arrivalTime: string;
  simulatedDepartureTime?: string;
  simulatedArrivalTime?: string;
  durationMinutes: number;
  coachType: string;
  legFare: number;
  availableSeatsCount: number;
  delayMinutes: number;
  isCancelled: boolean;
  suggestedSeats: Array<{ seatId: string; coachCode: string; seatNumber: number; berthType: string }>;
}

export interface AutopilotItinerary {
  id: string;
  journeyType: 'DIRECT' | 'SAME_TRAIN_CHANGE' | 'TWO_TRAIN_CONNECTION' | 'MULTI_TRANSFER';
  transfersCount: number;
  totalFare: number; // in minor units (paise)
  totalDurationMinutes: number;
  departureTime: string;
  arrivalTime: string;
  originStationCode: string;
  destinationStationCode: string;
  legs: AutopilotLeg[];
  transferStationName?: string;
  transferWaitMinutes?: number;
  connectionRisk: ConnectionRiskReport;
  rankingScore: number; // 0 to 100
  rankingExplanation: string;
  meetsAllConstraints: boolean;
  constraintsViolationReasons: string[];
}

export class AutopilotService {
  /**
   * Intelligently plans and ranks optimal train itineraries across network graph.
   */
  static async planJourney(constraints: AutopilotConstraints): Promise<{
    itineraries: AutopilotItinerary[];
    totalEvaluated: number;
    graphStats: { stationsCount: number; activeRunsCount: number };
    activeSimulationApplied: boolean;
  }> {
    const db = await getDb();
    const origin = constraints.origin.toUpperCase().trim();
    const destination = constraints.destination.toUpperCase().trim();
    const date = constraints.date;
    const coachClass = constraints.coachClass || '3A';
    const passengerCount = Math.max(1, constraints.passengerCount || 1);
    const maxTransfers = constraints.maxTransfers !== undefined ? constraints.maxTransfers : 2;
    const minConnectionMin = constraints.minConnectionMinutes || 30;
    const maxFarePaise = constraints.maxFare ? constraints.maxFare * 100 : undefined;
    const objective = constraints.objectiveWeight || 'BALANCED';
    const useSimulation = constraints.useSimulation ?? true;

    // Helper: get available seats for segment interval
    const getAvailableSeats = async (runId: string, classType: string, fromSeq: number, toSeq: number) => {
      const q = await db.query(`
        SELECT rs.id, rs.coach_code, rs.seat_number, rs.berth_type, rs.base_fare
        FROM run_seats rs
        WHERE rs.run_id = $1 
          AND rs.coach_type = $2
          AND rs.id NOT IN (
            SELECT sa.run_seat_id 
            FROM seat_allocations sa
            WHERE (sa.status = 'CONFIRMED' OR (sa.status = 'HELD' AND sa.expires_at > CURRENT_TIMESTAMP))
              AND sa.from_stop_seq < $4 
              AND sa.to_stop_seq > $3
          )
        ORDER BY 
          CASE WHEN $5::text IS NOT NULL AND rs.berth_type = $5 THEN 0 ELSE 1 END,
          rs.coach_code, rs.seat_number
      `, [runId, classType, fromSeq, toSeq, constraints.preferredBerth || null]);

      let available = q.rows;
      if (useSimulation) {
        available = available.filter(s => !SimulatorService.isSeatBlocked(s.id));
      }
      return available;
    };

    // 1. Query station graph nodes and scheduled runs for the date
    const stnsCountRes = await db.query('SELECT COUNT(*) as count FROM stations');
    const runsCountRes = await db.query(`
      SELECT COUNT(*) as count FROM train_runs 
      WHERE (run_date::text LIKE $1 || '%' OR run_date = $1::date)
    `, [date]);

    const itineraries: AutopilotItinerary[] = [];

    // --- Search Graph Route Options ---
    // A. Direct Runs (0 transfers)
    if (maxTransfers >= 0) {
      const directRunsQuery = await db.query(`
        SELECT 
          tr.id as run_id, tr.run_date, tr.status as run_status,
          t.train_number, t.name as train_name,
          rs1.stop_sequence as from_seq, rs1.departure_time as dep_time, s1.name as from_name,
          rs2.stop_sequence as to_seq, rs2.arrival_time as arr_time, s2.name as to_name
        FROM train_runs tr
        JOIN trains t ON t.id = tr.train_id
        JOIN run_stops rs1 ON rs1.run_id = tr.id
        JOIN stations s1 ON s1.id = rs1.station_id AND s1.code = $1
        JOIN run_stops rs2 ON rs2.run_id = tr.id
        JOIN stations s2 ON s2.id = rs2.station_id AND s2.code = $2
        WHERE (tr.run_date::text LIKE $3 || '%' OR tr.run_date = $3::date)
          AND tr.status = 'SCHEDULED'
          AND rs1.stop_sequence < rs2.stop_sequence
        ORDER BY rs1.departure_time ASC
      `, [origin, destination, date]);

      for (const run of directRunsQuery.rows) {
        const isCancelled = useSimulation && SimulatorService.isRunCancelled(run.run_id);
        const delay = useSimulation ? SimulatorService.getDelayForRun(run.run_id) : 0;

        const depTime = new Date(new Date(run.dep_time).getTime() + delay * 60000);
        const arrTime = new Date(new Date(run.arr_time).getTime() + delay * 60000);
        const durationMin = Math.round((arrTime.getTime() - depTime.getTime()) / 60000);

        const freeSeats = await getAvailableSeats(run.run_id, coachClass, run.from_seq, run.to_seq);

        if (freeSeats.length >= passengerCount && !isCancelled) {
          const pricing = await PricingService.calculateLegFare(db, run.run_id, coachClass, run.from_seq, run.to_seq, depTime);
          const totalFare = pricing.finalFare * passengerCount;

          const risk = RiskService.assessConnectionRisk({
            scheduledArrival: arrTime,
            scheduledDeparture: arrTime,
            transferStationName: destination,
            isSameTrain: true
          });

          itineraries.push({
            id: `ap-dir-${run.run_id}-${coachClass}`,
            journeyType: 'DIRECT',
            transfersCount: 0,
            totalFare,
            totalDurationMinutes: durationMin,
            departureTime: depTime.toISOString(),
            arrivalTime: arrTime.toISOString(),
            originStationCode: origin,
            destinationStationCode: destination,
            connectionRisk: risk,
            rankingScore: 0,
            rankingExplanation: '',
            meetsAllConstraints: true,
            constraintsViolationReasons: [],
            legs: [{
              legOrder: 1,
              runId: run.run_id,
              trainNumber: run.train_number,
              trainName: run.train_name,
              fromStationCode: origin,
              fromStationName: run.from_name,
              fromStopSeq: run.from_seq,
              toStationCode: destination,
              toStationName: run.to_name,
              toStopSeq: run.to_seq,
              departureTime: run.dep_time,
              arrivalTime: run.arr_time,
              simulatedDepartureTime: depTime.toISOString(),
              simulatedArrivalTime: arrTime.toISOString(),
              durationMinutes: durationMin,
              coachType: coachClass,
              legFare: pricing.finalFare,
              availableSeatsCount: freeSeats.length,
              delayMinutes: delay,
              isCancelled,
              suggestedSeats: freeSeats.slice(0, passengerCount).map((s: any) => ({
                seatId: s.id,
                coachCode: s.coach_code,
                seatNumber: s.seat_number,
                berthType: s.berth_type
              }))
            }]
          });
        }

        // Same-Train Seat / Coach Change Check
        if (maxTransfers >= 1) {
          const intermediateStops = await db.query(`
            SELECT rs.stop_sequence, rs.arrival_time, rs.departure_time, rs.is_change_permitted, s.code, s.name
            FROM run_stops rs
            JOIN stations s ON s.id = rs.station_id
            WHERE rs.run_id = $1 
              AND rs.stop_sequence > $2 
              AND rs.stop_sequence < $3
              AND rs.is_change_permitted = TRUE
            ORDER BY rs.stop_sequence ASC
          `, [run.run_id, run.from_seq, run.to_seq]);

          for (const splitStop of intermediateStops.rows) {
            const leg1Seats = await getAvailableSeats(run.run_id, coachClass, run.from_seq, splitStop.stop_sequence);
            const leg2Seats = await getAvailableSeats(run.run_id, coachClass, splitStop.stop_sequence, run.to_seq);

            if (leg1Seats.length >= passengerCount && leg2Seats.length >= passengerCount && !isCancelled) {
              const pricing = await PricingService.calculateLegFare(db, run.run_id, coachClass, run.from_seq, run.to_seq, depTime);
              const leg1Fare = Math.round(pricing.finalFare / 2);
              const leg2Fare = pricing.finalFare - leg1Fare;
              const totalFare = pricing.finalFare * passengerCount;

              const risk = RiskService.assessConnectionRisk({
                scheduledArrival: new Date(splitStop.arrival_time),
                scheduledDeparture: new Date(splitStop.departure_time),
                arrivalTrainDelayMinutes: delay,
                transferStationName: splitStop.name,
                isSameTrain: true
              });

              itineraries.push({
                id: `ap-split-${run.run_id}-${splitStop.stop_sequence}-${coachClass}`,
                journeyType: 'SAME_TRAIN_CHANGE',
                transfersCount: 1,
                totalFare,
                totalDurationMinutes: durationMin,
                departureTime: depTime.toISOString(),
                arrivalTime: arrTime.toISOString(),
                originStationCode: origin,
                destinationStationCode: destination,
                transferStationName: splitStop.name,
                connectionRisk: risk,
                rankingScore: 0,
                rankingExplanation: '',
                meetsAllConstraints: true,
                constraintsViolationReasons: [],
                legs: [
                  {
                    legOrder: 1,
                    runId: run.run_id,
                    trainNumber: run.train_number,
                    trainName: run.train_name,
                    fromStationCode: origin,
                    fromStationName: run.from_name,
                    fromStopSeq: run.from_seq,
                    toStationCode: splitStop.code,
                    toStationName: splitStop.name,
                    toStopSeq: splitStop.stop_sequence,
                    departureTime: run.dep_time,
                    arrivalTime: splitStop.arrival_time,
                    simulatedDepartureTime: depTime.toISOString(),
                    simulatedArrivalTime: new Date(new Date(splitStop.arrival_time).getTime() + delay * 60000).toISOString(),
                    durationMinutes: Math.round((new Date(splitStop.arrival_time).getTime() - new Date(run.dep_time).getTime()) / 60000),
                    coachType: coachClass,
                    legFare: leg1Fare,
                    availableSeatsCount: leg1Seats.length,
                    delayMinutes: delay,
                    isCancelled,
                    suggestedSeats: leg1Seats.slice(0, passengerCount).map((s: any) => ({
                      seatId: s.id,
                      coachCode: s.coach_code,
                      seatNumber: s.seat_number,
                      berthType: s.berth_type
                    }))
                  },
                  {
                    legOrder: 2,
                    runId: run.run_id,
                    trainNumber: run.train_number,
                    trainName: run.train_name,
                    fromStationCode: splitStop.code,
                    fromStationName: splitStop.name,
                    fromStopSeq: splitStop.stop_sequence,
                    toStationCode: destination,
                    toStationName: run.to_name,
                    toStopSeq: run.to_seq,
                    departureTime: splitStop.departure_time,
                    arrivalTime: run.arr_time,
                    simulatedDepartureTime: new Date(new Date(splitStop.departure_time).getTime() + delay * 60000).toISOString(),
                    simulatedArrivalTime: arrTime.toISOString(),
                    durationMinutes: Math.round((new Date(run.arr_time).getTime() - new Date(splitStop.departure_time).getTime()) / 60000),
                    coachType: coachClass,
                    legFare: leg2Fare,
                    availableSeatsCount: leg2Seats.length,
                    delayMinutes: delay,
                    isCancelled,
                    suggestedSeats: leg2Seats.slice(0, passengerCount).map((s: any) => ({
                      seatId: s.id,
                      coachCode: s.coach_code,
                      seatNumber: s.seat_number,
                      berthType: s.berth_type
                    }))
                  }
                ]
              });
              break; // choose optimal split stop
            }
          }
        }
      }
    }

    // B. Two-Train Connections (1 transfer across graph edge)
    if (maxTransfers >= 1) {
      const connectionsQuery = await db.query(`
        SELECT 
          tr1.id as run1_id, t1.train_number as train1_num, t1.name as train1_name,
          rs1_dep.stop_sequence as r1_from_seq, rs1_dep.departure_time as r1_dep_time, s_orig.name as orig_name,
          rs1_arr.stop_sequence as r1_to_seq, rs1_arr.arrival_time as r1_arr_time, s_trans.code as trans_code, s_trans.name as trans_name,
          
          tr2.id as run2_id, t2.train_number as train2_num, t2.name as train2_name,
          rs2_dep.stop_sequence as r2_from_seq, rs2_dep.departure_time as r2_dep_time,
          rs2_arr.stop_sequence as r2_to_seq, rs2_arr.arrival_time as r2_arr_time, s_dest.name as dest_name
        FROM train_runs tr1
        JOIN trains t1 ON t1.id = tr1.train_id
        JOIN run_stops rs1_dep ON rs1_dep.run_id = tr1.id
        JOIN stations s_orig ON s_orig.id = rs1_dep.station_id AND s_orig.code = $1
        JOIN run_stops rs1_arr ON rs1_arr.run_id = tr1.id AND rs1_arr.stop_sequence > rs1_dep.stop_sequence
        JOIN stations s_trans ON s_trans.id = rs1_arr.station_id
        
        JOIN train_runs tr2 ON tr2.id != tr1.id AND tr2.status = 'SCHEDULED'
        JOIN trains t2 ON t2.id = tr2.train_id
        JOIN run_stops rs2_dep ON rs2_dep.run_id = tr2.id AND rs2_dep.station_id = s_trans.id
        JOIN run_stops rs2_arr ON rs2_arr.run_id = tr2.id AND rs2_arr.stop_sequence > rs2_dep.stop_sequence
        JOIN stations s_dest ON s_dest.id = rs2_arr.station_id AND s_dest.code = $2
        
        WHERE (tr1.run_date::text LIKE $3 || '%' OR tr1.run_date = $3::date)
          AND tr1.status = 'SCHEDULED'
          AND s_trans.code != $1 AND s_trans.code != $2
        ORDER BY rs1_dep.departure_time ASC
      `, [origin, destination, date]);

      for (const conn of connectionsQuery.rows) {
        const isRun1Cancelled = useSimulation && SimulatorService.isRunCancelled(conn.run1_id);
        const isRun2Cancelled = useSimulation && SimulatorService.isRunCancelled(conn.run2_id);

        const delay1 = useSimulation ? SimulatorService.getDelayForRun(conn.run1_id) : 0;
        const delay2 = useSimulation ? SimulatorService.getDelayForRun(conn.run2_id) : 0;

        const schedArrT1 = new Date(conn.r1_arr_time);
        const schedDepT2 = new Date(conn.r2_dep_time);

        const simArrT1 = new Date(schedArrT1.getTime() + delay1 * 60000);
        const simDepT2 = new Date(schedDepT2.getTime() + delay2 * 60000);

        const risk = RiskService.assessConnectionRisk({
          scheduledArrival: schedArrT1,
          scheduledDeparture: schedDepT2,
          arrivalTrainDelayMinutes: delay1,
          departureTrainDelayMinutes: delay2,
          isArrivalCancelled: isRun1Cancelled,
          isDepartureCancelled: isRun2Cancelled,
          transferStationName: conn.trans_name,
          isSameTrain: false
        });

        // Enforce transfer feasibility
        if (risk.isFeasible && !isRun1Cancelled && !isRun2Cancelled) {
          const leg1Seats = await getAvailableSeats(conn.run1_id, coachClass, conn.r1_from_seq, conn.r1_to_seq);
          const leg2Seats = await getAvailableSeats(conn.run2_id, coachClass, conn.r2_from_seq, conn.r2_to_seq);

          if (leg1Seats.length >= passengerCount && leg2Seats.length >= passengerCount) {
            const p1 = await PricingService.calculateLegFare(db, conn.run1_id, coachClass, conn.r1_from_seq, conn.r1_to_seq, new Date(conn.r1_dep_time));
            const p2 = await PricingService.calculateLegFare(db, conn.run2_id, coachClass, conn.r2_from_seq, conn.r2_to_seq, schedDepT2);
            const totalFare = (p1.finalFare + p2.finalFare) * passengerCount;

            const totalDurationMin = Math.round((new Date(conn.r2_arr_time).getTime() - new Date(conn.r1_dep_time).getTime()) / 60000) + delay2;

            itineraries.push({
              id: `ap-conn-${conn.run1_id}-${conn.run2_id}-${coachClass}`,
              journeyType: 'TWO_TRAIN_CONNECTION',
              transfersCount: 1,
              totalFare,
              totalDurationMinutes: totalDurationMin,
              departureTime: new Date(new Date(conn.r1_dep_time).getTime() + delay1 * 60000).toISOString(),
              arrivalTime: new Date(new Date(conn.r2_arr_time).getTime() + delay2 * 60000).toISOString(),
              originStationCode: origin,
              destinationStationCode: destination,
              transferStationName: conn.trans_name,
              transferWaitMinutes: risk.effectiveLayoverMinutes,
              connectionRisk: risk,
              rankingScore: 0,
              rankingExplanation: '',
              meetsAllConstraints: true,
              constraintsViolationReasons: [],
              legs: [
                {
                  legOrder: 1,
                  runId: conn.run1_id,
                  trainNumber: conn.train1_num,
                  trainName: conn.train1_name,
                  fromStationCode: origin,
                  fromStationName: conn.orig_name,
                  fromStopSeq: conn.r1_from_seq,
                  toStationCode: conn.trans_code,
                  toStationName: conn.trans_name,
                  toStopSeq: conn.r1_to_seq,
                  departureTime: conn.r1_dep_time,
                  arrivalTime: conn.r1_arr_time,
                  simulatedDepartureTime: new Date(new Date(conn.r1_dep_time).getTime() + delay1 * 60000).toISOString(),
                  simulatedArrivalTime: simArrT1.toISOString(),
                  durationMinutes: Math.round((schedArrT1.getTime() - new Date(conn.r1_dep_time).getTime()) / 60000),
                  coachType: coachClass,
                  legFare: p1.finalFare,
                  availableSeatsCount: leg1Seats.length,
                  delayMinutes: delay1,
                  isCancelled: isRun1Cancelled,
                  suggestedSeats: leg1Seats.slice(0, passengerCount).map((s: any) => ({
                    seatId: s.id,
                    coachCode: s.coach_code,
                    seatNumber: s.seat_number,
                    berthType: s.berth_type
                  }))
                },
                {
                  legOrder: 2,
                  runId: conn.run2_id,
                  trainNumber: conn.train2_num,
                  trainName: conn.train2_name,
                  fromStationCode: conn.trans_code,
                  fromStationName: conn.trans_name,
                  fromStopSeq: conn.r2_from_seq,
                  toStationCode: destination,
                  toStationName: conn.dest_name,
                  toStopSeq: conn.r2_to_seq,
                  departureTime: conn.r2_dep_time,
                  arrivalTime: conn.r2_arr_time,
                  simulatedDepartureTime: simDepT2.toISOString(),
                  simulatedArrivalTime: new Date(new Date(conn.r2_arr_time).getTime() + delay2 * 60000).toISOString(),
                  durationMinutes: Math.round((new Date(conn.r2_arr_time).getTime() - schedDepT2.getTime()) / 60000),
                  coachType: coachClass,
                  legFare: p2.finalFare,
                  availableSeatsCount: leg2Seats.length,
                  delayMinutes: delay2,
                  isCancelled: isRun2Cancelled,
                  suggestedSeats: leg2Seats.slice(0, passengerCount).map((s: any) => ({
                    seatId: s.id,
                    coachCode: s.coach_code,
                    seatNumber: s.seat_number,
                    berthType: s.berth_type
                  }))
                }
              ]
            });
          }
        }
      }
    }

    // --- Constraints Validation & Multi-Objective Ranking ---
    // Min & Max bounds for normalization
    const fares = itineraries.map(it => it.totalFare);
    const durations = itineraries.map(it => it.totalDurationMinutes);
    const minFare = fares.length > 0 ? Math.min(...fares) : 1;
    const maxFare = fares.length > 0 ? Math.max(...fares) : 1;
    const minDur = durations.length > 0 ? Math.min(...durations) : 1;
    const maxDur = durations.length > 0 ? Math.max(...durations) : 1;

    // Apply User Constraints & Calculate Scores
    for (const it of itineraries) {
      const violations: string[] = [];

      // Constraint: Max Fare
      if (maxFarePaise && it.totalFare > maxFarePaise) {
        violations.push(`Fare ₹${(it.totalFare / 100).toFixed(0)} exceeds limit ₹${(maxFarePaise / 100).toFixed(0)}`);
      }

      // Constraint: Arrival Deadline
      if (constraints.arrivalDeadlineTime) {
        const arrDate = new Date(it.arrivalTime);
        const hours = arrDate.getUTCHours();
        const mins = arrDate.getUTCMinutes();
        const arrMinOfDay = hours * 60 + mins;

        // Parse deadline e.g. "22:00"
        const [dh, dm] = constraints.arrivalDeadlineTime.split(':').map(Number);
        const deadlineMinOfDay = (dh || 23) * 60 + (dm || 59);

        if (arrMinOfDay > deadlineMinOfDay) {
          violations.push(`Arrives at ${arrDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, after deadline ${constraints.arrivalDeadlineTime}`);
        }
      }

      // Constraint: Min Connection Layover
      if (it.transferWaitMinutes !== undefined && it.transferWaitMinutes < minConnectionMin) {
        violations.push(`Layover ${it.transferWaitMinutes}m is shorter than minimum requested ${minConnectionMin}m`);
      }

      it.meetsAllConstraints = violations.length === 0;
      it.constraintsViolationReasons = violations;

      // Normalizations (0 = best, 1 = worst)
      const normFare = maxFare === minFare ? 0 : (it.totalFare - minFare) / (maxFare - minFare);
      const normDur = maxDur === minDur ? 0 : (it.totalDurationMinutes - minDur) / (maxDur - minDur);
      const normTransfer = it.transfersCount / 2; // 0 to 1
      const normRisk = it.connectionRisk.score / 100; // 0 to 1

      // Weights depending on objective
      let wFare = 0.35;
      let wDur = 0.35;
      let wTransfer = 0.15;
      let wRisk = 0.15;

      if (objective === 'CHEAPEST') {
        wFare = 0.65;
        wDur = 0.15;
        wTransfer = 0.10;
        wRisk = 0.10;
      } else if (objective === 'FASTEST') {
        wFare = 0.15;
        wDur = 0.65;
        wTransfer = 0.10;
        wRisk = 0.10;
      } else if (objective === 'SAFEST') {
        wFare = 0.15;
        wDur = 0.15;
        wTransfer = 0.20;
        wRisk = 0.50;
      }

      const compositeLoss = (wFare * normFare) + (wDur * normDur) + (wTransfer * normTransfer) + (wRisk * normRisk);
      // Penalty if constraints violated
      const penalty = it.meetsAllConstraints ? 0 : 30;
      it.rankingScore = Math.max(0, Math.round((1 - compositeLoss) * 100 - penalty));

      // Human-readable ranking explanation
      const fareRs = `₹${(it.totalFare / 100).toFixed(0)}`;
      const durHours = `${Math.floor(it.totalDurationMinutes / 60)}h ${it.totalDurationMinutes % 60}m`;
      const riskLevel = it.connectionRisk.level;

      if (it.journeyType === 'DIRECT') {
        it.rankingExplanation = `Direct continuous service (${durHours}) with zero transfer risk and fare of ${fareRs}.`;
      } else if (it.journeyType === 'SAME_TRAIN_CHANGE') {
        it.rankingExplanation = `Zero station transfer: stay onboard the same train, changing seats at ${it.transferStationName}. Total fare: ${fareRs}.`;
      } else {
        it.rankingExplanation = `Efficient 2-train connection via ${it.transferStationName} with ${it.transferWaitMinutes}m layover (${riskLevel} risk). Total fare: ${fareRs}.`;
      }
    }

    // Sort by rankingScore descending
    itineraries.sort((a, b) => b.rankingScore - a.rankingScore);

    return {
      itineraries: itineraries.slice(0, 15),
      totalEvaluated: itineraries.length,
      graphStats: {
        stationsCount: Number(stnsCountRes.rows[0]?.count || 7),
        activeRunsCount: Number(runsCountRes.rows[0]?.count || 2)
      },
      activeSimulationApplied: useSimulation && (
        SimulatorService.getSimulationState().cancelledRuns.length > 0 ||
        Object.keys(SimulatorService.getSimulationState().delays).length > 0
      )
    };
  }
}
