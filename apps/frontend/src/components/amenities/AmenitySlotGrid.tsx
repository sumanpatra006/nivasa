import React from 'react';
import { Clock, CalendarCheck } from 'lucide-react';
import { ApiAmenitySlot } from '../../services/api.js';

interface AmenitySlotGridProps {
  slots: ApiAmenitySlot[];
  isLoading: boolean;
  selectedSlot: ApiAmenitySlot | null;
  onSelectSlot: (slot: ApiAmenitySlot) => void;
}

export function AmenitySlotGrid({
  slots,
  isLoading,
  selectedSlot,
  onSelectSlot,
}: AmenitySlotGridProps) {
  if (isLoading) {
    return (
      <div className="py-12 text-center text-text-muted text-xs">
        <Clock className="h-6 w-6 animate-spin mx-auto mb-2 text-sage-600" />
        Checking slot availability...
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="py-8 text-center text-text-muted text-xs border border-dashed rounded-control">
        No booking slots scheduled for this date.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
      {slots.map((slot) => {
        const isSelected = selectedSlot?.startAt === slot.startAt;
        const isOccupied = !slot.isAvailable;

        return (
          <button
            key={slot.startAt}
            type="button"
            disabled={isOccupied}
            onClick={() => onSelectSlot(slot)}
            className={`p-3 rounded-control border text-left text-xs transition-all ${
              isOccupied
                ? 'bg-surface-alt/70 border-border text-text-muted opacity-60 cursor-not-allowed'
                : isSelected
                ? 'bg-sage-600 text-white border-sage-700 shadow-sm'
                : 'bg-surface border-border hover:border-sage-400 hover:bg-sage-50/40 text-walnut-900'
            }`}
          >
            <span className="font-bold block text-xs">{slot.label}</span>
            <span
              className={`text-[10px] block mt-1 font-semibold ${
                isSelected ? 'text-white/90' : isOccupied ? 'text-text-muted' : 'text-sage-700'
              }`}
            >
              {isOccupied ? 'Occupied' : 'Available'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

