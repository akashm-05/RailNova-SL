import React, { useState } from 'react';
import { Armchair, CheckCircle2, Lock, Clock, DoorOpen, Compass } from 'lucide-react';

export interface SeatItem {
  id: string;
  seatNumber: number;
  berthType: string;
  baseFare: number;
  status: 'AVAILABLE' | 'CONFIRMED' | 'HELD';
}

export interface CoachData {
  coachCode: string;
  coachType: string;
  seats: SeatItem[];
}

interface CoachLayoutProps {
  coaches: CoachData[];
  selectedSeatIds: string[];
  onSelectSeat: (seat: SeatItem, coachCode: string) => void;
  maxSelectable: number;
  fromStationName: string;
  toStationName: string;
}

export const CoachLayout: React.FC<CoachLayoutProps> = ({
  coaches,
  selectedSeatIds,
  onSelectSeat,
  maxSelectable,
  fromStationName,
  toStationName,
}) => {
  const [activeCoachIndex, setActiveCoachIndex] = useState(0);
  const [selectedBayFilter, setSelectedBayFilter] = useState<number | 'ALL'>('ALL');

  if (!coaches || coaches.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        No coaches found for this service.
      </div>
    );
  }

  const currentCoach = coaches[activeCoachIndex] || coaches[0];
  const seatsPerBay = currentCoach.coachType === '2A' ? 6 : currentCoach.coachType === '1A' ? 4 : 8;
  const totalBays = Math.ceil(currentCoach.seats.length / seatsPerBay);

  // Group seats into bays
  const bays: Array<{ bayNumber: number; seats: SeatItem[] }> = [];
  for (let b = 1; b <= totalBays; b++) {
    const startIdx = (b - 1) * seatsPerBay;
    const baySeats = currentCoach.seats.slice(startIdx, startIdx + seatsPerBay);
    if (baySeats.length > 0) {
      bays.push({ bayNumber: b, seats: baySeats });
    }
  }

  const displayedBays = selectedBayFilter === 'ALL' 
    ? bays 
    : bays.filter(b => b.bayNumber === selectedBayFilter);

  const getBerthBadgeColor = (berthType: string) => {
    if (berthType.includes('LOWER')) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (berthType.includes('MIDDLE')) return 'bg-amber-100 text-amber-800 border-amber-300';
    if (berthType.includes('UPPER')) return 'bg-sky-100 text-sky-800 border-sky-300';
    return 'bg-purple-100 text-purple-800 border-purple-300';
  };

  const renderSeatButton = (seat?: SeatItem) => {
    if (!seat) return <div className="h-16 w-16 invisible" />;

    const isSelected = selectedSeatIds.includes(seat.id);
    const isAvailable = seat.status === 'AVAILABLE';
    const isHeld = seat.status === 'HELD';
    const isBooked = seat.status === 'CONFIRMED';

    let btnClass = 'bg-teal-50/80 border-teal-300 text-teal-950 hover:bg-teal-100 hover:border-teal-500 shadow-sm';
    let icon = <Armchair className="w-3.5 h-3.5 text-teal-600" />;

    if (isSelected) {
      btnClass = 'bg-blue-600 border-blue-700 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400';
      icon = <CheckCircle2 className="w-3.5 h-3.5 text-white" />;
    } else if (isHeld) {
      btnClass = 'bg-amber-50 border-amber-300 text-amber-900 cursor-not-allowed opacity-80';
      icon = <Clock className="w-3.5 h-3.5 text-amber-600" />;
    } else if (isBooked) {
      btnClass = 'bg-red-50 border-red-300 text-red-800 cursor-not-allowed opacity-60';
      icon = <Lock className="w-3.5 h-3.5 text-red-500" />;
    }

    return (
      <button
        key={seat.id}
        type="button"
        disabled={!isAvailable && !isSelected}
        onClick={() => onSelectSeat(seat, currentCoach.coachCode)}
        className={`relative p-2 rounded-xl border flex flex-col items-center justify-between transition min-w-[72px] h-20 text-center ${btnClass}`}
        title={`Seat ${seat.seatNumber}: ${seat.berthType} (${seat.status})`}
      >
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-black font-mono">
            #{seat.seatNumber}
          </span>
          {icon}
        </div>

        <span className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border ${
          isSelected ? 'bg-blue-700 text-white border-blue-500' : getBerthBadgeColor(seat.berthType)
        }`}>
          {seat.berthType.replace('SIDE_', 'S.').replace('CABIN_', 'C.')}
        </span>

        <span className="text-[9px] font-semibold opacity-75">
          {isSelected ? 'SELECTED' : isAvailable ? 'AVAILABLE' : isHeld ? 'HELD' : 'BOOKED'}
        </span>
      </button>
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
      {/* Coach Header & Navigation */}
      <div className="bg-slate-50 border-b border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-mono text-sm">
                Coach {currentCoach.coachCode}
              </span>
              <span>{currentCoach.coachType === 'SL' ? 'Sleeper Class' : currentCoach.coachType === '3A' ? 'AC 3 Tier' : currentCoach.coachType === '2A' ? 'AC 2 Tier' : 'First Class AC'}</span>
            </h3>
            <span className="text-xs bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded-full font-mono">
              {currentCoach.seats.length} Berths ({totalBays} Compartment Bays)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time segment availability for travel between <strong className="text-slate-800">{fromStationName}</strong> and <strong className="text-slate-800">{toStationName}</strong>.
          </p>
        </div>

        {/* Coach Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {coaches.map((c, idx) => (
            <button
              key={c.coachCode}
              type="button"
              onClick={() => {
                setActiveCoachIndex(idx);
                setSelectedBayFilter('ALL');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeCoachIndex === idx
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Armchair className="w-3.5 h-3.5" />
              <span>{c.coachCode} ({c.coachType})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bay Quick Filter Bar */}
      <div className="px-5 py-2 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="font-bold text-slate-600 shrink-0">Filter Bay:</span>
          <button
            onClick={() => setSelectedBayFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
              selectedBayFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-300'
            }`}
          >
            All Bays (1–{totalBays})
          </button>
          {bays.map(b => (
            <button
              key={b.bayNumber}
              onClick={() => setSelectedBayFilter(b.bayNumber)}
              className={`px-2 py-1 rounded-lg font-bold text-[11px] transition ${
                selectedBayFilter === b.bayNumber ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-300'
              }`}
            >
              Bay {b.bayNumber}
            </button>
          ))}
        </div>

        <span className="font-bold text-blue-700 text-xs">
          Assigned: {selectedSeatIds.length} / {maxSelectable} Passenger{maxSelectable > 1 ? 's' : ''}
        </span>
      </div>

      {/* Authentic Coach Blueprint Visualization */}
      <div className="p-6 overflow-x-auto">
        <div className="min-w-[760px] max-w-5xl mx-auto bg-slate-100 rounded-3xl p-6 border-2 border-slate-300 space-y-6">
          {/* Coach Exterior Frame Header */}
          <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-500 px-4 pb-2 border-b-2 border-slate-300">
            <div className="flex items-center gap-2 text-slate-700">
              <DoorOpen className="w-4 h-4 text-slate-600" />
              <span>Coach Vestibule / Entrance</span>
            </div>
            <span className="tracking-widest uppercase text-slate-600">
              ◄ Track Direction — Train Car {currentCoach.coachCode} ►
            </span>
            <div className="flex items-center gap-2 text-slate-700">
              <span>Gangway</span>
              <DoorOpen className="w-4 h-4 text-slate-600" />
            </div>
          </div>

          {/* Bays Container */}
          <div className="space-y-4">
            {displayedBays.map((bay) => {
              // Standard 8-berth layout:
              // Left cabin: Seats 1..6 (facing rows: 1,2,3 facing 4,5,6)
              // Center: Aisle corridor
              // Right side: Seats 7,8 (Side Lower, Side Upper)
              const cabinSeats = bay.seats.filter(s => !s.berthType.startsWith('SIDE_'));
              const sideSeats = bay.seats.filter(s => s.berthType.startsWith('SIDE_'));

              return (
                <div
                  key={bay.bayNumber}
                  className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <span className="text-xs font-black font-mono uppercase tracking-wider text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded">
                      Bay {bay.bayNumber} (Berths #{bay.seats[0]?.seatNumber} – #{bay.seats[bay.seats.length - 1]?.seatNumber})
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Standard Compartment
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    {/* Main Compartment Berths (Left Side) */}
                    <div className="flex-1 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Main Compartment Berths
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {cabinSeats.map(seat => renderSeatButton(seat))}
                      </div>
                    </div>

                    {/* Corridor / Walking Aisle */}
                    <div className="w-16 flex flex-col items-center justify-center border-l-2 border-r-2 border-dashed border-slate-200 py-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest rotate-90 my-auto">
                        AISLE
                      </span>
                    </div>

                    {/* Side Berths (Right Side) */}
                    <div className="w-48 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Side Berths (Track View)
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {sideSeats.map(seat => renderSeatButton(seat))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend Footer */}
          <div className="pt-4 border-t-2 border-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-teal-100 border border-teal-500"></span>
                <span className="text-slate-700 font-medium">Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-blue-600 border border-blue-700"></span>
                <span className="text-slate-900 font-bold">Your Selection</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-500"></span>
                <span className="text-slate-700 font-medium">Temporarily Held</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-red-100 border border-red-400"></span>
                <span className="text-slate-700 font-medium">Booked on Segment</span>
              </div>
            </div>

            <span className="text-slate-500 text-[11px] font-medium">
              💡 Select exactly {maxSelectable} berth(s) for your party before proceeding.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
