import React from 'react';
import { 
  IndianRupee, 
  Users, 
  Armchair, 
  Train, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight,
  ShieldCheck,
  Activity,
  Layers
} from 'lucide-react';
import { OrganiserSection } from '../OrganiserSidebar';

interface OverviewViewProps {
  analytics: any;
  loading: boolean;
  onNavigate: (section: OrganiserSection) => void;
  onRefresh: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  analytics,
  loading,
  onNavigate,
  onRefresh
}) => {
  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Activity className="w-6 h-6 animate-spin mr-2 text-blue-500" />
        <span>Loading operational telemetry...</span>
      </div>
    );
  }

  const fin = analytics?.financialMetrics || {};
  const inv = analytics?.inventoryMetrics || {};
  const runs = analytics?.runs || [];

  const grossRs = (Number(fin.grossCollectionsPaise || 0) / 100).toFixed(2);
  const refundRs = (Number(fin.completedRefundsPaise || 0) / 100).toFixed(2);
  const netRs = (Number(fin.netCollectionsPaise || 0) / 100).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Top Banner / System Status */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold uppercase tracking-wider border border-emerald-400/30 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Central Traffic Control: Nominal
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Northern Railway Operations Cockpit
          </h1>
          <p className="text-xs text-slate-300 max-w-xl mt-1">
            Real-time telemetry, segment-level seat allocations, dynamic pricing rules, and railway disruption simulation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('simulation')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <AlertTriangle className="w-4 h-4" />
            Launch Simulation Lab
          </button>
          <button
            onClick={() => onNavigate('trains')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Train className="w-4 h-4" />
            Schedule Run
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Revenue */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Net Collections</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            ₹{netRs}
          </div>
          <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 border-t border-slate-100 pt-2">
            <span>Gross: ₹{grossRs}</span>
            <span className="text-rose-500 font-medium">Refunds: ₹{refundRs}</span>
          </div>
        </div>

        {/* Confirmed Bookings */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Total Bookings</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {fin.totalCustomerBookings || 0}
          </div>
          <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 border-t border-slate-100 pt-2">
            <span>Legs: {fin.totalPassengerLegs || 0}</span>
            <span className="text-blue-600 font-semibold cursor-pointer" onClick={() => onNavigate('bookings')}>
              View Logs →
            </span>
          </div>
        </div>

        {/* Occupied Segments */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Confirmed Occupancy</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Armchair className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {inv.confirmedOccupiedSegments || 0} <span className="text-xs font-normal text-slate-400">seats</span>
          </div>
          <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 border-t border-slate-100 pt-2">
            <span>Interval Locks</span>
            <span className="text-emerald-600 font-semibold">PostgreSQL Verified</span>
          </div>
        </div>

        {/* Active Holds */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Active Holds (5m TTL)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {inv.activeHolds || 0} <span className="text-xs font-normal text-slate-400">held</span>
          </div>
          <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 border-t border-slate-100 pt-2">
            <span>Auto-expiry</span>
            <span className="text-slate-500 font-medium">300 sec</span>
          </div>
        </div>
      </div>

      {/* Network Occupancy Overview & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scheduled Runs Occupancy Heatmap Preview */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Scheduled Runs Occupancy</h2>
              <p className="text-xs text-slate-500">Live segment-level seat utilization across services</p>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
            >
              Interactive Seat Map <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {runs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No active train runs scheduled.</p>
            ) : (
              runs.slice(0, 5).map((run: any) => {
                const totalOccupied = run.segments?.reduce((acc: number, s: any) => acc + (s.occupiedSeats || 0), 0) || 0;
                const totalCapacity = (run.total_seats || 50) * Math.max(1, (run.segments?.length || 1));
                const overallPct = Math.min(100, Math.round((totalOccupied / Math.max(1, totalCapacity)) * 100));

                return (
                  <div key={run.run_id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{run.train_number} - {run.train_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                          {run.run_date}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700">{overallPct}% Booked</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          run.status === 'CANCELLED' 
                            ? 'bg-rose-100 text-rose-700' 
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {run.status}
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          overallPct > 80 ? 'bg-amber-500' : overallPct > 50 ? 'bg-blue-600' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(5, overallPct)}%` }}
                      />
                    </div>

                    {run.segments && run.segments.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-slate-500">
                        {run.segments.map((s: any, idx: number) => (
                          <span key={idx} className="bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {s.fromCode}→{s.toCode}: <strong className="text-slate-700">{s.occupancyPercent}%</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Operations Actions & Security Card */}
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Security & Compliance
            </h3>
            <ul className="text-xs text-slate-300 space-y-2 mb-4">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Segment intervals enforced via transactional row locks</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Audit logging active on all organiser actions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Simulation runs isolated from live passenger records</span>
              </li>
            </ul>

            <button
              onClick={() => onNavigate('audit')}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition text-center"
            >
              View System Audit Logs
            </button>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Quick Operational Actions</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => onNavigate('bookings')}
                className="p-3 text-left rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition font-medium text-slate-700"
              >
                <div className="font-bold text-slate-900">Booking Logs</div>
                <div className="text-[10px] text-slate-400">Search PNRs</div>
              </button>
              <button
                onClick={() => onNavigate('pricing')}
                className="p-3 text-left rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition font-medium text-slate-700"
              >
                <div className="font-bold text-slate-900">Fare Config</div>
                <div className="text-[10px] text-slate-400">Per km rates</div>
              </button>
              <button
                onClick={() => onNavigate('passengers')}
                className="p-3 text-left rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition font-medium text-slate-700"
              >
                <div className="font-bold text-slate-900">Passengers</div>
                <div className="text-[10px] text-slate-400">Customer directory</div>
              </button>
              <button
                onClick={() => onNavigate('analytics')}
                className="p-3 text-left rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition font-medium text-slate-700"
              >
                <div className="font-bold text-slate-900">Analytics</div>
                <div className="text-[10px] text-slate-400">Export CSV</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
