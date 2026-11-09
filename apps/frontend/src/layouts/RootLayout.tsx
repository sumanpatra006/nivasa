import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Building2, UserCircle2, ArrowRightLeft, LogOut, LogIn } from 'lucide-react';
import { DEMO_FLATS } from '../fixtures/uiData.js';
import { ApiClient } from '../services/api.js';

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeFlatId, setActiveFlatId] = useState('flat-t07-1203');
  const [activeRole, setActiveRole] = useState<'Resident' | 'Staff' | 'Committee'>('Resident');

  const currentFlat = DEMO_FLATS.find((f) => f.id === activeFlatId) || DEMO_FLATS[0];
  const user = ApiClient.getUser();
  const token = ApiClient.getToken();

  const handleLogout = () => {
    ApiClient.clearToken();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col font-sans antialiased">
      {/* Top Utility & Context Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 h-16">
          {/* Brand Identity */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-control bg-sage-500 text-white font-bold transition-transform group-hover:scale-105 shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-walnut-900">Nivasa</span>
                <span className="rounded-full bg-sage-50 px-2 py-0.5 text-[10px] font-semibold text-sage-900 border border-sage-200 uppercase tracking-wider">
                  Township Ops
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-tight">2,400 Flats • 28 Towers</p>
            </div>
          </Link>

          {/* Quick Context & Role Switcher for Testing */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Flat Selector (Resident View) */}
            {location.pathname.startsWith('/resident') && (
              <div className="hidden sm:flex items-center gap-1.5 bg-surface-alt px-2.5 py-1 rounded-control border border-border text-xs">
                <span className="text-text-muted font-medium">Flat:</span>
                <select
                  aria-label="Active resident flat selector"
                  value={activeFlatId}
                  onChange={(e) => setActiveFlatId(e.target.value)}
                  className="bg-transparent font-semibold text-walnut-900 focus:outline-none cursor-pointer"
                >
                  {DEMO_FLATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.tower}-{f.flatNumber} ({f.residentName} • {f.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Role Nav Toggles */}
            <div className="flex items-center bg-surface-alt p-1 rounded-control border border-border text-xs">
              <Link
                to="/resident"
                onClick={() => setActiveRole('Resident')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-control transition-colors ${
                  location.pathname.startsWith('/resident')
                    ? 'bg-sage-500 text-white font-semibold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Resident
              </Link>
              <Link
                to="/staff/complaints"
                onClick={() => setActiveRole('Staff')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-control transition-colors ${
                  location.pathname.startsWith('/staff')
                    ? 'bg-walnut-500 text-white font-semibold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Staff
              </Link>
              <Link
                to="/committee"
                onClick={() => setActiveRole('Committee')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-control transition-colors ${
                  location.pathname.startsWith('/committee')
                    ? 'bg-amber-500 text-white font-semibold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Committee
              </Link>
              <Link
                to="/guard"
                className={`px-2.5 sm:px-3 py-1.5 rounded-control transition-colors ${
                  location.pathname.startsWith('/guard')
                    ? 'bg-walnut-800 text-white font-semibold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Guard
              </Link>
            </div>

            {/* User Auth Action (Login / Logout) */}
            {token ? (
              <div className="flex items-center gap-2 border-l border-border pl-2 sm:pl-3">
                <span className="hidden lg:inline-flex items-center gap-1.5 text-xs text-text-muted">
                  <UserCircle2 className="h-4 w-4 text-sage-600" />
                  <span className="font-semibold text-walnut-900">{user?.name?.split(' ')[0] || 'User'}</span>
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-red-700 hover:bg-red-50 rounded-control transition-colors border border-border sm:border-0"
                  title="Sign out of Nivasa"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="border-l border-border pl-2 sm:pl-3">
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-sage-800 bg-sage-50 border border-sage-300 hover:bg-sage-100 rounded-control transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Sign In</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-20 sm:pb-12">
        <Outlet context={{ currentFlat, activeRole, setActiveRole }} />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-6 text-center text-xs text-text-muted">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Nivasa Residential Operations Platform • DPDP Act 2023 Compliant</span>
          <span className="font-mono text-[11px]">Demo Mode: Pune Federation Township</span>
        </div>
      </footer>
    </div>
  );
}

