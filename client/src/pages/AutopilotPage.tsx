import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Compass, Sliders, ArrowRight, Clock, ShieldCheck, AlertCircle, ChevronRight, CheckCircle2, Train, IndianRupee } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';

export const AutopilotPage: React.FC = () => {
  const navigate = useNavigate();

  const [stations, setStations] = useState<any[]>([]);
  const [origin, setOrigin] = useState('NDLS');
  const [destination, setDestination] = useState('HWH');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [date, setDate] = useState(tomorrow.toISOString().split('T')[0]);

  const [coachClass, setCoachClass] = useState('3A');
  const [passengerCount, setPassengerCount] = useState(1);
  const [objectiveWeight, setObjectiveWeight] = useState<'BALANCED' | 'CHEAPEST' | 'FASTEST' | 'SAFEST'>('BALANCED');
  const [maxTransfers, setMaxTransfers] = useState(0);
  const [minConnectionMinutes, setMinConnectionMinutes] = useState(30);
  const [maxFare, setMaxFare] = useState<number | undefined>(undefined);
  const [arrivalDeadlineTime, setArrivalDeadlineTime] = useState<string>('');
  const [preferredBerth, setPreferredBerth] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any | null>(null);

  useEffect(() => {
    apiFetch('/api/stations')
      .then(data => {
        if (Array.isArray(data)) setStations(data);
      })
      .catch(console.error);

    // Initial plan
    handlePlan();
  }, []);

  const handlePlan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        origin,
        destination,
        date,
        coachClass,
        passengerCount,
        objectiveWeight,
        maxTransfers: Number(maxTransfers),
        minConnectionMinutes: Number(minConnectionMinutes),
        useSimulation: true
      };

      if (maxFare) payload.maxFare = Number(maxFare);
      if (arrivalDeadlineTime) payload.arrivalDeadlineTime = arrivalDeadlineTime;
      if (preferredBerth) payload.preferredBerth = preferredBerth;

      const data = await apiFetch('/api/autopilot/plan', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setResults(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Autopilot planning failed.');
      setLoading(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getRiskBadge = (level: string) => {
    if (level === 'SAFE' || level === 'LOW') {
      return <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">Low Risk</span>;
    }
    if (level === 'MODERATE') {
      return <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">Moderate Risk</span>;
    }
    return <span className="bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded text-[10px] font-bold">High Layover Risk</span>;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Autopilot Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Graph-Search Multi-Objective Planner
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            RailNova Journey Autopilot
          </h1>
          <p className="text-xs sm:text-sm text-blue-200/90 mt-1 max-w-2xl">
            Optimizes multi-train connections across the network graph using multi-objective Pareto ranking (Fare, Duration, Transfers, and Layover Risk).
          </p>
        </div>

        {results?.activeSimulationApplied && (
          <div className="bg-amber-500/20 border border-amber-400/40 text-amber-200 px-3.5 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            <span>Simulated Scenario Active</span>
          </div>
        )}
      </div>

      {/* Constraints & Objective Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Search Parameters & Constraints</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {results?.graphStats?.stationsCount || 7} Nodes • {results?.graphStats?.activeRunsCount || 2} Edge Sets
          </span>
        </div>

        <form onSubmit={handlePlan} className="space-y-4">
          {/* Row 1: Origin, Destination, Date, Class */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">From</label>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50"
              >
                {stations.map(s => (
                  <option key={s.id} value={s.code}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">To</label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50"
              >
                {stations.map(s => (
                  <option key={s.id} value={s.code}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Class</label>
              <select
                value={coachClass}
                onChange={(e) => setCoachClass(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50"
              >
                <option value="3A">AC 3 Tier (3A)</option>
                <option value="2A">AC 2 Tier (2A)</option>
                <option value="1A">First AC (1A)</option>
                <option value="SL">Sleeper (SL)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Optimization Goal & Advanced Constraints */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Optimization Goal</label>
              <select
                value={objectiveWeight}
                onChange={(e) => setObjectiveWeight(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border border-blue-300 text-xs font-bold bg-blue-50/50 text-blue-900"
              >
                <option value="BALANCED">Balanced (Pareto Optimal)</option>
                <option value="CHEAPEST">Cheapest Fare First</option>
                <option value="FASTEST">Shortest Duration First</option>
                <option value="SAFEST">Safest Layover Buffer</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Max Transfers</label>
              <select
                value={maxTransfers}
                onChange={(e) => setMaxTransfers(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50"
              >
                <option value={0}>0 (Direct Only)</option>
                <option value={1}>At most 1 Transfer</option>
                <option value={2}>Up to 2 Transfers</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Min Layover Buffer</label>
              <select
                value={minConnectionMinutes}
                onChange={(e) => setMinConnectionMinutes(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50"
              >
                <option value={20}>20 Minutes (Aggressive)</option>
                <option value={30}>30 Minutes (Standard)</option>
                <option value={45}>45 Minutes (Comfortable)</option>
                <option value={60}>60 Minutes (Maximum Safety)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Arrival Deadline</label>
              <input
                type="text"
                placeholder="e.g. 22:00 or noon"
                value={arrivalDeadlineTime}
                onChange={(e) => setArrivalDeadlineTime(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2 transition"
            >
              {loading ? (
                <span>Evaluating Graph...</span>
              ) : (
                <>
                  <Compass className="w-4 h-4" />
                  <span>Run Journey Autopilot</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Autopilot Results List */}
      <div className="space-y-4">
        {results?.itineraries?.map((itinerary: any, idx: number) => {
          const isDirect = itinerary.journeyType === 'DIRECT';
          const isSeatChange = itinerary.journeyType === 'SAME_TRAIN_CHANGE';
          const isConnection = itinerary.journeyType === 'TWO_TRAIN_CONNECTION';

          return (
            <div
              key={itinerary.id}
              className={`bg-white rounded-3xl border-2 transition overflow-hidden shadow-sm hover:shadow-md ${
                idx === 0 ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'
              }`}
            >
              {/* Ranking Score Header */}
              <div className="px-6 py-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`px-3 py-1 rounded-full text-xs font-black font-mono shadow-sm ${
                    idx === 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800'
                  }`}>
                    Rank #{idx + 1} • {itinerary.rankingScore}/100
                  </span>

                  {idx === 0 && (
                    <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                      Autopilot Top Pick
                    </span>
                  )}

                  {getRiskBadge(itinerary.connectionRisk?.level)}
                </div>

                <span className="text-xs text-slate-500 font-semibold">
                  {itinerary.transfersCount === 0 ? 'Direct Route' : `${itinerary.transfersCount} Transfer (${itinerary.transferStationName || 'Station'})`}
                </span>
              </div>

              {/* Body */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Timeline & Train Details */}
                <div className="md:col-span-8 space-y-4">
                  <div className="flex items-center justify-between max-w-lg">
                    <div>
                      <span className="text-2xl font-black text-slate-900">{formatTime(itinerary.departureTime)}</span>
                      <p className="text-sm font-bold text-slate-700">{origin}</p>
                    </div>

                    <div className="flex-1 px-6 text-center">
                      <span className="text-[11px] font-mono text-slate-400 block mb-1">
                        {Math.floor(itinerary.totalDurationMinutes / 60)}h {itinerary.totalDurationMinutes % 60}m
                      </span>
                      <div className="relative flex items-center justify-center">
                        <div className="w-full h-0.5 bg-slate-200"></div>
                        <div className="absolute w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow"></div>
                      </div>
                      {itinerary.transferWaitMinutes && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 block mt-1">
                          {itinerary.transferWaitMinutes}m layover at {itinerary.transferStationName}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-2xl font-black text-slate-900">{formatTime(itinerary.arrivalTime)}</span>
                      <p className="text-sm font-bold text-slate-700">{destination}</p>
                    </div>
                  </div>

                  {/* Ranking Explanation */}
                  <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-2xl text-xs text-blue-950">
                    <strong className="font-semibold text-blue-900">Why Autopilot Ranked This:</strong> {itinerary.rankingExplanation}
                  </div>

                  {/* Constraint violations if any */}
                  {!itinerary.meetsAllConstraints && (
                    <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900">
                      ⚠️ Note: {itinerary.constraintsViolationReasons.join('; ')}
                    </div>
                  )}
                </div>

                {/* Price & Book Action */}
                <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 flex flex-col justify-between h-full space-y-3">
                  <div>
                    <span className="text-xs text-slate-500">Authoritative Total Fare</span>
                    <div className="text-3xl font-black text-slate-900">
                      ₹{(itinerary.totalFare / 100).toFixed(2)}
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 block mt-0.5">
                      ✓ Real PostgreSQL Seats Guaranteed
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      sessionStorage.setItem('railnova_selected_itinerary', JSON.stringify(itinerary));
                      navigate(`/seats?itineraryId=${encodeURIComponent(itinerary.id)}&passengerCount=${passengerCount}`);
                    }}
                    className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 transition"
                  >
                    <span>Book Itinerary</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
