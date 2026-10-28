import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Train, Ticket, LayoutDashboard, LogOut, User, Shield, Compass, Sparkles, MessageSquare, Zap, Sliders } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, logout, demoLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Tagline */}
          <Link to={user?.role === 'ORGANISER' ? '/organiser' : '/'} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition flex items-center gap-1.5">
                RailNova
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  Demo
                </span>
              </span>
              <p className="text-[11px] text-slate-500 hidden sm:block -mt-0.5">
                Your journey, thoughtfully connected.
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1">
            {user?.role === 'ORGANISER' ? (
              <Link
                to="/organiser"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                  isActive('/organiser') 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                    : 'text-slate-700 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-blue-600 group-hover:text-white" />
                <span>Operations Control Centre</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                    isActive('/') 
                      ? 'bg-blue-50 text-blue-700 font-semibold' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  <span>Search</span>
                </Link>

                <Link
                  to="/autopilot"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                    isActive('/autopilot') 
                      ? 'bg-blue-50 text-blue-700 font-semibold' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Autopilot</span>
                </Link>

                <Link
                  to="/assistant"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                    isActive('/assistant') 
                      ? 'bg-blue-50 text-blue-700 font-semibold' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>Assistant</span>
                </Link>

                {user && (
                  <Link
                    to="/my-bookings"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                      isActive('/my-bookings') 
                        ? 'bg-blue-50 text-blue-700 font-semibold' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Ticket className="w-4 h-4 text-emerald-600" />
                    <span>My Bookings</span>
                  </Link>
                )}
              </>
            )}
          </nav>

          {/* Auth Controls */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-sm font-semibold text-slate-900">{user.name}</span>
                  <span className="text-[11px] font-mono text-slate-500 uppercase">
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => demoLogin('PASSENGER')}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition border border-slate-300"
                >
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  Passenger Demo
                </button>
                <button
                  onClick={() => demoLogin('ORGANISER')}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition border border-slate-300"
                >
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  Organiser Demo
                </button>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
