import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Users,
  KeyRound,
  CheckCircle2,
  XCircle,
  Plus,
  Clock,
  Car,
  AlertCircle,
  Share2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { Modal } from '../components/ui/Modal.js';
import { ApiClient, ApiVisitor, ApiGuestCode } from '../services/api.js';
import { DemoFlat } from '../fixtures/uiData.js';

export function ResidentVisitorsPage() {
  const { currentFlat } = useOutletContext<{ currentFlat: DemoFlat }>();
  const [visitors, setVisitors] = useState<ApiVisitor[]>([]);
  const [guestCodes, setGuestCodes] = useState<ApiGuestCode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Guest Code Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [guestName, setGuestName] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('Personal Guest');
  const [validHours, setValidHours] = useState<number>(24);
  const [generatedPass, setGeneratedPass] = useState<ApiGuestCode | null>(null);

  const fetchFlatData = async () => {
    try {
      setIsLoading(true);
      await ApiClient.authenticateResident(currentFlat.phone);
      const [visRes, codeRes] = await Promise.all([
        ApiClient.getVisitors(currentFlat.id),
        ApiClient.getGuestCodes(currentFlat.id),
      ]);
      setVisitors(visRes.visitors);
      setGuestCodes(codeRes.guestCodes);
    } catch (err: any) {
      console.warn('Could not load resident visitor data:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlatData();
  }, [currentFlat.id]);

  const handleApprove = async (visitorId: string, status: 'APPROVED' | 'DENIED') => {
    try {
      await ApiClient.authenticateResident(currentFlat.phone);
      await ApiClient.approveVisitor(visitorId, status);
      setStatusMessage({
        type: 'success',
        text: `Visitor marked as ${status}. Gate has been notified.`,
      });
      fetchFlatData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Action failed.' });
    }
  };

  const handleCreateGuestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    try {
      await ApiClient.authenticateResident(currentFlat.phone);
      const validUntil = new Date(Date.now() + validHours * 60 * 60 * 1000).toISOString();
      const res = await ApiClient.createGuestCode({
        flatId: currentFlat.id,
        guestName: guestName.trim(),
        purpose,
        validUntil,
        usageLimit: 1,
      });

      setGeneratedPass(res.guestCode);
      setStatusMessage({
        type: 'success',
        text: `Guest pass PIN generated: ${res.guestCode.codePlain}. Share this 6-digit code with your guest.`,
      });
      setGuestName('');
      fetchFlatData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Pass generation failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-walnut-900">
            Visitors & Pre-Approved Passes
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Approve gate visitor requests and generate 6-digit PIN codes for expected guests.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setGeneratedPass(null);
            setIsModalOpen(true);
          }}
          leftIcon={<KeyRound className="h-4 w-4" />}
        >
          Create Guest Pass PIN
        </Button>
      </div>

      {/* Status Feedback */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-control text-xs flex items-center justify-between border ${
            statusMessage.type === 'success'
              ? 'bg-sage-50 border-sage-300 text-sage-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-[11px] font-semibold text-text-muted hover:text-text-primary ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Pre-Approved Guest Passes */}
      <div className="rounded-surface border border-border bg-surface p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-walnut-600" />
            <h3 className="text-sm font-bold text-walnut-900">Active Pre-Approved Guest Passes</h3>
          </div>
          <span className="text-xs text-text-muted">{guestCodes.filter((c) => c.isActive).length} active</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {guestCodes.filter((c) => c.isActive).length > 0 ? (
            guestCodes
              .filter((c) => c.isActive)
              .map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl border border-sage-200 bg-sage-50/50 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-walnut-900">{c.guestName}</span>
                      <span className="rounded-full bg-sage-200 px-2 py-0.5 text-[10px] font-bold text-sage-900">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-text-muted">{c.purpose}</p>
                    <div className="mt-3 p-2 rounded-lg bg-white border border-sage-300 flex items-center justify-between font-mono font-bold text-base text-sage-950">
                      <span>PIN: {c.codePlain || c.codeMasked}</span>
                      <span className="text-[10px] font-sans font-normal text-text-muted">6 Digits</span>
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] text-text-muted flex items-center justify-between">
                    <span>Valid until {new Date(c.validUntil).toLocaleDateString()}</span>
                    <span>Used {c.usageCount}/{c.usageLimit}</span>
                  </div>
                </div>
              ))
          ) : (
            <div className="col-span-full py-6 text-center text-xs text-text-muted">
              No active pre-approved guest passes. Click "Create Guest Pass PIN" to generate one.
            </div>
          )}
        </div>
      </div>

      {/* Visitor History & Arriving Requests */}
      <div className="rounded-surface border border-border bg-surface p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-walnut-600" />
            <h3 className="text-sm font-bold text-walnut-900">Flat Visitor Activity Log</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchFlatData}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
        </div>

        <div className="space-y-3">
          {visitors.length > 0 ? (
            visitors.map((v) => (
              <div
                key={v.id}
                className="p-4 rounded-xl border border-border bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-sage-100 border border-sage-300 flex items-center justify-center font-bold text-sage-900 text-sm shrink-0">
                    {v.visitorName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-walnut-900">{v.visitorName}</span>
                      <StatusBadge
                        variant={
                          v.approvalStatus === 'APPROVED'
                            ? 'paid'
                            : v.approvalStatus === 'DENIED'
                            ? 'overdue'
                            : 'pending'
                        }
                        label={v.approvalStatus}
                      />
                      <span className="text-xs text-text-muted">({v.entryStatus})</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5 flex-wrap">
                      <span>{v.purpose}</span>
                      {v.vehicleNumber && <span>• {v.vehicleNumber}</span>}
                      {v.arrivedAt && <span>• Arrived: {new Date(v.arrivedAt).toLocaleTimeString()}</span>}
                    </div>
                  </div>
                </div>

                {/* Resident Approval Action for Pending Visitors */}
                {v.approvalStatus === 'PENDING' && (
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprove(v.id, 'APPROVED')}
                      leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApprove(v.id, 'DENIED')}
                      leftIcon={<XCircle className="h-3.5 w-3.5" />}
                    >
                      Deny
                    </Button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-xs text-text-muted">
              No recent visitors logged for Flat {currentFlat.tower}-{currentFlat.flatNumber}.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Generate Guest Pass PIN */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Pre-Approved Guest Pass"
      >
        {generatedPass ? (
          <div className="space-y-4 text-center py-2">
            <div className="p-4 rounded-xl bg-sage-50 border border-sage-300">
              <span className="text-xs uppercase tracking-wider font-bold text-sage-900 block mb-1">
                6-Digit Gate Entry PIN
              </span>
              <span className="text-3xl font-mono font-bold tracking-widest text-walnut-900 block my-2">
                {generatedPass.codePlain}
              </span>
              <p className="text-xs text-sage-800">
                Valid for guest <strong>{generatedPass.guestName}</strong> until{' '}
                {new Date(generatedPass.validUntil).toLocaleString()}.
              </p>
            </div>
            <p className="text-xs text-text-muted">
              Your guest can type this PIN on the security gate keypad for instant access.
            </p>
            <Button variant="primary" size="md" className="w-full" onClick={() => setIsModalOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreateGuestCode} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-walnut-900 uppercase tracking-wider mb-1">
                Guest Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh Patel"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full min-h-[44px] rounded-control border border-border bg-canvas px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-walnut-900 uppercase tracking-wider mb-1">
                Visit Purpose
              </label>
              <select
                aria-label="Visit Purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full min-h-[44px] rounded-control border border-border bg-canvas px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              >
                <option value="Personal Guest">Family & Friends</option>
                <option value="Dinner / Party">Dinner / Celebration</option>
                <option value="Home Maintenance">Contractor / Painter / Electrician</option>
                <option value="Cab / Driver">Private Driver</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-walnut-900 uppercase tracking-wider mb-1">
                PIN Validity Duration
              </label>
              <select
                aria-label="PIN Validity Duration"
                value={validHours}
                onChange={(e) => setValidHours(Number(e.target.value))}
                className="w-full min-h-[44px] rounded-control border border-border bg-canvas px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              >
                <option value={4}>4 Hours</option>
                <option value={12}>12 Hours</option>
                <option value={24}>24 Hours (Recommended)</option>
                <option value={48}>48 Hours (Weekend)</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="md" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="md">
                Generate PIN Code
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default ResidentVisitorsPage;
