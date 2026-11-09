import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  History,
  XCircle,
  Clock,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { Modal } from '../components/ui/Modal.js';
import { formatPaiseToINR } from '@nivasa/shared';
import {
  ApiClient,
  ApiReconciledTransaction,
  ApiBatchSummary,
} from '../services/api.js';

export function StaffReconciliationPage() {
  // Queue & Batches
  const [queue, setQueue] = useState<ApiReconciledTransaction[]>([]);
  const [batches, setBatches] = useState<ApiBatchSummary[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [activeView, setActiveView] = useState<'QUEUE' | 'HISTORY'>('QUEUE');

  // Loading & Error States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Modals & Selection
  const [selectedTxn, setSelectedTxn] = useState<ApiReconciledTransaction | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [latestImportSummary, setLatestImportSummary] = useState<any | null>(null);

  // Manual Review & Search
  const [candidateSearchQuery, setCandidateSearchQuery] = useState<string>('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedManualInvoiceId, setSelectedManualInvoiceId] = useState<string | null>(null);
  const [isPostingAction, setIsPostingAction] = useState<boolean>(false);
  const [postingResultNotice, setPostingResultNotice] = useState<string | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load active reconciliation queue and batches
  const loadData = useCallback(async () => {
    try {
      setApiError(null);
      await ApiClient.authenticateStaff();

      const [queueRes, batchesRes] = await Promise.all([
        ApiClient.getReconciliationQueue(),
        ApiClient.getReconciliationBatches(),
      ]);

      setQueue(queueRes.queue);
      setBatches(batchesRes.batches);
    } catch (err: any) {
      console.error('Failed to load reconciliation queue:', err);
      setApiError(err.message || 'Unable to connect to reconciliation API.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [loadData]);

  // Search candidate invoices for manual review
  useEffect(() => {
    if (selectedTxn) {
      ApiClient.searchCandidates(candidateSearchQuery)
        .then((res) => {
          setCandidates(res.candidates);
        })
        .catch(console.error);
    }
  }, [selectedTxn, candidateSearchQuery]);

  // Handle CSV File Upload
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Only valid .csv files are supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds the 5MB maximum limit.');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        const res = await ApiClient.uploadBankCsv(content, file.name);
        setLatestImportSummary(res.summary);
        setIsUploadModalOpen(false);
        await loadData();
      } catch (err: any) {
        setUploadError(err.message || 'Failed to upload and parse statement.');
      } finally {
        setUploadLoading(false);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read file from disk.');
      setUploadLoading(false);
    };
    reader.readAsText(file);
  };

  // Confirm match and post to flat ledger
  const handleConfirmMatch = async (txnId: string, invoiceId?: string) => {
    setIsPostingAction(true);
    setPostingResultNotice(null);

    try {
      const res = await ApiClient.confirmReconciliationMatch(txnId, invoiceId);
      setPostingResultNotice(
        `Successfully posted ${formatPaiseToINR(
          res.transaction.transaction.amountPaise
        )} to ${res.transaction.suggestedMatch?.flatIdentifier || 'flat ledger'} (Receipt: ${
          res.receipt?.receiptNumber
        })`
      );

      // Refresh queue
      await loadData();
      setSelectedTxn(null);
    } catch (err: any) {
      alert(`Posting Error: ${err.message}`);
    } finally {
      setIsPostingAction(false);
    }
  };

  // Reject match suggestion
  const handleRejectMatch = async (txnId: string) => {
    const reason = prompt('Please enter the reason for rejection (optional):') || 'Rejected by Accounts';
    try {
      await ApiClient.rejectReconciliationMatch(txnId, reason);
      await loadData();
      setSelectedTxn(null);
    } catch (err: any) {
      alert(`Reject Error: ${err.message}`);
    }
  };

  // Mark transaction for review
  const handleMarkReview = async (txnId: string) => {
    try {
      await ApiClient.markReconciliationReview(txnId);
      await loadData();
      setSelectedTxn(null);
    } catch (err: any) {
      alert(`Review Error: ${err.message}`);
    }
  };

  // Filter transactions
  const filteredQueue = queue.filter((t) => {
    if (activeTab === 'ALL') return true;
    return t.status === activeTab;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-surface-alt rounded-control" />
        <div className="h-24 rounded-surface bg-surface border border-border p-6" />
        <div className="h-96 rounded-surface bg-surface border border-border p-6" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-walnut-900">
            Bank Statement Reconciliation
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Deterministic multi-factor matching, row-level error validation, and human accounts review.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              loadData();
            }}
            disabled={isRefreshing}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            {isRefreshing ? 'Syncing...' : 'Sync Queue'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Upload className="h-4 w-4" />}
            onClick={() => {
              setUploadError(null);
              setIsUploadModalOpen(true);
            }}
          >
            Import Bank CSV Statement
          </Button>
        </div>
      </div>

      {/* Strict Accounting Rule Notice */}
      <div className="p-3.5 rounded-control border border-amber-200 bg-amber-50/70 text-xs text-amber-900 flex items-start gap-2.5">
        <Sparkles className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">Deterministic Accounting Guardrail:</span>
          <span>
            Candidate matches with high confidence ($\ge 85\%$) are strictly marked as <strong>SUGGESTED</strong>.
            Transactions are <strong>NEVER automatically posted</strong> to a resident's ledger without explicit manual confirmation by Accounts staff. An amount match alone (25%) is always routed to manual review or unmatched.
          </span>
        </div>
      </div>

      {/* Posting Result Toast / Notification */}
      {postingResultNotice && (
        <div className="p-3.5 rounded-control border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{postingResultNotice}</span>
          </div>
          <button
            onClick={() => setPostingResultNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Import Summary Banner (if recent upload occurred) */}
      {latestImportSummary && (
        <div className="rounded-control border border-sage-200 bg-sage-50/60 p-4 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold text-sage-900">
            <span>Statement Batch Processed Successfully</span>
            <button
              onClick={() => setLatestImportSummary(null)}
              className="text-sage-700 hover:text-sage-900 text-[11px]"
            >
              Clear
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
            <div className="bg-surface p-2 rounded border border-border">
              <span className="text-text-muted block">Total Processed</span>
              <strong className="text-walnut-900">{latestImportSummary.validRows} rows</strong>
            </div>
            <div className="bg-surface p-2 rounded border border-border">
              <span className="text-text-muted block">Suggested Matches</span>
              <strong className="text-emerald-800">{latestImportSummary.suggestedCount} matches</strong>
            </div>
            <div className="bg-surface p-2 rounded border border-border">
              <span className="text-text-muted block">Needs Review</span>
              <strong className="text-amber-800">{latestImportSummary.needsReviewCount} rows</strong>
            </div>
            <div className="bg-surface p-2 rounded border border-border">
              <span className="text-text-muted block">Duplicates Detected</span>
              <strong className="text-rose-800">{latestImportSummary.duplicateRows} rows</strong>
            </div>
          </div>
        </div>
      )}

      {/* View Switcher: Queue vs History */}
      <div className="flex items-center justify-between border-b border-border pb-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('QUEUE')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 transition-colors ${
              activeView === 'QUEUE'
                ? 'border-sage-600 text-sage-900'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            Review Queue ({queue.length})
          </button>
          <button
            onClick={() => setActiveView('HISTORY')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeView === 'HISTORY'
                ? 'border-sage-600 text-sage-900'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Import History ({batches.length})
          </button>
        </div>
      </div>

      {activeView === 'QUEUE' ? (
        /* Queue View */
        <div className="rounded-surface border border-border bg-surface shadow-xs overflow-hidden space-y-4 p-4">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {['ALL', 'SUGGESTED', 'NEEDS_REVIEW', 'UNMATCHED', 'POSTED', 'DUPLICATE', 'REJECTED'].map(
              (tab) => {
                const count =
                  tab === 'ALL'
                    ? queue.length
                    : queue.filter((t) => t.status === tab).length;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-control font-semibold whitespace-nowrap transition-colors ${
                      activeTab === tab
                        ? 'bg-walnut-800 text-white shadow-xs'
                        : 'bg-surface-alt text-text-secondary hover:bg-surface-alt/80 border border-border'
                    }`}
                  >
                    {tab.replace('_', ' ')} ({count})
                  </button>
                );
              }
            )}
          </div>

          {/* Transactions Table */}
          {filteredQueue.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-muted">
              No bank transactions found in this category.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted bg-surface-alt/70">
                    <th className="py-3 px-4 font-semibold">Date & Reference</th>
                    <th className="py-3 px-4 font-semibold">Narration</th>
                    <th className="py-3 px-4 font-semibold text-right">Amount (₹)</th>
                    <th className="py-3 px-4 font-semibold">Candidate Target</th>
                    <th className="py-3 px-4 font-semibold">Confidence</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredQueue.map((item) => {
                    const conf = item.suggestedMatch?.confidence || 0;
                    return (
                      <tr key={item.id} className="hover:bg-surface-alt/40 transition-colors">
                        {/* Date & Ref */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-text-primary block">
                            {new Date(item.transaction.transactionDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="font-mono text-[11px] text-text-muted block">
                            {item.transaction.reference}
                          </span>
                        </td>

                        {/* Narration */}
                        <td className="py-3 px-4 max-w-xs">
                          <span className="text-text-primary block line-clamp-1">
                            {item.transaction.description}
                          </span>
                          {item.transaction.upiId && (
                            <span className="text-[11px] text-text-muted font-mono block">
                              UPI: {item.transaction.upiId}
                            </span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-text-primary tabular-nums">
                          {formatPaiseToINR(item.transaction.amountPaise)}
                        </td>

                        {/* Candidate Target */}
                        <td className="py-3 px-4">
                          {item.suggestedMatch ? (
                            <div>
                              <strong className="text-walnut-900 block">
                                {item.suggestedMatch.flatIdentifier}
                              </strong>
                              <span className="text-[11px] text-text-muted block">
                                {item.suggestedMatch.candidateFlat.residentName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-text-muted italic">Unmatched</span>
                          )}
                        </td>

                        {/* Confidence Score Bar */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 rounded-full bg-surface-alt border border-border overflow-hidden">
                              <div
                                className={`h-full ${
                                  conf >= 0.85
                                    ? 'bg-sage-600'
                                    : conf >= 0.4
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.round(conf * 100)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] font-bold">
                              {Math.round(conf * 100)}%
                            </span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4">
                          <StatusBadge
                            variant={
                              item.status === 'POSTED'
                                ? 'paid'
                                : item.status === 'SUGGESTED'
                                ? 'suggested'
                                : item.status === 'NEEDS_REVIEW'
                                ? 'warning'
                                : item.status === 'DUPLICATE'
                                ? 'danger'
                                : 'neutral'
                            }
                            label={item.status}
                          />
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {item.status === 'POSTED' ? (
                            <span className="text-[11px] font-semibold text-emerald-700 flex items-center justify-end gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Posted
                            </span>
                          ) : item.status === 'DUPLICATE' ? (
                            <span className="text-[11px] text-rose-700 font-semibold">Duplicate</span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedTxn(item);
                                  setSelectedManualInvoiceId(item.suggestedMatch?.invoiceId || null);
                                }}
                              >
                                Review Evidence
                              </Button>

                              {item.suggestedMatch && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleConfirmMatch(item.id)}
                                >
                                  Confirm & Post
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* History View */
        <div className="rounded-surface border border-border bg-surface p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-walnut-900">Imported Statement Batches</h3>
          {batches.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">No statements uploaded yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {batches.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-walnut-900 block">{b.filename}</span>
                    <span className="text-[11px] text-text-muted font-mono block">
                      Uploaded on {new Date(b.uploadedAt).toLocaleString('en-IN')} • SHA-256:{' '}
                      {b.fileHash.substring(0, 12)}...
                    </span>
                  </div>
                  <div className="text-right font-mono text-[11px]">
                    <span className="text-emerald-800 font-bold block">
                      {b.processedRows} rows processed
                    </span>
                    {b.invalidRows > 0 && (
                      <span className="text-rose-700 block">{b.invalidRows} row errors</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual Review & Evidence Modal */}
      {selectedTxn && (
        <Modal
          isOpen={!!selectedTxn}
          onClose={() => setSelectedTxn(null)}
          title="Transaction Match Evidence & Review"
          description={`Reference: ${selectedTxn.transaction.reference} • Amount: ${formatPaiseToINR(
            selectedTxn.transaction.amountPaise
          )}`}
          footer={
            <div className="flex justify-between w-full">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRejectMatch(selectedTxn.id)}
                >
                  Reject Suggestion
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMarkReview(selectedTxn.id)}
                >
                  Mark for Review
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedTxn(null)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!selectedManualInvoiceId || isPostingAction}
                  onClick={() => handleConfirmMatch(selectedTxn.id, selectedManualInvoiceId || undefined)}
                >
                  {isPostingAction ? 'Posting...' : 'Confirm & Post to Ledger'}
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Raw CSV vs Normalized Data */}
            <div className="rounded-control bg-surface-alt/70 p-3.5 border border-border text-xs space-y-2">
              <span className="font-bold text-walnut-900 block">Raw CSV Row Data:</span>
              <p className="font-mono text-[11px] bg-canvas p-2 rounded border border-border overflow-x-auto text-text-primary">
                {selectedTxn.transaction.rawRow}
              </p>
            </div>

            {/* Evidence Breakdown */}
            {selectedTxn.suggestedMatch ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h4 className="text-xs font-bold text-walnut-900">
                    Suggested Target: {selectedTxn.suggestedMatch.flatIdentifier} (
                    {selectedTxn.suggestedMatch.candidateFlat.residentName})
                  </h4>
                  <span className="font-mono text-xs font-bold text-sage-900">
                    {Math.round(selectedTxn.suggestedMatch.confidence * 100)}% Confidence
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-emerald-800 block">
                    Verified Positive Evidence:
                  </span>
                  <ul className="text-xs space-y-1 list-disc pl-4 text-text-secondary">
                    {selectedTxn.suggestedMatch.matchingReasons.map((reason, idx) => (
                      <li key={idx} className="text-emerald-900">
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>

                {selectedTxn.suggestedMatch.missingEvidence.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[11px] font-bold text-amber-800 block">
                      Missing Factors / Notes:
                    </span>
                    <ul className="text-xs space-y-1 list-disc pl-4 text-text-muted">
                      {selectedTxn.suggestedMatch.missingEvidence.map((missing, idx) => (
                        <li key={idx}>{missing}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-amber-50 rounded border border-amber-200 text-xs text-amber-800">
                No unambiguous automated match detected. Please select candidate invoice below.
              </div>
            )}

            {/* Manual Candidate Invoice Selector / Search */}
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-walnut-900">Select Target Society Invoice</h4>
                <div className="relative w-48">
                  <Search className="h-3 w-3 absolute left-2 top-2 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search flat / resident..."
                    value={candidateSearchQuery}
                    onChange={(e) => setCandidateSearchQuery(e.target.value)}
                    className="w-full pl-6 pr-2 py-1 text-xs border border-border rounded-control bg-surface focus:outline-none focus:border-sage-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {candidates.map((cand) => (
                  <label
                    key={cand.id}
                    className={`flex items-center justify-between p-2.5 rounded-control border text-xs cursor-pointer transition-colors ${
                      selectedManualInvoiceId === cand.id
                        ? 'border-sage-500 bg-sage-50 text-sage-900 font-semibold'
                        : 'border-border bg-surface hover:bg-surface-alt'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="manualInvoiceTarget"
                        checked={selectedManualInvoiceId === cand.id}
                        onChange={() => setSelectedManualInvoiceId(cand.id)}
                        className="text-sage-600 focus:ring-sage-500"
                      />
                      <span>
                        <strong>{cand.tower}-{cand.flatNumber}</strong> ({cand.residentName})
                      </span>
                    </div>

                    <div className="text-right font-mono">
                      <span className="block text-text-primary">
                        Balance: {formatPaiseToINR(cand.balancePaise)}
                      </span>
                      <span className="text-[10px] text-text-muted">Due: {cand.dueDate.substring(0, 10)}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* CSV File Upload Modal */}
      {isUploadModalOpen && (
        <Modal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          title="Import Bank Statement CSV"
          description="Upload an authentic exported statement from HDFC, SBI, Axis, or ICICI bank."
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={uploadLoading}
              >
                Cancel
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile) handleFileUpload(droppedFile);
              }}
              className="border-2 border-dashed border-border-strong rounded-surface p-8 text-center hover:bg-surface-alt/50 transition-colors cursor-pointer"
            >
              <Upload className="h-10 w-10 mx-auto text-walnut-500 mb-2" />
              <p className="text-xs font-semibold text-text-primary">
                Drag & drop bank CSV statement here, or click to browse
              </p>
              <p className="text-[11px] text-text-muted mt-1">
                Expected columns: Date, Amount, Reference/UTR, UPI ID, Narration (Max 5MB)
              </p>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </div>

            {uploadLoading && (
              <div className="text-center py-2 text-xs font-semibold text-sage-800 flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Parsing CSV and calculating multi-factor candidate matches...
              </div>
            )}

            {uploadError && (
              <div className="p-3 rounded-control bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="text-[11px] text-text-muted bg-surface-alt p-3 rounded border border-border">
              <strong>Duplicate Statement Guard:</strong> SHA-256 fingerprint hash is evaluated upon upload. Re-uploading an identical statement batch is automatically rejected to safeguard against double posting.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
