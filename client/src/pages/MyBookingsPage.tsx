import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, ArrowRight, Ban, Eye, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';

export const MyBookingsPage: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = () => {
    setLoading(true);
    apiFetch('/api/bookings/me')
      .then(data => {
        setBookings(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load bookings.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelBooking = async (bookingId: string, reference: string) => {
    if (!confirm(`Are you sure you want to cancel booking PNR ${reference}? According to RailNova Demo policy, a full mock refund will be credited.`)) {
      return;
    }

    setCancellingId(bookingId);
    try {
      await apiFetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
      setCancellingId(null);
      fetchBookings();
    } catch (err: any) {
      setCancellingId(null);
      alert(err.message || 'Failed to cancel booking.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Ticket className="w-6 h-6 text-blue-600" />
            <span>My Railway Bookings</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Logged in as <strong className="text-slate-800">{user?.name}</strong> ({user?.email})
          </p>
        </div>

        <Link
          to="/"
          className="py-2.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 shadow-sm transition"
        >
          Book Another Ticket
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm font-medium">
          {error}
        </div>
      )}

      {loading && (
        <div className="p-16 text-center space-y-3 bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-semibold text-slate-600">Retrieving booking history from database...</p>
        </div>
      )}

      {!loading && bookings.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <Ticket className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No railway bookings found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You haven't made any reservations yet. Search and book your train journey now.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {bookings.map((b) => {
          const isConfirmed = b.status === 'CONFIRMED';
          const isCancelled = b.status === 'CANCELLED';
          const isPending = b.status === 'PENDING_PAYMENT';
          const isDisrupted = b.disruption_status === 'DISRUPTED';

          return (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-slate-500">
                    PNR: <strong className="text-slate-900 text-sm">{b.reference}</strong>
                  </span>
                  
                  {isConfirmed && !isDisrupted && (
                    <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                      Confirmed
                    </span>
                  )}
                  {isCancelled && (
                    <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                      Cancelled (Refunded)
                    </span>
                  )}
                  {isPending && (
                    <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Payment Pending
                    </span>
                  )}
                  {isDisrupted && (
                    <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                      Train Disrupted / Cancelled
                    </span>
                  )}
                </div>

                <span className="text-xs font-bold text-slate-500 font-mono">
                  {b.journey_type.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-8 space-y-1">
                  <h3 className="text-base font-bold text-slate-900">
                    {b.trains_summary || 'Express Rail Service'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Passengers: <strong className="text-slate-800">{b.passenger_count || 1}</strong> • Total Paid: <strong className="text-slate-900">₹{(b.total_amount / 100).toFixed(2)}</strong>
                  </p>
                  {isDisrupted && (
                    <p className="text-xs font-semibold text-red-700 bg-red-50 p-2 rounded-lg border border-red-200">
                      ⚠️ Train service was cancelled by railway organiser. A full refund has been credited.
                    </p>
                  )}
                </div>

                <div className="md:col-span-4 flex items-center justify-end gap-2">
                  <Link
                    to={isPending ? `/checkout/${b.id}` : `/confirmation/${b.id}`}
                    className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <Eye className="w-4 h-4 text-slate-600" />
                    <span>{isPending ? 'Complete Payment' : 'View Ticket'}</span>
                  </Link>

                  {isConfirmed && !isDisrupted && (
                    <button
                      onClick={() => handleCancelBooking(b.id, b.reference)}
                      disabled={cancellingId === b.id}
                      className="py-2.5 px-4 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 font-bold text-xs flex items-center gap-1.5 transition"
                    >
                      <Ban className="w-4 h-4 text-red-600" />
                      <span>{cancellingId === b.id ? 'Cancelling...' : 'Cancel Ticket'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
