import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Train, User, Shield, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, demoLogin } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'PASSENGER' | 'ORGANISER'>('PASSENGER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const body = isRegister ? { name, email, password, role } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.token && data.user) {
        login(data.token, data.user);
        if (data.user.role === 'ORGANISER') {
          navigate('/organiser');
        } else {
          navigate('/');
        }
      } else {
        setError(data.error?.message || data.message || 'Authentication failed. Please check credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (role: 'PASSENGER' | 'ORGANISER') => {
    setLoading(true);
    setError(null);
    try {
      await demoLogin(role);
      if (role === 'ORGANISER') {
        navigate('/organiser');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 space-y-6">
      {/* Brand card */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/25">
          <Train className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">RailNova Authentication</h1>
        <p className="text-xs text-slate-500">“Your journey, thoughtfully connected.”</p>
      </div>

      {/* 1-Click Quick Demo Login for Judges */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
            1-Click Judge & Demo Sign-In
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleQuickLogin('PASSENGER')}
            className="p-3 rounded-xl bg-white border border-blue-200 hover:border-blue-400 text-left transition shadow-sm group"
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 group-hover:text-blue-600">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>Passenger</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Aarav Sharma</p>
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin('ORGANISER')}
            className="p-3 rounded-xl bg-white border border-indigo-200 hover:border-indigo-400 text-left transition shadow-sm group"
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 group-hover:text-indigo-600">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Organiser</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Vikram Malhotra (NR)</p>
          </button>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5 shadow-sm">
        {/* Toggle between Login and Register */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setIsRegister(false)}
            className={`flex-1 pb-3 text-sm font-bold border-b-2 transition ${
              !isRegister ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsRegister(true)}
            className={`flex-1 pb-3 text-sm font-bold border-b-2 transition ${
              isRegister ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('PASSENGER')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      role === 'PASSENGER'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Passenger</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('ORGANISER')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      role === 'ORGANISER'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Organiser / Admin</span>
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 transition"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>{isRegister ? 'Register Account' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-400">
          {isRegister
            ? 'Note: Public registration creates standard PASSENGER roles only.'
            : 'Demo credentials: passenger@railnova.demo / Password123!'}
        </p>
      </div>
    </div>
  );
};
