import React, { useState } from 'react';
import {
  Wrench,
  ShieldAlert,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { Modal } from '../components/ui/Modal.js';
import { DEMO_COMPLAINTS } from '../fixtures/uiData.js';

export function StaffComplaintsPage() {
  const [complaints, setComplaints] = useState(DEMO_COMPLAINTS);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  const categories = ['All', 'Safety Critical', 'Plumbing', 'Electrical', 'Lift'];

  const filteredComplaints = complaints.filter((c) => {
    if (filterCategory === 'All') return true;
    if (filterCategory === 'Safety Critical') return c.isSafetyEscalation;
    return c.category === filterCategory;
  });

  const handleCategoryChange = (id: string, newCategory: string) => {
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              category: newCategory,
              timeline: [
                ...c.timeline,
                { date: 'Just now', event: `Category reclassified to ${newCategory} by staff` },
              ],
            }
          : c
      )
    );
  };

  const handleStatusTransition = (id: string, newStatus: string) => {
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: newStatus,
              timeline: [
                ...c.timeline,
                { date: 'Just now', event: `Status updated to ${newStatus} by on-duty staff` },
              ],
            }
          : c
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-walnut-900">
            Help Desk Complaint Queue
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Operational triage, AI classification review, and technician dispatching.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-full border transition-colors ${
                filterCategory === cat
                  ? cat === 'Safety Critical'
                    ? 'bg-status-danger text-white border-status-danger font-bold'
                    : 'bg-walnut-900 text-white border-walnut-900 font-semibold'
                  : 'bg-surface text-text-secondary border-border hover:bg-surface-alt'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Safety Escalation Alert Banner */}
      {complaints.some((c) => c.isSafetyEscalation && c.status !== 'Resolved') && (
        <div className="p-4 rounded-surface border border-rose-300 bg-status-danger-bg text-status-danger flex items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 sm:mt-0 animate-pulse text-status-danger" />
            <div className="text-xs">
              <span className="font-bold block">PRIORITY 1 SAFETY ESCALATION PINNED</span>
              <span className="text-[11px] text-status-danger/90">
                Lift stuck in Tower T07 requires 15-minute response SLA. AI categorization was bypassed by deterministic safety rules.
              </span>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-white text-status-danger px-2.5 py-1 rounded-control border border-rose-200">
            12 mins remaining
          </span>
        </div>
      )}

      {/* Complaints Table (DESIGN.md Section 14) */}
      <div className="rounded-surface border border-border bg-surface shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-alt/70 text-text-muted">
                <th className="py-3 px-4 font-semibold">Ticket & Unit</th>
                <th className="py-3 px-4 font-semibold">Issue & Description</th>
                <th className="py-3 px-4 font-semibold">Category (One-Tap Override)</th>
                <th className="py-3 px-4 font-semibold">Urgency & SLA</th>
                <th className="py-3 px-4 font-semibold">Assigned Technician</th>
                <th className="py-3 px-4 font-semibold">Status Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredComplaints.map((ticket) => (
                <tr
                  key={ticket.id}
                  className={`hover:bg-surface-alt/40 transition-colors ${
                    ticket.isSafetyEscalation ? 'bg-status-danger-bg/15' : ''
                  }`}
                >
                  {/* Ticket & Unit */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-mono font-bold text-walnut-900 block">{ticket.id}</span>
                    <span className="text-[11px] text-text-muted block">Flat {ticket.flat}</span>
                    <span className="text-[10px] text-text-secondary">{ticket.resident}</span>
                  </td>

                  {/* Title & Description */}
                  <td className="py-3 px-4 max-w-xs">
                    <span className="font-semibold text-text-primary block line-clamp-1">
                      {ticket.title}
                    </span>
                    <span className="text-[11px] text-text-secondary block line-clamp-1 mt-0.5">
                      {ticket.description}
                    </span>
                  </td>

                  {/* One-Tap Category Override */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <select
                      aria-label="Change ticket category"
                      value={ticket.category}
                      onChange={(e) => handleCategoryChange(ticket.id, e.target.value)}
                      className="text-xs bg-surface border border-border rounded-control px-2 py-1 font-medium text-text-primary focus:outline-none focus:border-sage-500 cursor-pointer"
                    >
                      <option value="Plumbing">Plumbing</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Lift">Lift</option>
                      <option value="Cleaning">Cleaning</option>
                      <option value="Security">Security</option>
                      <option value="Other">Other</option>
                    </select>
                  </td>

                  {/* Urgency & SLA */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <StatusBadge
                        variant={ticket.isSafetyEscalation ? 'critical' : ticket.urgency === 'High' ? 'danger' : 'neutral'}
                        label={ticket.urgency}
                      />
                      <span className="text-[11px] text-amber-700 block font-mono">
                        {ticket.slaTimeRemaining}
                      </span>
                    </div>
                  </td>

                  {/* Technician Assignment */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <select
                      aria-label="Assign technician"
                      value={ticket.assignedTeam}
                      onChange={(e) =>
                        setComplaints((prev) =>
                          prev.map((c) =>
                            c.id === ticket.id ? { ...c, assignedTeam: e.target.value } : c
                          )
                        )
                      }
                      className="text-xs bg-surface border border-border rounded-control px-2 py-1 text-text-primary focus:outline-none focus:border-sage-500 cursor-pointer"
                    >
                      <option value="Plumbing Team (Santosh Shinde)">Santosh (Plumber)</option>
                      <option value="Electrical Team (Mahesh Jadhav)">Mahesh (Electrician)</option>
                      <option value="Emergency Response / OTIS Tech">OTIS Lift Tech</option>
                      <option value="Housekeeping Supervisor">Housekeeping Lead</option>
                    </select>
                  </td>

                  {/* Status Action Button */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {ticket.status === 'Resolved' ? (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
                      </span>
                    ) : ticket.status === 'In Progress' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleStatusTransition(ticket.id, 'Resolved')}
                      >
                        Mark Resolved
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusTransition(ticket.id, 'In Progress')}
                      >
                        Start Work
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

