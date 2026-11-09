import React from 'react';
import { Camera, UserPlus, Phone, Car, Building } from 'lucide-react';
import { Button } from '../ui/Button.js';
import { DEMO_FLATS } from '../../fixtures/uiData.js';

interface GateVisitorFormProps {
  formData: {
    flatId: string;
    visitorName: string;
    visitorPhone: string;
    purpose: string;
    vehicleNumber: string;
  };
  capturedPhoto: string | null;
  effectiveOnline: boolean;
  isSubmitting: boolean;
  onFormChange: (field: string, value: string) => void;
  onCapturePhoto: () => void;
  onClearPhoto: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function GateVisitorForm({
  formData,
  capturedPhoto,
  effectiveOnline,
  isSubmitting,
  onFormChange,
  onCapturePhoto,
  onClearPhoto,
  onSubmit,
}: GateVisitorFormProps) {
  return (
    <div className="max-w-3xl mx-auto rounded-surface border border-border bg-surface p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold text-walnut-900">Walk-in Visitor Registration</h2>
          <p className="text-xs text-text-muted">
            For couriers, service vendors, and unscheduled visitors.
          </p>
        </div>
        {!effectiveOnline && (
          <span className="text-xs bg-amber-50 text-amber-900 font-bold px-3 py-1 rounded-full border border-amber-300">
            Local Offline Storage Active
          </span>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Flat Destination */}
          <div>
            <label className="block text-xs font-bold text-text-primary mb-1.5 flex items-center gap-1.5">
              <Building className="h-4 w-4 text-walnut-700" /> Destination Flat *
            </label>
            <select
              aria-label="Destination Flat"
              value={formData.flatId}
              onChange={(e) => onFormChange('flatId', e.target.value)}
              className="w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-walnut-900 focus:outline-none focus:border-sage-500"
            >
              {DEMO_FLATS.map((f) => (
                <option key={f.id} value={f.id}>
                  Tower {f.tower} • Flat {f.flatNumber} ({f.residentName})
                </option>
              ))}
            </select>
          </div>

          {/* Purpose of Visit */}
          <div>
            <label className="block text-xs font-bold text-text-primary mb-1.5">Purpose of Visit *</label>
            <select
              aria-label="Purpose of Visit"
              value={formData.purpose}
              onChange={(e) => onFormChange('purpose', e.target.value)}
              className="w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-walnut-900 focus:outline-none focus:border-sage-500"
            >
              <option value="Delivery">E-Commerce / Food Delivery</option>
              <option value="Guest">Social Guest / Relative</option>
              <option value="Service">Repair / Technician / Maid</option>
              <option value="Cab">Taxi / Cab Pickup</option>
              <option value="Official">Government / Official Verification</option>
            </select>
          </div>

          {/* Visitor Name */}
          <div>
            <label className="block text-xs font-bold text-text-primary mb-1.5">Visitor Full Name *</label>
            <input
              type="text"
              required
              value={formData.visitorName}
              onChange={(e) => onFormChange('visitorName', e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className="w-full rounded-control border border-border px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-sage-500"
            />
          </div>

          {/* Visitor Phone */}
          <div>
            <label className="block text-xs font-bold text-text-primary mb-1.5 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-text-muted" /> Mobile Number
            </label>
            <input
              type="tel"
              maxLength={10}
              value={formData.visitorPhone}
              onChange={(e) => onFormChange('visitorPhone', e.target.value)}
              placeholder="e.g. 9811122233"
              className="w-full rounded-control border border-border px-3 py-2.5 text-sm font-mono text-text-primary focus:outline-none focus:border-sage-500"
            />
          </div>

          {/* Vehicle Number */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-text-primary mb-1.5 flex items-center gap-1.5">
              <Car className="h-3.5 w-3.5 text-text-muted" /> Vehicle Registration Number (Optional)
            </label>
            <input
              type="text"
              value={formData.vehicleNumber}
              onChange={(e) => onFormChange('vehicleNumber', e.target.value.toUpperCase())}
              placeholder="MH 12 AB 1234"
              className="w-full rounded-control border border-border px-3 py-2.5 text-sm font-mono text-text-primary focus:outline-none focus:border-sage-500"
            />
          </div>
        </div>

        {/* Photo Capture Section */}
        <div className="rounded-xl border border-border bg-surface-alt p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {capturedPhoto ? (
                <img
                  src={capturedPhoto}
                  alt="Visitor preview"
                  className="h-16 w-16 rounded-xl object-cover border-2 border-sage-500"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-surface border border-dashed border-border flex items-center justify-center text-text-muted">
                  <Camera className="h-6 w-6" />
                </div>
              )}
              <div>
                <h4 className="text-xs font-bold text-walnut-900">Security Gate Camera Photo</h4>
                <p className="text-[11px] text-text-muted">
                  Captured photos are automatically purged after 90 days per DPDP Act compliance.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCapturePhoto}
                leftIcon={<Camera className="h-4 w-4" />}
              >
                {capturedPhoto ? 'Retake Photo' : 'Capture Photo'}
              </Button>
              {capturedPhoto && (
                <button
                  type="button"
                  onClick={onClearPhoto}
                  className="text-xs text-text-muted hover:text-red-700 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            className="w-full sm:w-auto min-w-[200px]"
            leftIcon={<UserPlus className="h-5 w-5 mr-1" />}
          >
            Register & Check In Visitor
          </Button>
        </div>
      </form>
    </div>
  );
}
