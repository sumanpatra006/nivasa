import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  Info,
  CalendarCheck,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { Modal } from '../components/ui/Modal.js';
import { ApiClient, ApiAmenity, ApiAmenitySlot, ApiAmenityBooking } from '../services/api.js';
import { DemoFlat } from '../fixtures/uiData.js';
import { formatPaiseToINR } from '@nivasa/shared';

export function ResidentAmenitiesPage() {
  const { currentFlat } = useOutletContext<{ currentFlat: DemoFlat }>();

  const [amenities, setAmenities] = useState<ApiAmenity[]>([]);
  const [selectedAmenity, setSelectedAmenity] = useState<ApiAmenity | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Tomorrow by default
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [slots, setSlots] = useState<ApiAmenitySlot[]>([]);
  const [bookings, setBookings] = useState<ApiAmenityBooking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSlotsLoading, setIsSlotsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Booking Modal
  const [selectedSlot, setSelectedSlot] = useState<ApiAmenitySlot | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchAmenitiesAndBookings = async () => {
    try {
      setIsLoading(true);
      await ApiClient.authenticateResident(currentFlat.phone);
      const [amenRes, bookRes] = await Promise.all([
        ApiClient.getAmenities(),
        ApiClient.getAmenityBookings(currentFlat.id),
      ]);
      setAmenities(amenRes.amenities);
      if (!selectedAmenity && amenRes.amenities.length > 0) {
        setSelectedAmenity(amenRes.amenities[0]);
      }
      setBookings(bookRes.bookings);
    } catch (err: any) {
      console.warn('Could not load amenities:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSlots = async (amenityId: string, date: string) => {
    try {
      setIsSlotsLoading(true);
      await ApiClient.authenticateResident(currentFlat.phone);
      const res = await ApiClient.getAmenitySlots(amenityId, date);
      setSlots(res.slots);
    } catch (err: any) {
      console.warn('Could not load slots:', err.message);
    } finally {
      setIsSlotsLoading(false);
    }
  };

  useEffect(() => {
    fetchAmenitiesAndBookings();
  }, [currentFlat.id]);

  useEffect(() => {
    if (selectedAmenity) {
      fetchSlots(selectedAmenity.id, selectedDate);
    }
  }, [selectedAmenity?.id, selectedDate]);

  const handleBookSlot = async () => {
    if (!selectedSlot || !selectedAmenity) return;

    setIsSubmitting(true);
    try {
      await ApiClient.authenticateResident(currentFlat.phone);
      await ApiClient.bookAmenity(selectedAmenity.id, {
        flatId: currentFlat.id,
        startAt: selectedSlot.startAt,
        endAt: selectedSlot.endAt,
      });

      setStatusMessage({
        type: 'success',
        text: `Slot booked successfully for ${selectedAmenity.name} (${selectedSlot.label}).`,
      });
      setIsBookingModalOpen(false);
      setSelectedSlot(null);
      fetchAmenitiesAndBookings();
      fetchSlots(selectedAmenity.id, selectedDate);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Slot booking failed. The window may have been taken.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await ApiClient.authenticateResident(currentFlat.phone);
      await ApiClient.cancelAmenityBooking(bookingId);
      setStatusMessage({
        type: 'success',
        text: 'Booking cancelled. The slot has been freed for other residents.',
      });
      fetchAmenitiesAndBookings();
      if (selectedAmenity) {
        fetchSlots(selectedAmenity.id, selectedDate);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Cancellation failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-walnut-900">
            Society Amenities & Slot Booking
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Reserve community facilities with non-overlapping slot management.
          </p>
        </div>

        {/* Demo Fees Disclaimer Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-[11px] font-semibold text-amber-900">
          <Info className="h-3.5 w-3.5 text-amber-700 shrink-0" />
          <span>Non-Statutory Demo Fees & Rules</span>
        </div>
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

      {/* Amenity Picker Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {amenities.map((amenity) => {
          const isSelected = selectedAmenity?.id === amenity.id;
          return (
            <button
              type="button"
              key={amenity.id}
              onClick={() => setSelectedAmenity(amenity)}
              className={`text-left p-4 rounded-surface border transition-all ${
                isSelected
                  ? 'border-sage-500 bg-sage-50/40 shadow-sm ring-1 ring-sage-500'
                  : 'border-border bg-surface hover:border-walnut-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-walnut-900">{amenity.name}</span>
                <span className="font-bold text-xs text-sage-800">
                  {amenity.feePaise === 0 ? 'Complimentary' : `${formatPaiseToINR(amenity.feePaise)}/slot`}
                </span>
              </div>
              <p className="text-xs text-text-secondary line-clamp-2 mb-3">{amenity.description}</p>
              <div className="flex items-center justify-between text-[11px] text-text-muted pt-2 border-t border-border/60">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> Max {amenity.capacity} people
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {amenity.openTime} – {amenity.closeTime}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Amenity Slot Availability & Booking Grid */}
      {selectedAmenity && (
        <div className="rounded-surface border border-border bg-surface p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-walnut-900">{selectedAmenity.name}</h3>
                <span className="text-xs font-semibold text-sage-800">
                  {selectedAmenity.feePaise === 0 ? 'Free' : formatPaiseToINR(selectedAmenity.feePaise)}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">Rules: {selectedAmenity.rules}</p>
            </div>

            {/* Date Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="slot-date-picker" className="text-xs font-bold text-walnut-900">Date:</label>
              <input
                id="slot-date-picker"
                type="date"
                value={selectedDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-control border border-border bg-canvas px-3 py-1.5 text-xs font-semibold text-walnut-900 focus:outline-none focus:ring-1 focus:ring-sage-500"
              />
            </div>
          </div>

          {/* Slots Grid */}
          <div className="mt-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">
              Available Slots for {new Date(selectedDate).toDateString()}
            </h4>

            {isSlotsLoading ? (
              <div className="text-center py-10 text-xs text-text-muted">Loading available slots...</div>
            ) : slots.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {slots.map((slot) => {
                  return (
                    <button
                      type="button"
                      key={slot.id}
                      disabled={!slot.isAvailable}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setIsBookingModalOpen(true);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        slot.isAvailable
                          ? 'border-sage-200 bg-sage-50/50 hover:border-sage-500 hover:bg-sage-100/50 active:scale-95 cursor-pointer'
                          : 'border-border bg-surface-alt/70 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-walnut-900">{slot.label}</span>
                        {slot.isAvailable ? (
                          <span className="h-2 w-2 rounded-full bg-sage-500"></span>
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                        )}
                      </div>
                      <div className="text-[11px] text-text-muted flex items-center justify-between">
                        <span>{slot.isAvailable ? 'Available' : 'Booked'}</span>
                        <span className="font-bold text-sage-800">
                          {slot.feePaise === 0 ? 'Free' : formatPaiseToINR(slot.feePaise)}
                        </span>
                      </div>
                      {slot.bookedByFlat && (
                        <span className="text-[10px] text-text-muted block mt-1">Flat: {slot.bookedByFlat}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-text-muted">
                No slots configured for this facility today.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flat's Booking History */}
      <div className="rounded-surface border border-border bg-surface p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-walnut-600" />
            <h3 className="text-sm font-bold text-walnut-900">
              Bookings for Flat {currentFlat.tower}-{currentFlat.flatNumber}
            </h3>
          </div>
          <span className="text-xs text-text-muted">{bookings.length} reservations</span>
        </div>

        <div className="space-y-3">
          {bookings.length > 0 ? (
            bookings.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-xl border border-border bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-walnut-900">{b.amenityName}</span>
                    <StatusBadge
                      variant={b.status === 'CONFIRMED' ? 'paid' : 'overdue'}
                      label={b.status}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                    <span>
                      Window: {new Date(b.startAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} –{' '}
                      {new Date(b.endAt).toLocaleTimeString([], { timeStyle: 'short' })}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-text-primary">
                      Fee: {b.feePaise === 0 ? 'Complimentary' : formatPaiseToINR(b.feePaise)}
                    </span>
                  </div>
                </div>

                {/* Cancel Booking Action */}
                {b.status === 'CONFIRMED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancelBooking(b.id)}
                    leftIcon={<XCircle className="h-3.5 w-3.5" />}
                  >
                    Cancel Booking
                  </Button>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-xs text-text-muted">
              No facility bookings found for your flat.
            </div>
          )}
        </div>
      </div>

      {/* Booking Confirmation Modal */}
      <Modal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        title="Confirm Facility Booking"
      >
        {selectedSlot && selectedAmenity && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-sage-50 border border-sage-300 text-xs text-sage-950 space-y-1.5">
              <div className="flex justify-between">
                <span>Facility:</span>
                <strong className="text-sage-900">{selectedAmenity.name}</strong>
              </div>
              <div className="flex justify-between">
                <span>Slot Window:</span>
                <strong className="text-sage-900">
                  {new Date(selectedSlot.date).toDateString()} • {selectedSlot.label}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Flat Account:</span>
                <strong className="text-sage-900">
                  Tower {currentFlat.tower} - {currentFlat.flatNumber} ({currentFlat.residentName})
                </strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-sage-200 text-sm font-bold">
                <span>Demo Booking Fee:</span>
                <span className="text-walnut-900">
                  {selectedSlot.feePaise === 0 ? 'Complimentary' : formatPaiseToINR(selectedSlot.feePaise)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-text-muted">
              By confirming, you agree to society facility guidelines: {selectedAmenity.rules}
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="md" onClick={() => setIsBookingModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleBookSlot}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Reserving...' : 'Confirm Reservation'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ResidentAmenitiesPage;
