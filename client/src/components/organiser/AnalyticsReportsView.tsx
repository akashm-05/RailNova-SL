import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  IndianRupee, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  PieChart
} from 'lucide-react';
import { apiFetch } from '../../context/AuthContext';

export const AnalyticsReportsView: React.FC = () => {
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [extended, setExtended] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [basic, ext] = await Promise.all([
        apiFetch('/api/admin/analytics'),
        apiFetch('/api/admin/analytics/extended')
      ]);
      setAnalytics(basic);
      setExtended(ext);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const fin = analytics?.financialMetrics || {};
  const bookingCounts = extended?.bookingCounts || {};
  const payments = extended?.payments || [];
  const classOcc = extended?.classOccupancy || [];

  // Payment Success Calculation
  const totalPaymentAttempts = payments.reduce((acc: number, p: any) => acc + Number(p.count || 0), 0);
  const succeededPayments = payments.find((p: any) => p.status === 'SUCCEEDED')?.count || 0;
  const paymentSuccessRate = totalPaymentAttempts > 0 
    ? Math.round((Number(succeededPayments) / totalPaymentAttempts) * 100) 
    : 100;

  // Cancellation Rate
  const totalBookings = Number(bookingCounts.total_bookings || 0);
  const cancelledBookings = Number(bookingCounts.cancelled_bookings || 0);
  const cancellationRate = totalBookings > 0 
    ? Math.round((cancelledBookings / totalBookings) * 100) 
    : 0;

  const handleExportCSV = async () => {
    try {
      const allBookings = await apiFetch('/api/admin/bookings');
      if (!allBookings || allBookings.length === 0) {
        alert('No booking records to export.');
        return;
      }
      const headers = ['PNR', 'Customer', 'Email', 'Train', 'Origin', 'Destination', 'Fare (INR)', 'Status', 'Date'];
      const rows = allBookings.map((b: any) => [
        `"${b.pnr}"`,
        `"${b.customer_name}"`,
        `"${b.customer_email}"`,
        `"${b.train_name}"`,
        `"${b.origin_station}"`,
        `"${b.destination_station}"`,
        `"${b.fareRupees}"`,
        `"${b.status}"`,
        `"${b.created_at}"`
      ]);
      const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
      const link = document.createElement('a');
      link.href = encodeURI(csv);
      link.download = `railnova-operations-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Failed to export CSV.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Operational Analytics & Financial Reports
          </h1>
          <p className="text-xs text-slate-500">
            Conversion metrics, payment integrity analysis, class occupancy distributions, and audit exports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            Export Complete CSV Audit
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Analytics KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Payment Gateway Success</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {paymentSuccessRate}%
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {succeededPayments} successful out of {totalPaymentAttempts} attempts
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Reservation Cancellation Rate</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {cancellationRate}%
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {cancelledBookings} cancelled / {totalBookings} total reservations
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Refund Settlement Ratio</span>
            <IndianRupee className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            100%
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Instant automated full refund guarantee on admin disruptions
          </p>
        </div>
      </div>

      {/* Class Occupancy Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Occupancy Distribution by Coach Class</h2>
          <p className="text-xs text-slate-500">Physical seat utilization ratio across travel classes</p>

          <div className="space-y-4 pt-2">
            {classOcc.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No class inventory found.</p>
            ) : (
              classOcc.map((c: any) => {
                const label = 
                  c.coach_type === 'SL' ? 'Sleeper Class (SL)' :
                  c.coach_type === '3A' ? 'AC 3-Tier (3A)' :
                  c.coach_type === '2A' ? 'AC 2-Tier (2A)' : 'First AC (1A)';

                return (
                  <div key={c.coach_type} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{label}</span>
                      <span className="font-mono font-bold text-slate-900">
                        {c.confirmed_count} / {c.total_seats} seats ({c.occupancyPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(4, c.occupancyPercent)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Financial Flow Summary */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Financial Ledger Summary</h2>
          <p className="text-xs text-slate-500">Reconciled transaction ledger across all runs</p>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 font-mono text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Gross Ticket Collections:</span>
              <span className="font-bold text-slate-900">₹{(Number(fin.grossCollectionsPaise || 0) / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>Disruption & Admin Refunds:</span>
              <span className="font-bold">-₹{(Number(fin.completedRefundsPaise || 0) / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Confirmed Passengers:</span>
              <span>{fin.totalCustomerBookings || 0}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Passenger Legs:</span>
              <span>{fin.totalPassengerLegs || 0}</span>
            </div>
            <div className="flex justify-between text-sm font-black text-emerald-700 border-t border-slate-200 pt-3">
              <span>Net Division Revenue:</span>
              <span>₹{(Number(fin.netCollectionsPaise || 0) / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
