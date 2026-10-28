import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  RefreshCw, 
  Ticket, 
  Calendar, 
  UserCheck 
} from 'lucide-react';
import { apiFetch } from '../../context/AuthContext';

export const PassengersView: React.FC = () => {
  const [passengers, setPassengers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadPassengers = async (q?: string) => {
    setLoading(true);
    try {
      const url = q ? `/api/admin/passengers?q=${encodeURIComponent(q)}` : '/api/admin/passengers';
      const data = await apiFetch(url);
      setPassengers(data || []);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPassengers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadPassengers(search);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Passenger Directory & Travel History
          </h1>
          <p className="text-xs text-slate-500">
            Audit customer travel frequency, past reservations, and demographic records.
          </p>
        </div>

        <button
          onClick={() => loadPassengers(search)}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search passenger name or PNR..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition"
        >
          Search Directory
        </button>
      </form>

      {/* Passengers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Passenger Name</th>
                <th className="py-3 px-4">Demographics</th>
                <th className="py-3 px-4">Total Bookings</th>
                <th className="py-3 px-4">Last Reserved Date</th>
                <th className="py-3 px-4">Associated PNRs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Loading passenger directory...
                  </td>
                </tr>
              ) : passengers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No passengers recorded in database yet.
                  </td>
                </tr>
              ) : (
                passengers.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px]">
                          {p.full_name ? p.full_name[0].toUpperCase() : 'P'}
                        </div>
                        <span>{p.full_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.age} years • {p.gender}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {p.booking_count} bookings
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {p.formattedLastDate}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                        {p.pnrs?.split(',').map((pnrStr: string, i: number) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {pnrStr.trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
