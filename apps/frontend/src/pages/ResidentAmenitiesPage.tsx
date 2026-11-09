import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Info,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { ApiClient, ApiAmenity, ApiAmenitySlot, ApiAmenityBooking } from '../services/api.js';
import { DemoFlat } from '../fixtures/uiData.js';
import { formatPaiseToINR } from '@nivasa/shared';
import { AmenityCard } from '../components/amenities/AmenityCard.js';
import { AmenitySlotGrid } from '../components/amenities/AmenitySlotGrid.js';
import { ResidentBookingsList } from '../components/amenities/ResidentBookingsList.js';

export function ResidentAmenitiesPage() {
  const { currentFlat } = useOutletContext<{ currentFlat: DemoFlat }>();

  const [amenities, setAmenities] = useState<ApiAmenity[]>([]);
  const [selectedAmenity, setSelectedAmenity] = useState<ApiAmenity | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
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

      // Refresh slots and resident bookings
      fetchSlots(selectedAmenity.id, selectedDate);
      const updatedBookings = await ApiClient.getAmenityBookings(currentFlat.id);
      setBookings(updatedBookings.bookings);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to book slot. It may have already been reserved.',
      });
      setIsBookingModalOpen(false);
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

      const updatedBookings = await ApiClient.getAmenityBookings(currentFlat.id);
      setBookings(updatedBookings.bookings);
      if (selectedAmenity) {
        fetchSlots(selectedAmenity.id, selectedDate);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to cancel booking.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Disclaimer Banner */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-walnut-900">Society Amenities & Slot Booking</h1>
            <p className="text-xs text-text-secondary">
              Reserve clubhouse facilities, courts, and community halls for personal use.
            </p>
          </div>
        </div>

        {/* Explicit Demo Disclaimer Banner */}
        <div className="rounded-control border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2.5">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
          <div>
            <strong className="font-semibold text-amber-950">Non-Statutory Demo Fees & Rules:</strong>
            <p className="mt-0.5 text-amber-800 text-[11px]">
              Actual township bye-laws and fee structures are governed by the society managing committee.
              All slot fees and time limits shown here are demonstration simulations.
            </p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-control border flex items-center justify-between text-xs ${
            statusMessage.type === 'success'
              ? 'bg-sage-50 border-sage-300 text-sage-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-sage-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-[11px] font-semibold underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Amenity Selection Cards */}
      <div>
        <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3">
          1. Select Facility
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {amenities.map((amenity) => (
            <AmenityCard
              key={amenity.id}
              amenity={amenity}
              isSelected={selectedAmenity?.id === amenity.id}
              onSelect={setSelectedAmenity}
            />
          ))}
        </div>
      </div>

      {/* 3. Slot Schedule & Date Picker */}
      {selectedAmenity && (
        <div className="rounded-surface border border-border bg-surface p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-border">
            <div>
              <h2 className="text-sm font-bold text-walnut-900">
                2. Choose Slot for {selectedAmenity.name}
              </h2>
              <p className="text-xs text-text-muted">
                Operating hours: {selectedAmenity.openTime} – {selectedAmenity.closeTime} • {selectedAmenity.slotDurationMinutes} min sessions
              </p>
            </div>

            {/* Date Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="amenity-booking-date" className="text-xs font-semibold text-text-primary flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-sage-600" /> Date:
              </label>
              <input
                id="amenity-booking-date"
                type="date"
                value={selectedDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-control border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-walnut-900 focus:outline-none focus:border-sage-500"
              />
            </div>
          </div>

          {/* Slot Grid Component */}
          <AmenitySlotGrid
            slots={slots}
            isLoading={isSlotsLoading}
            selectedSlot={selectedSlot}
            onSelectSlot={(slot) => {
              setSelectedSlot(slot);
              setIsBookingModalOpen(true);
            }}
          />
        </div>
      )}

      {/* 4. Resident's Bookings History */}
      <div>
        <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3">
          Your Scheduled Bookings ({bookings.length})
        </h2>
        <ResidentBookingsList bookings={bookings} onCancelBooking={handleCancelBooking} />
      </div>

      {/* 5. Booking Confirmation Modal */}
      {selectedSlot && selectedAmenity && (
        <Modal
          isOpen={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setSelectedSlot(null);
          }}
          title={`Confirm Booking: ${selectedAmenity.name}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-text-secondary">
              Review booking details for your flat before reserving the slot:
            </p>

            <div className="rounded-control border border-border bg-surface-alt p-3.5 space-y-2">
              <div className="flex justify-between">
                <span className="text-text-muted">Facility:</span>
                <span className="font-bold text-walnut-900">{selectedAmenity.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Date & Time:</span>
                <span className="font-semibold text-walnut-900">
                  {selectedDate} • {selectedSlot.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Flat:</span>
                <span className="font-semibold text-walnut-900">
                  {currentFlat.tower}-{currentFlat.flatNumber} ({currentFlat.residentName})
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-bold">
                <span className="text-walnut-900">Facility Demo Fee:</span>
                <span className="text-sage-800">
                  {selectedAmenity.feePaise === 0 ? 'Complimentary' : formatPaiseToINR(selectedAmenity.feePaise)}
                </span>
              </div>
            </div>

            {selectedAmenity.rules && (
              <div className="text-[11px] text-text-muted bg-surface p-2.5 rounded-control border border-border">
                <strong>Facility Rules:</strong> {selectedAmenity.rules}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsBookingModalOpen(false);
                  setSelectedSlot(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                onClick={handleBookSlot}
              >
                Confirm Reservation
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
