import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Wrench, ArrowRightLeft, LayoutDashboard, ShieldAlert } from 'lucide-react';

export function StaffLayout() {
  const staffLinks = [
    { to: '/staff', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/staff/complaints', label: 'Complaints Queue', icon: Wrench },
    { to: '/staff/reconciliation', label: 'Bank Reconciliation', icon: ArrowRightLeft },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      {/* Staff Ops Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-walnut-900">
              Operations & Facility Console
            </h1>
            <span className="rounded-full bg-walnut-50 px-2.5 py-0.5 text-xs font-semibold text-walnut-900 border border-walnut-200">
              On-Duty Staff
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Dispatch help-desk requests, review automated AI categorization, and verify bank reconciliation statements.
          </p>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-surface-alt p-1 rounded-control border border-border text-xs self-start sm:self-auto">
          {staffLinks.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-control font-medium transition-colors ${
                  isActive
                    ? 'bg-walnut-500 text-white font-semibold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}

