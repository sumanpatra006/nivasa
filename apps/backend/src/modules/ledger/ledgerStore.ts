import { societyStore, LedgerEntryRecord } from '../billing/societyStore.js';

export type { LedgerEntryRecord };

export function getLedgerEntries(flatId: string): LedgerEntryRecord[] {
  return societyStore.getLedger(flatId);
}

export function addLedgerEntry(entry: LedgerEntryRecord): void {
  societyStore.addLedgerEntry(entry);
}

export function calculateClosingBalancePaise(entries: LedgerEntryRecord[]): number {
  return entries.reduce((acc, curr) => {
    return curr.entryType === 'BILL' || curr.entryType === 'LATE_FEE'
      ? acc + curr.amountPaise
      : acc - curr.amountPaise;
  }, 0);
}
