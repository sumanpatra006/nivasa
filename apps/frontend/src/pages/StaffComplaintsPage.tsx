import React, { useState, useEffect } from 'react';
import {
  Wrench,
  ShieldAlert,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Filter,
  RefreshCw,
  Search,
  ExternalLink,
  Link as LinkIcon,
  XCircle,
  MessageSquare,
  AlertCircle,
  Sparkles,
  Camera,
  Star,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { StatusBadge, BadgeVariant } from '../components/ui/StatusBadge.js';
import { Modal } from '../components/ui/Modal.js';
import { COMPLAINT_CATEGORY, COMPLAINT_URGENCY, COMPLAINT_STATUS } from '@nivasa/shared';
import { ApiClient, ApiComplaint } from '../services/api.js';

export function StaffComplaintsPage() {
  const [complaints, setComplaints] = useState<ApiComplaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterUrgency, setFilterUrgency] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Detail Modal
  const [selectedTicket, setSelectedTicket] = useState<ApiComplaint | null>(null);

  // Resolution Modal State
  const [resolvingTicket, setResolvingTicket] = useState<ApiComplaint | null>(null);
  const [resolutionComment, setResolutionComment] = useState('');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  // Category & Urgency Correction Modal
  const [correctingTicket, setCorrectingTicket] = useState<ApiComplaint | null>(null);
  const [editCategory, setEditCategory] = useState<string>('');
  const [editUrgency, setEditUrgency] = useState<string>('');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

  // Duplicate Review State
  const [duplicateReviewTicket, setDuplicateReviewTicket] = useState<ApiComplaint | null>(null);
  const [isLinkingDuplicate, setIsLinkingDuplicate] = useState(false);

  const loadComplaints = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await ApiClient.authenticateStaff('9876543210');
      const res = await ApiClient.getComplaints({
        category: filterCategory !== 'All' ? filterCategory : undefined,
        urgency: filterUrgency === 'Safety Critical' ? 'SAFETY_CRITICAL' : filterUrgency !== 'All' ? filterUrgency : undefined,
        status: filterStatus !== 'All' ? filterStatus : undefined,
        search: searchQuery || undefined,
      });
      setComplaints(res.complaints);
    } catch (err: any) {
      console.error('Failed to load help-desk complaints:', err);
      setError(err.message || 'Failed to connect to Help Desk service');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, [filterCategory, filterUrgency, filterStatus, searchQuery]);

  const handleCategoryQuickChange = async (id: string, newCategory: string) => {
    try {
      await ApiClient.authenticateStaff();
      const res = await ApiClient.correctComplaint(id, {
        category: newCategory,
        reason: 'One-tap category triage by Help Desk officer',
      });
      setComplaints((prev) => prev.map((c) => (c.id === id ? res.complaint : c)));
    } catch (err: any) {
      alert(`Category update failed: ${err.message}`);
    }
  };

  const handleAssignTechnician = async (id: string, assignedTo: string) => {
    try {
      await ApiClient.authenticateStaff();
      const res = await ApiClient.assignComplaint(id, assignedTo, 'Assigned via Help Desk queue');
      setComplaints((prev) => prev.map((c) => (c.id === id ? res.complaint : c)));
    } catch (err: any) {
      alert(`Technician assignment failed: ${err.message}`);
    }
  };

  const handleStatusTransition = async (id: string, newStatus: string) => {
    if (newStatus === COMPLAINT_STATUS.RESOLVED) {
      const ticket = complaints.find((c) => c.id === id);
      if (ticket) {
        setResolvingTicket(ticket);
        setResolutionComment('');
        return;
      }
    }

    try {
      await ApiClient.authenticateStaff();
      const res = await ApiClient.updateComplaintStatus(id, newStatus);
      setComplaints((prev) => prev.map((c) => (c.id === id ? res.complaint : c)));
    } catch (err: any) {
      alert(`Status transition failed: ${err.message}`);
    }
  };

  const handleConfirmResolution = async () => {
    if (!resolvingTicket) return;
    setIsSubmittingResolution(true);
    try {
      await ApiClient.authenticateStaff();
      const res = await ApiClient.updateComplaintStatus(
        resolvingTicket.id,
        COMPLAINT_STATUS.RESOLVED,
        resolutionComment || 'Issue resolved by field technician'
      );
      setComplaints((prev) => prev.map((c) => (c.id === resolvingTicket.id ? res.complaint : c)));
      setResolvingTicket(null);
    } catch (err: any) {
      alert(`Resolution failed: ${err.message}`);
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  const handleSaveCorrection = async () => {
    if (!correctingTicket) return;
    setIsSubmittingCorrection(true);
    try {
      await ApiClient.authenticateStaff();
      const res = await ApiClient.correctComplaint(correctingTicket.id, {
        category: editCategory || undefined,
        urgency: editUrgency || undefined,
        reason: correctionReason || 'Help Desk classification adjustment',
      });
      setComplaints((prev) => prev.map((c) => (c.id === correctingTicket.id ? res.complaint : c)));
      setCorrectingTicket(null);
    } catch (err: any) {
      alert(`Correction failed: ${err.message}`);
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  const handleConfirmLinkDuplicate = async (primaryId: string, duplicateId: string) => {
    setIsLinkingDuplicate(true);
    try {
      await ApiClient.authenticateStaff();
      const res = await ApiClient.linkDuplicateComplaint(primaryId, duplicateId);
      setComplaints((prev) =>
        prev.map((c) => {
          if (c.id === primaryId) return res.primary;
          if (c.id === duplicateId) return res.duplicate;
          return c;
        })
      );
      setDuplicateReviewTicket(null);
    } catch (err: any) {
      alert(`Link duplicate failed: ${err.message}`);
    } finally {
      setIsLinkingDuplicate(false);
    }
  };

  const handleRejectDuplicate = async (primaryId: string, candidateId: string) => {
    try {
      await ApiClient.authenticateStaff();
      const res = await ApiClient.rejectDuplicateComplaint(primaryId, candidateId, 'Dismissed by Help Desk');
      setComplaints((prev) => prev.map((c) => (c.id === primaryId ? res.complaint : c)));
      if (duplicateReviewTicket && duplicateReviewTicket.id === primaryId) {
        setDuplicateReviewTicket(res.complaint);
      }
    } catch (err: any) {
      alert(`Reject duplicate failed: ${err.message}`);
    }
  };

  const openSafetyTickets = complaints.filter(
    (c) => (c.isSafetyEscalation || c.urgency === 'CRITICAL') && c.status !== COMPLAINT_STATUS.RESOLVED && c.status !== COMPLAINT_STATUS.CLOSED
  );

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-walnut-900">
            Help Desk Complaint Queue
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Operational triage, AI classification audit, technician dispatching, and duplicate management.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-text-muted absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search title, unit, resident..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-control border border-border text-xs bg-surface focus:outline-none focus:border-sage-500 w-48 sm:w-60"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadComplaints}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-surface border border-border bg-surface text-xs">
        {/* Category Filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-text-muted mr-1">Category:</span>
          {['All', 'Plumbing', 'Electrical', 'Lift', 'Cleaning', 'Security'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat === 'All' ? 'All' : cat.toUpperCase())}
              className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
                (cat === 'All' && filterCategory === 'All') || filterCategory === cat.toUpperCase()
                  ? 'bg-walnut-900 text-white border-walnut-900 font-semibold'
                  : 'bg-surface text-text-secondary border-border hover:bg-surface-alt'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-text-muted mr-1">Status:</span>
          {['All', 'NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
                filterStatus === st
                  ? 'bg-sage-700 text-white border-sage-700 font-semibold'
                  : 'bg-surface text-text-secondary border-border hover:bg-surface-alt'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Safety Escalation Alert Banner (FEATURE 3) */}
      {openSafetyTickets.length > 0 && (
        <div className="p-4 rounded-surface border border-rose-300 bg-status-danger-bg text-status-danger flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-pulse">
          <div className="flex items-start sm:items-center gap-3">
            <ShieldAlert className="h-6 w-6 shrink-0 mt-0.5 sm:mt-0 text-status-danger" />
            <div className="text-xs">
              <span className="font-bold block text-sm">
                PRIORITY 1 SAFETY ESCALATION PINNED ({openSafetyTickets.length} ACTIVE)
              </span>
              <span className="text-[11px] text-status-danger/90">
                Critical hazard detected ({openSafetyTickets[0].safetyReason || 'Emergency condition'}). Duty Manager notified. 15-minute response SLA active.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-white text-status-danger px-2.5 py-1 rounded-control border border-rose-200">
              {openSafetyTickets[0].slaTimeRemaining || '15m Emergency Target'}
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setSelectedTicket(openSafetyTickets[0])}
            >
              View Ticket
            </Button>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-3 rounded-control border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={loadComplaints}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="p-12 text-center text-xs text-text-muted bg-surface rounded-surface border border-border">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-sage-600" />
          Loading complaint queue...
        </div>
      )}

      {/* Empty State */}
      {!isLoading && complaints.length === 0 && (
        <div className="rounded-surface border border-border p-8 text-center bg-surface">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-walnut-900">No Tickets Matching Filters</h3>
          <p className="text-xs text-text-secondary mt-1">All complaints have been cleared or match criteria.</p>
        </div>
      )}

      {/* Complaints Table (DESIGN.md Section 14) */}
      {!isLoading && complaints.length > 0 && (
        <div className="rounded-surface border border-border bg-surface shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-alt/70 text-text-muted">
                  <th className="py-3 px-4 font-semibold">Ticket & Unit</th>
                  <th className="py-3 px-4 font-semibold">Issue & AI Classifier</th>
                  <th className="py-3 px-4 font-semibold">Category (One-Tap Override)</th>
                  <th className="py-3 px-4 font-semibold">Urgency & Response SLA</th>
                  <th className="py-3 px-4 font-semibold">Assigned Technician</th>
                  <th className="py-3 px-4 font-semibold">Duplicates & Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {complaints.map((ticket) => {
                  const isCritical = ticket.isSafetyEscalation || ticket.urgency === 'CRITICAL';
                  const hasDuplicates = (ticket.duplicateSuggestions && ticket.duplicateSuggestions.length > 0) || (ticket.duplicateLinks && ticket.duplicateLinks.length > 0);

                  return (
                    <tr
                      key={ticket.id}
                      className={`hover:bg-surface-alt/40 transition-colors ${
                        isCritical ? 'bg-status-danger-bg/15' : ''
                      }`}
                    >
                      {/* Ticket & Unit */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedTicket(ticket)}
                          className="font-mono font-bold text-walnut-900 block hover:underline text-left"
                        >
                          {ticket.id}
                        </button>
                        <span className="text-[11px] text-text-muted block">
                          Tower {ticket.tower} • Flat {ticket.flatNumber}
                        </span>
                        <span className="text-[10px] text-text-secondary">{ticket.residentName}</span>
                      </td>

                      {/* Title & AI Summary */}
                      <td className="py-3 px-4 max-w-xs">
                        <span className="font-semibold text-text-primary block line-clamp-1">
                          {ticket.title}
                        </span>
                        <span className="text-[11px] text-text-secondary block line-clamp-1 mt-0.5">
                          {ticket.description}
                        </span>
                        {/* AI / Fallback tag */}
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-text-muted">
                          <Sparkles className="h-3 w-3 text-sage-600 shrink-0" />
                          <span>
                            {ticket.isAiFallback ? 'Fallback Rule' : 'Gemini AI'}{' '}
                            {ticket.aiConfidence ? `(${Math.round(ticket.aiConfidence * 100)}%)` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCorrectingTicket(ticket);
                              setEditCategory(ticket.category);
                              setEditUrgency(ticket.urgency);
                              setCorrectionReason('');
                            }}
                            className="text-sage-700 underline ml-1"
                          >
                            Edit
                          </button>
                        </div>
                      </td>

                      {/* One-Tap Category Override (FEATURE 5) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          aria-label="Change ticket category"
                          value={ticket.category}
                          onChange={(e) => handleCategoryQuickChange(ticket.id, e.target.value)}
                          className="text-xs bg-surface border border-border rounded-control px-2 py-1 font-medium text-text-primary focus:outline-none focus:border-sage-500 cursor-pointer"
                        >
                          {Object.values(COMPLAINT_CATEGORY).map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Urgency & SLA (FEATURE 6) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <StatusBadge
                            variant={
                              isCritical
                                ? 'critical'
                                : ticket.urgency === 'HIGH'
                                ? 'danger'
                                : 'neutral'
                            }
                            label={isCritical ? 'CRITICAL (SAFETY)' : ticket.urgency}
                          />
                          <span className="text-[11px] text-amber-800 block font-mono">
                            {ticket.slaTimeRemaining || '4h SLA Target'}
                          </span>
                        </div>
                      </td>

                      {/* Technician Assignment (FEATURE 5) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          aria-label="Assign technician"
                          value={ticket.assignedTo || ''}
                          onChange={(e) => handleAssignTechnician(ticket.id, e.target.value)}
                          className="text-xs bg-surface border border-border rounded-control px-2 py-1 text-text-primary focus:outline-none focus:border-sage-500 cursor-pointer max-w-[180px]"
                        >
                          <option value="">Select Technician...</option>
                          <option value="Plumbing Duty Team (Santosh Shinde)">Santosh Shinde (Plumbing)</option>
                          <option value="Electrical Duty Team (Mahesh Jadhav)">Mahesh Jadhav (Electrical)</option>
                          <option value="Lift Emergency Tech (OTIS)">OTIS Tech (Lift Emergency)</option>
                          <option value="Housekeeping Supervisor (Sunita Patil)">Sunita Patil (Housekeeping)</option>
                          <option value="Township Security Office (Gate 1)">Township Security Office</option>
                          <option value="Civil & Grounds Maintenance Team">Civil Maintenance Team</option>
                        </select>
                      </td>

                      {/* Duplicates & Status Action */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {/* Duplicate indicator badge */}
                          {ticket.duplicateSuggestions && ticket.duplicateSuggestions.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setDuplicateReviewTicket(ticket)}
                              className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1 rounded flex items-center gap-1 hover:bg-amber-200"
                            >
                              <LinkIcon className="h-3 w-3" />
                              {ticket.duplicateSuggestions.length} Duplicate(s)?
                            </button>
                          )}

                          {ticket.duplicateOfId && (
                            <span className="text-[10px] bg-surface-alt text-text-muted px-1.5 py-0.5 rounded border border-border">
                              Linked to {ticket.duplicateOfId}
                            </span>
                          )}

                          {/* Status Actions */}
                          {ticket.status === COMPLAINT_STATUS.RESOLVED ? (
                            <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
                            </span>
                          ) : ticket.status === COMPLAINT_STATUS.IN_PROGRESS ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleStatusTransition(ticket.id, COMPLAINT_STATUS.RESOLVED)}
                            >
                              Resolve
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusTransition(ticket.id, COMPLAINT_STATUS.IN_PROGRESS)}
                            >
                              Start Work
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolution Dialog Modal */}
      {resolvingTicket && (
        <Modal
          isOpen={!!resolvingTicket}
          onClose={() => setResolvingTicket(null)}
          title={`Mark Complaint Resolved — ${resolvingTicket.id}`}
          description={`Unit: Tower ${resolvingTicket.tower}-${resolvingTicket.flatNumber} • Issue: "${resolvingTicket.title}"`}
          footer={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setResolvingTicket(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isSubmittingResolution}
                onClick={handleConfirmResolution}
              >
                {isSubmittingResolution ? 'Saving...' : 'Confirm Resolution'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-text-primary">
              Resolution Summary / Work Carried Out *
            </label>
            <textarea
              rows={3}
              value={resolutionComment}
              onChange={(e) => setResolutionComment(e.target.value)}
              placeholder="e.g. Replaced faulty washer on bathroom sink. Water pressure tested."
              className="w-full rounded-control border border-border px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-sage-500"
            />
            <p className="text-[11px] text-text-muted">
              Resolving this complaint will notify the resident and invite them to submit their 5-star rating.
            </p>
          </div>
        </Modal>
      )}

      {/* Category & Urgency Manual Correction Modal (FEATURE 5 & 6) */}
      {correctingTicket && (
        <Modal
          isOpen={!!correctingTicket}
          onClose={() => setCorrectingTicket(null)}
          title={`Help Desk Manual Correction — ${correctingTicket.id}`}
          description={`Override AI classification audit trails for Unit ${correctingTicket.tower}-${correctingTicket.flatNumber}`}
          footer={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCorrectingTicket(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isSubmittingCorrection}
                onClick={handleSaveCorrection}
              >
                {isSubmittingCorrection ? 'Saving...' : 'Apply Correction'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Category
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full rounded-control border border-border px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-sage-500"
              >
                {Object.values(COMPLAINT_CATEGORY).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Urgency Level
              </label>
              <select
                value={editUrgency}
                onChange={(e) => setEditUrgency(e.target.value)}
                className="w-full rounded-control border border-border px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-sage-500"
              >
                {Object.values(COMPLAINT_URGENCY).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Correction Reason (Logged in persistent audit trail)
              </label>
              <input
                type="text"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="e.g. Resident clarified location is outside clubhouse, not common corridor"
                className="w-full rounded-control border border-border px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-sage-500"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Duplicate Review Panel Modal (FEATURE 4) */}
      {duplicateReviewTicket && (
        <Modal
          isOpen={!!duplicateReviewTicket}
          onClose={() => setDuplicateReviewTicket(null)}
          title="Review Duplicate Complaint Suggestions"
          description={`Ticket ${duplicateReviewTicket.id}: "${duplicateReviewTicket.title}"`}
          footer={
            <Button variant="outline" size="sm" onClick={() => setDuplicateReviewTicket(null)}>
              Close Review
            </Button>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-text-secondary leading-relaxed">
              The deterministic duplicate engine scanned open township tickets and identified potential duplicates based on tower, category, and text token overlap. 
              <strong> Linking does not delete either ticket; both resident records are preserved.</strong>
            </p>

            {duplicateReviewTicket.duplicateSuggestions.length === 0 ? (
              <p className="text-xs text-text-muted italic">No pending duplicate candidates.</p>
            ) : (
              <div className="space-y-3">
                {duplicateReviewTicket.duplicateSuggestions.map((candidate) => (
                  <div
                    key={candidate.candidateId}
                    className="p-3 rounded-control border border-amber-300 bg-amber-50/60 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-walnut-900 block">
                          {candidate.candidateTitle}
                        </span>
                        <span className="text-[11px] text-text-muted">
                          {candidate.candidateId} • {candidate.candidateFlat} • Status: {candidate.candidateStatus}
                        </span>
                      </div>
                      <span className="font-bold font-mono text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded text-[11px]">
                        {Math.round(candidate.confidence * 100)}% Match
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 text-[10px] text-text-secondary">
                      {candidate.matchingFactors.map((f, i) => (
                        <span key={i} className="bg-white px-2 py-0.5 rounded border border-amber-200">
                          {f}
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-1 border-t border-amber-200/70">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={isLinkingDuplicate}
                        onClick={() => handleConfirmLinkDuplicate(duplicateReviewTicket.id, candidate.candidateId)}
                        leftIcon={<LinkIcon className="h-3 w-3" />}
                      >
                        Confirm & Link Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectDuplicate(duplicateReviewTicket.id, candidate.candidateId)}
                        leftIcon={<XCircle className="h-3 w-3" />}
                      >
                        Dismiss Suggestion
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <Modal
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          title={selectedTicket.title}
          description={`${selectedTicket.id} • Flat ${selectedTicket.tower}-${selectedTicket.flatNumber} (${selectedTicket.residentName})`}
          footer={
            <Button variant="outline" size="sm" onClick={() => setSelectedTicket(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                variant={selectedTicket.isSafetyEscalation ? 'critical' : 'assigned'}
                label={selectedTicket.status}
              />
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-alt text-text-secondary border border-border">
                {selectedTicket.category}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-alt text-text-secondary border border-border">
                Urgency: {selectedTicket.urgency}
              </span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed bg-surface-alt p-3 rounded-control border border-border">
              {selectedTicket.description}
            </p>

            {/* Photo Attachment if present */}
            {selectedTicket.photoUrl && (
              <div>
                <h4 className="text-xs font-bold text-walnut-900 mb-1 flex items-center gap-1">
                  <Camera className="h-3.5 w-3.5" /> Attached Photo Evidence
                </h4>
                <div className="rounded-control border border-border overflow-hidden max-h-48 bg-black/5">
                  <img src={selectedTicket.photoUrl} alt="Complaint" className="w-full h-48 object-cover" />
                </div>
              </div>
            )}

            {/* Rating Display if present */}
            {selectedTicket.rating && (
              <div className="p-2.5 rounded-control bg-amber-50 border border-amber-200 text-xs">
                <span className="font-bold text-amber-900 block mb-1">
                  Resident Feedback: Rated {selectedTicket.rating.stars} / 5 Stars
                </span>
                {selectedTicket.rating.feedback && (
                  <p className="text-[11px] text-amber-800 italic">"{selectedTicket.rating.feedback}"</p>
                )}
              </div>
            )}

            {/* Activity Timeline */}
            <div>
              <h4 className="text-xs font-bold text-walnut-900 mb-2">Audit & Activity Timeline</h4>
              <div className="space-y-2 border-l-2 border-sage-200 pl-3 ml-1 text-xs">
                {selectedTicket.timeline.map((event, i) => (
                  <div key={event.id || i} className="relative">
                    <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-sage-500" />
                    <span className="text-[10px] text-text-muted block">
                      {new Date(event.createdAt).toLocaleString()} • {event.actor || 'System'}
                    </span>
                    <span className="text-text-primary text-xs">{event.message}</span>
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
