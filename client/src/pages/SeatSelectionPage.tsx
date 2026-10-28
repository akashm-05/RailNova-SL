import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CoachLayout, CoachData, SeatItem } from '../components/CoachLayout';
import { JourneyChangeAlert } from '../components/JourneyChangeAlert';
import { useAuth, apiFetch } from '../context/AuthContext';
import { Train, User, AlertCircle, ArrowRight, CheckCircle2, ChevronRight, Lock } from 'lucide-react';

export const SeatSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const passengerCount = Number(searchParams.get('passengerCount') || 1);
  const { user } = useAuth();

  const [itinerary, setItinerary] = useState<any | null>(null);
  const [activeLegIndex, setActiveLegIndex] = useState(0);
  const [coachDataByLeg, setCoachDataByLeg] = useState<Record<number, CoachData[]>>({});
  const [selectedSeatsByLeg, setSelectedSeatsByLeg] = useState<Record<number, string[]>>({});
  const [passengers, setPassengers] = useState<Array<{ fullName: string; age: number; gender: string; berthPreference: string }>>([
    { fullName: user ? user.name : 'Aarav Sharma', age: 29, gender: 'M', berthPreference: 'LOWER' }
  ]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [holding, setHolding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load itinerary from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('railnova_selected_itinerary');
    if (!stored) {
      navigate('/');
      return;
    }
    const parsed = JSON.parse(stored);
    setItinerary(parsed);

    // Initialize passenger rows
    const paxList = [];
    for (let i = 0; i < passengerCount; i++) {
      paxList.push({
        fullName: i === 0 && user ? user.name : `Passenger ${i + 1}`,
        age: 28 + i * 2,
        gender: i % 2 === 0 ? 'M' : 'F',
        berthPreference: 'LOWER'
      });
    }
    setPassengers(paxList);

    // Initialize suggested seats
    const initialSeats: Record<number, string[]> = {};
    parsed.legs.forEach((leg: any, idx: number) => {
      if (leg.suggestedSeats && leg.suggestedSeats.length >= passengerCount) {
        initialSeats[idx] = leg.suggestedSeats.slice(0, passengerCount).map((s: any) => s.seatId);
      } else {
        initialSeats[idx] = [];
      }
    });
    setSelectedSeatsByLeg(initialSeats);

    // Fetch live seats for all legs
    const fetchPromises = parsed.legs.map((leg: any, idx: number) =>
      fetch(`/api/runs/${leg.runId}/seats?fromStopSeq=${leg.fromStopSeq}&toStopSeq=${leg.toStopSeq}&class=${leg.coachType}`)
        .then(r => r.json())
        .then(data => ({ legIndex: idx, coaches: data.coaches || [] }))
    );

    Promise.all(fetchPromises)
      .then(results => {
        const coachMap: Record<number, CoachData[]> = {};
        results.forEach(res => {
          coachMap[res.legIndex] = res.coaches;
        });
        setCoachDataByLeg(coachMap);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load seats.');
        setLoading(false);
      });
  }, [navigate, passengerCount, user]);

  if (loading || !itinerary) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm font-semibold text-slate-600">Retrieving coach inventory and segment allocations...</p>
      </div>
    );
  }

  const currentLeg = itinerary.legs[activeLegIndex];
  const currentCoaches = coachDataByLeg[activeLegIndex] || [];
  const currentSelectedSeats = selectedSeatsByLeg[activeLegIndex] || [];

  const handleSeatClick = (seat: SeatItem) => {
    const current = [...(selectedSeatsByLeg[activeLegIndex] || [])];
    const existsIndex = current.indexOf(seat.id);

    if (existsIndex >= 0) {
      current.splice(existsIndex, 1);
    } else {
      if (current.length >= passengerCount) {
        // Replace first if limit reached
        current.shift();
      }
      current.push(seat.id);
    }

    setSelectedSeatsByLeg({
      ...selectedSeatsByLeg,
      [activeLegIndex]: current
    });
  };

  const handleHoldAndContinue = async () => {
    setError(null);

    // Require sign-in
    if (!localStorage.getItem('railnova_token')) {
      alert('Please sign in with a demo passenger account to proceed.');
      navigate('/login');
      return;
    }

    // Validation: All passengers must have seats allocated on all legs
    for (let lIdx = 0; lIdx < itinerary.legs.length; lIdx++) {
      const seats = selectedSeatsByLeg[lIdx] || [];
      if (seats.length < passengerCount) {
        setError(`Please select ${passengerCount} seat(s) for Leg ${lIdx + 1} (${itinerary.legs[lIdx].fromStationCode} ➔ ${itinerary.legs[lIdx].toStationCode}).`);
        setActiveLegIndex(lIdx);
        return;
      }
    }

    // Validation: Acknowledge change if required
    if (itinerary.requiresAcknowledgement && !acknowledged) {
      setError('Please check the acknowledgement box confirming you reviewed the required seat change / transfer.');
      return;
    }

    // Build API payload
    const legsPayload = itinerary.legs.map((leg: any, idx: number) => ({
      legOrder: leg.legOrder,
      runId: leg.runId,
      fromStationCode: leg.fromStationCode,
      toStationCode: leg.toStationCode,
      fromStopSeq: leg.fromStopSeq,
      toStopSeq: leg.toStopSeq,
      seatAllocations: (selectedSeatsByLeg[idx] || []).map((seatId, pIdx) => ({
        passengerIndex: pIdx,
        seatId
      }))
    }));

    setHolding(true);
    try {
      const holdRes = await apiFetch('/api/holds', {
        method: 'POST',
        body: JSON.stringify({
          journeyType: itinerary.journeyType,
          changeAcknowledged: acknowledged,
          passengers,
          legs: legsPayload
        })
      });

      setHolding(false);
      navigate(`/checkout/${holdRes.booking.id}`);
    } catch (err: any) {
      setHolding(false);
      setError(err.message || 'Failed to place atomic seat hold.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <span className="text-xs font-mono uppercase text-blue-600 font-bold">Step 2 of 3</span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            Review Berths & Passenger Details
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {itinerary.originStationCode} ➔ {itinerary.destinationStationCode} • {itinerary.legs.length} Leg{itinerary.legs.length > 1 ? 's' : ''} • {passengerCount} Passenger{passengerCount > 1 ? 's' : ''}
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-500">Estimated Total</span>
          <p className="text-2xl font-extrabold text-slate-900">
            ₹{(itinerary.totalFare / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Mandatory Disclosure Alert */}
      <JourneyChangeAlert
        journeyType={itinerary.journeyType}
        transferStationName={itinerary.transferStationName}
        transferWaitMinutes={itinerary.transferWaitMinutes}
        acknowledgementMessage={itinerary.acknowledgementMessage}
        acknowledged={acknowledged}
        onToggleAcknowledge={setAcknowledged}
      />

      {/* Leg Tabs if Multi-Leg */}
      {itinerary.legs.length > 1 && (
        <div className="flex border-b border-slate-200 gap-2">
          {itinerary.legs.map((leg: any, idx: number) => {
            const isCompleted = (selectedSeatsByLeg[idx] || []).length === passengerCount;
            return (
              <button
                key={leg.legOrder}
                onClick={() => setActiveLegIndex(idx)}
                className={`py-3 px-5 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
                  activeLegIndex === idx
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Leg {leg.legOrder}: {leg.fromStationCode} ➔ {leg.toStationCode}</span>
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                ) : (
                  <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                    Seat needed
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Coach Layout */}
      <CoachLayout
        coaches={currentCoaches}
        selectedSeatIds={currentSelectedSeats}
        onSelectSeat={handleSeatClick}
        maxSelectable={passengerCount}
        fromStationName={currentLeg.fromStationName || currentLeg.fromStationCode}
        toStationName={currentLeg.toStationName || currentLeg.toStationCode}
      />

      {/* Passenger Information Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-600" />
          Passenger Information
        </h3>

        <div className="space-y-3">
          {passengers.map((pax, pIdx) => (
            <div key={pIdx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block">Full Name</label>
                <input
                  type="text"
                  value={pax.fullName}
                  onChange={(e) => {
                    const updated = [...passengers];
                    updated[pIdx].fullName = e.target.value;
                    setPassengers(updated);
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold bg-white"
                  placeholder="e.g. Aarav Sharma"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block">Age</label>
                <input
                  type="number"
                  value={pax.age}
                  onChange={(e) => {
                    const updated = [...passengers];
                    updated[pIdx].age = Number(e.target.value);
                    setPassengers(updated);
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block">Gender</label>
                <select
                  value={pax.gender}
                  onChange={(e) => {
                    const updated = [...passengers];
                    updated[pIdx].gender = e.target.value;
                    setPassengers(updated);
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold bg-white"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block">Berth Preference</label>
                <select
                  value={pax.berthPreference}
                  onChange={(e) => {
                    const updated = [...passengers];
                    updated[pIdx].berthPreference = e.target.value;
                    setPassengers(updated);
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold bg-white"
                >
                  <option value="LOWER">Lower Berth</option>
                  <option value="MIDDLE">Middle Berth</option>
                  <option value="UPPER">Upper Berth</option>
                  <option value="SIDE_LOWER">Side Lower</option>
                  <option value="SIDE_UPPER">Side Upper</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <span className="text-xs text-blue-300 font-mono">Atomic Database Lock Guarantee</span>
          <p className="text-xs text-slate-300 mt-0.5">
            Claiming seats triggers an immediate 5-minute serialized hold across all itinerary legs.
          </p>
        </div>

        <button
          onClick={handleHoldAndContinue}
          disabled={holding}
          className="py-3.5 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/30 flex items-center gap-2 transition"
        >
          {holding ? (
            <span>Placing Atomic Hold...</span>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              <span>Hold Seats and Continue</span>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
