import { PrismaClient, Role, MembershipType, InvoiceStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Nivasa database with authoritative sample data...');

  // 1. Seed Demo Staff Users
  const helpdeskUser = await prisma.user.upsert({
    where: { phone: '9876543210' },
    update: {},
    create: {
      phone: '9876543210',
      name: 'Ramesh Sawant (Helpdesk Duty)',
      role: Role.HELPDESK,
      preferredLanguage: 'en',
    },
  });

  const accountsUser = await prisma.user.upsert({
    where: { phone: '9876543211' },
    update: {},
    create: {
      phone: '9876543211',
      name: 'Pooja Mehta (Accounts Officer)',
      role: Role.ACCOUNTS,
      preferredLanguage: 'en',
    },
  });

  const committeeUser = await prisma.user.upsert({
    where: { phone: '9876543212' },
    update: {},
    create: {
      phone: '9876543212',
      name: 'Dr. Vikram Deshmukh (Secretary)',
      role: Role.COMMITTEE,
      preferredLanguage: 'en',
    },
  });

  // 2. Seed Sample Flats and Residents from TDD Section 5

  // Flat 1: T07-1203 (Neeraj Kulkarni)
  const flat1 = await prisma.flat.upsert({
    where: { tower_flatNumber: { tower: 'T07', flatNumber: '1203' } },
    update: {},
    create: {
      tower: 'T07',
      flatNumber: '1203',
      areaSqFt: 1150,
      maintenanceRate: 650, // ₹6.50
    },
  });

  const resident1 = await prisma.user.upsert({
    where: { phone: '9820000001' },
    update: {},
    create: {
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

  // Flat 2: T12-0408 (Swati Joshi, Tenant)
  const flat2 = await prisma.flat.upsert({
    where: { tower_flatNumber: { tower: 'T12', flatNumber: '0408' } },
    update: {},
    create: {
      tower: 'T12',
      flatNumber: '0408',
      areaSqFt: 980,
      maintenanceRate: 650,
    },
  });

  const resident2 = await prisma.user.upsert({
    where: { phone: '9820000002' },
    update: {},
    create: {
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

  // Flat 3: T21-1601 (Aamir Shaikh)
  const flat3 = await prisma.flat.upsert({
    where: { tower_flatNumber: { tower: 'T21', flatNumber: '1601' } },
    update: {},
    create: {
      tower: 'T21',
      flatNumber: '1601',
      areaSqFt: 1640,
      maintenanceRate: 650,
    },
  });

  const resident3 = await prisma.user.upsert({
    where: { phone: '9820000003' },
    update: {},
    create: {
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

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

