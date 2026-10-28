import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  IndianRupee, 
  AlertCircle, 
  Ban, 
  TrendingUp, 
  Armchair, 
  ShieldCheck, 
  RefreshCw, 
  FileText,
  Ticket,
  Train,
  CheckCircle2,
  Clock,
  Sliders,
  DollarSign,
  Trash2
} from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';

export const OrganiserDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [fareRules, setFareRules] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'BOOKINGS' | 'HEATMAP' | 'RULES'>('BOOKINGS');
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [manifest, setManifest] = useState<any | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [cancellingRun, setCancellingRun] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadAllData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [analyticsData, bookingsData, rulesData] = await Promise.all([
        apiFetch('/api/admin/analytics'),
        apiFetch('/api/admin/bookings'),
        apiFetch('/api/admin/fare-rules')
      ]);

      setAnalytics(analyticsData);
      setBookings(bookingsData || []);
      setFareRules(rulesData || []);
      setError(null);
      setLoading(false);
      setRefreshing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load organiser data.');
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
    // Auto-refresh every 8 seconds so any newly placed bookings appear dynamically
    const interval = setInterval(() => {
      loadAllData(false);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleViewManifest = (runId: string) => {
    setSelectedRunId(runId);
    setLoadingManifest(true);
    apiFetch(`/api/admin/manifest/${runId}`)
      .then(data => {
        setManifest(data);
        setLoadingManifest(false);
      })
      .catch(err => {
        alert(err.message || 'Failed to load manifest.');
        setLoadingManifest(false);
      });
  };

  const handleCancelRun = async (runId: string, trainNum: string) => {
    if (!confirm(`CAUTION: Are you sure you want to cancel Train Run ${trainNum}? All active bookings on this run will be cancelled and automatically refunded.`)) {
      return;
    }

    setCancellingRun(true);
    try {
      const res = await apiFetch(`/api/admin/runs/${runId}/cancel`, { method: 'POST' });
      setActionMessage(res.message);
      setCancellingRun(false);
      loadAllData(true);
      if (selectedRunId === runId) {
        setSelectedRunId(null);
      }
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      setCancellingRun(false);
      alert(err.message || 'Failed to cancel train run.');
    }
  };

  const handleCancelBooking = async (bookingId: string, pnr: string) => {
    if (!confirm(`Cancel customer booking ${pnr} and issue an immediate mock refund?`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/admin/bookings/${bookingId}/cancel`, { method: 'POST' });
      setActionMessage(res.message);
      loadAllData(true);
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel booking.');
    }
  };

  const handleClearAllLogs = async () => {
    if (!confirm('Are you sure you want to clear all booking logs and reset inventory? This will clear all previous demo bookings so fresh reservations can be logged.')) {
      return;
    }
    setClearing(true);
    try {
      const res = await apiFetch('/api/admin/bookings/clear-all', { method: 'POST' });
      setActionMessage(res.message);
      setClearing(false);
      loadAllData(true);
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      setClearing(false);
      alert(err.message || 'Failed to clear booking logs.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center space-y-3">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm font-semibold text-slate-600">Connecting to PostgreSQL and compiling railway metrics...</p>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-sm font-medium">
          {error || 'Unable to load organiser console.'}
        </div>
        <button
          onClick={() => loadAllData(true)}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const { financialMetrics, inventoryMetrics, runs } = analytics;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-indigo-600" />
              <span>Railway Organiser Administration</span>
            </h1>
            <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
              Live Division Console
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Administrator: <strong className="text-slate-800">{user?.name}</strong> ({user?.email}) • Real-time database metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearAllLogs}
            disabled={clearing}
            className="px-3.5 py-2 rounded-xl border border-rose-300 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>{clearing ? 'Clearing...' : 'Clear All Booking Logs'}</span>
          </button>

          <button
            onClick={() => loadAllData(true)}
            disabled={refreshing}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Live Data'}</span>
          </button>
        </div>
      </div>

      {/* Action notification banner */}
      {actionMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Collections */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Net Collections
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            ₹{(financialMetrics.netCollectionsPaise / 100).toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400">
            Gross ₹{(financialMetrics.grossCollectionsPaise / 100).toFixed(2)} minus refunds
          </p>
        </div>

        {/* Completed Refunds */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block">
            Completed Mock Refunds
          </span>
          <div className="text-2xl font-black text-rose-600 tracking-tight">
            ₹{(financialMetrics.completedRefundsPaise / 100).toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400">
            Processed cancellation & disruption refunds
          </p>
        </div>

        {/* Customer Bookings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">
            Customer Bookings
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {financialMetrics.totalCustomerBookings} Bookings
          </div>
          <p className="text-[11px] text-slate-400">
            Total {bookings.length} reservations recorded
          </p>
        </div>

        {/* Active Holds */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block">
            Active Seat Holds
          </span>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {inventoryMetrics.activeHolds} Held
          </div>
          <p className="text-[11px] text-slate-400">
            {inventoryMetrics.confirmedOccupiedSegments} confirmed segment reservations
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('BOOKINGS')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'BOOKINGS'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Ticket className="w-4 h-4 text-indigo-600" />
          <span>All Customer Bookings ({bookings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('HEATMAP')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'HEATMAP'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Train className="w-4 h-4 text-indigo-600" />
          <span>Train Services & Occupancy Heatmap ({runs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('RULES')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'RULES'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4 text-indigo-600" />
          <span>Fare Rules Rate Card ({fareRules.length})</span>
        </button>
      </div>

      {/* TAB 1: ALL CUSTOMER BOOKINGS (Requested Feature) */}
      {activeTab === 'BOOKINGS' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Live Customer Bookings Registry
              </h2>
              <p className="text-xs text-slate-500">
                Updates dynamically as new passenger reservations, seat holds, or payments are completed.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              ● Live PostgreSQL Stream
            </span>
          </div>

          {bookings.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Ticket className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-sm">No bookings recorded in database yet.</p>
              <p className="text-xs text-slate-400 mt-1">Bookings made by passengers will appear here automatically.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">PNR / Ref</th>
                    <th className="p-3.5">Passenger(s)</th>
                    <th className="p-3.5">Train Service</th>
                    <th className="p-3.5">Route</th>
                    <th className="p-3.5">Total Fare</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Date & Time</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {bookings.map((b: any) => {
                    const isConfirmed = b.status === 'CONFIRMED';
                    const isPending = b.status === 'PENDING_PAYMENT';
                    const isCancelled = b.status === 'CANCELLED';

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 font-mono font-bold text-blue-600">
                          {b.pnr}
                        </td>
                        <td className="p-3.5">
                          <strong className="text-slate-900 block">{b.customer_name}</strong>
                          <span className="text-[11px] text-slate-500">{b.passenger_names || `${b.passenger_count} passenger(s)`}</span>
                        </td>
                        <td className="p-3.5 font-bold text-slate-800">
                          {b.train_name || 'RailNova Express'}
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-slate-900">{b.origin_station || 'NDLS'}</span>
                          <span className="text-slate-400 mx-1">➔</span>
                          <span className="font-bold text-slate-900">{b.destination_station || 'HWH'}</span>
                        </td>
                        <td className="p-3.5 font-black text-slate-900">
                          ₹{b.fareRupees}
                        </td>
                        <td className="p-3.5">
                          {isConfirmed && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                              Confirmed
                            </span>
                          )}
                          {isPending && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                              Seat Held (Pending)
                            </span>
                          )}
                          {isCancelled && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] uppercase">
                              Cancelled / Refunded
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                          {b.formattedDate}
                        </td>
                        <td className="p-3.5 text-right">
                          {!isCancelled && (
                            <button
                              onClick={() => handleCancelBooking(b.id, b.pnr)}
                              className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-[11px] transition"
                            >
                              Cancel & Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRAIN SERVICES & OCCUPANCY HEATMAP */}
      {activeTab === 'HEATMAP' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Train Services & Segment Occupancy Heatmap
              </h2>
              <p className="text-xs text-slate-500">
                Segment-level analysis demonstrating non-overlapping seat reuse across station hops.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {runs.map((run: any) => {
              const isCancelled = run.status === 'CANCELLED';

              return (
                <div key={run.run_id} className="p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg">
                        {run.train_number}
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{run.train_name}</h3>
                        <span className="text-xs text-slate-500">Run Date: {run.run_date}</span>
                      </div>

                      {isCancelled ? (
                        <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-red-100 text-red-800">
                          Run Cancelled
                        </span>
                      ) : (
                        <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
                          Scheduled Service
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewManifest(run.run_id)}
                        className="py-1.5 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>View Manifest</span>
                      </button>

                      {!isCancelled && (
                        <button
                          onClick={() => handleCancelRun(run.run_id, run.train_number)}
                          disabled={cancellingRun}
                          className="py-1.5 px-3 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-bold text-xs flex items-center gap-1.5 transition"
                        >
                          <Ban className="w-3.5 h-3.5 text-red-600" />
                          <span>Cancel Run (Disruption Demo)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Segment Occupancy Grid */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      Segment-by-Segment Occupancy (Hop Breakdown):
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {run.segments.map((seg: any, sIdx: number) => {
                        const pct = seg.occupancyPercent;
                        let color = 'bg-teal-50 border-teal-200 text-teal-900';
                        let barColor = 'bg-teal-500';

                        if (pct >= 80) {
                          color = 'bg-red-50 border-red-200 text-red-900';
                          barColor = 'bg-red-500';
                        } else if (pct >= 50) {
                          color = 'bg-amber-50 border-amber-200 text-amber-900';
                          barColor = 'bg-amber-500';
                        }

                        return (
                          <div key={sIdx} className={`p-3 rounded-xl border ${color}`}>
                            <div className="flex justify-between items-center text-xs font-bold">
                              <span>{seg.fromCode} ➔ {seg.toCode}</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                              <div className={`${barColor} h-1.5 rounded-full`} style={{ width: `${Math.min(100, pct)}%` }}></div>
                            </div>
                            <span className="text-[10px] opacity-75 mt-1 block">
                              {seg.occupiedSeats} / {seg.totalCapacity} seats occupied
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: FARE RULES RATE CARD */}
      {activeTab === 'RULES' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Official RailNova Fare Rules Rate Card
              </h2>
              <p className="text-xs text-slate-500">
                Configured rate per kilometer and minimum base fares per coach accommodation class.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Class Code</th>
                  <th className="p-3.5">Accommodation Tier</th>
                  <th className="p-3.5">Base Rate Per Km</th>
                  <th className="p-3.5">Minimum Fare</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {fareRules.map((fr: any) => {
                  const names: Record<string, string> = {
                    'SL': 'Sleeper Class (72 Berths)',
                    '3A': 'AC 3 Tier (64 Berths)',
                    '2A': 'AC 2 Tier (48 Berths)',
                    '1A': 'AC First Class (18 Berths)'
                  };

                  return (
                    <tr key={fr.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-bold font-mono text-indigo-700">
                        {fr.class_code}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {names[fr.class_code] || fr.class_code}
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">
                        ₹{Number(fr.base_rate_per_km).toFixed(2)} / km
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">
                        ₹{(Number(fr.min_fare) / 100).toFixed(2)}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                          ACTIVE
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Passenger Manifest Modal */}
      {selectedRunId && manifest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  Train Manifest: {manifest.run.train_name} ({manifest.run.train_number})
                </h3>
                <p className="text-xs text-slate-400">
                  Run Date: {manifest.run.run_date} • {manifest.passengersCount} Confirmed Passengers
                </p>
              </div>
              <button
                onClick={() => setSelectedRunId(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {manifest.manifest.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-8">
                  No confirmed passengers booked on this run yet.
                </p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                    <tr>
                      <th className="p-2.5">PNR</th>
                      <th className="p-2.5">Passenger</th>
                      <th className="p-2.5">Coach/Seat</th>
                      <th className="p-2.5">From</th>
                      <th className="p-2.5">To</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {manifest.manifest.map((m: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-mono font-bold text-blue-600">{m.pnr}</td>
                        <td className="p-2.5 font-bold text-slate-900">{m.passenger_name} ({m.age})</td>
                        <td className="p-2.5 font-mono">{m.coach_code}-{m.seat_number} ({m.berth_type})</td>
                        <td className="p-2.5 font-bold">{m.from_station_code}</td>
                        <td className="p-2.5 font-bold">{m.to_station_code}</td>
                        <td className="p-2.5 font-bold text-teal-700">CNF</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
