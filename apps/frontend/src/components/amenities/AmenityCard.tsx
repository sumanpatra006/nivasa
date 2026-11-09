import React from 'react';
import { Users, Clock, Sparkles } from 'lucide-react';
import { ApiAmenity } from '../../services/api.js';
import { formatPaiseToINR } from '@nivasa/shared';

interface AmenityCardProps {
  amenity: ApiAmenity;
  isSelected: boolean;
  onSelect: (amenity: ApiAmenity) => void;
}

export function AmenityCard({ amenity, isSelected, onSelect }: AmenityCardProps) {
  return (
    <div
      onClick={() => onSelect(amenity)}
      className={`p-4 rounded-surface border cursor-pointer transition-all ${
        isSelected
          ? 'bg-sage-50/70 border-sage-500 shadow-sm ring-1 ring-sage-500'
          : 'bg-surface border-border hover:border-sage-300 hover:bg-surface-alt/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-bold text-walnut-900 text-sm">{amenity.name}</h3>
        <span className="text-[11px] font-semibold text-sage-800 bg-sage-50 px-2 py-0.5 rounded-full border border-sage-200 shrink-0">
          {amenity.feePaise === 0 ? 'Free' : formatPaiseToINR(amenity.feePaise)}
        </span>
      </div>

      <p className="text-xs text-text-secondary line-clamp-2 mb-3">{amenity.description}</p>

      <div className="flex items-center gap-3 text-[11px] text-text-muted">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-sage-600" /> Max {amenity.capacity}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-sage-600" /> {amenity.slotDurationMinutes} min slots
        </span>
      </div>
    </div>
  );
}

