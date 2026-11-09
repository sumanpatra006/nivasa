import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Camera,
  Wifi,
  WifiOff,
  RefreshCw,
  UserPlus,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Clock,
  KeyRound,
  Trash2,
  Car,
  Phone,
  Building,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { ApiClient, ApiVisitor, ApiGuestCode } from '../services/api.js';
import { DEMO_FLATS } from '../fixtures/uiData.js';

interface OfflineQueueItem {
  clientUuid: string;
  flatId: string;
  visitorName: string;
  visitorPhone?: string;
  purpose: string;
  vehicleNumber?: string;
  photoBase64?: string;
  recordedAt: string;
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  errorMessage?: string;
}

const OFFLINE_QUEUE_KEY = 'nivasa_guard_offline_queue';

export function GuardTabletPage() {
  const [activeTab, setActiveTab] = useState<'KEYPAD' | 'REGISTER' | 'LOG' | 'OFFLINE'>('KEYPAD');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [simulateOfflineMode, setSimulateOfflineMode] = useState<boolean>(false);
  const effectiveOnline = isOnline && !simulateOfflineMode;

  const [visitors, setVisitors] = useState<ApiVisitor[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isVerifyingKeypad, setIsVerifyingKeypad] = useState<boolean>(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Keypad State
  const [pinCode, setPinCode] = useState<string>('');
  const [keypadResult, setKeypadResult] = useState<{
    success: boolean;
    guestName?: string;
    flatInfo?: string;
    message: string;
  } | null>(null);

  // Registration Form State
  const [formData, setFormData] = useState({
    flatId: 'flat-t07-1203',
    visitorName: '',
    visitorPhone: '',
    purpose: 'Delivery',
    vehicleNumber: '',
  });
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // DPDP Purge State
  const [purgeResult, setPurgeResult] = useState<{ message: string; count: number } | null>(null);

  // Load offline queue from localStorage
  const loadOfflineQueue = (): OfflineQueueItem[] => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveOfflineQueue = (items: OfflineQueueItem[]) => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
      setOfflineQueue(items);
    } catch (e) {
      console.error('Failed to save offline queue', e);
    }
  };

  // Sync state & data
  const fetchGateVisitors = async () => {
    if (!effectiveOnline) return;
    try {
      setIsLoading(true);
      await ApiClient.authenticateGuard();
      const res = await ApiClient.getVisitors();
      setVisitors(res.visitors);
    } catch (err: any) {
      console.warn('Could not fetch gate visitors:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setOfflineQueue(loadOfflineQueue());
    fetchGateVisitors();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // When network comes back online, trigger auto sync if queue has items
  useEffect(() => {
    if (effectiveOnline && offlineQueue.length > 0) {
      handleSyncBatch();
    }
  }, [effectiveOnline]);

  // Keypad handlers
  const handleKeypadPress = (val: string) => {
    if (pinCode.length < 6) {
      setPinCode((prev) => prev + val);
    }
  };

  const handleKeypadClear = () => {
    setPinCode('');
    setKeypadResult(null);
  };

  const handleKeypadVerify = async () => {
    if (pinCode.length !== 6) {
      setStatusMessage({ type: 'error', text: 'Please enter a 6-digit guest pass PIN.' });
      return;
    }

    if (!effectiveOnline) {
      setStatusMessage({
        type: 'error',
        text: 'Pre-approved pass PIN verification requires online connection to society servers.',
      });
      return;
    }

    try {
      setIsVerifyingKeypad(true);
      await ApiClient.authenticateGuard();
      const res = await ApiClient.validateGuestCode(pinCode);
      if (res.isValid && res.visitor) {
        setKeypadResult({
          success: true,
          guestName: res.guestCode?.guestName || res.visitor.visitorName,
          flatInfo: `${res.visitor.tower}-${res.visitor.flatNumber}`,
          message: `Access Approved! ${res.guestCode?.guestName} checked in to Flat ${res.visitor.tower}-${res.visitor.flatNumber}.`,
        });
        setStatusMessage({ type: 'success', text: `Access Granted. Guest checked in.` });
        setPinCode('');
        fetchGateVisitors();
      } else {
        setKeypadResult({
          success: false,
          message: res.reason || 'Invalid or expired guest pass PIN.',
        });
      }
    } catch (err: any) {
      setKeypadResult({
        success: false,
        message: err.message || 'Validation failed. Please check the code.',
      });
    } finally {
      setIsVerifyingKeypad(false);
    }
  };

  // Register Visitor
  const handleRegisterVisitor = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!formData.visitorName.trim()) {
      setStatusMessage({ type: 'error', text: 'Visitor name is required.' });
      return;
    }

    const clientUuid = `off-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const recordedAt = new Date().toISOString();

    const newEntry: OfflineQueueItem = {
      clientUuid,
      flatId: formData.flatId,
      visitorName: formData.visitorName.trim(),
      visitorPhone: formData.visitorPhone.trim() || undefined,
      purpose: formData.purpose,
      vehicleNumber: formData.vehicleNumber.trim() || undefined,
      photoBase64: capturedPhoto || undefined,
      recordedAt,
      syncStatus: effectiveOnline ? 'SYNCING' : 'PENDING',
    };

    if (!effectiveOnline) {
      // Store persistently in offline queue
      const updatedQueue = [...offlineQueue, newEntry];
      saveOfflineQueue(updatedQueue);

      // Create a local temporary visitor in list so guard sees it immediately
      const chosenFlat = DEMO_FLATS.find((f) => f.id === formData.flatId);
      const localVisitor: ApiVisitor = {
        id: clientUuid,
        clientUuid,
        flatId: formData.flatId,
        tower: chosenFlat?.tower || 'T07',
        flatNumber: chosenFlat?.flatNumber || '1203',
        visitorName: newEntry.visitorName,
        visitorPhone: newEntry.visitorPhone,
        purpose: newEntry.purpose,
        vehicleNumber: newEntry.vehicleNumber,
        arrivedAt: recordedAt,
        approvalStatus: 'PENDING',
        entryStatus: 'CHECKED_IN',
        recordedAt,
        createdAt: recordedAt,
      };
      setVisitors((prev) => [localVisitor, ...prev]);

      setStatusMessage({
        type: 'info',
        text: `Recorded Offline! Visitor stored in tablet local queue. Will sync when online.`,
      });
      resetForm();
      setActiveTab('LOG');
      return;
    }

    // Direct online registration
    try {
      setIsSubmittingForm(true);
      await ApiClient.authenticateGuard();
      const res = await ApiClient.registerVisitor({
        clientUuid,
        flatId: formData.flatId,
        visitorName: formData.visitorName.trim(),
        visitorPhone: formData.visitorPhone.trim() || undefined,
        purpose: formData.purpose,
        vehicleNumber: formData.vehicleNumber.trim() || undefined,
        photoBase64: capturedPhoto || undefined,
        recordedAt,
      });

      setStatusMessage({
        type: 'success',
        text: `Visitor "${res.visitor.visitorName}" registered and checked in successfully.`,
      });
      resetForm();
      fetchGateVisitors();
      setActiveTab('LOG');
    } catch (err: any) {
      // If network failed during request, fallback to queue
      const updatedQueue = [...offlineQueue, { ...newEntry, syncStatus: 'PENDING' as const }];
      saveOfflineQueue(updatedQueue);
      setStatusMessage({
        type: 'info',
        text: `Network unreachable. Visitor saved to offline queue.`,
      });
      resetForm();
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const resetForm = () => {
    setFormData({
      flatId: 'flat-t07-1203',
      visitorName: '',
      visitorPhone: '',
      purpose: 'Delivery',
      vehicleNumber: '',
    });
    setCapturedPhoto(null);
  };

  // Offline batch sync
  const handleSyncBatch = async () => {
    const queue = loadOfflineQueue();
    if (queue.length === 0) {
      setStatusMessage({ type: 'info', text: 'Offline queue is already empty.' });
      return;
    }

    if (!effectiveOnline) {
      setStatusMessage({ type: 'error', text: 'Cannot sync while offline. Check internet connection.' });
      return;
    }

    setIsSyncing(true);
    try {
      await ApiClient.authenticateGuard();

      // Submit batch to backend sync endpoint
      const payload = queue.map((item) => ({
        clientUuid: item.clientUuid,
        flatId: item.flatId,
        visitorName: item.visitorName,
        visitorPhone: item.visitorPhone,
        purpose: item.purpose,
        vehicleNumber: item.vehicleNumber,
        photoBase64: item.photoBase64,
        recordedAt: item.recordedAt,
      }));

      const res = await ApiClient.syncVisitorBatch(payload);

      // Backend confirmed receipt! Clear synced items
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
      setOfflineQueue([]);
      setStatusMessage({
        type: 'success',
        text: `Sync Complete: ${res.syncedCount} offline record(s) verified & synced with society server.`,
      });
      fetchGateVisitors();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Sync failed: ${err.message}. Retaining queue for next attempt.`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Check out visitor
  const handleCheckOut = async (visitorId: string) => {
    if (!effectiveOnline) {
      setStatusMessage({
        type: 'error',
        text: 'Visitor checkout requires online connection to update society records.',
      });
      return;
    }

    try {
      await ApiClient.authenticateGuard();
      await ApiClient.recordVisitorExit(visitorId);
      setStatusMessage({ type: 'success', text: 'Visitor departure recorded.' });
      fetchGateVisitors();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Checkout failed.' });
    }
  };

  // DPDP Photo Purge
  const handlePurgePhotos = async () => {
    try {
      await ApiClient.authenticateGuard();
      const res = await ApiClient.purgeExpiredPhotos();
      setPurgeResult({ message: res.message, count: res.purgedPhotosCount });
      setStatusMessage({
        type: 'success',
        text: `DPDP Act 2023 purge complete: ${res.purgedPhotosCount} expired photo files removed from disk.`,
      });
      fetchGateVisitors();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Purge failed.' });
    }
  };

  // Simulated photo capture
  const handleCapturePhoto = () => {
    // Generate a minimal simulated SVG base64 avatar
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#87A96B"/><circle cx="100" cy="80" r="40" fill="#ffffff"/><path d="M40 180 c0 -40 30 -60 60 -60 c30 0 60 20 60 60 Z" fill="#ffffff"/><text x="100" y="190" font-size="12" text-anchor="middle" fill="#5A3E2B">Gate 1 Verified</text></svg>`;
    const b64 = 'data:image/svg+xml;base64,' + btoa(svg);
    setCapturedPhoto(b64);
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary p-4 sm:p-6 lg:p-8">
      {/* 1. Header Bar Optimized for Tablet */}
      <header className="mb-6 rounded-surface border border-border bg-surface p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-walnut-800 text-white flex items-center justify-center font-bold text-xl shadow-xs">
            <ShieldCheck className="h-7 w-7 text-sage-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-walnut-900">
                Gate 1 • Security Tablet Terminal
              </h1>
              <span className="rounded-full bg-walnut-100 px-2.5 py-0.5 text-xs font-semibold text-walnut-900 border border-walnut-300">
                On-Duty Guard
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Nivasa Township Operations • Tablet Touch Optimized Interface (48px+ touch targets)
            </p>
          </div>
        </div>

        {/* Connectivity Indicator & Offline Simulator Switch */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              effectiveOnline
                ? 'bg-sage-50 text-sage-900 border-sage-200'
                : 'bg-amber-50 text-amber-900 border-amber-300'
            }`}
          >
            {effectiveOnline ? (
              <>
                <Wifi className="h-4 w-4 text-sage-600" />
                <span>Online (Connected)</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-amber-700 animate-pulse" />
                <span>Offline (Local Queue Active)</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSimulateOfflineMode((prev) => !prev)}
            className="px-3 py-1.5 rounded-control border border-border bg-surface-alt hover:bg-border/60 text-xs font-semibold transition-colors"
          >
            {simulateOfflineMode ? 'Disable Offline Sim' : 'Simulate Offline'}
          </button>

          {offlineQueue.length > 0 && (
            <Button
              variant="amber"
              size="sm"
              onClick={handleSyncBatch}
              disabled={isSyncing || !effectiveOnline}
              leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
            >
              Sync {offlineQueue.length} Pending
            </Button>
          )}
        </div>
      </header>

      {/* 2. DPDP Act 2023 Gate Privacy Notice Banner */}
      <div className="mb-6 rounded-surface border border-sage-300 bg-sage-50/60 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-sage-950">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-sage-700 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold text-sage-900">
              Gate Privacy Notice (Digital Personal Data Protection Act, 2023 Compliance):
            </strong>
            <p className="mt-0.5 text-sage-800">
              Visitor names, vehicle numbers, and facial photos captured at security terminals are stored strictly for
              residential safety and access validation. Under statutory compliance, all visitor photo records and physical
              disk files are permanently deleted after 90 days.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handlePurgePhotos}
          className="shrink-0 px-3 py-1.5 rounded-control bg-white border border-sage-300 text-sage-900 hover:bg-sage-100 font-semibold transition-colors inline-flex items-center gap-1.5 self-start sm:self-center"
        >
          <Trash2 className="h-3.5 w-3.5 text-sage-700" />
          Run 90-Day Purge Job
        </button>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div
          className={`mb-6 p-4 rounded-control border flex items-center justify-between text-sm ${
            statusMessage.type === 'success'
              ? 'bg-sage-50 border-sage-300 text-sage-900'
              : statusMessage.type === 'error'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-surface-alt border-border text-text-primary'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-sage-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-semibold text-text-muted hover:text-text-primary ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Main Navigation Mode Tabs with Large Touch Targets (min 52px) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('KEYPAD')}
          className={`min-h-[52px] px-4 py-3 rounded-surface font-bold text-sm flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${
            activeTab === 'KEYPAD'
              ? 'bg-sage-500 text-white border-sage-600 shadow-md'
              : 'bg-surface border-border text-text-secondary hover:bg-surface-alt'
          }`}
        >
          <KeyRound className="h-5 w-5" />
          <span>Pass PIN Keypad</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('REGISTER')}
          className={`min-h-[52px] px-4 py-3 rounded-surface font-bold text-sm flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${
            activeTab === 'REGISTER'
              ? 'bg-walnut-600 text-white border-walnut-700 shadow-md'
              : 'bg-surface border-border text-text-secondary hover:bg-surface-alt'
          }`}
        >
          <UserPlus className="h-5 w-5" />
          <span>Register Visitor</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('LOG')}
          className={`min-h-[52px] px-4 py-3 rounded-surface font-bold text-sm flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${
            activeTab === 'LOG'
              ? 'bg-amber-600 text-white border-amber-700 shadow-md'
              : 'bg-surface border-border text-text-secondary hover:bg-surface-alt'
          }`}
        >
          <Clock className="h-5 w-5" />
          <span>Active Gate Log ({visitors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('OFFLINE')}
          className={`min-h-[52px] px-4 py-3 rounded-surface font-bold text-sm flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${
            activeTab === 'OFFLINE'
              ? 'bg-walnut-800 text-white border-walnut-900 shadow-md'
              : 'bg-surface border-border text-text-secondary hover:bg-surface-alt'
          }`}
        >
          <RefreshCw className="h-5 w-5" />
          <span>Offline Queue ({offlineQueue.length})</span>
        </button>
      </div>

      {/* 4. Tab 1: Large Touch Keypad for 6-Digit Guest Code Verification */}
      {activeTab === 'KEYPAD' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 rounded-surface border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-walnut-900">Pre-Approved Guest Pass Keypad</h2>
                <p className="text-xs text-text-muted">
                  Ask guest for the 6-digit PIN generated by resident on their Nivasa app.
                </p>
              </div>
              <span className="text-xs font-semibold text-text-muted">6-Digit Code</span>
            </div>

            {/* PIN Display Field */}
            <div className="mb-6 flex items-center justify-center rounded-xl bg-canvas border-2 border-border h-16 px-4">
              <input
                aria-label="Guest pass 6-digit PIN"
                type="text"
                maxLength={6}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full text-center bg-transparent text-3xl font-mono font-bold tracking-[0.5em] text-walnut-900 focus:outline-none"
              />
            </div>

            {/* Numeric Keypad Grid with Large 60px Touch Targets */}
            <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-6">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="min-h-[60px] rounded-xl bg-surface-alt hover:bg-border/60 active:scale-95 text-2xl font-bold text-walnut-900 border border-border shadow-xs transition-all flex items-center justify-center"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleKeypadClear}
                className="min-h-[60px] rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-95 text-base font-bold text-amber-800 border border-amber-200 shadow-xs transition-all flex items-center justify-center"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="min-h-[60px] rounded-xl bg-surface-alt hover:bg-border/60 active:scale-95 text-2xl font-bold text-walnut-900 border border-border shadow-xs transition-all flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleKeypadVerify}
                disabled={pinCode.length !== 6 || isVerifyingKeypad}
                className="min-h-[60px] rounded-xl bg-sage-500 hover:bg-sage-600 disabled:opacity-50 active:scale-95 text-base font-bold text-white border border-sage-600 shadow-xs transition-all flex items-center justify-center"
              >
                Verify
              </button>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full min-h-[52px] text-base"
              onClick={handleKeypadVerify}
              disabled={pinCode.length !== 6 || isVerifyingKeypad}
              leftIcon={<KeyRound className="h-5 w-5" />}
            >
              Verify PIN & Check In Guest
            </Button>
          </div>

          {/* Keypad Result Card */}
          <div className="lg:col-span-5 rounded-surface border border-border bg-surface p-6 shadow-sm">
            <h3 className="text-base font-bold text-walnut-900 mb-3">Validation Result</h3>
            {keypadResult ? (
              <div
                className={`p-5 rounded-xl border text-sm ${
                  keypadResult.success
                    ? 'bg-sage-50 border-sage-300 text-sage-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-2 mb-2 font-bold text-base">
                  {keypadResult.success ? (
                    <>
                      <CheckCircle2 className="h-6 w-6 text-sage-600" />
                      <span>ACCESS GRANTED</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-6 w-6 text-amber-600" />
                      <span>ACCESS DENIED</span>
                    </>
                  )}
                </div>
                <p className="mb-3">{keypadResult.message}</p>
                {keypadResult.success && (
                  <div className="mt-4 pt-3 border-t border-sage-200 text-xs space-y-1">
                    <div>
                      Guest Name: <strong>{keypadResult.guestName}</strong>
                    </div>
                    <div>
                      Destination: <strong>Flat {keypadResult.flatInfo}</strong>
                    </div>
                    <div>
                      Gate Check-In: <strong>{new Date().toLocaleTimeString()}</strong>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-text-muted text-xs">
                <KeyRound className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Enter the 6-digit visitor pass PIN on the keypad to verify admission.</p>
                <p className="mt-1 text-[11px] text-text-secondary">
                  Example active demo PIN: <strong className="font-mono text-sage-800">842619</strong> (Neeraj Kulkarni's
                  flat guest)
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Tab 2: Register Visitor Form */}
      {activeTab === 'REGISTER' && (
        <div className="max-w-2xl mx-auto rounded-surface border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-bold text-walnut-900 mb-1">Gate Visitor Registration</h2>
          <p className="text-xs text-text-muted mb-6">
            Register arriving delivery agent, personal guest, or service contractor.
          </p>

          <form onSubmit={handleRegisterVisitor} className="space-y-4">
            {/* Destination Flat Selector */}
            <div>
              <label className="block text-xs font-bold text-walnut-900 uppercase tracking-wider mb-1">
                Destination Flat <span className="text-red-500">*</span>
              </label>
              <select
                aria-label="Destination Flat"
                value={formData.flatId}
                onChange={(e) => setFormData({ ...formData, flatId: e.target.value })}
                className="w-full min-h-[48px] rounded-control border border-border bg-canvas px-3 text-sm font-semibold text-walnut-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
              >
                {DEMO_FLATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    Tower {f.tower} • Flat {f.flatNumber} ({f.residentName})
                  </option>
                ))}
              </select>
            </div>

            {/* Visitor Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-walnut-900 uppercase tracking-wider mb-1">
                  Visitor Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.visitorName}
                  onChange={(e) => setFormData({ ...formData, visitorName: e.target.value })}
                  className="w-full min-h-[48px] rounded-control border border-border bg-canvas px-3 text-sm text-walnut-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-walnut-900 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="10-digit mobile"
                  value={formData.visitorPhone}
                  onChange={(e) => setFormData({ ...formData, visitorPhone: e.target.value })}
                  className="w-full min-h-[48px] rounded-control border border-border bg-canvas px-3 text-sm text-walnut-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>
            </div>

            {/* Purpose & Vehicle Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-walnut-900 uppercase tracking-wider mb-1">
                  Visit Purpose <span className="text-red-500">*</span>
                </label>
                <select
                  aria-label="Visit Purpose"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full min-h-[48px] rounded-control border border-border bg-canvas px-3 text-sm font-medium text-walnut-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                >
                  <option value="Amazon Delivery">Amazon / Flipkart Delivery</option>
                  <option value="Food Delivery">Swiggy / Zomato Delivery</option>
                  <option value="Grocery Delivery">Blinkit / Zepto / Milk</option>
                  <option value="Personal Guest">Personal Guest / Family</option>
                  <option value="Cab Driver">Uber / Ola Cab</option>
                  <option value="Maintenance / Repair">Plumber / Electrician / Carpenter</option>
                  <option value="Other Service">Other Service Provider</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-walnut-900 uppercase tracking-wider mb-1">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. MH-02-CD-5678"
                  value={formData.vehicleNumber}
                  onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                  className="w-full min-h-[48px] rounded-control border border-border bg-canvas px-3 text-sm text-walnut-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>
            </div>

            {/* Photo Capture Simulation */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-walnut-900 uppercase tracking-wider mb-1">
                Gate Photo Capture (90-Day Retention)
              </label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  className="min-h-[48px] px-4 rounded-control border border-border bg-surface-alt hover:bg-border/60 text-xs font-bold inline-flex items-center gap-2 transition-colors"
                >
                  <Camera className="h-4 w-4 text-walnut-700" />
                  {capturedPhoto ? 'Re-take Gate Photo' : 'Capture Visitor Photo'}
                </button>
                {capturedPhoto && (
                  <div className="flex items-center gap-2">
                    <img
                      src={capturedPhoto}
                      alt="Captured Gate Photo"
                      className="h-12 w-12 rounded-lg border border-border object-cover"
                    />
                    <span className="text-xs text-sage-800 font-medium">Photo attached</span>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button with Large 52px Target */}
            <div className="pt-4">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full min-h-[52px] text-base font-bold"
                disabled={isSubmittingForm}
                onClick={handleRegisterVisitor}
                leftIcon={<UserPlus className="h-5 w-5" />}
              >
                Register & Check In Visitor
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 6. Tab 3: Active Gate Log & Departure Management */}
      {activeTab === 'LOG' && (
        <div className="rounded-surface border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-walnut-900">Today's Society Gate Entries</h2>
              <p className="text-xs text-text-muted">
                Audit log of all registered visitors. Tap "Check Out" upon gate exit.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchGateVisitors}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh Log
            </Button>
          </div>

          <div className="space-y-3">
            {visitors.length > 0 ? (
              visitors.map((v) => (
                <div
                  key={v.id}
                  className="p-4 rounded-xl border border-border bg-canvas flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-walnut-400"
                >
                  <div className="flex items-center gap-4">
                    {/* Photo / Avatar */}
                    <div className="h-12 w-12 rounded-xl bg-sage-100 border border-sage-300 flex items-center justify-center font-bold text-sage-900 shrink-0">
                      {v.visitorName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-walnut-900">{v.visitorName}</span>
                        <StatusBadge
                          variant={v.entryStatus === 'CHECKED_IN' ? 'paid' : 'neutral'}
                          label={v.entryStatus === 'CHECKED_IN' ? 'Inside Society' : 'Departed'}
                        />
                        <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-text-secondary border border-border">
                          {v.approvalStatus}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-muted mt-1 flex-wrap">
                        <span>
                          Destination: <strong className="text-text-primary">Flat {v.tower}-{v.flatNumber}</strong> ({v.residentName})
                        </span>
                        <span>•</span>
                        <span>Purpose: {v.purpose}</span>
                        {v.vehicleNumber && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <Car className="h-3 w-3" /> {v.vehicleNumber}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span>Arrived: {v.arrivedAt ? new Date(v.arrivedAt).toLocaleTimeString() : 'Pending'}</span>
                        {v.departedAt && (
                          <span>• Departed: {new Date(v.departedAt).toLocaleTimeString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-start md:self-center">
                    {v.entryStatus === 'CHECKED_IN' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => handleCheckOut(v.id)}
                        leftIcon={<LogOut className="h-4 w-4" />}
                      >
                        Check Out
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-text-muted text-xs">
                No visitor activity recorded for today yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Tab 4: Offline Queue Management */}
      {activeTab === 'OFFLINE' && (
        <div className="rounded-surface border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-walnut-900">Local Offline Queue</h2>
              <p className="text-xs text-text-muted">
                Entries recorded on tablet while offline. Preserves original local timestamps and syncs automatically.
              </p>
            </div>
            {offlineQueue.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSyncBatch}
                disabled={isSyncing || !effectiveOnline}
                leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
              >
                Sync All Now
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {offlineQueue.length > 0 ? (
              offlineQueue.map((item, idx) => (
                <div
                  key={item.clientUuid || idx}
                  className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex items-center justify-between gap-4 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <strong className="text-sm font-bold text-walnut-900">{item.visitorName}</strong>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                        {item.syncStatus}
                      </span>
                    </div>
                    <div className="text-text-muted space-x-2">
                      <span>Destination Flat: {item.flatId}</span>
                      <span>•</span>
                      <span>Purpose: {item.purpose}</span>
                      <span>•</span>
                      <span>Recorded Locally: {new Date(item.recordedAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-text-muted">{item.clientUuid.slice(0, 8)}...</span>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-text-muted text-xs">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-sage-600" />
                <p>Offline queue is empty. All gate visitor records are fully synchronized with society servers.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default GuardTabletPage;
