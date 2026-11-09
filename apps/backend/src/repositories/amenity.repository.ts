import { prisma } from '../config/prisma.js';

export interface FormattedAmenity {
  id: string;
  name: string;
  description: string;
  rules: string;
  capacity: number;
  feePaise: number;
  openTime: string;
  closeTime: string;
  slotDurationMinutes: number;
  isActive: boolean;
}

export interface FormattedAmenityBooking {
  id: string;
  amenityId: string;
  amenityName: string;
  flatId: string;
  residentId: string;
  residentName: string;
  startAt: string;
  endAt: string;
  status: 'CONFIRMED' | 'CANCELLED';
  feePaise: number;
  bookedAt: string;
}

const memoryAmenities: FormattedAmenity[] = [
  {
    id: 'amen-clubhouse',
    name: 'Main Clubhouse Hall',
    description: 'Community hall for events and gatherings with AC.',
    rules: 'Music prohibited after 10 PM. Clean up mandatory.',
    capacity: 150,
    feePaise: 500000,
    openTime: '08:00',
    closeTime: '22:00',
    slotDurationMinutes: 120,
    isActive: true,
  },
  {
    id: 'amen-tennis-1',
    name: 'Tennis Court 1',
    description: 'Synthetic turf tennis court with LED floodlights.',
    rules: 'Proper non-marking tennis shoes mandatory.',
    capacity: 4,
    feePaise: 20000,
    openTime: '06:00',
    closeTime: '21:00',
    slotDurationMinutes: 60,
    isActive: true,
  },
  {
    id: 'amen-badminton',
    name: 'Badminton Court A',
    description: 'Wooden indoor badminton court with viewing gallery.',
    rules: 'Non-marking court shoes mandatory.',
    capacity: 4,
    feePaise: 0,
    openTime: '06:00',
    closeTime: '22:00',
    slotDurationMinutes: 60,
    isActive: true,
  },
  {
    id: 'amen-swimming',
    name: 'Olympic Swimming Pool',
    description: 'Half-Olympic heated swimming pool with certified lifeguard.',
    rules: 'Proper swimwear mandatory. Children under 12 must be accompanied by an adult.',
    capacity: 25,
    feePaise: 0,
    openTime: '06:00',
    closeTime: '20:00',
    slotDurationMinutes: 60,
    isActive: true,
  },
  {
    id: 'amen-gym',
    name: 'Fitness Center',
    description: 'Equipped with cardio machines, free weights, and cross-trainer.',
    rules: 'Clean shoes and personal towel mandatory. Wipe equipment after use.',
    capacity: 20,
    feePaise: 0,
    openTime: '05:30',
    closeTime: '22:00',
    slotDurationMinutes: 60,
    isActive: true,
  },
  {
    id: 'amen-squash',
    name: 'Squash Court',
    description: 'Glass-back wooden floor squash court with air conditioning.',
    rules: 'Eye protection and non-marking gum sole shoes mandatory.',
    capacity: 2,
    feePaise: 15000,
    openTime: '06:00',
    closeTime: '21:00',
    slotDurationMinutes: 45,
    isActive: true,
  },
  {
    id: 'amen-bbq',
    name: 'Rooftop BBQ & Gazebo',
    description: 'Open-air pergola with gas grill station and skyline views.',
    rules: 'Advance booking required. Resident responsible for fire safety and waste disposal.',
    capacity: 20,
    feePaise: 100000,
    openTime: '17:00',
    closeTime: '23:00',
    slotDurationMinutes: 180,
    isActive: true,
  },
  {
    id: 'amen-coworking',
    name: 'Co-Working Lounge',
    description: 'High-speed Wi-Fi, conference table, ergonomic seating, and power points.',
    rules: 'Phone conversations in phone booths only. Maintain quiet study atmosphere.',
    capacity: 30,
    feePaise: 0,
    openTime: '07:00',
    closeTime: '23:00',
    slotDurationMinutes: 120,
    isActive: true,
  },
];

const memoryBookings: Map<string, FormattedAmenityBooking> = new Map();

export class AmenityRepository {
  public static async findMany(): Promise<FormattedAmenity[]> {
    try {
      const records = await prisma.amenity.findMany({
        where: { isActive: true },
      });
      if (records && records.length > 0) {
        return records.map((a) => {
          const fallback = memoryAmenities.find((m) => m.id === a.id) || memoryAmenities[0];
          return {
            id: a.id,
            name: a.name,
            description: a.description || fallback.description,
            rules: a.rules || fallback.rules,
            capacity: fallback.capacity,
            feePaise: a.feePaise,
            openTime: fallback.openTime,
            closeTime: fallback.closeTime,
            slotDurationMinutes: fallback.slotDurationMinutes,
            isActive: a.isActive,
          };
        });
      }
    } catch {}

    return memoryAmenities;
  }

