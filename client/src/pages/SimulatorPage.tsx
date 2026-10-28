import React, { useState, useEffect } from 'react';
import { Sliders, AlertTriangle, RefreshCw, Train, ArrowRight, ShieldCheck, Flame, Ban, Clock, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';

export const SimulatorPage: React.FC = () => {
  const [simState, setSimState] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetRunId, setTargetRunId] = useState('run-12301-2026-10-29');
  const [delayInput, setDelayInput] = useState(45);
  const [isCancelled, setIsCancelled] = useState(false);
  const [surgeMultiplier, setSurgeMultiplier] = useState(1.0);
  const [evaluating, setEvaluating] = useState(false);
  const [impactReport, setImpactReport] = useState<any | null>(null);

  const fetchState = () => {
    apiFetch('/api/simulator/state')
      .then(state => {
        setSimState(state);
        setLoading(false);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchState();
  }, []);

  const handleApplyDelay = async () => {
    setEvaluating(true);
    await apiFetch('/api/simulator/delay', {
      method: 'POST',
      body: JSON.stringify({ runId: targetRunId, delayMinutes: delayInput })
    });
    fetchState();
    runImpactEval();
  };

  const handleToggleCancel = async () => {
    setEvaluating(true);
    const newStatus = !isCancelled;
    setIsCancelled(newStatus);
    await apiFetch('/api/simulator/cancel', {
      method: 'POST',
      body: JSON.stringify({ runId: targetRunId, cancelled: newStatus })
    });
    fetchState();
    runImpactEval();
  };

  const handleReset = async () => {
    setEvaluating(true);
    setIsCancelled(false);
    setDelayInput(0);
    setSurgeMultiplier(1.0);
    await apiFetch('/api/simulator/reset', { method: 'POST' });
    fetchState();
    runImpactEval();
  };

  const runImpactEval = async () => {
    setEvaluating(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // Evaluate Delhi to Howrah under simulation
      const res = await apiFetch('/api/autopilot/plan', {
        method: 'POST',
        body: JSON.stringify({
          origin: 'NDLS',
          destination: 'HWH',
          date: dateStr,
          coachClass: '3A',
          useSimulation: true
        })
      });

      setImpactReport(res);
      setEvaluating(false);
    } catch (err) {
      console.error(err);
      setEvaluating(false);
    }
  };

  useEffect(() => {
    runImpactEval();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4 shadow-xl border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2 border border-amber-400/30">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            Isolated Sandbox Environment
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            What-If Journey Simulator
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Simulate delays, cancellations, and demand spikes without mutating confirmed passenger bookings. Observe real-time connection risk propagation and recovery routing.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center gap-1.5 border border-amber-500/40 transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
          <span>Restore Original Scenario</span>
        </button>
      </div>

      {/* Simulator Control Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Delay Injection */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
              Inject Train Delay
            </h3>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Target Service</label>
            <select
              value={targetRunId}
              onChange={(e) => setTargetRunId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50"
            >
              <option value="run-12301-2026-10-29">Train 12301 (RailNova Rajdhani)</option>
              <option value="run-12424-2026-10-29">Train 12424 (Eastern Connect)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1">
              <span>Delay Duration:</span>
              <span className="font-mono text-blue-600 font-black">{delayInput} minutes</span>
            </div>
            <input
              type="range"
              min="0"
              max="180"
              step="15"
              value={delayInput}
              onChange={(e) => setDelayInput(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>0m</span>
              <span>60m</span>
              <span>120m</span>
              <span>180m</span>
            </div>
          </div>

          <button
            onClick={handleApplyDelay}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
          >
            Apply Delay ({delayInput}m)
          </button>
        </div>

        {/* Card 2: Train Cancellation */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
              Service Cancellation
            </h3>
          </div>

          <p className="text-xs text-slate-500">
            Simulate unexpected track maintenance or weather cancellation on the selected train run.
          </p>

          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between">
            <span className="text-xs font-bold text-red-900">
              Run Cancelled: {isCancelled ? 'YES' : 'NO'}
            </span>
            <button
              onClick={handleToggleCancel}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition ${
                isCancelled ? 'bg-red-600 text-white' : 'bg-white border border-slate-300 text-slate-700'
              }`}
            >
              {isCancelled ? 'Restore Run' : 'Cancel Service'}
            </button>
          </div>
        </div>

        {/* Card 3: Demand Surge */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
              Simulated Demand Surge
            </h3>
          </div>

          <p className="text-xs text-slate-500">
            Simulate holiday rush conditions to evaluate dynamic pricing adjustments and berth depletion.
          </p>

          <div className="flex items-center gap-2">
            {[1.0, 1.5, 2.0].map((mult) => (
              <button
                key={mult}
                onClick={async () => {
                  setSurgeMultiplier(mult);
                  await apiFetch('/api/simulator/surge', {
                    method: 'POST',
                    body: JSON.stringify({ multiplier: mult })
                  });
                  fetchState();
                  runImpactEval();
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  surgeMultiplier === mult ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {mult === 1.0 ? 'Normal' : `${mult}x Surge`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Real-Time Impact Evaluation Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Real-Time Impact & Connection Feasibility Report
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Route evaluated: New Delhi (NDLS) ➔ Howrah (HWH) under active simulation parameters.
            </p>
          </div>

          {evaluating && (
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Recalculating Feasibility...</span>
            </div>
          )}
        </div>

        {impactReport?.itineraries?.length === 0 ? (
          <div className="p-8 text-center bg-red-50 border border-red-200 rounded-2xl space-y-2">
            <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
            <h3 className="font-bold text-red-900 text-sm">All direct and connecting services disrupted!</h3>
            <p className="text-xs text-red-700 max-w-md mx-auto">
              Under current simulated cancellation or delay parameters, no feasible travel connections exist. Click "Restore Original Scenario" to recover baseline schedule.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {impactReport?.itineraries?.map((it: any, idx: number) => {
              const risk = it.connectionRisk;
              const isBroken = !risk?.isFeasible;

              return (
                <div
                  key={it.id}
                  className={`p-5 rounded-2xl border transition ${
                    isBroken 
                      ? 'bg-red-50/70 border-red-300' 
                      : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-lg bg-white border border-slate-300">
                        {it.journeyType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {it.legs.map((l: any) => `${l.trainName} (${l.trainNumber})`).join(' ➔ ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${
                        risk?.level === 'CRITICAL' ? 'bg-red-600 text-white' :
                        risk?.level === 'HIGH' ? 'bg-amber-500 text-white' :
                        'bg-emerald-600 text-white'
                      }`}>
                        Risk: {risk?.level} (Score {risk?.score}/100)
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-8 space-y-2 text-xs">
                      <p className="text-slate-700">
                        <strong>Connection Assessment:</strong> {risk?.explanation}
                      </p>
                      {it.transferWaitMinutes !== undefined && (
                        <p className="text-slate-500 font-mono">
                          Effective Transfer Layover: <strong className="text-slate-900">{risk?.effectiveLayoverMinutes} minutes</strong> (Scheduled: {risk?.layoverMinutes}m)
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-4 text-right">
                      <span className="text-xs text-slate-500 block">Total Simulated Fare</span>
                      <span className="text-2xl font-black text-slate-900">
                        ₹{(it.totalFare / 100).toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
