import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, ShieldCheck, CreditCard, AlertTriangle, ArrowRight, User, CheckCircle2, XCircle } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';
import { MockPaymentModal } from '../components/MockPaymentModal';

export const CheckoutPage: React.FC = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [bookingDetails, setBookingDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);

  const fetchDetails = () => {
    apiFetch(`/api/holds/${bookingId}`)
      .then(data => {
        setBookingDetails(data);
        setLoading(false);
        if (data.booking.status === 'CONFIRMED') {
          navigate(`/confirmation/${bookingId}`);
        }
      })
      .catch(err => {
        setError(err.message || 'Failed to load booking details.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDetails();
  }, [bookingId]);

  // Live TTL countdown
  useEffect(() => {
    if (!bookingDetails?.booking?.hold_expires_at) return;
    const expiry = new Date(bookingDetails.booking.hold_expires_at).getTime();

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && bookingDetails.booking.status === 'PENDING_PAYMENT') {
        setError('Seat hold expired. Seats have been automatically released back to inventory.');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [bookingDetails]);

  const handlePaymentOutcome = (outcome: any) => {
    setShowPaymentModal(false);
    if (outcome.success) {
      navigate(`/confirmation/${bookingId}`);
    } else {
      setError(outcome.message || 'Payment simulation failed.');
      fetchDetails();
    }
  };

  const handleCancelHold = async () => {
    if (!confirm('Are you sure you want to cancel this seat hold?')) return;
    try {
      await apiFetch(`/api/holds/${bookingId}`, { method: 'DELETE' });
      navigate('/');
    } catch (err: any) {
      alert(err.message || 'Failed to release hold.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm font-semibold text-slate-600">Verifying held reservations in database...</p>
      </div>
    );
  }

  if (!bookingDetails) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <p className="text-red-600 font-bold">{error || 'Booking not found.'}</p>
      </div>
    );
  }

  const { booking, legs, passengers, allocations } = bookingDetails;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Expiry Banner */}
      <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 transition ${
        timeLeft < 60 
          ? 'bg-red-50 border-red-300 text-red-900' 
          : 'bg-amber-50 border-amber-300 text-amber-900'
      }`}>
        <div className="flex items-center gap-3">
          <Clock className={`w-5 h-5 ${timeLeft < 60 ? 'text-red-600 animate-pulse' : 'text-amber-600'}`} />
          <div>
            <h4 className="text-sm font-bold">
              {timeLeft > 0 ? 'Seats Temporarily Held for You' : 'Hold Expired'}
            </h4>
            <p className="text-xs opacity-90">
              {timeLeft > 0 
                ? 'Complete mock payment before the timer expires to secure your seats.' 
                : 'Allocations have been released back to other passengers.'}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs uppercase font-mono tracking-wider font-semibold">Time Remaining</span>
          <p className="text-2xl font-black font-mono tracking-tight">
            {timeFormatted}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Booking Summary Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-mono uppercase text-slate-500 font-bold">Booking Reference</span>
            <h2 className="text-xl font-black text-slate-900">{booking.reference}</h2>
          </div>
          <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            {booking.status}
          </span>
        </div>

        {/* Legs & Seats */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Journey Breakdown ({legs.length} Leg{legs.length > 1 ? 's' : ''})
          </h3>

          <div className="space-y-3">
            {legs.map((leg: any) => (
              <div key={leg.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                      Leg {leg.leg_order}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {leg.train_name} ({leg.train_number})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
                    <span className="font-bold text-slate-800">{leg.from_station_code}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-slate-800">{leg.to_station_code}</span>
                  </div>
                </div>

                {/* Assigned berths for this leg */}
                <div className="flex flex-wrap gap-2">
                  {allocations
                    .filter((a: any) => a.leg_id === leg.id)
                    .map((a: any) => (
                      <span key={a.id} className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 shadow-sm">
                        Coach {a.coach_code} • Berth {a.seat_number} ({a.berth_type})
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Passengers */}
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Passengers ({passengers.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {passengers.map((p: any) => (
              <div key={p.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                <User className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800">{p.full_name}</span>
                <span className="text-xs text-slate-500">({p.age} yrs • {p.gender})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fare Summary */}
        <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">Total Simulated Payable</span>
            <span className="text-3xl font-black text-slate-900">
              ₹{(booking.total_amount / 100).toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCancelHold}
              className="py-3 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition"
            >
              Cancel Hold
            </button>
            <button
              disabled={timeLeft === 0}
              onClick={() => setShowPaymentModal(true)}
              className="py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center gap-2 transition disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              <span>Proceed to Mock Payment</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mock Payment Modal */}
      {showPaymentModal && (
        <MockPaymentModal
          bookingId={booking.id}
          totalAmountPaise={booking.total_amount}
          holdExpiresAt={booking.hold_expires_at}
          onPaymentComplete={handlePaymentOutcome}
          onCancel={() => setShowPaymentModal(false)}
        />
      )}
    </div>
  );
};
