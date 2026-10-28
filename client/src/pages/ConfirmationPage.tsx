import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Train, Printer, ArrowRight, User, ShieldCheck, AlertCircle, QrCode } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';

export const ConfirmationPage: React.FC = () => {
  const { bookingId } = useParams();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/api/bookings/${bookingId}`)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load booking details.');
        setLoading(false);
      });
  }, [bookingId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm font-semibold text-slate-600">Generating official RailNova demo ticket...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <p className="text-red-600 font-bold">{error || 'Booking not found.'}</p>
      </div>
    );
  }

  const { booking, legs, passengers, allocations, payments } = data;
  const isConfirmed = booking.status === 'CONFIRMED';

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Top Banner (No-print) */}
      <div className="no-print bg-teal-50 border border-teal-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-teal-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase text-teal-800 tracking-wider">
              Booking Confirmed
            </span>
            <h1 className="text-xl font-black text-teal-950">
              Your RailNova Journey is Booked!
            </h1>
            <p className="text-xs text-teal-800 mt-0.5">
              PNR: <strong className="font-mono text-teal-950">{booking.reference}</strong> • Transaction Verified
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="py-2.5 px-4 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-xs hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Ticket</span>
          </button>
          <Link
            to="/my-bookings"
            className="py-2.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 shadow-sm transition"
          >
            My Bookings
          </Link>
        </div>
      </div>

      {/* Official RailNova Demo E-Ticket Layout */}
      <div className="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-lg print:border-black print:rounded-none">
        {/* Ticket Header */}
        <div className="bg-slate-900 text-white p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4 print:bg-white print:text-black print:border-b-2 print:border-black">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white print:border print:border-black">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">RailNova Electronic Reservation Slip</h2>
              <p className="text-xs text-slate-400 print:text-slate-600">
                “Your journey, thoughtfully connected.”
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-mono uppercase text-slate-400 block print:text-slate-600">
              Demo PNR Reference
            </span>
            <span className="text-2xl font-black font-mono tracking-wider text-blue-400 print:text-black">
              {booking.reference}
            </span>
          </div>
        </div>

        {/* Demo Disclaimer Box inside ticket */}
        <div className="bg-amber-50 border-b border-amber-200 p-3 text-[11px] text-amber-900 flex items-center justify-between px-6">
          <span>
            <strong>Demo Document:</strong> For educational evaluation only. Not valid for actual boarding or transit on Indian Railways.
          </span>
          <span className="font-mono font-bold bg-amber-200/60 px-2 py-0.5 rounded text-[10px]">
            STATUS: {booking.status}
          </span>
        </div>

        {/* Journey Legs Details */}
        <div className="p-6 sm:p-8 space-y-6">
          {legs.map((leg: any, idx: number) => {
            const legAllocs = allocations.filter((a: any) => a.leg_id === leg.id);

            return (
              <div key={leg.id} className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50/50">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase bg-blue-600 text-white px-2 py-0.5 rounded">
                      Leg {leg.leg_order}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      {leg.train_name} ({leg.train_number})
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {formatDate(leg.departure_time)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <span className="text-xs text-slate-500 block">Boarding Station</span>
                    <p className="text-lg font-black text-slate-900">
                      {leg.from_name} ({leg.from_station_code})
                    </p>
                    <span className="text-xs font-mono font-semibold text-blue-700">
                      Departs: {formatTime(leg.departure_time)}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block">Destination Station</span>
                    <p className="text-lg font-black text-slate-900">
                      {leg.to_name} ({leg.to_station_code})
                    </p>
                    <span className="text-xs font-mono font-semibold text-blue-700">
                      Arrives: {formatTime(leg.arrival_time)}
                    </span>
                  </div>
                </div>

                {/* Berth allocations for this leg */}
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
                    Allocated Berths on this Leg:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {legAllocs.map((a: any) => (
                      <div key={a.id} className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-sm">
                        <span className="text-xs font-bold text-slate-900">
                          {a.full_name}:
                        </span>
                        <span className="text-xs font-mono font-bold text-blue-600 ml-1.5">
                          Coach {a.coach_code} / Seat {a.seat_number} ({a.berth_type})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Passenger List Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Passenger Manifest Details
            </h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Passenger Name</th>
                    <th className="p-3">Age</th>
                    <th className="p-3">Gender</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {passengers.map((p: any, idx: number) => (
                    <tr key={p.id}>
                      <td className="p-3 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold">{p.full_name}</td>
                      <td className="p-3">{p.age}</td>
                      <td className="p-3">{p.gender}</td>
                      <td className="p-3 font-bold text-teal-700">CNF (Confirmed)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment & Audit Summary */}
          <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-center p-2">
                <QrCode className="w-12 h-12 text-slate-800" />
              </div>
              <div>
                <span className="text-[11px] font-mono text-slate-500 block">
                  Simulated Gateway TX: {payments[0]?.gateway_ref || 'MOCK-VERIFIED'}
                </span>
                <span className="text-xs text-slate-600">
                  Idempotent confirmation recorded in PostgreSQL
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total Simulated Fare Paid</span>
              <span className="text-2xl font-black text-slate-900">
                ₹{(booking.total_amount / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
