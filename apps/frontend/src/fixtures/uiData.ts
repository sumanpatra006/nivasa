/**
 * Nivasa Design System — UI Demonstration Fixtures
 * NOTE: These are clearly labeled design fixtures strictly adhering to TDD.md Section 5.
 * They establish visual hierarchy and real operational state before database integration.
 */

export interface DemoFlat {
  id: string;
  flatNumber: string;
  tower: string;
  residentName: string;
  phone: string;
  role: 'Owner' | 'Tenant';
  areaSqFt: number;
  monthlyBillPaise: number;
  paidAmountPaise: number;
  daysOverdue: number;
  openComplaintsCount: number;
}

export const DEMO_FLATS: DemoFlat[] = [
  {
    id: 'flat-t07-1203',
    tower: 'T07',
    flatNumber: '1203',
    residentName: 'Neeraj Kulkarni',
    phone: '9820000001',
    role: 'Owner',
    areaSqFt: 1150,
    monthlyBillPaise: 747500, // ₹7,475 @ ₹6.50/sq ft
    paidAmountPaise: 747500,
    daysOverdue: 0,
    openComplaintsCount: 0,
  },
  {
    id: 'flat-t12-0408',
    tower: 'T12',
    flatNumber: '0408',
    residentName: 'Swati Joshi',
    phone: '9820000002',
    role: 'Tenant',
    areaSqFt: 980,
    monthlyBillPaise: 637000, // ₹6,370 @ ₹6.50/sq ft
    paidAmountPaise: 0,
    daysOverdue: 47,
    openComplaintsCount: 1,
  },
  {
    id: 'flat-t21-1601',
    tower: 'T21',
    flatNumber: '1601',
    residentName: 'Aamir Shaikh',
    phone: '9820000003',
    role: 'Owner',
    areaSqFt: 1640,
    monthlyBillPaise: 1066000, // ₹10,660 @ ₹6.50/sq ft
    paidAmountPaise: 500000,
    daysOverdue: 18,
    openComplaintsCount: 0,
  },
];

export const DEMO_NOTICES = [
  {
    id: 'ntc-1',
    title: 'Water Tank Cleaning — Towers T01 to T14',
    body: 'Overhead water tank sanitization scheduled on Saturday 14th November from 10:00 AM to 4:00 PM. Water supply will be paused.',
    date: '08 Nov 2026',
    author: 'Society Maintenance Office',
  },
  {
    id: 'ntc-2',
    title: 'Annual General Meeting (AGM) Notice',
    body: 'The Annual General Body Meeting will be held in the Clubhouse Hall on Sunday 29th November at 10:30 AM. Agenda papers sent via email.',
    date: '05 Nov 2026',
    author: 'Dr. Vikram Deshmukh (Secretary)',
  },
];

export const DEMO_VISITORS_TODAY = [
  {
    id: 'vis-1',
    visitorName: 'Sunil Verma',
    purpose: 'Amazon Package Delivery',
    time: '11:45 AM',
    status: 'Awaiting Approval',
    gate: 'Gate 2 (South Gate)',
  },
  {
    id: 'vis-2',
    visitorName: 'Kavita Sharma',
    purpose: 'Family Guest Visit',
    time: '02:30 PM',
    status: 'Pre-Approved (Code #4981)',
    gate: 'Gate 1 (Main Gate)',
  },
];

