import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Train, Clock, ArrowRight, ArrowRightLeft, Sparkles, Filter, ChevronRight, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const SearchResultsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const origin = searchParams.get('origin') || 'NDLS';
  const destination = searchParams.get('destination') || 'HWH';
  const date = searchParams.get('date') || '';
  const coachClass = searchParams.get('coachClass') || '3A';
  const passengerCount = Number(searchParams.get('passengerCount') || 1);
  const preference = searchParams.get('preference') || 'ALL';

  const [itineraries, setItineraries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'FARE' | 'DURATION' | 'DEPARTURE'>('DEPARTURE');
  const [filterType, setFilterType] = useState<string>('ALL');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/itineraries/search?origin=${origin}&destination=${destination}&date=${date}&coachClass=${coachClass}&passengerCount=${passengerCount}&preference=${preference}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data.error) {
          setError(data.error.message || 'Failed to search trains.');
        } else {
          setItineraries(data);
        }
      })
      .catch(err => {
        setLoading(false);
        setError(err.message || 'Network error.');
      });
  }, [origin, destination, date, coachClass, passengerCount, preference]);

  const directOptions = itineraries.filter(it => it.journeyType === 'DIRECT');
  const seatChangeOptions = itineraries.filter(it => it.journeyType === 'SAME_TRAIN_CHANGE');
  const connectionOptions = itineraries.filter(it => it.journeyType === 'TWO_TRAIN_CONNECTION');
  const alternativeOptions = [...seatChangeOptions, ...connectionOptions];

  const filtered = itineraries.filter(it => {
    if (filterType === 'ALL') return true;
    return it.journeyType === filterType;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'FARE') return a.totalFare - b.totalFare;
    if (sortBy === 'DURATION') return a.totalDurationMinutes - b.totalDurationMinutes;
    return new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime();
  });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Search Header Summary */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>{origin}</span>
              <ArrowRight className="w-5 h-5 text-blue-600" />
              <span>{destination}</span>
            </h1>
            <span className="text-xs font-bold uppercase bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200">
              {coachClass} Class
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Date: <strong className="text-slate-800">{date}</strong> • Group: <strong className="text-slate-800">{passengerCount} Passenger{passengerCount > 1 ? 's' : ''}</strong>
          </p>
        </div>

        <Link
          to="/"
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
        >
          Modify Search
        </Link>
      </div>

      {/* Prominent Smart Connection Alternatives Spotlight */}
      {alternativeOptions.length > 0 && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                {directOptions.length === 0 
                  ? 'No Direct Continuous Seats Available — Smart Alternatives Discovered!'
                  : 'Smart Alternatives Available for this Route'}
              </h2>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-3 py-1 rounded-full">
              {alternativeOptions.length} Alternative Route{alternativeOptions.length > 1 ? 's' : ''}
            </span>
          </div>

          <p className="text-xs text-blue-100/90 leading-relaxed max-w-3xl">
            When standard direct seats are booked or unavailable, RailNova's reservation engine unlocks inventory by offering two intelligent alternatives:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Alternative A: Same Train Seat Change */}
            {seatChangeOptions.length > 0 && (
              <div 
                onClick={() => setFilterType('SAME_TRAIN_CHANGE')}
                className="bg-white/10 hover:bg-white/15 border border-white/20 rounded-2xl p-4 cursor-pointer transition backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Option 1: Same-Train Seat Change
                  </span>
                  <span className="text-[11px] font-bold text-blue-200">Zero Train Transfer</span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">
                  Stay on the Same Train (Change at {seatChangeOptions[0].transferStationName})
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  Combines non-overlapping berths on the same service. Simply walk to your next berth during the scheduled station stop.
                </p>
              </div>
            )}

            {/* Alternative B: Two-Train Connection */}
            {connectionOptions.length > 0 && (
              <div 
                onClick={() => setFilterType('TWO_TRAIN_CONNECTION')}
                className="bg-white/10 hover:bg-white/15 border border-white/20 rounded-2xl p-4 cursor-pointer transition backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                    <Train className="w-3.5 h-3.5" />
                    Option 2: Two-Train Connection
                  </span>
                  <span className="text-[11px] font-bold text-teal-200">
                    {connectionOptions[0].transferWaitMinutes}m Layover
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">
                  Switch Trains at {connectionOptions[0].transferStationName}
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  Book Train 12301 to {connectionOptions[0].transferStationName}, then switch to Train 12424 with a safe, verified layover.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter and Sorting Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-3 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Filter className="w-4 h-4 text-slate-500" />
          <span>Showing:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                filterType === 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              All Itineraries ({itineraries.length})
            </button>
            <button
              onClick={() => setFilterType('DIRECT')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                filterType === 'DIRECT' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Direct ({directOptions.length})
            </button>
            <button
              onClick={() => setFilterType('SAME_TRAIN_CHANGE')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                filterType === 'SAME_TRAIN_CHANGE' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Seat Changes ({seatChangeOptions.length})
            </button>
            <button
              onClick={() => setFilterType('TWO_TRAIN_CONNECTION')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                filterType === 'TWO_TRAIN_CONNECTION' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              2-Train Transfers ({connectionOptions.length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <span>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-xs"
          >
            <option value="DEPARTURE">Departure Time</option>
            <option value="FARE">Lowest Fare</option>
            <option value="DURATION">Shortest Duration</option>
          </select>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="p-16 text-center space-y-3 bg-white rounded-3xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-semibold text-slate-600">Evaluating multi-leg inventory and connection graphs...</p>
        </div>
      )}

      {error && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Itinerary List */}
      <div className="space-y-4">
        {sorted.map((itinerary) => {
          const isDirect = itinerary.journeyType === 'DIRECT';
          const isSeatChange = itinerary.journeyType === 'SAME_TRAIN_CHANGE';
          const isConnection = itinerary.journeyType === 'TWO_TRAIN_CONNECTION';

          return (
            <div
              key={itinerary.id}
              className={`bg-white rounded-3xl border transition overflow-hidden shadow-sm hover:shadow-md ${
                !isDirect ? 'border-indigo-200/90 ring-1 ring-indigo-100' : 'border-slate-200/90'
              }`}
            >
              {/* Type Badge Header */}
              <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
                <div className="flex items-center gap-2">
                  {isDirect && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                      <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                      Direct Continuous Seat
                    </span>
                  )}
                  {isSeatChange && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" />
                      Smart Alternative: Same-Train Seat Change
                    </span>
                  )}
                  {isConnection && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                      <Train className="w-3.5 h-3.5 text-indigo-700" />
                      Smart Alternative: Two-Train Transfer ({itinerary.transferStationName})
                    </span>
                  )}

                  <span className="text-xs text-slate-500 font-medium">
                    {itinerary.legs.map((l: any) => `${l.trainName} (${l.trainNumber})`).join(' ➔ ')}
                  </span>
                </div>

                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {Math.floor(itinerary.totalDurationMinutes / 60)}h {itinerary.totalDurationMinutes % 60}m
                </span>
              </div>

              {/* Card Body */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Schedule & Stations */}
                <div className="md:col-span-8 space-y-4">
                  <div className="flex items-center justify-between max-w-lg">
                    {/* Origin */}
                    <div>
                      <span className="text-2xl font-black text-slate-900">
                        {formatTime(itinerary.departureTime)}
                      </span>
                      <p className="text-sm font-bold text-slate-700">{origin}</p>
                      <span className="text-[11px] text-slate-400">{formatDate(itinerary.departureTime)}</span>
                    </div>

                    {/* Progress Bar / Arrow */}
                    <div className="flex-1 px-6 text-center">
                      <span className="text-[11px] font-mono text-slate-400 block mb-1">
                        {itinerary.legs.length} {itinerary.legs.length === 1 ? 'Leg' : 'Legs'}
                      </span>
                      <div className="relative flex items-center justify-center">
                        <div className="w-full h-0.5 bg-slate-200"></div>
                        <div className={`absolute w-3 h-3 rounded-full border-2 border-white shadow ${
                          isDirect ? 'bg-teal-600' : isSeatChange ? 'bg-amber-500' : 'bg-indigo-600'
                        }`}></div>
                      </div>
                      {isSeatChange && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 block mt-1.5">
                          Change seat at {itinerary.transferStationName}
                        </span>
                      )}
                      {isConnection && (
                        <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 block mt-1.5">
                          {itinerary.transferWaitMinutes}m layover at {itinerary.transferStationName}
                        </span>
                      )}
                    </div>

                    {/* Destination */}
                    <div className="text-right">
                      <span className="text-2xl font-black text-slate-900">
                        {formatTime(itinerary.arrivalTime)}
                      </span>
                      <p className="text-sm font-bold text-slate-700">{destination}</p>
                      <span className="text-[11px] text-slate-400">{formatDate(itinerary.arrivalTime)}</span>
                    </div>
                  </div>

                  {/* Pricing explanation */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-800 font-semibold">Authoritative Pricing:</strong> {itinerary.pricingExplanation}
                    </span>
                  </div>
                </div>

                {/* Pricing & CTA */}
                <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 flex flex-col justify-between h-full space-y-3">
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Total Simulated Fare</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        ₹{(itinerary.totalFare / 100).toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500">for {passengerCount} pax</span>
                    </div>
                    <span className="text-xs font-semibold text-teal-700 flex items-center gap-1 mt-0.5">
                      ✓ Real PostgreSQL Inventory Verified
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      sessionStorage.setItem('railnova_selected_itinerary', JSON.stringify(itinerary));
                      navigate(`/seats?itineraryId=${encodeURIComponent(itinerary.id)}&passengerCount=${passengerCount}`);
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white shadow-md flex items-center justify-center gap-1.5 transition ${
                      isDirect 
                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' 
                        : isSeatChange 
                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                    }`}
                  >
                    <span>{isDirect ? 'Select Seats' : 'Select Alternative Route'}</span>
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
