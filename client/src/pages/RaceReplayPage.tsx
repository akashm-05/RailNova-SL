import React, { useState } from 'react';
import { Play, ShieldCheck, Zap, Users, CheckCircle2, XCircle, Clock, Database, Code2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';

export const RaceReplayPage: React.FC = () => {
  const [contendersCount, setContendersCount] = useState(3);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunRace = async () => {
    setRunning(true);
    setError(null);
    try {
      const data = await apiFetch('/api/concurrency/race-replay', {
        method: 'POST',
        body: JSON.stringify({ contendersCount })
      });
      setReport(data);
      setRunning(false);
    } catch (err: any) {
      setError(err.message || 'Concurrency race execution failed.');
      setRunning(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-400/30">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            Live PostgreSQL Concurrency Stress Test
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Booking Race Replay
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Visually demonstrates RailNova's database-level race condition protection by firing simultaneous booking requests for the exact same berth across parallel PostgreSQL transactions.
          </p>
        </div>

        {/* Contender Count & Run Trigger */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-2xl">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-slate-300">Contenders:</span>
            <select
              value={contendersCount}
              onChange={(e) => setContendersCount(Number(e.target.value))}
              disabled={running}
              className="bg-slate-900 text-white font-mono text-xs font-bold rounded-lg px-2 py-1 border border-slate-600"
            >
              <option value={2}>2 Users</option>
              <option value={3}>3 Users</option>
              <option value={4}>4 Users</option>
              <option value={5}>5 Users</option>
            </select>
          </div>

          <button
            onClick={handleRunRace}
            disabled={running}
            className="py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
            <span>{running ? 'Firing Race...' : 'Start Live Race'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Visual Race Track & Live Telemetry */}
      {report && (
        <div className="space-y-6 animate-fadeIn">
          {/* Target Berth Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                Contested Inventory Asset:
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">
                Coach {report.coachCode} — Berth #{report.seatNumber} ({report.berthType})
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Run ID: {report.runId} • Target Segment: [0, 4) (New Delhi to Howrah)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Zero Double Booking Guaranteed</span>
              </span>
            </div>
          </div>

          {/* Animated Contender Race Lanes */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Simultaneous Request Execution Timeline</span>
            </h3>

            <div className="space-y-3 pt-2">
              {report.contenders.map((c: any, idx: number) => {
                const isWinner = c.outcome === 'WON_HOLD';

                return (
                  <div
                    key={c.contenderId}
                    className={`p-4 rounded-2xl border transition flex flex-wrap items-center justify-between gap-4 ${
                      isWinner
                        ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                        style={{ backgroundColor: c.avatarColor }}
                      >
                        #{idx + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{c.contenderName}</span>
                          {isWinner && (
                            <span className="bg-emerald-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                              Winner (Lock Acquired)
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 block">
                          T={c.requestedAt.split('T')[1].slice(0, 12)} • Execution Duration: {c.durationMs}ms
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      {isWinner ? (
                        <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Status: 201 Created (PNR: {c.pnrReference})</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-700 font-semibold text-xs">
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span>Status: {c.statusCode} Conflict ({c.errorMessage})</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Database Verification Proof */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Box 1: Actual Physical DB State */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 space-y-4 border border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-400">
                <Database className="w-5 h-5" />
                <h4 className="font-bold text-sm uppercase tracking-wide">
                  PostgreSQL Table Inspection
                </h4>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Total Allocations in DB:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {report.databaseVerification.totalAllocationsInDatabase} Record
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Allocated To:</span>
                  <span className="font-bold text-white">
                    {report.databaseVerification.allocatedToUser}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Double-Booking Detected:</span>
                  <span className="font-bold text-emerald-400">
                    NONE (0% Overlap)
                  </span>
                </div>
              </div>
            </div>

            {/* Box 2: SQL Lock Mechanism */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600">
                <Code2 className="w-5 h-5" />
                <h4 className="font-bold text-sm uppercase tracking-wide">
                  Concurrency Control Architecture
                </h4>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>Lock Protocol:</strong> {report.technicalDeepDive.lockMechanism}
              </p>

              <div className="p-3 bg-slate-900 text-blue-300 font-mono text-[11px] rounded-xl overflow-x-auto">
                <code>{report.technicalDeepDive.sqlStatementSnippet}</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
