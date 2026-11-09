import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Wrench, Plus, AlertCircle, Clock, CheckCircle2, ChevronRight, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { StatusBadge, BadgeVariant } from '../components/ui/StatusBadge.js';
import { Modal } from '../components/ui/Modal.js';
import { DemoFlat, DEMO_COMPLAINTS } from '../fixtures/uiData.js';
import { checkSafetyEscalation } from '@nivasa/shared';

export function ResidentComplaintsPage() {
  const { currentFlat } = useOutletContext<{ currentFlat: DemoFlat }>();
  const [complaints, setComplaints] = useState(DEMO_COMPLAINTS);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);

  // New Complaint Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Live safety & category analysis
  const safetyCheck = checkSafetyEscalation(title, description);

  const handleCreateComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;

    let category = 'Other';
    const text = `${title} ${description}`.toLowerCase();
    if (text.includes('water') || text.includes('leak') || text.includes('pipe')) category = 'Plumbing';
    else if (text.includes('power') || text.includes('light') || text.includes('spark')) category = 'Electrical';
    else if (text.includes('lift') || text.includes('elevator')) category = 'Lift';
    else if (text.includes('clean') || text.includes('garbage')) category = 'Cleaning';

    const newTicket = {
      id: `CMP-2026-${Math.floor(100 + Math.random() * 900)}`,
      flat: `${currentFlat.tower}-${currentFlat.flatNumber}`,
      resident: currentFlat.residentName,
      title,
      description,
      category,
      urgency: safetyCheck.isSafetyEscalation ? 'Critical' : 'Normal',
      status: 'New',
      assignedTeam: 'Unassigned (Dispatched to Help Desk)',
      createdDate: 'Just now',
      slaTimeRemaining: safetyCheck.isSafetyEscalation ? '15 mins (Emergency SLA)' : '4 hrs SLA',
      isSafetyEscalation: safetyCheck.isSafetyEscalation,
      safetyReason: safetyCheck.reason,
      timeline: [
        { date: 'Just now', event: `Complaint raised for Flat ${currentFlat.tower}-${currentFlat.flatNumber}` },
        ...(safetyCheck.isSafetyEscalation
          ? [{ date: 'Just now', event: `AUTOMATED SAFETY ESCALATION TRIGGERED: Duty Manager alerted` }]
          : []),
      ],
    };

    setComplaints([newTicket, ...complaints]);
    setTitle('');
    setDescription('');
    setIsNewModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-walnut-900">Complaints & Requests</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Log maintenance issues with automated categorization and response SLA tracking.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setIsNewModalOpen(true)}
        >
          Raise New Complaint
        </Button>
      </div>

      {/* Complaints List */}
      <div className="space-y-3">
        {complaints.map((c) => (
          <div
            key={c.id}
            onClick={() => setSelectedComplaint(c)}
            className={`rounded-surface border p-4 sm:p-5 bg-surface hover:shadow-xs transition-all cursor-pointer ${
              c.isSafetyEscalation ? 'border-status-danger bg-status-danger-bg/20' : 'border-border'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-text-muted">{c.id}</span>
                  <StatusBadge
                    variant={
                      c.isSafetyEscalation
                        ? 'critical'
                        : c.status === 'Resolved'
                        ? 'paid'
                        : c.status === 'In Progress'
                        ? 'in-progress'
                        : 'assigned'
                    }
                    label={c.isSafetyEscalation ? 'SAFETY ESCALATION' : c.status}
                  />
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-alt text-text-secondary border border-border">
                    {c.category}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-walnut-900">{c.title}</h3>
                <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                  {c.description}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted pt-2">
                  <span>Assigned: <strong className="text-text-primary">{c.assignedTeam}</strong></span>
                  <span>Created: {c.createdDate}</span>
                  <span className="text-amber-700 font-medium">{c.slaTimeRemaining}</span>
                </div>
              </div>

              <ChevronRight className="h-5 w-5 text-text-muted shrink-0 self-center" />
            </div>
          </div>
        ))}
      </div>

      {/* New Complaint Modal */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Raise Maintenance Complaint"
        description={`Unit: Tower ${currentFlat.tower} • Flat ${currentFlat.flatNumber}`}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsNewModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateComplaint}>
              Submit Complaint
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateComplaint} className="space-y-4">
          <div>
            <label htmlFor="complaint-title" className="block text-xs font-semibold text-text-primary mb-1">
              Issue Title
            </label>
            <input
              id="complaint-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Water leak under bathroom sink"
              className="w-full rounded-control border border-border px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-sage-500"
            />
          </div>

          <div>
            <label htmlFor="complaint-description" className="block text-xs font-semibold text-text-primary mb-1">
              Description
            </label>
            <textarea
              id="complaint-description"
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe the issue, location in flat, and any urgent hazard..."
              className="w-full rounded-control border border-border px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-sage-500"
            />
          </div>

          {/* Real-time Safety Escalation Warning Banner */}
          {safetyCheck.isSafetyEscalation && (
            <div className="p-3 rounded-control border border-rose-300 bg-status-danger-bg text-status-danger text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="h-4 w-4" />
                <span>SAFETY EMERGENCY DETECTED</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Emergency indicators detected: [{safetyCheck.matchedTerms.join(', ')}]. This ticket will automatically override normal queues and trigger immediate Duty Manager dispatch.
              </p>
            </div>
          )}

          {!safetyCheck.isSafetyEscalation && description.length > 5 && (
            <div className="p-2.5 rounded-control border border-sage-200 bg-sage-50/60 text-xs text-sage-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sage-700 shrink-0" />
              <span className="text-[11px]">
                AI Assistant will classify category, check for duplicate tower complaints, and route to on-duty staff.
              </span>
            </div>
          )}
        </form>
      </Modal>

      {/* Complaint Detail & Timeline Modal */}
      {selectedComplaint && (
        <Modal
          isOpen={!!selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          title={selectedComplaint.title}
          description={`${selectedComplaint.id} • Flat ${selectedComplaint.flat}`}
          footer={
            <Button variant="outline" size="sm" onClick={() => setSelectedComplaint(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                variant={selectedComplaint.isSafetyEscalation ? 'critical' : 'assigned'}
                label={selectedComplaint.status}
              />
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-alt text-text-secondary border border-border">
                {selectedComplaint.category}
              </span>
              <span className="text-xs text-text-muted">Assigned: {selectedComplaint.assignedTeam}</span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed bg-surface-alt p-3 rounded-control border border-border">
              {selectedComplaint.description}
            </p>

            {/* Timeline */}
            <div>
              <h4 className="text-xs font-bold text-walnut-900 mb-2">Activity Timeline</h4>
              <div className="space-y-2 border-l-2 border-sage-200 pl-3 ml-1 text-xs">
                {selectedComplaint.timeline.map((event: any, i: number) => (
                  <div key={i} className="relative">
                    <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-sage-500" />
                    <span className="text-[10px] text-text-muted block">{event.date}</span>
                    <span className="text-text-primary text-xs">{event.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

