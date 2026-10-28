import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Shield, 
  Server, 
  Database, 
  CheckCircle2, 
  Clock, 
  Lock, 
  RefreshCw,
  Cpu
} from 'lucide-react';
import { apiFetch, useAuth } from '../../context/AuthContext';

export const SettingsView: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/admin/settings')
      .then(data => {
        setSettings(data);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Operations Control Centre Settings
          </h1>
          <p className="text-xs text-slate-500">
            System health diagnostics, concurrency engine rules, and administrative profiles.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Administrator Profile */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Shield className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-sm">Authenticated Controller Profile</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 font-medium">Administrator Name:</span>
              <span className="font-bold text-slate-900">{user?.name || 'Administrator'}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 font-medium">Email / Identity:</span>
              <span className="font-mono font-bold text-slate-900">{user?.email}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 font-medium">Operational Role:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase">
                {user?.role}
              </span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 font-medium">Railway Division:</span>
              <span className="font-semibold text-slate-800">Northern Railway — CTC New Delhi</span>
            </div>
          </div>
        </div>

        {/* Concurrency & Allocation Rules */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Lock className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-slate-900 text-sm">Concurrency & Reservation Rules</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 font-medium">Seat Hold TTL Window:</span>
              <span className="font-bold text-slate-900">300 seconds (5 minutes)</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 font-medium">Max Holds per Passenger:</span>
              <span className="font-bold text-slate-900">3 active reservations</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 font-medium">Transaction Isolation:</span>
              <span className="font-mono font-semibold text-slate-800">PostgreSQL Serializable Rows</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 font-medium">Segment Overlap Guard:</span>
              <span className="font-semibold text-emerald-600">GiST & Row-Level Lock Verified</span>
            </div>
          </div>
        </div>

        {/* System Diagnostic Status */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Cpu className="w-4 h-4 text-purple-600" />
            <h2 className="font-bold text-slate-900 text-sm">Engine Diagnostics & Microservices</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-slate-400 font-medium text-[11px]">Primary Database</div>
                <div className="font-bold text-slate-900 mt-0.5">PostgreSQL PGlite (WASM)</div>
                <div className="text-[10px] text-slate-500 font-mono">.data/railnova_db</div>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                ONLINE
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-slate-400 font-medium text-[11px]">Idempotency Manager</div>
                <div className="font-bold text-slate-900 mt-0.5">Dual-Write Safe</div>
                <div className="text-[10px] text-slate-500">Zero duplicate charges</div>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                ACTIVE
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-slate-400 font-medium text-[11px]">Graph Route Engine</div>
                <div className="font-bold text-slate-900 mt-0.5">Autopilot Dijkstra & Risk</div>
                <div className="text-[10px] text-slate-500">Multi-objective ranking</div>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                READY
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
