import React from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';

export const DemoDisclaimerBanner: React.FC = () => {
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs py-1.5 px-4 no-print">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong className="font-semibold">Educational Project Demonstration:</strong> Schedules, pricing, and availability are simulated RailNova database records. Payments are mock-tested. Issued tickets are <strong>not valid</strong> for real railway transit.
          </span>
        </div>
        <span className="hidden md:inline-block font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[11px]">
          Demo Environment
        </span>
      </div>
    </div>
  );
};
