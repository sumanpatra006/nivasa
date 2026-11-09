import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Wrench,
  Plus,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Camera,
  Star,
  RefreshCw,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { StatusBadge, BadgeVariant } from '../components/ui/StatusBadge.js';
import { Modal } from '../components/ui/Modal.js';
import { DemoFlat } from '../fixtures/uiData.js';
import { checkSafetyEscalation, COMPLAINT_CATEGORY, COMPLAINT_STATUS } from '@nivasa/shared';
import { ApiClient, ApiComplaint } from '../services/api.js';

export function ResidentComplaintsPage() {
  const { currentFlat } = useOutletContext<{ currentFlat: DemoFlat }>();
  const [complaints, setComplaints] = useState<ApiComplaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ApiComplaint | null>(null);

  // New Complaint Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Rating Modal State
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [ratingFeedback, setRatingFeedback] = useState<string>('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Reopen State
  const [isReopening, setIsReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Live safety & category analysis
  const safetyCheck = checkSafetyEscalation(title, description);

  const residentFlatId = currentFlat.id || (currentFlat as any).flatId || 'flat-t12-0408';
  const residentPhoneNumber = currentFlat.phone || (currentFlat as any).residentPhone || '9820000002';

  // Load complaints from backend
  const loadComplaints = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await ApiClient.authenticateResident(residentPhoneNumber);
      const res = await ApiClient.getComplaints();
      setComplaints(res.complaints);
    } catch (err: any) {
      console.error('Failed to load complaints:', err);
      setError(err.message || 'Failed to connect to complaint service');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, [residentFlatId]);

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setFormError('Please enter both issue title and detailed description.');
      return;
    }
    setFormError(null);
    setIsSubmitting(true);

    try {
      await ApiClient.authenticateResident(residentPhoneNumber);
      const res = await ApiClient.createComplaint({
        flatId: residentFlatId,
        title: title.trim(),
        description: description.trim(),
        category: category || undefined,
        photoUrl: photoUrl || undefined,
      });

      setComplaints([res.complaint, ...complaints]);
      setTitle('');
      setDescription('');
      setCategory('');
      setPhotoUrl('');
      setIsNewModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit complaint. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRateComplaint = async (complaintId: string) => {
    setIsSubmittingRating(true);
    try {
      await ApiClient.authenticateResident(residentPhoneNumber);
      const res = await ApiClient.rateComplaint(complaintId, ratingStars, ratingFeedback);
      setComplaints((prev) => prev.map((c) => (c.id === complaintId ? res.complaint : c)));
      setSelectedComplaint(res.complaint);
      setRatingFeedback('');
    } catch (err: any) {
      alert(`Rating submission failed: ${err.message}`);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleReopenComplaint = async (complaintId: string) => {
    if (!reopenReason.trim()) {
      alert('Please provide a reason for reopening this ticket.');
      return;
    }
    setIsReopening(true);
    try {
      await ApiClient.authenticateResident(residentPhoneNumber);
      const res = await ApiClient.updateComplaintStatus(complaintId, COMPLAINT_STATUS.REOPENED, reopenReason);
      setComplaints((prev) => prev.map((c) => (c.id === complaintId ? res.complaint : c)));
      setSelectedComplaint(res.complaint);
      setReopenReason('');
    } catch (err: any) {
      alert(`Reopen failed: ${err.message}`);
    } finally {
      setIsReopening(false);
    }
  };

  // Helper for simulated photo upload
  const handleSimulatePhotoUpload = () => {
    const samplePhotos = [
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=600&q=80',
    ];
    const picked = samplePhotos[Math.floor(Math.random() * samplePhotos.length)];
    setPhotoUrl(picked);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-walnut-900">Complaints & Requests</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Log maintenance issues with automated categorization, photo attachments, and response SLA tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadComplaints}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setIsNewModalOpen(true)}
          >
            Raise New Complaint
          </Button>
        </div>
      </div>

      {/* Demo SLA Notice Banner */}
      <div className="p-3 rounded-control border border-amber-200 bg-amber-50/70 text-xs text-amber-900 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-700 shrink-0" />
          <span className="text-[11px]">
            <strong>Demo Response SLA Active:</strong> Target response times (15m Critical, 1h High, 4h Normal) are simulation defaults and not legally binding society bye-laws.
          </span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-surface border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadComplaints}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-surface border border-border p-4 bg-surface animate-pulse space-y-2">
              <div className="h-4 bg-surface-alt rounded w-1/4"></div>
              <div className="h-3 bg-surface-alt rounded w-3/4"></div>
              <div className="h-3 bg-surface-alt rounded w-1/2"></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && complaints.length === 0 && (
        <div className="rounded-surface border border-dashed border-border p-8 text-center bg-surface">
          <Wrench className="h-8 w-8 text-text-muted mx-auto mb-2" />
          <h3 className="text-sm font-bold text-walnut-900">No Open Complaints</h3>
          <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
            Everything in Unit {currentFlat.tower}-{currentFlat.flatNumber} is in working order. If you experience an issue, tap "Raise New Complaint".
          </p>
        </div>
      )}

      {/* Complaints List */}
      {!isLoading && complaints.length > 0 && (
        <div className="space-y-3">
          {complaints.map((c) => {
            const isCritical = c.isSafetyEscalation || c.urgency === 'CRITICAL';
            const isResolved = c.status === COMPLAINT_STATUS.RESOLVED || c.status === COMPLAINT_STATUS.CLOSED;

            return (
              <div
                key={c.id}
                onClick={() => setSelectedComplaint(c)}
                className={`rounded-surface border p-4 sm:p-5 bg-surface hover:shadow-xs transition-all cursor-pointer ${
                  isCritical ? 'border-status-danger bg-status-danger-bg/20' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-text-muted">{c.id}</span>
                      <StatusBadge
                        variant={
                          isCritical
                            ? 'critical'
                            : isResolved
                            ? 'paid'
                            : c.status === COMPLAINT_STATUS.IN_PROGRESS
                            ? 'in-progress'
                            : 'assigned'
                        }
                        label={isCritical ? 'SAFETY ESCALATION' : c.status}
                      />
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-alt text-text-secondary border border-border">
                        {c.category}
                      </span>
                      {c.rating && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {c.rating.stars}/5
                        </span>
                      )}
                      {c.reopenCount > 0 && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                          Reopened {c.reopenCount}x
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-walnut-900">{c.title}</h3>
                    <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                      {c.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted pt-2 border-t border-border/50">
                      <span>
                        Assigned:{' '}
                        <strong className="text-text-primary">
                          {c.assignedTo || 'Unassigned (Help Desk Queue)'}
                        </strong>
                      </span>
                      <span>Created: {new Date(c.createdAt).toLocaleDateString()}</span>
                      <span className="text-amber-800 font-semibold font-mono">
                        {c.slaTimeRemaining || (isCritical ? '15m Emergency Target' : '4h SLA Target')}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-text-muted shrink-0 self-center" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Complaint Modal */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => !isSubmitting && setIsNewModalOpen(false)}
        title="Raise Maintenance Complaint"
        description={`Unit: Tower ${currentFlat.tower} • Flat ${currentFlat.flatNumber}`}
        footer={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setIsNewModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              onClick={handleCreateComplaint}
            >
              {isSubmitting ? 'Registering...' : 'Submit Complaint'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateComplaint} className="space-y-4">
          {formError && (
            <div className="p-2.5 rounded-control bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {formError}
            </div>
          )}

          <div>
            <label htmlFor="complaint-title" className="block text-xs font-semibold text-text-primary mb-1">
              Issue Title *
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
            <label htmlFor="complaint-category" className="block text-xs font-semibold text-text-primary mb-1">
              Category (Optional — AI will auto-categorize if left blank)
            </label>
            <select
              id="complaint-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-control border border-border px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-sage-500"
            >
              <option value="">Auto-Detect via AI / Rules</option>
              {Object.values(COMPLAINT_CATEGORY).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="complaint-description" className="block text-xs font-semibold text-text-primary mb-1">
              Detailed Description *
            </label>
            <textarea
              id="complaint-description"
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe the issue, exact location, and any hazard..."
              className="w-full rounded-control border border-border px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-sage-500"
            />
          </div>

          {/* Photo Attachment (FEATURE 1) */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Attach Photo Evidence (Optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Paste image URL or attach below..."
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="flex-1 rounded-control border border-border px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-sage-500"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Camera className="h-3.5 w-3.5" />}
                onClick={handleSimulatePhotoUpload}
              >
                Sample Photo
              </Button>
            </div>
            {photoUrl && (
              <div className="mt-2 relative w-24 h-24 rounded border border-border overflow-hidden bg-surface-alt">
                <img src={photoUrl} alt="Complaint preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotoUrl('')}
                  className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 text-[10px]"
                >
                  ✕
                </button>
              </div>
            )}
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
          description={`${selectedComplaint.id} • Flat ${selectedComplaint.tower}-${selectedComplaint.flatNumber}`}
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
              <span className="text-xs text-text-muted">
                Assigned: {selectedComplaint.assignedTo || 'Pending Assignment'}
              </span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed bg-surface-alt p-3 rounded-control border border-border">
              {selectedComplaint.description}
            </p>

            {/* Photo Attachment Display */}
            {selectedComplaint.photoUrl && (
              <div>
                <h4 className="text-xs font-bold text-walnut-900 mb-1 flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5" /> Attached Photo Evidence
                </h4>
                <div className="rounded-control border border-border overflow-hidden max-h-48 bg-black/5">
                  <img
                    src={selectedComplaint.photoUrl}
                    alt="Complaint photo"
                    className="w-full h-48 object-cover"
                  />
                </div>
              </div>
            )}

            {/* Response SLA Timer Details */}
            {selectedComplaint.sla && (
              <div className="p-2.5 rounded-control border border-border bg-surface-alt text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-text-muted block font-semibold">RESPONSE SLA (SIMULATION)</span>
                  <span className="font-bold text-walnut-900">
                    {selectedComplaint.sla.isBreached ? '⚠️ SLA Breached' : '✓ Within SLA Window'}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-amber-800">
                  {selectedComplaint.sla.displayRemaining}
                </span>
              </div>
            )}

            {/* Rating Section for Resolved Complaints (FEATURE 1) */}
            {(selectedComplaint.status === COMPLAINT_STATUS.RESOLVED ||
              selectedComplaint.status === COMPLAINT_STATUS.CLOSED) && (
              <div className="p-3 rounded-control border border-emerald-200 bg-emerald-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Resident Resolution Feedback
                  </h4>
                  {selectedComplaint.rating && (
                    <span className="text-xs font-bold text-emerald-800">
                      Rated {selectedComplaint.rating.stars} / 5 Stars
                    </span>
                  )}
                </div>

                {selectedComplaint.resolutionComment && (
                  <p className="text-[11px] text-emerald-900 italic">
                    Staff note: "{selectedComplaint.resolutionComment}"
                  </p>
                )}

                {selectedComplaint.rating ? (
                  <div className="text-xs text-text-secondary bg-white p-2.5 rounded border border-emerald-200">
                    <div className="flex items-center gap-1 text-amber-500 mb-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= selectedComplaint.rating!.stars
                              ? 'fill-amber-400 text-amber-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    {selectedComplaint.rating.feedback && (
                      <p className="text-[11px]">"{selectedComplaint.rating.feedback}"</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatingStars(star)}
                          className="p-1 focus:outline-none hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`h-5 w-5 ${
                              star <= ratingStars
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold ml-2 text-text-primary">
                        {ratingStars} / 5 Stars
                      </span>
                    </div>

                    <input
                      type="text"
                      placeholder="Add brief feedback for technician (optional)..."
                      value={ratingFeedback}
                      onChange={(e) => setRatingFeedback(e.target.value)}
                      className="w-full rounded border border-border px-2.5 py-1.5 text-xs text-text-primary bg-white focus:outline-none focus:border-sage-500"
                    />

                    <Button
                      size="sm"
                      variant="primary"
                      disabled={isSubmittingRating}
                      onClick={() => handleRateComplaint(selectedComplaint.id)}
                    >
                      {isSubmittingRating ? 'Saving...' : 'Submit 5-Star Rating'}
                    </Button>
                  </div>
                )}

                {/* Reopen Ticket Option */}
                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">Issue recurred or not resolved?</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Reason for reopening..."
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                      className="w-48 rounded border border-border px-2 py-1 text-[11px] bg-white focus:outline-none"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isReopening}
                      onClick={() => handleReopenComplaint(selectedComplaint.id)}
                      leftIcon={<RotateCcw className="h-3 w-3" />}
                    >
                      {isReopening ? 'Reopening...' : 'Reopen Ticket'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h4 className="text-xs font-bold text-walnut-900 mb-2">Activity Timeline</h4>
              <div className="space-y-2 border-l-2 border-sage-200 pl-3 ml-1 text-xs">
                {selectedComplaint.timeline.map((event, i) => (
                  <div key={event.id || i} className="relative">
                    <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-sage-500" />
                    <span className="text-[10px] text-text-muted block">
                      {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                      • {event.actor || 'System'}
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
