import React, { useState, useEffect } from 'react';
import { 
  Train, 
  Calendar, 
  Plus, 
  Ban, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  X,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { apiFetch } from '../../context/AuthContext';

export const TrainsJourneysView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'JOURNEYS' | 'TRAINS'>('JOURNEYS');
  const [journeys, setJourneys] = useState<any[]>([]);
  const [trains, setTrains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Manifest Modal State
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [manifestData, setManifestData] = useState<any | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);

  // Schedule Journey Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedTrainId, setSelectedTrainId] = useState('');
  const [selectedRunDate, setSelectedRunDate] = useState('');
  const [scheduling, setScheduling] = useState(false);

  // Add Train Modal State
  const [showAddTrainModal, setShowAddTrainModal] = useState(false);
  const [trainNumber, setTrainNumber] = useState('');
  const [trainName, setTrainName] = useState('');
  const [sourceCode, setSourceCode] = useState('NDLS');
  const [destCode, setDestCode] = useState('HWH');
  const [addingTrain, setAddingTrain] = useState(false);

  const [cancellingRunId, setCancellingRunId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [journeysRes, trainsRes] = await Promise.all([
        apiFetch('/api/admin/journeys'),
        apiFetch('/api/admin/trains')
      ]);
      setJourneys(journeysRes || []);
      setTrains(trainsRes || []);
      if (trainsRes && trainsRes.length > 0 && !selectedTrainId) {
        setSelectedTrainId(trainsRes[0].id);
      }
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Default tomorrow for scheduling
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedRunDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  const handleViewManifest = async (runId: string) => {
    setSelectedRunId(runId);
    setLoadingManifest(true);
    try {
      const data = await apiFetch(`/api/admin/manifest/${runId}`);
      setManifestData(data);
      setLoadingManifest(false);
    } catch (err: any) {
      alert(err.message || 'Failed to load manifest.');
      setLoadingManifest(false);
    }
  };

  const handleCancelRun = async (runId: string, trainNum: string) => {
    if (!confirm(`CAUTION: Are you sure you want to cancel Train Run ${trainNum}? All bookings on this service will be cancelled and automatically refunded.`)) {
      return;
    }
    setCancellingRunId(runId);
    try {
      const res = await apiFetch(`/api/admin/runs/${runId}/cancel`, { method: 'POST' });
      setActionMessage(res.message);
      setCancellingRunId(null);
      loadData();
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel train run.');
      setCancellingRunId(null);
    }
  };

  const handleScheduleJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrainId || !selectedRunDate) return;
    setScheduling(true);
    try {
      await apiFetch('/api/admin/journeys', {
        method: 'POST',
        body: JSON.stringify({ trainId: selectedTrainId, runDate: selectedRunDate })
      });
      setActionMessage('New train run scheduled successfully with coach seats.');
      setShowScheduleModal(false);
      setScheduling(false);
      loadData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to schedule journey.');
      setScheduling(false);
    }
  };

  const handleAddTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainNumber || !trainName) return;
    setAddingTrain(true);
    try {
      await apiFetch('/api/admin/trains', {
        method: 'POST',
        body: JSON.stringify({
          trainNumber,
          name: trainName,
          sourceCode,
          destCode
        })
      });
      setActionMessage(`Train ${trainNumber} added to railway fleet.`);
      setShowAddTrainModal(false);
      setAddingTrain(false);
      setTrainNumber('');
      setTrainName('');
      loadData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to create train.');
      setAddingTrain(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Train className="w-5 h-5 text-blue-600" />
            Train Fleet & Scheduled Journeys
          </h1>
          <p className="text-xs text-slate-500">
            Manage services, timetable runs, passenger manifests, and disruption cancellations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'JOURNEYS' ? (
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              Schedule Journey
            </button>
          ) : (
            <button
              onClick={() => setShowAddTrainModal(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              Add Train Service
            </button>
          )}

          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('JOURNEYS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'JOURNEYS'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Scheduled Journeys ({journeys.length})
        </button>
        <button
          onClick={() => setActiveTab('TRAINS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'TRAINS'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Train className="w-4 h-4" />
          Trains Fleet ({trains.length})
        </button>
      </div>

      {/* Tab 1: Scheduled Journeys */}
      {activeTab === 'JOURNEYS' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Run Date</th>
                  <th className="py-3 px-4">Train Service</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Capacity / Booked</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {journeys.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No scheduled train journeys found.
                    </td>
                  </tr>
                ) : (
                  journeys.map(j => (
                    <tr key={j.run_id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {j.run_date}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{j.train_number} - {j.train_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {j.run_id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-700 font-semibold">
                          {j.source_station_code} → {j.dest_station_code}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {j.booked_seats || 0} / {j.total_seats || 0} seats
                        </div>
                        {Number(j.disabled_seats || 0) > 0 && (
                          <div className="text-[10px] text-amber-600">
                            {j.disabled_seats} seats in maintenance
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          j.status === 'SCHEDULED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : j.status === 'RUNNING'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {j.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleViewManifest(j.run_id)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-medium flex items-center gap-1"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                            Manifest
                          </button>
                          {j.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleCancelRun(j.run_id, j.train_number)}
                              disabled={cancellingRunId === j.run_id}
                              className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-medium flex items-center gap-1"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Cancel Run
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
      )}

      {/* Tab 2: Registered Trains */}
      {activeTab === 'TRAINS' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Train Number</th>
                  <th className="py-3 px-4">Service Name</th>
                  <th className="py-3 px-4">Origin / Terminus</th>
                  <th className="py-3 px-4">Routes Configured</th>
                  <th className="py-3 px-4">Runs Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trains.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      {t.train_number}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {t.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {t.source_station_code} ⟷ {t.dest_station_code}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {t.routes_count} route profile
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {t.scheduled_runs_count} runs
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manifest Modal */}
      {selectedRunId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Passenger Manifest
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-1">
                  {manifestData?.run?.train_number} - {manifestData?.run?.train_name} ({manifestData?.run?.run_date})
                </h2>
              </div>
              <button
                onClick={() => { setSelectedRunId(null); setManifestData(null); }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingManifest || !manifestData ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Loading official passenger manifest...
              </div>
            ) : manifestData.manifest?.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No confirmed passengers boarded on this run.
              </div>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Coach / Seat</th>
                      <th className="py-2.5 px-3">Passenger</th>
                      <th className="py-2.5 px-3">PNR</th>
                      <th className="py-2.5 px-3">Segment</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {manifestData.manifest.map((pax: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                          {pax.coach_code} - #{pax.seat_number} ({pax.berth_type})
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900">{pax.passenger_name}</span>
                          <span className="text-[10px] text-slate-500 ml-1.5">({pax.age}y, {pax.gender})</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                          {pax.pnr}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {pax.from_station_code} → {pax.to_station_code}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            CONFIRMED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">
                Total Passengers: {manifestData?.passengersCount || 0}
              </span>
              <button
                onClick={() => setSelectedRunId(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Close Manifest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Journey Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleScheduleJourney} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Schedule New Train Journey</h2>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Select Train Service</label>
                <select
                  value={selectedTrainId}
                  onChange={e => setSelectedTrainId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium"
                  required
                >
                  {trains.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.train_number} - {t.name} ({t.source_station_code} ⟷ {t.dest_station_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Journey Date</label>
                <input
                  type="date"
                  value={selectedRunDate}
                  onChange={e => setSelectedRunDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                  required
                />
              </div>

              <div className="p-3 bg-blue-50 text-blue-800 rounded-xl text-[11px]">
                ℹ️ Automatically configures route stops, dwells, and initial coach seat inventory (CC1, CC2, SL1).
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-3 py-2 rounded-xl text-slate-600 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={scheduling}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl"
              >
                {scheduling ? 'Scheduling...' : 'Confirm Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Train Modal */}
      {showAddTrainModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddTrain} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Add Train Service to Fleet</h2>
              <button
                type="button"
                onClick={() => setShowAddTrainModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Train Number (5 digits)</label>
                <input
                  type="text"
                  placeholder="e.g. 12424"
                  value={trainNumber}
                  onChange={e => setTrainNumber(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rajdhani Superfast Express"
                  value={trainName}
                  onChange={e => setTrainName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Source Station</label>
                  <input
                    type="text"
                    value={sourceCode}
                    onChange={e => setSourceCode(e.target.value.toUpperCase())}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Destination Station</label>
                  <input
                    type="text"
                    value={destCode}
                    onChange={e => setDestCode(e.target.value.toUpperCase())}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddTrainModal(false)}
                className="px-3 py-2 rounded-xl text-slate-600 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingTrain}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl"
              >
                {addingTrain ? 'Adding...' : 'Add Train'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
