import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Trash2, 
  Download, 
  RefreshCw, 
  Eye, 
  Ban, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  X,
  CreditCard,
  Train,
  ArrowRight
} from 'lucide-react';
import { apiFetch } from '../../context/AuthContext';

interface BookingLogsViewProps {
  bookings: any[];
  loading: boolean;
  onRefresh: () => void;
}

export const BookingLogsView: React.FC<BookingLogsViewProps> = ({
  bookings,
  loading,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [journeyFilter, setJourneyFilter] = useState('ALL');

  // Detail Modal State
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Cancellation State
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Filtered Bookings
  const filteredBookings = bookings.filter(b => {
    const matchesSearch = 
      b.pnr?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.train_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.passenger_names?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    const matchesJourney = journeyFilter === 'ALL' || b.journey_type === journeyFilter;

    return matchesSearch && matchesStatus && matchesJourney;
  });

  const handleViewDetails = async (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setLoadingDetails(true);
    try {
      const data = await apiFetch(`/api/admin/bookings/${bookingId}/details`);
      setDetailData(data);
      setLoadingDetails(false);
    } catch (err: any) {
      alert(err.message || 'Failed to load booking details.');
      setLoadingDetails(false);
    }
  };

  const handleCancelBooking = async (bookingId: string, pnr: string) => {
    if (!confirm(`Are you sure you want to cancel and refund Booking ${pnr}? This will release the allocated seats and initiate a full refund.`)) {
      return;
    }
    setCancellingId(bookingId);
    try {
      const res = await apiFetch(`/api/admin/bookings/${bookingId}/cancel`, { method: 'POST' });
      setFeedbackMessage(res.message);
      setCancellingId(null);
      onRefresh();
      if (selectedBookingId === bookingId) {
        handleViewDetails(bookingId);
      }
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel booking.');
      setCancellingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('CAUTION: This will clear all booking logs, passenger records, allocations, and refunds. Are you sure you want a clean slate?')) {
      return;
    }
    setClearing(true);
    try {
      const res = await apiFetch('/api/admin/bookings/clear-all', { method: 'POST' });
      setFeedbackMessage(res.message);
      setClearing(false);
      onRefresh();
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to clear logs.');
      setClearing(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredBookings.length === 0) {
      alert('No records to export.');
      return;
    }

    const headers = ['PNR', 'Customer', 'Email', 'Train', 'Origin', 'Destination', 'Fare (INR)', 'Status', 'Disruption', 'Created At'];
    const rows = filteredBookings.map(b => [
      `"${b.pnr || ''}"`,
      `"${b.customer_name || ''}"`,
      `"${b.customer_email || ''}"`,
      `"${b.train_name || ''}"`,
      `"${b.origin_station || ''}"`,
      `"${b.destination_station || ''}"`,
      `"${b.fareRupees || ''}"`,
      `"${b.status || ''}"`,
      `"${b.disruption_status || ''}"`,
      `"${b.created_at || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `railnova-bookings-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Feedback */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Central Booking Registry
          </h1>
          <p className="text-xs text-slate-500">
            Real-time audit log of all passenger reservations, payment attempts, and refunds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold transition flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            {clearing ? 'Clearing...' : 'Clear All Logs'}
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search PNR, Customer, Email, Train..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Statuses</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="PAYMENT_FAILED">PAYMENT_FAILED</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Journey:</span>
          <select
            value={journeyFilter}
            onChange={e => setJourneyFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Types</option>
            <option value="DIRECT">Direct</option>
            <option value="SAME_TRAIN_CHANGE">Same-Train Change</option>
            <option value="TWO_TRAIN_CONNECTION">2-Train Connection</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-mono ml-auto">
          Showing {filteredBookings.length} of {bookings.length}
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">PNR Reference</th>
                <th className="py-3 px-4">Customer / Passengers</th>
                <th className="py-3 px-4">Train & Route</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Fare</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No bookings found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredBookings.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {b.pnr}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{b.customer_name}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{b.customer_email}</div>
                      {b.passenger_names && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Pax: {b.passenger_names}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{b.train_name || 'Railway Service'}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {b.origin_station} → {b.destination_station}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {b.journey_type === 'DIRECT' ? 'Direct' : b.journey_type === 'SAME_TRAIN_CHANGE' ? 'Seat Switch' : '2-Train'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      ₹{b.fareRupees}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {b.formattedDate}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        b.status === 'CONFIRMED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : b.status === 'PENDING_PAYMENT'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {b.status}
                      </span>
                      {b.disruption_status && b.disruption_status !== 'NONE' && (
                        <div className="text-[9px] text-amber-600 font-bold mt-0.5 uppercase">
                          {b.disruption_status}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewDetails(b.id)}
                          title="View Complete Booking Dossier"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {b.status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleCancelBooking(b.id, b.pnr)}
                            disabled={cancellingId === b.id}
                            title="Admin Cancel & Refund"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-400 hover:bg-rose-50 transition"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Details Modal / Dossier */}
      {selectedBookingId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Dossier Inspector
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1">
                  PNR: {detailData?.booking?.reference || selectedBookingId}
                </h2>
              </div>
              <button
                onClick={() => { setSelectedBookingId(null); setDetailData(null); }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetails || !detailData ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Loading dossier details...
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* Summary Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Customer</span>
                    <div className="font-bold text-slate-900">{detailData.booking.customer_name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{detailData.booking.customer_email}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Fare</span>
                    <div className="font-mono font-bold text-slate-900 text-sm">₹{detailData.booking.fareRupees}</div>
                    <div className="text-[10px] text-slate-500">Includes GST & Fees</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Status</span>
                    <div className="mt-0.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        detailData.booking.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {detailData.booking.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Journey Type</span>
                    <div className="font-bold text-slate-900">{detailData.booking.journey_type}</div>
                  </div>
                </div>

                {/* Journey Legs */}
                <div>
                  <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Train className="w-4 h-4 text-blue-600" />
                    Journey Segments ({detailData.legs?.length || 0})
                  </h3>
                  <div className="space-y-2">
                    {detailData.legs?.map((leg: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-800">{leg.train_number} - {leg.train_name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                            <span>{leg.from_station_code} ({new Date(leg.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                            <ArrowRight className="w-3 h-3" />
                            <span>{leg.to_station_code} ({new Date(leg.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-slate-900">₹{(Number(leg.leg_fare || 0) / 100).toFixed(2)}</div>
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-bold">
                            Coach {leg.coach_code || 'CC1'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Passengers & Seat Allocations */}
                <div>
                  <h3 className="font-bold text-slate-900 mb-2">Allocated Seats & Passengers</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {detailData.passengers?.map((p: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="font-bold text-slate-900">{p.full_name} ({p.age}y, {p.gender})</div>
                        <div className="text-[11px] text-blue-700 font-semibold mt-1">
                          Coach: {p.coach_code} • Seat: #{p.seat_number} ({p.berth_type || 'BERTH'})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment History */}
                <div>
                  <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    Payment Attempts & Gateway Audits
                  </h3>
                  {detailData.payments?.length === 0 ? (
                    <p className="text-slate-400 italic">No payment record found.</p>
                  ) : (
                    detailData.payments?.map((pm: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-white font-mono text-[11px] flex items-center justify-between">
                        <div>
                          <span className="text-slate-500">Key: {pm.idempotency_key}</span>
                          <span className="ml-2 font-bold text-slate-800">Status: {pm.status}</span>
                        </div>
                        <span className="font-bold text-emerald-600">₹{(Number(pm.amount || 0) / 100).toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Refunds */}
                {detailData.refunds && detailData.refunds.length > 0 && (
                  <div>
                    <h3 className="font-bold text-rose-700 mb-2">Refund Transactions</h3>
                    {detailData.refunds.map((ref: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/50 text-[11px] flex items-center justify-between">
                        <div>
                          <div className="font-bold text-rose-800">{ref.reason}</div>
                          <div className="text-slate-500 font-mono text-[10px]">ID: {ref.id} • Status: {ref.status}</div>
                        </div>
                        <div className="font-mono font-bold text-rose-700">₹{(Number(ref.amount || 0) / 100).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedBookingId(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
