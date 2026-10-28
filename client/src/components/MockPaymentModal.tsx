import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';

interface MockPaymentModalProps {
  bookingId: string;
  totalAmountPaise: number;
  holdExpiresAt: string;
  onPaymentComplete: (outcome: any) => void;
  onCancel: () => void;
}

export const MockPaymentModal: React.FC<MockPaymentModalProps> = ({
  bookingId,
  totalAmountPaise,
  holdExpiresAt,
  onPaymentComplete,
  onCancel,
}) => {
  const [scenario, setScenario] = useState<'SUCCESS' | 'FAILURE' | 'TIMEOUT'>('SUCCESS');
  const [processing, setProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(300);

  useEffect(() => {
    const calculateRemaining = () => {
      const diff = Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [holdExpiresAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const handlePay = async () => {
    setProcessing(true);
    const idempotencyKey = `idemp-pay-${bookingId}-${Date.now()}`;

    try {
      const res = await fetch('/api/payments/mock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('railnova_token')}`
        },
        body: JSON.stringify({
          bookingId,
          idempotencyKey,
          scenario,
          paymentMethod: 'MOCK_UPI_NETBANKING'
        })
      });

      const outcome = await res.json();
      setProcessing(false);
      onPaymentComplete(outcome);
    } catch (err: any) {
      setProcessing(false);
      onPaymentComplete({
        success: false,
        message: err.message || 'Payment simulation failed.'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header with Hold Countdown */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-200">
              Mock Payment Gateway
            </span>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              timeLeft < 60 ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-500/50 text-white'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>Seat Hold: {timeFormatted}</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs text-blue-100">Total Simulated Amount</p>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              ₹{(totalAmountPaise / 100).toFixed(2)}
            </h2>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Sandbox Mode: No real financial accounts or cards are charged.</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Test Gateway Scenario:
            </label>
            <div className="space-y-2.5">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                scenario === 'SUCCESS' ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="scenario"
                  value="SUCCESS"
                  checked={scenario === 'SUCCESS'}
                  onChange={() => setScenario('SUCCESS')}
                  className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-teal-900">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    <span>Payment Success (100%)</span>
                  </div>
                  <p className="text-[11px] text-teal-700">Simulate authorized charge; confirms seat allocations.</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                scenario === 'FAILURE' ? 'bg-red-50 border-red-500 ring-1 ring-red-500' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="scenario"
                  value="FAILURE"
                  checked={scenario === 'FAILURE'}
                  onChange={() => setScenario('FAILURE')}
                  className="w-4 h-4 text-red-600 focus:ring-red-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-red-900">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span>Payment Failure (Declined)</span>
                  </div>
                  <p className="text-[11px] text-red-700">Simulate insufficient funds; releases held seats immediately.</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                scenario === 'TIMEOUT' ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="scenario"
                  value="TIMEOUT"
                  checked={scenario === 'TIMEOUT'}
                  onChange={() => setScenario('TIMEOUT')}
                  className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-amber-900">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Gateway Network Timeout</span>
                  </div>
                  <p className="text-[11px] text-amber-700">Simulates delayed bank confirmation with idempotency safety.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-3">
            <button
              type="button"
              disabled={processing}
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100 transition"
            >
              Cancel Hold
            </button>
            <button
              type="button"
              disabled={processing || timeLeft === 0}
              onClick={handlePay}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm text-white transition flex items-center justify-center gap-2 shadow-lg ${
                scenario === 'SUCCESS' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25' :
                scenario === 'FAILURE' ? 'bg-red-600 hover:bg-red-700 shadow-red-500/25' :
                'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25'
              }`}
            >
              {processing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Execute Payment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
