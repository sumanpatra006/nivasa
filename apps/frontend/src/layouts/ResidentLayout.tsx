import React from 'react';
import { Outlet, NavLink, useOutletContext } from 'react-router-dom';
import { Home, Receipt, Wrench, ShieldCheck } from 'lucide-react';
import { DemoFlat } from '../fixtures/uiData.js';

export function ResidentLayout() {
  const { currentFlat } = useOutletContext<{ currentFlat: DemoFlat }>();

  const navLinks = [
    { to: '/resident', label: 'Home', icon: Home, end: true },
    { to: '/resident/maintenance', label: 'Maintenance', icon: Receipt },
    { to: '/resident/complaints', label: 'Complaints', icon: Wrench },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
      {/* Resident Identity Banner */}
      <div className="mb-6 rounded-surface border border-border bg-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-walnut-900">
              Tower {currentFlat.tower} • Flat {currentFlat.flatNumber}
            </h1>
            <span className="rounded-full bg-sage-50 px-2.5 py-0.5 text-xs font-semibold text-sage-900 border border-sage-200">
              {currentFlat.role}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Resident: <strong className="text-text-primary">{currentFlat.residentName}</strong> • Area:{' '}
            {currentFlat.areaSqFt} sq ft • ₹6.50/sq ft
          </p>
        </div>

        {/* Desktop Tab Links */}
        <nav className="hidden sm:flex items-center gap-1 bg-surface-alt p-1 rounded-control border border-border text-xs">
          {navLinks.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-control font-medium transition-colors ${
                  isActive
                    ? 'bg-sage-500 text-white font-semibold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Page Content */}
      <Outlet context={{ currentFlat }} />

      {/* Mobile-First Sticky Bottom Navigation Bar per DESIGN.md Section 7 */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface/98 backdrop-blur-md border-t border-border px-3 py-2 flex items-center justify-around shadow-lg">
        {navLinks.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[64px] min-h-[44px] text-[11px] font-medium transition-colors ${
                isActive ? 'text-sage-700 font-bold' : 'text-text-muted hover:text-text-primary'
              }`
            }
          >
            <Icon className="h-5 w-5 mb-0.5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

