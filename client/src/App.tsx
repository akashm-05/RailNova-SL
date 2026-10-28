import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { DemoDisclaimerBanner } from './components/DemoDisclaimerBanner';

import { HomePage } from './pages/HomePage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { SeatSelectionPage } from './pages/SeatSelectionPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { LoginPage } from './pages/LoginPage';
import { AutopilotPage } from './pages/AutopilotPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { RaceReplayPage } from './pages/RaceReplayPage';
import { AssistantPage } from './pages/AssistantPage';
import { OrganiserLayout } from './layouts/OrganiserLayout';

// Protected Organiser Route
const OrganiserRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== 'ORGANISER') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// Protected Passenger Route
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AppShell: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isOrganiserView = location.pathname.startsWith('/organiser');

  // If in Organiser Control Centre, render dedicated enterprise layout without passenger navbar/footer
  if (isOrganiserView) {
    return (
      <OrganiserRoute>
        <OrganiserLayout />
      </OrganiserRoute>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <DemoDisclaimerBanner />
      <Navbar />
      
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/autopilot" element={<AutopilotPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/race-replay" element={<RaceReplayPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/seats" element={<SeatSelectionPage />} />
          <Route path="/checkout/:bookingId" element={<CheckoutPage />} />
          <Route path="/confirmation/:bookingId" element={<ConfirmationPage />} />
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute>
                <MyBookingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="no-print bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <p>
            <strong>RailNova</strong> — Your journey, thoughtfully connected. Educational Railway Reservation Platform.
          </p>
          <p className="font-mono text-[11px] text-slate-400">
            Segment-Based Concurrency Safe Engine • PostgreSQL Verified
          </p>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
