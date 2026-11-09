import {
  PrismaClient,
  Role,
  MembershipType,
  InvoiceStatus,
  ComplaintCategory,
  ComplaintUrgency,
  ComplaintStatus,
} from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Nivasa Neon database with authoritative township data...');

  // 1. Staff Users & Security Personnel
  await prisma.user.upsert({
    where: { phone: '9876543210' },
    update: { role: Role.HELPDESK, name: 'Ramesh Sawant (Helpdesk Duty)' },
    create: {
      id: 'user-staff-ramesh',
      phone: '9876543210',
      name: 'Ramesh Sawant (Helpdesk Duty)',
      role: Role.HELPDESK,
      preferredLanguage: 'en',
    },
  });

  await prisma.user.upsert({
    where: { phone: '9876543211' },
    update: { role: Role.ACCOUNTS, name: 'Pooja Mehta (Accounts Officer)' },
    create: {
      id: 'user-staff-pooja',
      phone: '9876543211',
      name: 'Pooja Mehta (Accounts Officer)',
      role: Role.ACCOUNTS,
      preferredLanguage: 'en',
    },
  });

  await prisma.user.upsert({
    where: { phone: '9876543212' },
    update: { role: Role.COMMITTEE, name: 'Dr. Vikram Deshmukh (Secretary)' },
    create: {
      id: 'user-staff-vikram',
      phone: '9876543212',
      name: 'Dr. Vikram Deshmukh (Secretary)',
      role: Role.COMMITTEE,
      preferredLanguage: 'en',
    },
  });

  await prisma.user.upsert({
    where: { phone: '9876543213' },
    update: { role: Role.GUARD, name: 'Security Guard (Gate 1)' },
    create: {
      id: 'user-staff-guard',
      phone: '9876543213',
      name: 'Security Guard (Gate 1)',
      role: Role.GUARD,
      preferredLanguage: 'en',
    },
  });

  // 2. Flats and Resident Users (TDD.md Section 5 Authoritative Specs)
  // Flat 1: T07-1203 (Neeraj Kulkarni, 1150 sq ft)
  const flat1 = await prisma.flat.upsert({
    where: { tower_flatNumber: { tower: 'T07', flatNumber: '1203' } },
    update: { areaSqFt: 1150, maintenanceRate: 650 },
    create: {
      id: 'flat-t07-1203',
      tower: 'T07',
      flatNumber: '1203',
      areaSqFt: 1150,
      maintenanceRate: 650, // ₹6.50
    },
  });

  const resident1 = await prisma.user.upsert({
    where: { phone: '9820000001' },
    update: { name: 'Neeraj Kulkarni', role: Role.RESIDENT },
    create: {
      id: 'user-resident-neeraj',
      phone: '9820000001',
      name: 'Neeraj Kulkarni',
      role: Role.RESIDENT,
    },
  });

  await prisma.flatMembership.upsert({
    where: { id: 'membership-t07-1203' },
    update: {},
    create: {
      id: 'membership-t07-1203',
      userId: resident1.id,
      flatId: flat1.id,
      membershipType: MembershipType.OWNER,
    },
  });

  // Flat 2: T12-0408 (Swati Joshi, Tenant, 980 sq ft)
  const flat2 = await prisma.flat.upsert({
    where: { tower_flatNumber: { tower: 'T12', flatNumber: '0408' } },
    update: { areaSqFt: 980, maintenanceRate: 650 },
    create: {
      id: 'flat-t12-0408',
      tower: 'T12',
      flatNumber: '0408',
      areaSqFt: 980,
      maintenanceRate: 650,
    },
  });

  const resident2 = await prisma.user.upsert({
    where: { phone: '9820000002' },
    update: { name: 'Swati Joshi', role: Role.RESIDENT },
    create: {
      id: 'user-resident-swati',
      phone: '9820000002',
      name: 'Swati Joshi',
      role: Role.RESIDENT,
    },
  });

  await prisma.flatMembership.upsert({
    where: { id: 'membership-t12-0408' },
    update: {},
    create: {
      id: 'membership-t12-0408',
      userId: resident2.id,
      flatId: flat2.id,
      membershipType: MembershipType.TENANT,
    },
  });

  // Flat 3: T21-1601 (Aamir Shaikh, 1640 sq ft)
  const flat3 = await prisma.flat.upsert({
    where: { tower_flatNumber: { tower: 'T21', flatNumber: '1601' } },
    update: { areaSqFt: 1640, maintenanceRate: 650 },
    create: {
      id: 'flat-t21-1601',
      tower: 'T21',
      flatNumber: '1601',
      areaSqFt: 1640,
      maintenanceRate: 650,
    },
  });

  const resident3 = await prisma.user.upsert({
    where: { phone: '9820000003' },
    update: { name: 'Aamir Shaikh', role: Role.RESIDENT },
    create: {
      id: 'user-resident-aamir',
      phone: '9820000003',
      name: 'Aamir Shaikh',
      role: Role.RESIDENT,
    },
  });

  await prisma.flatMembership.upsert({
    where: { id: 'membership-t21-1601' },
    update: {},
    create: {
      id: 'membership-t21-1601',
      userId: resident3.id,
      flatId: flat3.id,
      membershipType: MembershipType.OWNER,
    },
  });

  // 3. Maintenance Invoices (Integer Paise, Rate ₹6.50/sq ft)
  await prisma.invoice.upsert({
    where: { flatId_billingPeriod: { flatId: flat1.id, billingPeriod: '2026-11' } },
    update: {},
    create: {
      id: 'inv-t07-1203-202611',
      flatId: flat1.id,
      billingPeriod: '2026-11',
      areaSqFt: 1150,
      ratePerSqFt: 650,
      baseAmountPaise: 747500, // ₹7,475.00
      lateFeePaise: 0,
      totalAmountPaise: 747500,
      paidAmountPaise: 747500,
      dueDate: new Date('2026-11-10T00:00:00Z'),
      status: InvoiceStatus.PAID,
    },
  });

  await prisma.invoice.upsert({
    where: { flatId_billingPeriod: { flatId: flat2.id, billingPeriod: '2026-11' } },
    update: {},
    create: {
      id: 'inv-t12-0408-202611',
      flatId: flat2.id,
      billingPeriod: '2026-11',
      areaSqFt: 980,
      ratePerSqFt: 650,
      baseAmountPaise: 637000, // ₹6,370.00
      lateFeePaise: 62000,     // Late fee (47 days overdue)
      totalAmountPaise: 699000,
      paidAmountPaise: 0,
      dueDate: new Date('2026-09-24T00:00:00Z'),
      status: InvoiceStatus.OVERDUE,
    },
  });

  await prisma.invoice.upsert({
    where: { flatId_billingPeriod: { flatId: flat3.id, billingPeriod: '2026-11' } },
    update: {},
    create: {
      id: 'inv-t21-1601-202611',
      flatId: flat3.id,
      billingPeriod: '2026-11',
      areaSqFt: 1640,
      ratePerSqFt: 650,
      baseAmountPaise: 1066000, // ₹10,660.00
      lateFeePaise: 25000,
      totalAmountPaise: 1091000,
      paidAmountPaise: 500000,
      dueDate: new Date('2026-10-23T00:00:00Z'),
      status: InvoiceStatus.PARTIALLY_PAID,
    },
  });

  // 4. Amenities with Rules and Demo Fees
  const amenitiesData = [
    {
      id: 'amen-1',
      name: 'Main Clubhouse Hall',
      description: 'Air-conditioned community hall suitable for society gatherings and private events.',
      rules: 'Quiet hours start at 10 PM. Music restricted to 65 dB. Host flat responsible for cleanup within 2 hours.',
      feePaise: 500000, // ₹5,000 demo fee
      isActive: true,
    },
    {
      id: 'amen-2',
      name: 'Tennis Court 1',
      description: 'Floodlit synthetic hard court with standard markings and net.',
      rules: 'Non-marking tennis shoes compulsory. Maximum 1-hour slot per flat per day.',
      feePaise: 20000, // ₹200 demo fee
      isActive: true,
    },
    {
      id: 'amen-3',
      name: 'Badminton Court A',
      description: 'Indoor wooden flooring court with tournament regulation lighting.',
      rules: 'Strictly gum-sole or indoor sports shoes. Turn off lights upon slot completion.',
      feePaise: 15000, // ₹150 demo fee
      isActive: true,
    },
    {
      id: 'amen-4',
      name: 'Swimming Pool',
      description: 'Semi-Olympic 25-meter temperature-monitored pool.',
      rules: 'Proper swimwear mandatory. Children under 12 must be accompanied by an adult.',
      feePaise: 0, // Complimentary
      isActive: true,
    },
    {
      id: 'amen-5',
      name: 'Gymnasium & Fitness Center',
      description: 'Full-range cardio, free weights, and resistance equipment.',
      rules: 'Personal sweat towel mandatory. Wipe down machines after workout.',
      feePaise: 0, // Complimentary
      isActive: true,
    },
  ];

  for (const amen of amenitiesData) {
    await prisma.amenity.upsert({
      where: { id: amen.id },
      update: amen,
      create: amen,
    });
  }

  // 5. Sample Amenity Booking
  await prisma.amenityBooking.upsert({
    where: { id: 'amen-book-01' },
    update: {},
    create: {
      id: 'amen-book-01',
      amenityId: 'amen-2',
      flatId: flat3.id,
      residentId: resident3.id,
      startAt: new Date('2026-11-10T07:00:00.000Z'),
      endAt: new Date('2026-11-10T08:00:00.000Z'),
      feePaise: 20000,
      status: 'CONFIRMED',
    },
  });

  // 6. Pre-Approved Guest Pass Code (PIN 842619 for Neeraj)
  const pin = '842619';
  const codeHash = crypto.createHash('sha256').update(pin).digest('hex');
  await prisma.guestCode.upsert({
    where: { id: 'gc-seed-01' },
    update: {},
    create: {
      id: 'gc-seed-01',
      flatId: flat1.id,
      createdBy: resident1.id,
      codeHash,
      validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
      validUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
      usageLimit: 2,
      usageCount: 0,
      isActive: true,
    },
  });

  // 7. Gate Visitors
  await prisma.visitor.upsert({
    where: { id: 'vis-seed-01' },
    update: {},
    create: {
      id: 'vis-seed-01',
      flatId: flat1.id,
      residentId: resident1.id,
      visitorName: 'Sunil Verma',
      purpose: 'Amazon Courier Delivery',
      arrivedAt: new Date('2026-11-09T10:15:00.000Z'),
      departedAt: new Date('2026-11-09T10:22:00.000Z'),
      approvalStatus: 'APPROVED',
    },
  });

  // 8. Sample Complaints
  await prisma.complaint.upsert({
    where: { id: 'cmp-seed-01' },
    update: {},
    create: {
      id: 'cmp-seed-01',
      residentId: resident2.id,
      flatId: flat2.id,
      title: 'Water leakage in master bathroom washbasin',
      description: 'Continuous slow drip under the washbasin pipe damaging the wooden vanity.',
      category: ComplaintCategory.PLUMBING,
      urgency: ComplaintUrgency.NORMAL,
      status: ComplaintStatus.ASSIGNED,
      assignedTo: 'user-staff-ramesh',
    },
  });

  await prisma.complaint.upsert({
    where: { id: 'cmp-seed-02' },
    update: {},
    create: {
      id: 'cmp-seed-02',
      residentId: resident1.id,
      flatId: flat1.id,
      title: 'Emergency: Passenger elevator stuck between 8th and 9th floor',
      description: 'Lift stopped with passengers inside. Emergency alarm sounding.',
      category: ComplaintCategory.LIFT,
      urgency: ComplaintUrgency.CRITICAL,
      status: ComplaintStatus.ASSIGNED,
      assignedTo: 'user-staff-ramesh',
    },
  });

  console.log('✅ Seed completed successfully. All township data populated into Neon DB.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
