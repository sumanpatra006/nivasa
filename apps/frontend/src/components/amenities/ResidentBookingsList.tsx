import React from 'react';
import { CalendarCheck, Clock, XCircle } from 'lucide-react';
import { Button } from '../ui/Button.js';
import { StatusBadge } from '../ui/StatusBadge.js';
import { ApiAmenityBooking } from '../../services/api.js';

interface ResidentBookingsListProps {
  bookings: ApiAmenityBooking[];
  onCancelBooking: (bookingId: string) => void;
}

export function ResidentBookingsList({ bookings, onCancelBooking }: ResidentBookingsListProps) {
  if (bookings.length === 0) {
    return (
      <div className="py-8 text-center text-text-muted text-xs border border-dashed rounded-control bg-surface/50">
        <CalendarCheck className="h-7 w-7 text-sage-400 mx-auto mb-2 opacity-60" />
        No active or past amenity bookings for your flat.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border border rounded-surface overflow-hidden bg-surface">
      {bookings.map((b) => {
        const startDate = new Date(b.startAt);
        const dateStr = startDate.toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        const timeStr = `${startDate.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })} - ${new Date(b.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        return (
          <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-walnut-900 text-sm">{b.amenityName}</span>
                <StatusBadge
                  variant={b.status === 'CONFIRMED' ? 'success' : 'neutral'}
                  label={b.status}
                />
              </div>
              <p className="text-text-muted mt-0.5 flex items-center gap-2 text-[11px]">
                <span>{dateStr}</span>
                <span>•</span>
                <span>{timeStr}</span>
                <span>•</span>
                <span>Flat {b.flatId}</span>
              </p>
            </div>

            {b.status === 'CONFIRMED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCancelBooking(b.id)}
                className="text-xs py-1 px-3 text-red-700 hover:bg-red-50 border-border self-start sm:self-center"
                leftIcon={<XCircle className="h-3.5 w-3.5" />}
              >
                Cancel Booking
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
