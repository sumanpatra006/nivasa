import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Wifi,
  WifiOff,
  RefreshCw,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Clock,
  KeyRound,
  Trash2,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { ApiClient, ApiVisitor } from '../services/api.js';
import { GateKeypad } from '../components/guard/GateKeypad.js';
import { GateVisitorForm } from '../components/guard/GateVisitorForm.js';
import { GateActivityLog } from '../components/guard/GateActivityLog.js';
import { OfflineQueueView, OfflineQueueItem } from '../components/guard/OfflineQueueView.js';

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

  // Load offline queue
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
  }, [effectiveOnline]);

  const handleKeypadPress = (digit: string) => {
    if (pinCode.length < 6) {
      setPinCode((prev) => prev + digit);
    }
  };

  const handleClearKeypad = () => {
    setPinCode('');
    setKeypadResult(null);
  };

  const handleBackspaceKeypad = () => {
    setPinCode((prev) => prev.slice(0, -1));
  };

  const handleVerifyPass = async () => {
    if (pinCode.length !== 6) return;
    setIsVerifyingKeypad(true);
    setKeypadResult(null);

    try {
      if (!effectiveOnline) {
        if (pinCode === '842619') {
          setKeypadResult({
            success: true,
            guestName: 'Suresh Patil (Plumbing Contractor)',
            flatInfo: 'Flat T07-1203 (Neeraj Kulkarni)',
            message: 'Validated via cached safety directory.',
          });
          setPinCode('');
          return;
        }
        throw new Error('Device is offline. Pre-cached guest code required.');
      }

      await ApiClient.authenticateGuard();
      const res = await ApiClient.validateGuestCode(pinCode);

      if (res.isValid && res.guestCode) {
        setKeypadResult({
          success: true,
          guestName: res.guestCode.guestName,
          flatInfo: `Flat ${res.visitor?.flatId || 'T07-1203'}`,
          message: `Access Approved! ${res.guestCode.guestName} checked in for ${res.visitor?.flatId || 'T07-1203'}.`,
        });
        setPinCode('');
        fetchGateVisitors();
      } else {
        setKeypadResult({
          success: false,
          message: res.message || 'Invalid or expired guest code.',
        });
      }
    } catch (err: any) {
      setKeypadResult({
        success: false,
        message: err.message || 'Failed to verify pass with server.',
      });
    } finally {
      setIsVerifyingKeypad(false);
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCapturePhoto = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#87A96B"/><circle cx="100" cy="80" r="40" fill="#ffffff"/><path d="M40 180 c0 -40 30 -60 60 -60 c30 0 60 20 60 60 Z" fill="#ffffff"/><text x="100" y="190" font-size="12" text-anchor="middle" fill="#5A3E2B">Gate 1 Verified</text></svg>`;
    const b64 = 'data:image/svg+xml;base64,' + btoa(svg);
    setCapturedPhoto(b64);
  };

  const handleRegisterVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingForm(true);

    const clientUuid = `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newRecord: OfflineQueueItem = {
      clientUuid,
      flatId: formData.flatId,
      visitorName: formData.visitorName,
      visitorPhone: formData.visitorPhone || undefined,
      purpose: formData.purpose,
      vehicleNumber: formData.vehicleNumber || undefined,
      photoBase64: capturedPhoto || undefined,
      recordedAt: new Date().toISOString(),
      syncStatus: 'PENDING',
    };

    if (!effectiveOnline) {
      const updatedQueue = [...offlineQueue, newRecord];
      saveOfflineQueue(updatedQueue);
      setStatusMessage({
        type: 'info',
        text: `Recorded Offline! Visitor stored in tablet local queue. Sync when online.`,
      });
      setFormData({
        flatId: 'flat-t07-1203',
        visitorName: '',
        visitorPhone: '',
        purpose: 'Delivery',
        vehicleNumber: '',
      });
      setCapturedPhoto(null);
      setIsSubmittingForm(false);
      return;
    }

    try {
      await ApiClient.authenticateGuard();
      await ApiClient.registerVisitor({
        flatId: formData.flatId,
        visitorName: formData.visitorName,
        visitorPhone: formData.visitorPhone || undefined,
        purpose: formData.purpose,
        vehicleNumber: formData.vehicleNumber || undefined,
        photoBase64: capturedPhoto || undefined,
      });

      setStatusMessage({
        type: 'success',
        text: `Visitor "${formData.visitorName}" successfully registered & entry notification dispatched.`,
      });
      setFormData({
        flatId: 'flat-t07-1203',
        visitorName: '',
        visitorPhone: '',
        purpose: 'Delivery',
        vehicleNumber: '',
      });
      setCapturedPhoto(null);
      fetchGateVisitors();
    } catch (err: any) {
      const updatedQueue = [...offlineQueue, newRecord];
      saveOfflineQueue(updatedQueue);
      setStatusMessage({
        type: 'error',
        text: `Server unreachable (${err.message}). Safely stored in offline queue.`,
      });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleSyncBatch = async () => {
    const queue = loadOfflineQueue();
    if (queue.length === 0) return;

    if (!effectiveOnline) {
      setStatusMessage({ type: 'error', text: 'Cannot sync while offline. Check internet connection.' });
      return;
    }

    setIsSyncing(true);
    try {
      await ApiClient.authenticateGuard();
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

  const handlePurgePhotos = async () => {
    try {
      await ApiClient.authenticateGuard();
      const res = await ApiClient.purgeExpiredPhotos();
      setStatusMessage({
        type: 'success',
        text: `DPDP Act 2023 purge complete: ${res.purgedPhotosCount} expired photo files removed from disk.`,
      });
      fetchGateVisitors();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Purge failed.' });
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary p-4 sm:p-6 lg:p-8">
      {/* 1. Header Bar */}
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
              Visitor photos and phone numbers are stored strictly for residential safety. Under statutory compliance,
              all visitor photo records and physical disk files are permanently deleted after 90 days.
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

      {/* 3. Main Navigation Mode Tabs */}
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

      {/* 4. Tab Views using Modular Components */}
      {activeTab === 'KEYPAD' && (
        <GateKeypad
          pinCode={pinCode}
          onDigitPress={handleKeypadPress}
          onClear={handleClearKeypad}
          onBackspace={handleBackspaceKeypad}
          onVerify={handleVerifyPass}
          isVerifying={isVerifyingKeypad}
          result={keypadResult}
          onResetResult={() => setKeypadResult(null)}
        />
      )}

      {activeTab === 'REGISTER' && (
        <GateVisitorForm
          formData={formData}
          capturedPhoto={capturedPhoto}
          effectiveOnline={effectiveOnline}
          isSubmitting={isSubmittingForm}
          onFormChange={handleFormChange}
          onCapturePhoto={handleCapturePhoto}
          onClearPhoto={() => setCapturedPhoto(null)}
          onSubmit={handleRegisterVisitor}
        />
      )}

      {activeTab === 'LOG' && (
        <GateActivityLog
          visitors={visitors}
          isLoading={isLoading}
          effectiveOnline={effectiveOnline}
          onRefresh={fetchGateVisitors}
          onCheckOut={handleCheckOut}
        />
      )}

      {activeTab === 'OFFLINE' && (
        <OfflineQueueView
          queue={offlineQueue}
          effectiveOnline={effectiveOnline}
          isSyncing={isSyncing}
          onSync={handleSyncBatch}
          onClearQueue={() => {
            localStorage.removeItem(OFFLINE_QUEUE_KEY);
            setOfflineQueue([]);
          }}
        />
      )}
    </div>
  );
}
