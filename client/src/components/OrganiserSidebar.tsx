import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Train, 
  Armchair, 
  Users, 
  IndianRupee, 
  BarChart3, 
  ShieldCheck, 
  Sliders, 
  Settings, 
  LogOut, 
  Radio, 
  Shield, 
  X,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type OrganiserSection = 
  | 'overview'
  | 'bookings'
  | 'trains'
  | 'inventory'
  | 'passengers'
  | 'pricing'
  | 'analytics'
  | 'audit'
  | 'simulation'
  | 'settings';

interface SidebarProps {
  currentSection: OrganiserSection;
  onSelectSection: (section: OrganiserSection) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const OrganiserSidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  isOpenMobile,
  onCloseMobile
}) => {
  const { user, logout } = useAuth();

  const navigationItems: { id: OrganiserSection; label: string; icon: React.FC<{ className?: string }>; badge?: string }[] = [
    { id: 'overview', label: '1. Overview', icon: LayoutDashboard },
    { id: 'bookings', label: '2. Booking Logs', icon: FileText },
    { id: 'trains', label: '3. Train & Journeys', icon: Train },
    { id: 'inventory', label: '4. Seat Inventory', icon: Armchair },
    { id: 'passengers', label: '5. Passengers', icon: Users },
    { id: 'pricing', label: '6. Fare & Pricing', icon: IndianRupee },
    { id: 'analytics', label: '7. Analytics & Reports', icon: BarChart3 },
    { id: 'audit', label: '8. Security & Audit Logs', icon: ShieldCheck },
    { id: 'simulation', label: '9. Simulation Lab', icon: Sliders },
    { id: 'settings', label: '10. Settings', icon: Settings },
  ];

  const handleSelect = (section: OrganiserSection) => {
    onSelectSection(section);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Persistent Sidebar */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Operations Branding Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-base tracking-tight">RailNova</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase tracking-wider">
                  OPS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Control Centre</p>
            </div>
          </div>
          <button 
            onClick={onCloseMobile}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Traffic Badge */}
        <div className="px-5 py-3 border-b border-slate-800/60 bg-slate-950/40">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-emerald-400 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              CTC LIVE MONITOR
            </span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
              DIV-NORTH
            </span>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Operational Modules
          </p>
          {navigationItems.map(item => {
            const Icon = item.icon;
            const active = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition ${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`} />
                  <span>{item.label}</span>
                </div>
                {active ? (
                  <ChevronRight className="w-4 h-4 text-white/80" />
                ) : item.badge ? (
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-400">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Bottom Profile & Role Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs">
                {user?.name ? user.name[0].toUpperCase() : 'A'}
              </div>
              <div className="leading-tight truncate">
                <p className="text-xs font-bold text-white truncate max-w-[130px]">
                  {user?.name || 'Administrator'}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Shield className="w-3 h-3 text-indigo-400" />
                  <span className="text-[10px] font-mono uppercase text-indigo-400 font-semibold">
                    {user?.role || 'ORGANISER'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out of Operations Console"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-2 font-mono">
            <span>Auth Level: Full Admin</span>
            <span>v2.4 LTS</span>
          </div>
        </div>
      </aside>
    </>
  );
};
