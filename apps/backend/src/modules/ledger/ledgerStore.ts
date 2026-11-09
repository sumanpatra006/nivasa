export interface LedgerRecord {
  id: string;
  flatId: string;
  entryType: 'BILL' | 'PAYMENT' | 'LATE_FEE' | 'ADJUSTMENT' | 'REVERSAL';
  amountPaise: number;
  description: string;
  createdAt: string;
}

const ledgerDatabase: LedgerRecord[] = [
  {
    id: 'led-init-1',
    flatId: 'flat-t07-1203',
    entryType: 'BILL',
    amountPaise: 747500,
    description: 'Monthly Maintenance November 2026',
    createdAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'led-init-2',
    flatId: 'flat-t12-0408',
    entryType: 'BILL',
    amountPaise: 637000,
    description: 'Monthly Maintenance November 2026',
    createdAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'led-init-3',
    flatId: 'flat-t21-1601',
    entryType: 'BILL',
    amountPaise: 1066000,
    description: 'Monthly Maintenance November 2026',
    createdAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'led-init-4',
    flatId: 'flat-t21-1601',
    entryType: 'PAYMENT',
    amountPaise: 500000,
    description: 'Part payment received',
    createdAt: '2026-11-03T11:00:00Z',
  },
];

export function getLedgerEntries(flatId: string): LedgerRecord[] {
  return ledgerDatabase.filter((entry) => entry.flatId === flatId);
}

export function addLedgerEntry(entry: LedgerRecord): void {
  ledgerDatabase.push(entry);
}

export function calculateClosingBalancePaise(entries: LedgerRecord[]): number {
  return entries.reduce((acc, curr) => {
    return curr.entryType === 'BILL' || curr.entryType === 'LATE_FEE'
      ? acc + curr.amountPaise
      : acc - curr.amountPaise;
  }, 0);
}