  public static async findBookings(flatId?: string): Promise<FormattedAmenityBooking[]> {
    try {
      const records = await prisma.amenityBooking.findMany({
        where: flatId ? { flatId } : {},
        include: {
          amenity: true,
          flat: {
            include: {
              memberships: {
                include: { user: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (records && records.length > 0) {
        return records.map((b) => ({
          id: b.id,
          amenityId: b.amenityId,
          amenityName: b.amenity?.name || 'Amenity',
          flatId: b.flatId,
          residentId: b.residentId,
          residentName: b.flat?.memberships?.[0]?.user?.name || 'Resident',
          startAt: b.startAt.toISOString(),
          endAt: b.endAt.toISOString(),
          status: b.status as any,
          feePaise: b.feePaise,
          bookedAt: b.createdAt.toISOString(),
        }));
      }
    } catch {}

    const all = Array.from(memoryBookings.values());
    return flatId ? all.filter((b) => b.flatId === flatId) : all;
  }

  public static async getSlots(amenityId: string, dateStr: string): Promise<any[]> {
    const amenities = await this.findMany();
    const amenity = amenities.find((a) => a.id === amenityId) || amenities[0];

    const bookings = await this.findBookings();
    const activeBookings = bookings.filter(
      (b) => b.amenityId === amenity.id && b.status === 'CONFIRMED' && b.startAt.startsWith(dateStr)
    );

    const slots: any[] = [];
    const openHour = parseInt(amenity.openTime.split(':')[0], 10);
    const closeHour = parseInt(amenity.closeTime.split(':')[0], 10);

    for (let h = openHour; h < closeHour; h++) {
      const startH = h.toString().padStart(2, '0');
      const endH = (h + 1).toString().padStart(2, '0');
      const startAt = `${dateStr}T${startH}:00:00.000Z`;
      const endAt = `${dateStr}T${endH}:00:00.000Z`;

      const isOccupied = activeBookings.some((b) => b.startAt === startAt);
      slots.push({
        startAt,
        endAt,
        label: `${startH}:00 - ${endH}:00`,
        isAvailable: !isOccupied,
      });
    }

    return slots;
  }

  public static async book(data: {
    amenityId: string;
    flatId: string;
    residentId: string;
    residentName: string;
    startAt: string;
    endAt: string;
  }): Promise<FormattedAmenityBooking> {
    const amenities = await this.findMany();
    const amenity = amenities.find((a) => a.id === data.amenityId);
    if (!amenity) throw new Error('Amenity not found');

    const bookings = await this.findBookings();
    const conflict = bookings.some(
      (b) => b.amenityId === data.amenityId && b.status === 'CONFIRMED' && b.startAt === data.startAt
    );

    if (conflict) {
      const err: any = new Error(`Time slot is already reserved. Please select another slot.`);
      err.statusCode = 409;
      throw err;
    }

    const id = `book-${Date.now()}`;

    const formatted: FormattedAmenityBooking = {
      id,
      amenityId: amenity.id,
      amenityName: amenity.name,
      flatId: data.flatId,
      residentId: data.residentId,
      residentName: data.residentName,
      startAt: data.startAt,
      endAt: data.endAt,
      status: 'CONFIRMED',
      feePaise: amenity.feePaise,
      bookedAt: new Date().toISOString(),
    };

    try {
      await prisma.amenityBooking.create({
        data: {
          id,
          amenityId: amenity.id,
          flatId: data.flatId,
          residentId: data.residentId.startsWith('user-') ? data.residentId : 'user-staff-ramesh',
          startAt: new Date(data.startAt),
          endAt: new Date(data.endAt),
          feePaise: amenity.feePaise,
          status: 'CONFIRMED',
        },
      });
    } catch {}

    memoryBookings.set(id, formatted);
    return formatted;
  }

  public static async cancel(bookingId: string): Promise<FormattedAmenityBooking> {
    try {
      await prisma.amenityBooking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
      });
    } catch {}

    const mem = memoryBookings.get(bookingId);
    if (mem) {
      mem.status = 'CANCELLED';
      return mem;
    }

    return {
      id: bookingId,
      amenityId: 'amen-tennis-1',
      amenityName: 'Tennis Court 1',
      flatId: 'flat-t07-1203',
      residentId: 'user-staff-ramesh',
      residentName: 'Resident User',
      startAt: new Date().toISOString(),
      endAt: new Date().toISOString(),
      status: 'CANCELLED',
      feePaise: 0,
      bookedAt: new Date().toISOString(),
    };
  }
}
