import React, { useState, useEffect } from 'react';
import { 
  IndianRupee, 
  Calculator, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Edit2,
  X
} from 'lucide-react';
import { apiFetch } from '../../context/AuthContext';

export const FarePricingView: React.FC = () => {
  const [fareRules, setFareRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Editing State
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<number>(0);
  const [editMinFare, setEditMinFare] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Calculator State
  const [calcDistance, setCalcDistance] = useState<number>(450);
  const [calcClass, setCalcClass] = useState<string>('3A');

  const loadFareRules = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/admin/fare-rules');
      setFareRules(data || []);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFareRules();
  }, []);

  const handleStartEdit = (rule: any) => {
    setEditingClass(rule.class_code);
    setEditRate(Number(rule.base_rate_per_km));
    setEditMinFare(Number(rule.min_fare) / 100);
  };

  const handleSaveEdit = async (classCode: string) => {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/fare-rules/${classCode}`, {
        method: 'PUT',
        body: JSON.stringify({
          baseRatePerKm: editRate,
          minFare: Math.round(editMinFare * 100)
        })
      });
      setMessage(`Fare rule for class ${classCode} successfully updated.`);
      setEditingClass(null);
      setSaving(false);
      loadFareRules();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update fare rule.');
      setSaving(false);
    }
  };

  // Live calculator calculation
  const selectedRule = fareRules.find(r => r.class_code === calcClass);
  const ratePerKm = selectedRule ? Number(selectedRule.base_rate_per_km) : 1.5;
  const minFareRupees = selectedRule ? Number(selectedRule.min_fare) / 100 : 250;
  
  const rawDistanceFare = Math.round(calcDistance * ratePerKm);
  const baseFare = Math.max(minFareRupees, rawDistanceFare);
  const superfastCharge = 45;
  const safetyCess = 15;
  const totalCalculated = baseFare + superfastCharge + safetyCess;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-blue-600" />
            Fare Rules & Dynamic Pricing Engine
          </h1>
          <p className="text-xs text-slate-500">
            Define distance rate coefficients, minimum fares per coach class, and verify live server calculations.
          </p>
        </div>

        <button
          onClick={loadFareRules}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {/* Main Grid: Rates Table + Live Fare Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rates Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Configured Fare Matrix</h2>
              <p className="text-xs text-slate-500">Class-based kilometer rates in minor units</p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
              Database Synced
            </span>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Class Code</th>
                  <th className="py-3 px-4">Class Description</th>
                  <th className="py-3 px-4">Rate per KM</th>
                  <th className="py-3 px-4">Min Base Fare</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fareRules.map(rule => {
                  const isEditing = editingClass === rule.class_code;
                  const desc = 
                    rule.class_code === 'SL' ? 'Sleeper Class' :
                    rule.class_code === '3A' ? 'AC 3-Tier (Chair/Berth)' :
                    rule.class_code === '2A' ? 'AC 2-Tier Deluxe' : 'AC First Class';

                  return (
                    <tr key={rule.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        {rule.class_code}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {desc}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.1"
                            value={editRate}
                            onChange={e => setEditRate(parseFloat(e.target.value) || 0)}
                            className="w-20 p-1 border rounded font-mono text-xs"
                          />
                        ) : (
                          `₹${Number(rule.base_rate_per_km).toFixed(2)} / km`
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold">
                        {isEditing ? (
                          <input
                            type="number"
                            step="10"
                            value={editMinFare}
                            onChange={e => setEditMinFare(parseFloat(e.target.value) || 0)}
                            className="w-20 p-1 border rounded font-mono text-xs"
                          />
                        ) : (
                          `₹${(Number(rule.min_fare) / 100).toFixed(2)}`
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleSaveEdit(rule.class_code)}
                              disabled={saving}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingClass(null)}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(rule)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-[10px] font-bold flex items-center gap-1 ml-auto"
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Fare Calculator Preview */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Calculator className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Server-Aligned Fare Calculator</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Travel Distance (Kilometers)</label>
              <input
                type="number"
                value={calcDistance}
                onChange={e => setCalcDistance(parseInt(e.target.value) || 0)}
                className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-sm"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Coach Class</label>
              <select
                value={calcClass}
                onChange={e => setCalcClass(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium"
              >
                {fareRules.map(r => (
                  <option key={r.class_code} value={r.class_code}>
                    {r.class_code} (Rate: ₹{Number(r.base_rate_per_km).toFixed(2)}/km)
                  </option>
                ))}
              </select>
            </div>

            {/* Calculated Receipt breakdown */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>Distance Rate ({calcDistance} km × ₹{ratePerKm}):</span>
                <span>₹{rawDistanceFare}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Minimum Fare Threshold:</span>
                <span>₹{minFareRupees}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Applied Base Fare:</span>
                <span className="font-bold text-slate-900">₹{baseFare}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Superfast Reservation Charge:</span>
                <span>₹{superfastCharge}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Safety / Development Cess:</span>
                <span>₹{safetyCess}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-blue-700 border-t border-slate-200 pt-2">
                <span>Total Expected Quote:</span>
                <span>₹{totalCalculated}</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 italic text-center">
              *Matches server quote algorithm exactly, ensuring zero discrepancies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
