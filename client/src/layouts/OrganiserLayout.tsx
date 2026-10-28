import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  Clock, 
  Activity, 
  ShieldCheck, 
  RefreshCw, 
  Train, 
  CheckCircle2, 
  Radio 
} from 'lucide-react';
import { OrganiserSidebar, OrganiserSection } from '../components/OrganiserSidebar';
import { OverviewView } from '../components/organiser/OverviewView';
import { BookingLogsView } from '../components/organiser/BookingLogsView';
import { TrainsJourneysView } from '../components/organiser/TrainsJourneysView';
import { SeatInventoryView } from '../components/organiser/SeatInventoryView';
import { PassengersView } from '../components/organiser/PassengersView';
import { FarePricingView } from '../components/organiser/FarePricingView';
import { AnalyticsReportsView } from '../components/organiser/AnalyticsReportsView';
import { SecurityAuditView } from '../components/organiser/SecurityAuditView';
import { SimulationLabView } from '../components/organiser/SimulationLabView';
import { SettingsView } from '../components/organiser/SettingsView';
import { apiFetch, useAuth } from '../context/AuthContext';

export const OrganiserLayout: React.FC = () => {
  const { user } = useAuth();
  const [currentSection, setCurrentSection] = useState<OrganiserSection>('overview');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Shared data state
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Digital clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [analyticsRes, bookingsRes] = await Promise.all([
        apiFetch('/api/admin/analytics'),
        apiFetch('/api/admin/bookings')
      ]);
      setAnalytics(analyticsRes);
      setBookings(bookingsRes || []);
      setLoading(false);
      setRefreshing(false);
    } catch (err: any) {
      console.error('[OrganiserLayout] Data load error:', err);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto sync every 10 seconds for real-time operations
    const interval = setInterval(() => {
      loadData(false);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex text-slate-900 font-sans antialiased">
      {/* 1. Persistent Organiser Sidebar */}
      <OrganiserSidebar
        currentSection={currentSection}
        onSelectSection={setCurrentSection}
        isOpenMobile={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* 2. Main Operational Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0 min-h-screen">
        {/* Top Operations Status Bar */}
        <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-sm sm:text-base tracking-tight">
                  Northern Railway
                </span>
                <span className="hidden sm:inline-block text-slate-400 text-xs">•</span>
                <span className="hidden sm:inline-block text-xs font-semibold text-slate-300">
                  Central Operations & Traffic Control (CTC)
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Segment Reservation Matrix Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Clock */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 font-mono text-xs text-slate-300">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>{currentTime} IST</span>
            </div>

            {/* Live Synced Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>PostgreSQL Live</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Sync Live Operations Telemetry"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </header>

        {/* 3. Main Dynamic Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentSection === 'overview' && (
            <OverviewView
              analytics={analytics}
              loading={loading}
              onNavigate={setCurrentSection}
              onRefresh={() => loadData(true)}
            />
          )}

          {currentSection === 'bookings' && (
            <BookingLogsView
              bookings={bookings}
              loading={loading}
              onRefresh={() => loadData(true)}
            />
          )}

          {currentSection === 'trains' && (
            <TrainsJourneysView />
          )}

          {currentSection === 'inventory' && (
            <SeatInventoryView />
          )}

          {currentSection === 'passengers' && (
            <PassengersView />
          )}

          {currentSection === 'pricing' && (
            <FarePricingView />
          )}

          {currentSection === 'analytics' && (
            <AnalyticsReportsView />
          )}

          {currentSection === 'audit' && (
            <SecurityAuditView />
          )}

          {currentSection === 'simulation' && (
            <SimulationLabView />
          )}

          {currentSection === 'settings' && (
            <SettingsView />
          )}
        </main>
      </div>
    </div>
  );
};