export const DEMO_COMPLAINTS = [
  {
    id: 'CMP-2026-089',
    flat: 'T12-0408',
    resident: 'Swati Joshi',
    title: 'Water leakage in master bathroom',
    description: 'Continuous slow drip under the washbasin pipe damaging wooden cabinet.',
    category: 'Plumbing',
    urgency: 'Normal',
    status: 'Assigned',
    assignedTeam: 'Plumbing Team (Santosh Shinde)',
    createdDate: '01 Nov 2026',
    slaTimeRemaining: '3 hrs remaining',
    isSafetyEscalation: false,
    timeline: [
      { date: '01 Nov, 08:30 AM', event: 'Complaint registered by Swati Joshi' },
      { date: '01 Nov, 09:15 AM', event: 'AI categorized as Plumbing (92% confidence)' },
      { date: '01 Nov, 09:30 AM', event: 'Assigned to Plumbing Team by Ramesh Sawant' },
    ],
  },
  {
    id: 'CMP-2026-092',
    flat: 'T07-0802',
    resident: 'Kiran Rao',
    title: 'Passenger lift stuck between 4th and 5th floor',
    description: 'Lift B came to a halt with loud sound. One senior resident is inside.',
    category: 'Lift',
    urgency: 'Critical',
    status: 'In Progress',
    assignedTeam: 'Emergency Response / OTIS Tech',
    createdDate: 'Today, 10:12 AM',
    slaTimeRemaining: '12 mins (Emergency SLA)',
    isSafetyEscalation: true,
    safetyReason: 'Automated safety override triggered due to matching safety term [lift stuck]',
    timeline: [
      { date: 'Today, 10:12 AM', event: 'Emergency complaint registered' },
      { date: 'Today, 10:12 AM', event: 'AUTOMATED SAFETY ESCALATION TRIGGERED: Duty Manager alerted' },
      { date: 'Today, 10:16 AM', event: 'Lift technician on-site' },
    ],
  },
  {
    id: 'CMP-2026-081',
    flat: 'T21-1402',
    resident: 'Rohit Kadam',
    title: 'Corridor lights flickering on 14th floor',
    description: 'Two tubelights in common hallway flickering continuously since yesterday.',
    category: 'Electrical',
    urgency: 'Low',
    status: 'Resolved',
    assignedTeam: 'Electrical Team (Mahesh Jadhav)',
    createdDate: '28 Oct 2026',
    slaTimeRemaining: 'Completed on-time',
    isSafetyEscalation: false,
    timeline: [
      { date: '28 Oct, 02:00 PM', event: 'Complaint registered' },
      { date: '29 Oct, 11:30 AM', event: 'Choke replacement completed by Mahesh' },
      { date: '29 Oct, 04:00 PM', event: 'Resolved and verified with resident' },
    ],
  },
];

export const DEMO_RECONCILIATION_QUEUE = [
  {
    id: 'txn-bank-01',
    date: '02 Nov 2026',
    amountPaise: 747500, // ₹7,475.00
    reference: 'UPI/1203/NeerajKulkarni',
    upiId: 'neeraj@oksbi',
    description: 'Maintenance Nov T07-1203',
    suggestedFlat: 'T07-1203 (Neeraj Kulkarni)',
    confidence: 0.95,
    status: 'Suggested',
    matchingEvidence: [
      'Exact Amount Match: ₹7,475.00 (40%)',
      'Flat Identifier "1203" in Narration (35%)',
      'Resident Name "Neeraj Kulkarni" matched (20%)',
    ],
  },
  {
    id: 'txn-bank-02',
    date: '03 Nov 2026',
    amountPaise: 637000, // ₹6,370.00
    reference: 'NEFT-AXIS-992384',
    upiId: null,
    description: 'Swati Joshi rent and maint',
    suggestedFlat: 'T12-0408 (Swati Joshi)',
    confidence: 0.75,
    status: 'Needs Review',
    matchingEvidence: [
      'Exact Amount Match: ₹6,370.00 (40%)',
      'Resident Name "Swati Joshi" matched (20%)',
      'Transaction within billing window (5%)',
    ],
  },
  {
    id: 'txn-bank-03',
    date: '04 Nov 2026',
    amountPaise: 500000, // ₹5,000.00
    reference: 'IMPS-TRANSFER-4982',
    upiId: null,
    description: 'HDFC transfer to Nivasa Society',
    suggestedFlat: null,
    confidence: 0.15,
    status: 'Unmatched',
    matchingEvidence: ['Amount does not match single full bill balance'],
  },
];

export const DEMO_COMMITTEE_METRICS = {
  totalApartments: 2400,
  totalTowers: 28,
  totalBilledPaise: 1800000000, // ₹1.80 Cr monthly billing (A-02 baseline)
  totalCollectedPaise: 1620000000, // ₹1.62 Cr (90% target)
  totalOverduePaise: 180000000, // ₹18 Lakh overdue
  collectionEfficiencyPct: 90.0,
  duesAgeing: [
    { label: '0–30 Days (Current)', amountPaise: 90000000, pct: 50, color: 'bg-sage-500' },
    { label: '31–60 Days Overdue', amountPaise: 54000000, pct: 30, color: 'bg-amber-500' },
    { label: '61–90 Days Overdue', amountPaise: 21600000, pct: 12, color: 'bg-orange-500' },
    { label: '90+ Days (Critical)', amountPaise: 14400000, pct: 8, color: 'bg-red-500' },
  ],
  operationalMetrics: {
    openComplaints: 24,
    avgResponseMinutes: 18,
    avgResolutionHours: 14.5,
    reopenRatePct: 6.2, // Below 8% target
    reopenedCount: 28,
  },
};

