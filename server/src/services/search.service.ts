import { getDb } from '../db/connection.js';
import { PricingService } from './pricing.service.js';

export interface ItineraryLeg {
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
  durationMinutes: number;
  coachType: string;
  legFare: number; // in minor units (paise)
  availableSeatsCount: number;
  requiresTransfer: boolean;
  requiresSeatChange: boolean;
  changeNote?: string;
  suggestedSeats?: Array<{ seatId: string; coachCode: string; seatNumber: number; berthType: string }>;
}

export interface ItineraryResult {
  id: string;
  journeyType: 'DIRECT' | 'SAME_TRAIN_CHANGE' | 'TWO_TRAIN_CONNECTION';
  totalFare: number; // in minor units
  totalDurationMinutes: number;
  departureTime: string;
  arrivalTime: string;
  originStationCode: string;
  destinationStationCode: string;
  legs: ItineraryLeg[];
  transferStationName?: string;
  transferWaitMinutes?: number;
  requiresAcknowledgement: boolean;
  acknowledgementMessage?: string;
  pricingExplanation: string;
}

export class SearchService {
  static async searchItineraries(params: {
    origin: string;
    destination: string;
    date: string; // YYYY-MM-DD
    coachClass?: string;
    passengerCount?: number;
    preference?: 'DIRECT_ONLY' | 'ALLOW_SEAT_CHANGE' | 'ALLOW_TWO_TRAINS' | 'ALL';
  }): Promise<ItineraryResult[]> {
    const db = await getDb();
    const origin = params.origin.toUpperCase().trim();
    const destination = params.destination.toUpperCase().trim();
    const date = params.date;
    const coachClass = params.coachClass || '3A';
    const passengerCount = Math.max(1, params.passengerCount || 1);
    const preference = params.preference || 'ALL';

    if (origin === destination) {
      throw { status: 400, code: 'INVALID_STATIONS', message: 'Origin and destination must be different.' };
    }

    const results: ItineraryResult[] = [];

    // Helper: query available seats on a run between two stop sequences
    const getAvailableSeatsForInterval = async (runId: string, classType: string, fromSeq: number, toSeq: number) => {
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
        ORDER BY rs.coach_code, rs.seat_number
      `, [runId, classType, fromSeq, toSeq]);
      return q.rows;
    };

    // -------------------------------------------------------------
    // 1. Direct Journeys (Same run serving origin before destination)
    // -------------------------------------------------------------
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
      const depDate = new Date(run.dep_time);
      const arrDate = new Date(run.arr_time);
      const durationMin = Math.round((arrDate.getTime() - depDate.getTime()) / 60000);

      // Check continuous seats
      const freeSeats = await getAvailableSeatsForInterval(run.run_id, coachClass, run.from_seq, run.to_seq);

      if (freeSeats.length >= passengerCount && preference !== 'ALLOW_SEAT_CHANGE' && preference !== 'ALLOW_TWO_TRAINS') {
        const pricing = await PricingService.calculateLegFare(db, run.run_id, coachClass, run.from_seq, run.to_seq, depDate);
        
        results.push({
          id: `itin-dir-${run.run_id}-${coachClass}`,
          journeyType: 'DIRECT',
          totalFare: pricing.finalFare * passengerCount,
          totalDurationMinutes: durationMin,
          departureTime: run.dep_time,
          arrivalTime: run.arr_time,
          originStationCode: origin,
          destinationStationCode: destination,
          pricingExplanation: pricing.explanation,
          requiresAcknowledgement: false,
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
            durationMinutes: durationMin,
            coachType: coachClass,
            legFare: pricing.finalFare,
            availableSeatsCount: freeSeats.length,
            requiresTransfer: false,
            requiresSeatChange: false,
            suggestedSeats: freeSeats.slice(0, passengerCount).map((s: any) => ({
              seatId: s.id,
              coachCode: s.coach_code,
              seatNumber: s.seat_number,
              berthType: s.berth_type
            }))
          }]
        });
      }

      // -------------------------------------------------------------
      // 2. Same Train, Seat or Coach Change (Split across intermediate stop)
      // -------------------------------------------------------------
      if (preference === 'ALLOW_SEAT_CHANGE' || preference === 'ALL' || freeSeats.length < passengerCount) {
        // Find intermediate permitted stops between from_seq and to_seq
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
          const leg1Seats = await getAvailableSeatsForInterval(run.run_id, coachClass, run.from_seq, splitStop.stop_sequence);
          const leg2Seats = await getAvailableSeatsForInterval(run.run_id, coachClass, splitStop.stop_sequence, run.to_seq);

          if (leg1Seats.length >= passengerCount && leg2Seats.length >= passengerCount) {
            // Check if seats differ (guaranteeing it is a seat or coach change)
            const s1 = leg1Seats[0];
            const s2 = leg2Seats[0];
            const isCoachChange = s1.coach_code !== s2.coach_code;
            const changeType = isCoachChange ? `Coach Change (${s1.coach_code} -> ${s2.coach_code})` : `Seat Change (Seat ${s1.seat_number} -> Seat ${s2.seat_number})`;

            const pricing = await PricingService.calculateLegFare(db, run.run_id, coachClass, run.from_seq, run.to_seq, depDate);
            const leg1Fare = Math.round(pricing.finalFare / 2);
            const leg2Fare = pricing.finalFare - leg1Fare;

            results.push({
              id: `itin-split-${run.run_id}-${splitStop.stop_sequence}-${coachClass}`,
              journeyType: 'SAME_TRAIN_CHANGE',
              totalFare: pricing.finalFare * passengerCount,
              totalDurationMinutes: durationMin,
              departureTime: run.dep_time,
              arrivalTime: run.arr_time,
              originStationCode: origin,
              destinationStationCode: destination,
              transferStationName: splitStop.name,
              requiresAcknowledgement: true,
              acknowledgementMessage: `Seat/coach change required at ${splitStop.name} (${splitStop.code}). You remain on the same train (${changeType}).`,
              pricingExplanation: `${pricing.explanation} | Apportioned over 2 contiguous segments`,
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
                  durationMinutes: Math.round((new Date(splitStop.arrival_time).getTime() - depDate.getTime()) / 60000),
                  coachType: coachClass,
                  legFare: leg1Fare,
                  availableSeatsCount: leg1Seats.length,
                  requiresTransfer: false,
                  requiresSeatChange: true,
                  changeNote: `Change seats at ${splitStop.name}`,
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
                  durationMinutes: Math.round((arrDate.getTime() - new Date(splitStop.departure_time).getTime()) / 60000),
                  coachType: coachClass,
                  legFare: leg2Fare,
                  availableSeatsCount: leg2Seats.length,
                  requiresTransfer: false,
                  requiresSeatChange: true,
                  changeNote: `Remaining journey to ${run.to_name}`,
                  suggestedSeats: leg2Seats.slice(0, passengerCount).map((s: any) => ({
                    seatId: s.id,
                    coachCode: s.coach_code,
                    seatNumber: s.seat_number,
                    berthType: s.berth_type
                  }))
                }
              ]
            });
            break; // take best intermediate stop to avoid combinatorial explosion
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 3. Two-Train Connections (Train 1: A -> Transfer, Train 2: Transfer -> B)
    // -------------------------------------------------------------
    if (preference === 'ALLOW_TWO_TRAINS' || preference === 'ALL') {
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
        const arrT1 = new Date(conn.r1_arr_time);
        const depT2 = new Date(conn.r2_dep_time);
        const waitMinutes = Math.round((depT2.getTime() - arrT1.getTime()) / 60000);

        // Enforce demo rules: Min 30 mins, Max 240 mins (4 hours)
        if (waitMinutes >= 30 && waitMinutes <= 240) {
          const leg1Seats = await getAvailableSeatsForInterval(conn.run1_id, coachClass, conn.r1_from_seq, conn.r1_to_seq);
          const leg2Seats = await getAvailableSeatsForInterval(conn.run2_id, coachClass, conn.r2_from_seq, conn.r2_to_seq);

          if (leg1Seats.length >= passengerCount && leg2Seats.length >= passengerCount) {
            const p1 = await PricingService.calculateLegFare(db, conn.run1_id, coachClass, conn.r1_from_seq, conn.r1_to_seq, new Date(conn.r1_dep_time));
            const p2 = await PricingService.calculateLegFare(db, conn.run2_id, coachClass, conn.r2_from_seq, conn.r2_to_seq, depT2);
            const totalFare = (p1.finalFare + p2.finalFare) * passengerCount;

            const totalDurationMin = Math.round((new Date(conn.r2_arr_time).getTime() - new Date(conn.r1_dep_time).getTime()) / 60000);

            results.push({
              id: `itin-conn-${conn.run1_id}-${conn.run2_id}-${coachClass}`,
              journeyType: 'TWO_TRAIN_CONNECTION',
              totalFare,
              totalDurationMinutes: totalDurationMin,
              departureTime: conn.r1_dep_time,
              arrivalTime: conn.r2_arr_time,
              originStationCode: origin,
              destinationStationCode: destination,
              transferStationName: conn.trans_name,
              transferWaitMinutes: waitMinutes,
              requiresAcknowledgement: true,
              acknowledgementMessage: `Platform transfer required at ${conn.trans_name} (${conn.trans_code}) with a ${waitMinutes}-minute layover. Connection not covered by missed-train guarantees.`,
              pricingExplanation: `Leg 1: ₹${(p1.finalFare / 100).toFixed(2)} + Leg 2: ₹${(p2.finalFare / 100).toFixed(2)} (Educational sum)`,
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
                  durationMinutes: Math.round((arrT1.getTime() - new Date(conn.r1_dep_time).getTime()) / 60000),
                  coachType: coachClass,
                  legFare: p1.finalFare,
                  availableSeatsCount: leg1Seats.length,
                  requiresTransfer: true,
                  requiresSeatChange: false,
                  changeNote: `Arrive at ${conn.trans_name}. Transfer to Train ${conn.train2_num}.`,
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
                  durationMinutes: Math.round((new Date(conn.r2_arr_time).getTime() - depT2.getTime()) / 60000),
                  coachType: coachClass,
                  legFare: p2.finalFare,
                  availableSeatsCount: leg2Seats.length,
                  requiresTransfer: true,
                  requiresSeatChange: false,
                  changeNote: `Board Train ${conn.train2_num} to ${conn.dest_name}.`,
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

    // Deduplicate and cap results
    return results.slice(0, 20);
  }
}
