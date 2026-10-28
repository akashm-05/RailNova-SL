import React, { useState, useEffect } from 'react';
import { 
  Armchair, 
  Wrench, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Ban, 
  RefreshCw, 
  User, 
  Ticket,
  Shield,
  Layers
} from 'lucide-react';
import { apiFetch } from '../../context/AuthContext';

export const SeatInventoryView: React.FC = () => {
  const [journeys, setJourneys] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [activeCoach, setActiveCoach] = useState<string>('');
  const [inventoryData, setInventoryData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedSeat, setSelectedSeat] = useState<any | null>(null);
  const [updatingSeat, setUpdatingSeat] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Initial load of journeys
  useEffect(() => {
    apiFetch('/api/admin/journeys')
      .then(runs => {
        setJourneys(runs || []);
        if (runs && runs.length > 0) {
          setSelectedRunId(runs[0].run_id);
        }
      })
      .catch(console.error);
  }, []);

  const loadInventory = async (runId: string, coach?: string) => {
    if (!runId) return;
    setLoading(true);
    try {
      const url = coach 
        ? `/api/admin/inventory/${runId}?coach=${coach}`
        : `/api/admin/inventory/${runId}`;
      const data = await apiFetch(url);
      setInventoryData(data);
      setActiveCoach(data.activeCoach);
      if (selectedSeat) {
        const updated = data.seats.find((s: any) => s.id === selectedSeat.id);
        setSelectedSeat(updated || null);
      }
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRunId) {
      loadInventory(selectedRunId, activeCoach);
    }
  }, [selectedRunId]);

  const handleCoachChange = (coach: string) => {
    setActiveCoach(coach);
    loadInventory(selectedRunId, coach);
  };

  const handleToggleDisabled = async (seat: any) => {
    setUpdatingSeat(true);
    const newDisabled = !seat.is_disabled;
    try {
      await apiFetch(`/api/admin/inventory/seats/${seat.id}/toggle-disabled`, {
        method: 'POST',
        body: JSON.stringify({ disabled: newDisabled })
      });
      setFeedback(`Seat ${seat.coach_code}-${seat.seat_number} marked as ${newDisabled ? 'OUT OF SERVICE' : 'IN SERVICE'}.`);
      setUpdatingSeat(false);
      loadInventory(selectedRunId, activeCoach);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update seat status.');
      setUpdatingSeat(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Armchair className="w-5 h-5 text-blue-600" />
            Physical Seat Inventory & Coach Map
          </h1>
          <p className="text-xs text-slate-500">
            Interactive visual berth layout, real-time allocation states, and maintenance overrides.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Train Run:</span>
            <select
              value={selectedRunId}
              onChange={e => { setSelectedRunId(e.target.value); setActiveCoach(''); }}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
            >
              {journeys.map(j => (
                <option key={j.run_id} value={j.run_id}>
                  {j.train_number} - {j.train_name} ({j.run_date})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => loadInventory(selectedRunId, activeCoach)}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Legend & Stats Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-slate-400 font-bold uppercase text-[10px]">Legend:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-emerald-500" />
            <span className="font-medium text-slate-700">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-rose-500" />
            <span className="font-medium text-slate-700">Confirmed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-amber-500" />
            <span className="font-medium text-slate-700">5-Min Hold</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-slate-400" />
            <span className="font-medium text-slate-700">Maintenance / Disabled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded ring-2 ring-blue-600 bg-blue-100" />
            <span className="font-medium text-slate-700">Selected</span>
          </div>
        </div>

        {/* Coach Tabs */}
        <div className="flex items-center gap-1">
          {inventoryData?.coaches?.map((c: any) => (
            <button
              key={c.coach_code}
              onClick={() => handleCoachChange(c.coach_code)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition ${
                activeCoach === c.coach_code
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {c.coach_code} ({c.coach_type})
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout: Visual Coach Map & Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Coach Map */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Coach {activeCoach} ({inventoryData?.run?.train_number} - {inventoryData?.run?.train_name})
              </h2>
              <p className="text-xs text-slate-500">
                Click any berth to inspect allocation records or flag maintenance
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              {inventoryData?.seats?.length || 0} Total Berths
            </div>
          </div>

          {loading ? (
            <div className="py-24 text-center text-slate-400 text-xs">
              Loading physical coach layout...
            </div>
          ) : (
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80">
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                {inventoryData?.seats?.map((seat: any) => {
                  const isSelected = selectedSeat?.id === seat.id;
                  const isConf = seat.state === 'CONFIRMED';
                  const isHeld = seat.state === 'HELD';
                  const isDisabled = seat.state === 'DISABLED';
                  const isAvail = seat.state === 'AVAILABLE';

                  let colorClass = 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-500/20';
                  if (isDisabled) {
                    colorClass = 'bg-slate-400 text-slate-100';
                  } else if (isConf) {
                    colorClass = 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/20';
                  } else if (isHeld) {
                    colorClass = 'bg-amber-500 text-slate-950 font-bold hover:bg-amber-600';
                  }

                  return (
                    <button
                      key={seat.id}
                      onClick={() => setSelectedSeat(seat)}
                      className={`relative p-3 rounded-xl flex flex-col items-center justify-center transition-all ${colorClass} ${
                        isSelected ? 'ring-4 ring-blue-600 ring-offset-2 scale-105 z-10' : ''
                      }`}
                    >
                      <span className="text-sm font-mono font-black">{seat.seat_number}</span>
                      <span className="text-[9px] uppercase tracking-wider font-semibold opacity-90">
                        {seat.berth_type === 'SIDE_LOWER' ? 'SL' : seat.berth_type === 'SIDE_UPPER' ? 'SU' : seat.berth_type[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Seat Inspector Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Armchair className="w-4 h-4 text-blue-600" />
                Berth Inspector
              </h3>
              {selectedSeat && (
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                  {selectedSeat.coach_code}-{selectedSeat.seat_number}
                </span>
              )}
            </div>

            {!selectedSeat ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Select any berth from the coach grid to inspect passenger allocation details or toggle maintenance status.
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Status Indicator */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Current Status</div>
                  <div className="text-base font-black text-slate-900 mt-0.5 flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${
                      selectedSeat.state === 'CONFIRMED' ? 'bg-rose-500' :
                      selectedSeat.state === 'HELD' ? 'bg-amber-500' :
                      selectedSeat.state === 'DISABLED' ? 'bg-slate-400' : 'bg-emerald-500'
                    }`} />
                    {selectedSeat.state}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Coach Type: <strong>{selectedSeat.coach_type}</strong> • Berth: <strong>{selectedSeat.berth_type}</strong>
                  </div>
                </div>

                {/* Allocation details if booked */}
                {selectedSeat.allocation && (
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200/60 space-y-2">
                    <div className="text-[10px] uppercase font-bold text-blue-700">Reservation Details</div>
                    <div className="font-bold text-slate-900 text-sm">
                      {selectedSeat.allocation.passenger_name}
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono">
                      PNR: <strong>{selectedSeat.allocation.pnr}</strong>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Segment: <strong>{selectedSeat.allocation.from_station} → {selectedSeat.allocation.to_station}</strong>
                    </div>
                    {selectedSeat.allocation.expires_at && (
                      <div className="text-[10px] text-amber-700 font-mono">
                        Hold Expires: {new Date(selectedSeat.allocation.expires_at).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Maintenance Toggle */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleToggleDisabled(selectedSeat)}
                    disabled={updatingSeat}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 ${
                      selectedSeat.is_disabled
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-800 hover:bg-slate-900 text-white'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    {updatingSeat 
                      ? 'Updating...' 
                      : selectedSeat.is_disabled 
                      ? 'Restore Berth to Service' 
                      : 'Take Out of Service (Maintenance)'}
                  </button>
                  <p className="text-[10px] text-slate-400 mt-2 text-center">
                    Disabling prevents the algorithm and passengers from booking this seat interval.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
