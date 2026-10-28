import React from 'react';
import { AlertTriangle, ArrowRightLeft, Train, Clock } from 'lucide-react';

interface JourneyChangeAlertProps {
  journeyType: 'DIRECT' | 'SAME_TRAIN_CHANGE' | 'TWO_TRAIN_CONNECTION';
  transferStationName?: string;
  transferWaitMinutes?: number;
  acknowledgementMessage?: string;
  acknowledged: boolean;
  onToggleAcknowledge: (val: boolean) => void;
}

export const JourneyChangeAlert: React.FC<JourneyChangeAlertProps> = ({
  journeyType,
  transferStationName,
  transferWaitMinutes,
  acknowledgementMessage,
  acknowledged,
  onToggleAcknowledge,
}) => {
  if (journeyType === 'DIRECT') return null;

  const isSeatChange = journeyType === 'SAME_TRAIN_CHANGE';

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
          {isSeatChange ? <ArrowRightLeft className="w-5 h-5" /> : <Train className="w-5 h-5" />}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
              {isSeatChange ? 'Required Same-Train Seat / Coach Change' : 'Required Train Transfer / Layover'}
            </h4>
            <span className="text-[11px] font-semibold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
              Action Required
            </span>
          </div>

          <p className="text-sm text-amber-900 mt-1 leading-relaxed">
            {acknowledgementMessage || (
              isSeatChange 
                ? `You remain on the same train, but will change seats or coaches at ${transferStationName}. Please move between coaches during the scheduled station dwell time.`
                : `This journey requires changing trains at ${transferStationName} with a scheduled ${transferWaitMinutes}-minute layover. Connection is not covered by live delay protection.`
            )}
          </p>

          {!isSeatChange && transferWaitMinutes && (
            <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-amber-800">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Layover window: {transferWaitMinutes} minutes (Standard Demo Policy: 30m - 240m allowed)</span>
            </div>
          )}

          <label className="flex items-start gap-3 mt-4 pt-3 border-t border-amber-200/80 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => onToggleAcknowledge(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-blue-600 rounded border-amber-400 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-amber-950 group-hover:text-black transition">
              I acknowledge that I have reviewed the required {isSeatChange ? 'seat/coach change' : 'train transfer'} details and agree to proceed.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
