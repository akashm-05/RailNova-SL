import { RiskService, ConnectionRiskReport } from './risk.service.js';

export interface SimulationState {
  delays: Record<string, number>; // runId -> delay in minutes
  cancelledRuns: string[];        // list of runIds marked cancelled in simulation
  blockedSeats: string[];         // list of seatIds temporarily blocked
  demandMultiplier: number;       // 1.0 = normal, 1.5 = +50% surge
  lastUpdated: string;
}

export class SimulatorService {
  private static delays: Map<string, number> = new Map();
  private static cancelledRuns: Set<string> = new Set();
  private static blockedSeats: Set<string> = new Set();
  private static demandMultiplier: number = 1.0;

  static getSimulationState(): SimulationState {
    const delaysObj: Record<string, number> = {};
    for (const [runId, delay] of this.delays.entries()) {
      delaysObj[runId] = delay;
    }

    return {
      delays: delaysObj,
      cancelledRuns: Array.from(this.cancelledRuns),
      blockedSeats: Array.from(this.blockedSeats),
      demandMultiplier: this.demandMultiplier,
      lastUpdated: new Date().toISOString()
    };
  }

  static setTrainDelay(runId: string, delayMinutes: number): SimulationState {
    if (delayMinutes <= 0) {
      this.delays.delete(runId);
    } else {
      this.delays.set(runId, delayMinutes);
    }
    return this.getSimulationState();
  }

  static setTrainCancelled(runId: string, cancelled: boolean): SimulationState {
    if (cancelled) {
      this.cancelledRuns.add(runId);
    } else {
      this.cancelledRuns.delete(runId);
    }
    return this.getSimulationState();
  }

  static setSeatBlocked(seatId: string, blocked: boolean): SimulationState {
    if (blocked) {
      this.blockedSeats.add(seatId);
    } else {
      this.blockedSeats.delete(seatId);
    }
    return this.getSimulationState();
  }

  static setDemandMultiplier(multiplier: number): SimulationState {
    this.demandMultiplier = Math.max(0.5, Math.min(3.0, multiplier));
    return this.getSimulationState();
  }

  static resetSimulation(): SimulationState {
    this.delays.clear();
    this.cancelledRuns.clear();
    this.blockedSeats.clear();
    this.demandMultiplier = 1.0;
    return this.getSimulationState();
  }

  static getDelayForRun(runId: string): number {
    return this.delays.get(runId) || 0;
  }

  static isRunCancelled(runId: string): boolean {
    return this.cancelledRuns.has(runId);
  }

  static isSeatBlocked(seatId: string): boolean {
    return this.blockedSeats.has(seatId);
  }

  static getDemandMultiplier(): number {
    return this.demandMultiplier;
  }
}
