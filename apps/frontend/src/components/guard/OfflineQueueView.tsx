import React from 'react';
import { RefreshCw, Wifi, WifiOff, Clock, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button.js';

export interface OfflineQueueItem {
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

interface OfflineQueueViewProps {
  queue: OfflineQueueItem[];
  effectiveOnline: boolean;
  isSyncing: boolean;
  onSync: () => void;
  onClearQueue: () => void;
}

export function OfflineQueueView({
  queue,
  effectiveOnline,
  isSyncing,
  onSync,
  onClearQueue,
}: OfflineQueueViewProps) {
  return (
    <div className="rounded-surface border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold text-walnut-900">Local Offline Queue Manager</h2>
          <p className="text-xs text-text-muted">
            Visitor entries saved to tablet device storage while connectivity is degraded.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearQueue}
              leftIcon={<Trash2 className="h-3.5 w-3.5 text-red-600" />}
              className="text-red-700 hover:bg-red-50"
            >
              Clear Queue
            </Button>
          )}
          <Button
            variant="amber"
            size="sm"
            onClick={onSync}
            isLoading={isSyncing}
            disabled={queue.length === 0 || !effectiveOnline}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Sync {queue.length} Records Now
          </Button>
        </div>
      </div>

      {!effectiveOnline && (
        <div className="mb-4 rounded-control bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900 flex items-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-700" />
          <span>Tablet is offline. Reconnect or disable offline simulation to synchronize with the server.</span>
        </div>
      )}

      {queue.length === 0 ? (
        <div className="py-12 text-center text-text-muted">
          <RefreshCw className="h-8 w-8 text-sage-400 mx-auto mb-2 opacity-50" />
          <h4 className="font-semibold text-walnut-900 text-sm">Offline Queue is Clean</h4>
          <p className="text-xs mt-1">All gate registrations are confirmed and synchronized with society servers.</p>
        </div>
      ) : (
        <div className="divide-y divide-border border rounded-xl overflow-hidden">
          {queue.map((item) => (
            <div key={item.clientUuid} className="p-4 flex items-center justify-between gap-3 text-xs bg-surface hover:bg-surface-alt/40 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-walnut-900">{item.visitorName}</span>
                  <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[10px] font-semibold text-text-muted border border-border">
                    {item.purpose}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Destination: Flat {item.flatId} • Recorded: {new Date(item.recordedAt).toLocaleTimeString()}
                </p>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 border border-amber-200">
                PENDING SYNC
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

