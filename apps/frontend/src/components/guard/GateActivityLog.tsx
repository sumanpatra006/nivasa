import React from 'react';
import { Clock, LogOut, Camera, ShieldCheck, UserCheck } from 'lucide-react';
import { Button } from '../ui/Button.js';
import { StatusBadge } from '../ui/StatusBadge.js';
import { ApiVisitor } from '../../services/api.js';

interface GateActivityLogProps {
  visitors: ApiVisitor[];
  isLoading: boolean;
  effectiveOnline: boolean;
  onRefresh: () => void;
  onCheckOut: (visitorId: string) => void;
}

export function GateActivityLog({
  visitors,
  isLoading,
  effectiveOnline,
  onRefresh,
  onCheckOut,
}: GateActivityLogProps) {
  return (
    <div className="rounded-surface border border-border bg-surface shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-walnut-900">Active Gate Activity Log</h2>
          <p className="text-xs text-text-muted">
            All registered entries and departures at security checkpoints.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} isLoading={isLoading}>
          Refresh Log
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-alt border-b border-border font-semibold text-text-secondary uppercase tracking-wider text-[11px]">
            <tr>
              <th className="px-4 py-3">Photo & Visitor</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Purpose</th>
              <th className="px-4 py-3">Arrival Time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-medium">
            {visitors.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  No gate visitor activity recorded yet today.
                </td>
              </tr>
            ) : (
              visitors.map((v) => {
                const arrivedTime = v.arrivedAt
                  ? new Date(v.arrivedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Just now';
                const departedTime = v.departedAt
                  ? new Date(v.departedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : null;

                return (
                  <tr key={v.id} className="hover:bg-surface-alt/50 transition-colors">
                    <td className="px-4 py-3 flex items-center gap-2.5">
                      {v.visitorPhotoKey ? (
                        <img
                          src={
                            v.visitorPhotoKey.startsWith('http') || v.visitorPhotoKey.startsWith('data:')
                              ? v.visitorPhotoKey
                              : `/api/v1/visitors/photos/${v.visitorPhotoKey}`
                          }
                          alt={v.visitorName}
                          className="h-9 w-9 rounded-full object-cover border border-border"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-sage-50 text-sage-700 flex items-center justify-center font-bold text-xs border border-sage-200">
                          {v.visitorName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-walnut-900 block">{v.visitorName}</span>
                        {v.vehicleNumber && (
                          <span className="font-mono text-[10px] text-text-muted block">
                            {v.vehicleNumber}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-walnut-900">
                      {v.flatId.includes('1203')
                        ? 'T07-1203'
                        : v.flatId.includes('0408')
                        ? 'T12-0408'
                        : 'T21-1601'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{v.purpose}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-text-muted">
                      {arrivedTime}
                      {departedTime && <span className="block text-[10px]">Left: {departedTime}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        variant={
                          v.approvalStatus === 'APPROVED'
                            ? 'success'
                            : v.approvalStatus === 'DENIED'
                            ? 'danger'
                            : 'pending'
                        }
                        label={v.approvalStatus}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!v.departedAt ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs py-1 px-2.5"
                          onClick={() => onCheckOut(v.id)}
                          disabled={!effectiveOnline}
                          leftIcon={<LogOut className="h-3.5 w-3.5" />}
                        >
                          Mark Departed
                        </Button>
                      ) : (
                        <span className="text-[11px] font-semibold text-text-muted">Checked Out</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
