import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Send, 
  MessageSquare, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  IndianRupee, 
  ShieldCheck, 
  AlertCircle, 
  SlidersHorizontal,
  Train,
  ArrowRight
} from 'lucide-react';
import { apiFetch } from '../context/AuthContext';

interface ExplainStep {
  step: string;
  detail: string;
}

interface AssistantData {
  query: string;
  parsedConstraints: any;
  explainabilitySteps: ExplainStep[];
  conversationalSummary: string;
  recommendedItineraries: any[];
}

export const AssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const [queryInput, setQueryInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assistantData, setAssistantData] = useState<AssistantData | null>(null);

  const quickPrompts = [
    'Cheapest route from Delhi to Howrah tomorrow',
    'Fastest train from Delhi to Kanpur with lower berth',
    'Avoid transfers shorter than 40 minutes from Delhi to Howrah',
    'Direct train only from Delhi to Howrah',
    'Arriving before noon with at most 1 transfer'
  ];

  const handleAsk = async (textToSubmit?: string) => {
    const q = textToSubmit || queryInput;
    if (!q.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch('/api/assistant/ask', {
        method: 'POST',
        body: JSON.stringify({ query: q })
      });
      setAssistantData(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Assistant request failed.');
      setLoading(false);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return isoString;
    }
  };

  const getRiskColor = (tier: string) => {
    switch (tier) {
      case 'SAFE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'MODERATE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'HIGH':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Deterministic NLP & Explainable Search
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Explainable Travel Assistant
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Conversational query planner that maps natural language travel goals into formal database constraints, explaining every deduction and serving live PostgreSQL-verified tickets.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-2xl border border-white/20 text-xs text-blue-200">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Zero Hallucinations Guarantee</span>
        </div>
      </div>

      {/* Query Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
          Describe your travel plans or preferences
        </label>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MessageSquare className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAsk();
              }}
              placeholder="e.g., 'Cheapest route from Delhi to Howrah tomorrow with lower berth and max 1 transfer'"
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>
          <button
            onClick={() => handleAsk()}
            disabled={loading || !queryInput.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-2xl shadow-md shadow-blue-500/20 flex items-center gap-2 transition"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>Ask</span>
                <Send className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs font-semibold text-slate-400">Try asking:</span>
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQueryInput(prompt);
                handleAsk(prompt);
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition"
            >
              "{prompt}"
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Container */}
      {assistantData && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Assistant Recommendation
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {assistantData.conversationalSummary}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Deductions & Explainability */}
            <div className="lg:col-span-1 space-y-6">
              {/* Parsed Search Parameters */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Extracted Constraints
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block font-medium">Origin</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {assistantData.parsedConstraints.origin}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block font-medium">Destination</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {assistantData.parsedConstraints.destination}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block font-medium">Travel Date</span>
                    <span className="font-bold text-slate-900">
                      {assistantData.parsedConstraints.date}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block font-medium">Coach Class</span>
                    <span className="font-bold text-slate-900">
                      {assistantData.parsedConstraints.coachClass}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block font-medium">Max Transfers</span>
                    <span className="font-bold text-slate-900">
                      {assistantData.parsedConstraints.maxTransfers}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block font-medium">Optimization</span>
                    <span className="font-bold text-indigo-700">
                      {assistantData.parsedConstraints.objectiveWeight}
                    </span>
                  </div>
                  {assistantData.parsedConstraints.arrivalDeadlineTime && (
                    <div className="p-2.5 bg-slate-50 rounded-xl col-span-2">
                      <span className="text-slate-400 block font-medium">Arrival Deadline</span>
                      <span className="font-bold text-slate-900">
                        Before {assistantData.parsedConstraints.arrivalDeadlineTime}
                      </span>
                    </div>
                  )}
                  {assistantData.parsedConstraints.preferredBerth && (
                    <div className="p-2.5 bg-slate-50 rounded-xl col-span-2">
                      <span className="text-slate-400 block font-medium">Preferred Berth</span>
                      <span className="font-bold text-emerald-700">
                        {assistantData.parsedConstraints.preferredBerth}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Explainability Stepper */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Reasoning Trace
                  </h3>
                </div>

                <div className="space-y-4">
                  {assistantData.explainabilitySteps.map((step, idx) => (
                    <div key={idx} className="relative pl-6 pb-2">
                      {idx !== assistantData.explainabilitySteps.length - 1 && (
                        <div className="absolute left-2.5 top-5 bottom-0 w-0.5 bg-slate-200" />
                      )}
                      <div className="absolute left-0 top-1 w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center border border-blue-300">
                        {idx + 1}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {step.step}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        {step.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Bookable Recommendations */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Available Bookable Itineraries ({assistantData.recommendedItineraries.length})
                </h3>
                <span className="text-xs font-mono text-emerald-600 font-semibold">
                  ✓ Verified against PostgreSQL Timetable & Inventory
                </span>
              </div>

              {assistantData.recommendedItineraries.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800">No Matching Trains Found</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Try broadening your search constraints, loosening arrival deadlines, or permitting connecting routes.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assistantData.recommendedItineraries.map((itinerary: any, idx: number) => {
                    const isDirect = itinerary.journeyType === 'DIRECT';
                    const isSameTrain = itinerary.journeyType === 'SAME_TRAIN_SEAT_CHANGE';
                    const riskTier = itinerary.riskReport?.riskTier || 'SAFE';

                    return (
                      <div
                        key={itinerary.id || idx}
                        className={`bg-white rounded-3xl border ${
                          idx === 0 ? 'border-blue-300 shadow-md ring-1 ring-blue-500/20' : 'border-slate-200 shadow-sm'
                        } overflow-hidden transition hover:shadow-md`}
                      >
                        {/* Card Header */}
                        <div className="bg-slate-50/80 px-6 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {idx === 0 && (
                              <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider">
                                Top Pick
                              </span>
                            )}
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 font-semibold text-[11px]">
                              {isDirect ? 'Direct Train' : isSameTrain ? 'Seat Change (Same Train)' : '2-Train Connection'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getRiskColor(riskTier)}`}>
                              {riskTier} RISK ({itinerary.riskReport?.riskScore || 0}/100)
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400 font-mono">Ranking Score:</span>
                            <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {itinerary.rankingScore}/100
                            </span>
                          </div>
                        </div>

                        {/* Card Content */}
                        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                          {/* Schedule & Route info */}
                          <div className="md:col-span-8 space-y-4">
                            <div className="flex items-center justify-between max-w-md">
                              <div>
                                <span className="text-2xl font-black text-slate-900">
                                  {formatTime(itinerary.departureTime)}
                                </span>
                                <p className="text-xs font-bold text-slate-600">
                                  {assistantData.parsedConstraints.origin}
                                </p>
                              </div>

                              <div className="flex-1 px-4 text-center">
                                <span className="text-[11px] font-mono text-slate-400 block mb-1">
                                  {Math.floor(itinerary.totalDurationMinutes / 60)}h {itinerary.totalDurationMinutes % 60}m
                                </span>
                                <div className="relative flex items-center justify-center">
                                  <div className="w-full h-0.5 bg-slate-200" />
                                  <div className="absolute w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white shadow" />
                                </div>
                                {itinerary.transferWaitMinutes && (
                                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 block mt-1">
                                    {itinerary.transferWaitMinutes}m layover at {itinerary.transferStationName}
                                  </span>
                                )}
                              </div>

                              <div className="text-right">
                                <span className="text-2xl font-black text-slate-900">
                                  {formatTime(itinerary.arrivalTime)}
                                </span>
                                <p className="text-xs font-bold text-slate-600">
                                  {assistantData.parsedConstraints.destination}
                                </p>
                              </div>
                            </div>

                            {/* Train Legs */}
                            <div className="space-y-1.5 pt-2">
                              {itinerary.legs.map((leg: any, lIdx: number) => (
                                <div key={lIdx} className="flex items-center gap-2 text-xs text-slate-600">
                                  <Train className="w-3.5 h-3.5 text-blue-600" />
                                  <span className="font-bold text-slate-800">
                                    {leg.trainNumber} {leg.trainName}
                                  </span>
                                  <span className="text-slate-400">•</span>
                                  <span>{leg.fromStation} ➔ {leg.toStation}</span>
                                  <span className="text-slate-400">•</span>
                                  <span className="font-mono text-slate-500">Coach {leg.coachClass}</span>
                                </div>
                              ))}
                            </div>

                            {/* Ranking Explanation */}
                            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-2xl text-xs text-blue-950">
                              <strong className="font-semibold text-blue-900">Why Autopilot Ranked This:</strong>{' '}
                              {itinerary.rankingExplanation}
                            </div>
                          </div>

                          {/* Price & Book */}
                          <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 flex flex-col justify-between h-full space-y-3">
                            <div>
                              <span className="text-xs text-slate-400 block font-medium">Calculated Total Fare</span>
                              <div className="text-2xl font-black text-slate-900">
                                ₹{(itinerary.totalFare / 100).toFixed(2)}
                              </div>
                              <span className="text-[11px] font-semibold text-emerald-700 block mt-0.5">
                                ✓ Live Inventory Verified
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                sessionStorage.setItem('railnova_selected_itinerary', JSON.stringify(itinerary));
                                navigate(`/seats?itineraryId=${encodeURIComponent(itinerary.id)}&passengerCount=${assistantData.parsedConstraints.passengerCount || 1}`);
                              }}
                              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition"
                            >
                              <span>Book Route</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
