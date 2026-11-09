import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Building2, UserCircle2, ArrowRightLeft } from 'lucide-react';
import { DEMO_FLATS } from '../fixtures/uiData.js';

export function RootLayout() {
  const location = useLocation();
  const [activeFlatId, setActiveFlatId] = useState('flat-t07-1203');
  const [activeRole, setActiveRole] = useState<'Resident' | 'Staff' | 'Committee'>('Resident');

  const currentFlat = DEMO_FLATS.find((f) => f.id === activeFlatId) || DEMO_FLATS[0];

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
          <div className="flex items-center gap-3">
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
                className={`px-3 py-1.5 rounded-control transition-colors ${
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
                className={`px-3 py-1.5 rounded-control transition-colors ${
                  location.pathname.startsWith('/staff')
                    ? 'bg-walnut-500 text-white font-semibold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Staff (Ops)
              </Link>
              <Link
                to="/committee"
                onClick={() => setActiveRole('Committee')}
                className={`px-3 py-1.5 rounded-control transition-colors ${
                  location.pathname.startsWith('/committee')
                    ? 'bg-amber-500 text-white font-semibold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Committee
              </Link>
            </div>
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

