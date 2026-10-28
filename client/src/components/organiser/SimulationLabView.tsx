import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  AlertTriangle, 
  RefreshCw, 
  Train, 
  ArrowRight, 
  ShieldCheck, 
  Flame, 
  Ban, 
  Clock, 
  CheckCircle2 
} from 'lucide-react';
import { apiFetch } from '../../context/AuthContext';

export const SimulationLabView: React.FC = () => {
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
    runImpactEval();
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

  const handleApplySurge = async () => {
    setEvaluating(true);
    await apiFetch('/api/simulator/surge', {
      method: 'POST',
      body: JSON.stringify({ multiplier: surgeMultiplier })
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4 shadow-xl border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2 border border-amber-400/30">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            Isolated Sandbox Environment
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            What-If Railway Disruption Simulator
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-2xl mt-1">
            Simulate operational disruptions like delays, train cancellations, and demand spikes without affecting real confirmed bookings or live database inventory.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Reset Baseline Scenario
        </button>
      </div>

      {/* Simulator Controls & Real-Time Impact Evaluation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Disruption Controls */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Train className="w-4 h-4 text-blue-600" />
              Target Train Service
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Select Train Run</label>
              <select
                value={targetRunId}
                onChange={e => setTargetRunId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-medium"
              >
                <option value="run-12301-2026-10-29">12301 - Rajdhani Express (NDLS ➔ HWH)</option>
                <option value="run-12004-2026-10-29">12004 - Shatabdi Express (NDLS ➔ CNB)</option>
                <option value="run-12382-2026-10-29">12382 - Poorva Express (CNB ➔ HWH)</option>
              </select>
            </div>

            {/* Injected Delay Slider */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="flex items-center gap-1 text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Inject Delay (Minutes):
                </span>
                <span className="font-mono text-blue-700 font-bold">+{delayInput} mins</span>
              </div>
              <input
                type="range"
                min="0"
                max="180"
                step="5"
                value={delayInput}
                onChange={e => setDelayInput(parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
              <button
                onClick={handleApplyDelay}
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition"
              >
                Apply Injected Delay
              </button>
            </div>

            {/* Train Cancellation Toggle */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-800">Simulate Full Cancellation</div>
                <div className="text-[10px] text-slate-400">Reroutes all affected connections</div>
              </div>
              <button
                onClick={handleToggleCancel}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                  isCancelled 
                    ? 'bg-rose-600 text-white shadow-md' 
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {isCancelled ? 'CANCELLED' : 'ACTIVE'}
              </button>
            </div>

            {/* Demand Surge */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="flex items-center gap-1 text-slate-700">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  Simulate Demand Surge:
                </span>
                <span className="font-mono text-amber-600 font-bold">{surgeMultiplier}x</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="2.5"
                step="0.1"
                value={surgeMultiplier}
                onChange={e => setSurgeMultiplier(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
              <button
                onClick={handleApplySurge}
                className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition"
              >
                Apply Demand Multiplier
              </button>
            </div>
          </div>
        </div>

        {/* Right: Simulated Route Recalculation */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Live Recalculated Itineraries</h2>
              <p className="text-xs text-slate-500">Autopilot graph rerouting with simulated disruption constraints</p>
            </div>
            {evaluating && (
              <span className="text-xs font-bold text-blue-600 animate-pulse">
                Recalculating graph...
              </span>
            )}
          </div>

          <div className="space-y-3">
            {!impactReport || impactReport.itineraries?.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No itineraries available under the active disruption scenario.
              </div>
            ) : (
              impactReport.itineraries.map((it: any, idx: number) => {
                const isRiskHigh = it.connectionRisk?.level === 'HIGH';
                const isDisrupted = it.isSimulatedDisrupted;

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition ${
                      idx === 0 
                        ? 'border-blue-500/50 bg-blue-50/20' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-900 text-white">
                          #{idx + 1} Best Route
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {it.type === 'DIRECT' ? 'Direct Service' : it.type === 'SAME_TRAIN_CHANGE' ? 'Same-Train Switch' : '2-Train Transfer'}
                        </span>
                      </div>
                      <div className="font-mono font-black text-slate-900 text-sm">
                        ₹{(Number(it.totalFarePaise || 0) / 100).toFixed(2)}
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 font-medium space-y-1 mb-3">
                      <div className="flex items-center gap-2">
                        <span>Duration: {it.durationMinutes} mins</span>
                        <span>•</span>
                        <span>Transfers: {it.transfersCount}</span>
                        {it.connectionRisk && (
                          <>
                            <span>•</span>
                            <span className={`font-bold ${isRiskHigh ? 'text-rose-600' : 'text-emerald-600'}`}>
                              Risk Score: {it.connectionRisk.score}/100 ({it.connectionRisk.level})
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 italic">
                        "{it.explanation}"
                      </p>
                    </div>

                    {/* Legs preview */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                      {it.legs?.map((leg: any, lIdx: number) => (
                        <div key={lIdx} className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                          <div className="font-bold text-slate-800">{leg.trainNumber} - {leg.trainName}</div>
                          <div className="text-slate-500 font-mono">
                            {leg.fromStationCode} ➔ {leg.toStationCode}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
