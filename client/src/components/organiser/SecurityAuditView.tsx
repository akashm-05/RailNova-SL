import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  FileText,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { apiFetch } from '../../context/AuthContext';

export const SecurityAuditView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const url = selectedAction !== 'ALL' 
        ? `/api/admin/audit-logs?action=${selectedAction}` 
        : '/api/admin/audit-logs';
      const data = await apiFetch(url);
      setLogs(data || []);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [selectedAction]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Security & System Audit Registry
          </h1>
          <p className="text-xs text-slate-500">
            Immutable database records of all administrative actions, disruptions, and policy changes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedAction}
            onChange={e => setSelectedAction(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Recorded Actions</option>
            <option value="BOOKING_CANCELLED">BOOKING_CANCELLED</option>
            <option value="RUN_CANCELLED">RUN_CANCELLED</option>
            <option value="FARE_UPDATED">FARE_UPDATED</option>
            <option value="SEAT_MAINTENANCE">SEAT_MAINTENANCE</option>
            <option value="LOGS_CLEARED">LOGS_CLEARED</option>
            <option value="JOURNEY_SCHEDULED">JOURNEY_SCHEDULED</option>
          </select>

          <button
            onClick={loadAuditLogs}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Outcome</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    Loading security audit logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/80 transition cursor-pointer" onClick={() => setExpandedLogId(isExpanded ? null : log.id)}>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {log.formattedDate}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-800">
                          {log.entity_type} <span className="text-slate-400">({log.entity_id})</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-sans font-medium">
                          {log.actor_name || 'Railway Administrator'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.outcome === 'SUCCESS' 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : 'bg-rose-50 text-rose-700'
                          }`}>
                            {log.outcome || 'SUCCESS'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button className="text-slate-400 hover:text-slate-600 p-1">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-100">
                          <td colSpan={6} className="p-4">
                            <div className="bg-slate-900 text-slate-200 p-3 rounded-xl text-[11px] font-mono overflow-x-auto">
                              <pre>{JSON.stringify(log.metadata || {}, null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
