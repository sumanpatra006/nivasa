import { NormalizedBankTransaction } from './csvParser.js';

export interface CandidateInvoice {
  id: string;
  flatId: string;
  tower: string;
  flatNumber: string;
  residentName: string;
  residentUpi?: string | null;
  totalAmountPaise: number;
  paidAmountPaise: number;
  balancePaise: number;
  dueDate: string;
  status: string;
}

export type TransactionMatchStatus =
  | 'UNMATCHED'
  | 'SUGGESTED'
  | 'NEEDS_REVIEW'
  | 'MATCHED'
  | 'POSTED'
  | 'DUPLICATE'
  | 'REJECTED';

export interface ReconciliationSuggestion {
  invoiceId: string;
  flatIdentifier: string;
  residentName: string;
  confidence: number; // 0.0 to 1.0
  matchingReasons: string[];
}

export interface ReconciledTransaction {
  transaction: NormalizedBankTransaction;
  status: TransactionMatchStatus;
  suggestedMatch: ReconciliationSuggestion | null;
  alternativeMatches: ReconciliationSuggestion[];
  isAmbiguous: boolean;
}

/**
 * Evaluates a single bank transaction against candidate society invoices.
 * Scoring breakdown (Max 100 points):
 * - Exact Amount Match: 40 points
 * - Flat Identifier in Narration/Reference (e.g., 'T07-1203' or '1203'): 35 points
 * - Resident Name or UPI ID match: 20 points
 * - Billing Cycle / Date Proximity: 5 points
 */
export function matchTransaction(
  txn: NormalizedBankTransaction,
  invoices: CandidateInvoice[],
  knownSystemReferences: Set<string> = new Set()
): ReconciledTransaction {
  // 1. Check duplicate reference against existing system records or batch duplicates
  if (txn.isDuplicateInBatch || (txn.reference && knownSystemReferences.has(txn.reference))) {
    return {
      transaction: txn,
      status: 'DUPLICATE',
      suggestedMatch: null,
      alternativeMatches: [],
      isAmbiguous: false,
    };
  }

  const normalizedNarrative = `${txn.reference} ${txn.description}`.toLowerCase();
  const suggestions: ReconciliationSuggestion[] = [];

  for (const inv of invoices) {
    let score = 0;
    const reasons: string[] = [];

    // Rule 1: Exact Amount Match (40 points)
    if (inv.balancePaise === txn.amountPaise || inv.totalAmountPaise === txn.amountPaise) {
      score += 40;
      reasons.push('Exact amount match (+40%)');
    } else if (Math.abs(inv.balancePaise - txn.amountPaise) <= 1000) {
      // Small variance within ₹10
      score += 20;
      reasons.push('Near amount match within ₹10 (+20%)');
    }

    // Rule 2: Flat Identifier in Narration / Reference (35 points)
    const towerFlatExact = `${inv.tower.toLowerCase()}-${inv.flatNumber.toLowerCase()}`;
    const flatOnly = inv.flatNumber.toLowerCase();

    if (normalizedNarrative.includes(towerFlatExact)) {
      score += 35;
      reasons.push(`Exact flat code "${inv.tower}-${inv.flatNumber}" found in narration (+35%)`);
    } else if (normalizedNarrative.includes(flatOnly)) {
      score += 25;
      reasons.push(`Flat number "${inv.flatNumber}" found in narration (+25%)`);
    }

    // Rule 3: Resident Name or UPI ID Match (20 points)
    const nameParts = inv.residentName.toLowerCase().split(' ').filter((p) => p.length > 2);
    const hasNameMatch = nameParts.some((part) => normalizedNarrative.includes(part));

    if (txn.upiId && inv.residentUpi && txn.upiId.includes(inv.residentUpi.toLowerCase())) {
      score += 20;
      reasons.push(`Registered resident UPI ID match (+20%)`);
    } else if (hasNameMatch) {
      score += 15;
      reasons.push(`Resident name "${inv.residentName}" found in narration (+15%)`);
    }

    // Rule 4: Date Proximity within same month/year (5 points)
    const txnMonth = txn.transactionDate.substring(0, 7);
    const invMonth = inv.dueDate.substring(0, 7);
    if (txnMonth === invMonth) {
      score += 5;
      reasons.push('Billing period proximity match (+5%)');
    }

    if (score >= 30) {
      suggestions.push({
        invoiceId: inv.id,
        flatIdentifier: `${inv.tower}-${inv.flatNumber}`,
        residentName: inv.residentName,
        confidence: Math.min(1.0, score / 100),
        matchingReasons: reasons,
      });
    }
  }

  // Sort descending by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence);

  if (suggestions.length === 0) {
    return {
      transaction: txn,
      status: 'UNMATCHED',
      suggestedMatch: null,
      alternativeMatches: [],
      isAmbiguous: false,
    };
  }

  const topMatch = suggestions[0];
  const secondMatch = suggestions[1];

  // Ambiguity check:
  // If multiple candidates have very close scores (e.g. difference < 0.15)
  // or top confidence is between 0.50 and 0.89, it MUST be marked as NEEDS_REVIEW
  const isAmbiguous =
    (secondMatch && Math.abs(topMatch.confidence - secondMatch.confidence) < 0.15) ||
    (topMatch.confidence >= 0.5 && topMatch.confidence < 0.9);

  let status: TransactionMatchStatus = 'UNMATCHED';
  if (topMatch.confidence >= 0.9 && !isAmbiguous) {
    status = 'SUGGESTED';
  } else if (topMatch.confidence >= 0.5 || isAmbiguous) {
    status = 'NEEDS_REVIEW';
  }

  return {
    transaction: txn,
    status,
    suggestedMatch: topMatch,
    alternativeMatches: suggestions.slice(1),
    isAmbiguous,
  };
}

/**
 * Reconciles an entire list of bank transactions against candidate invoices.
 */
export function reconcileBatch(
  transactions: NormalizedBankTransaction[],
  invoices: CandidateInvoice[],
  knownSystemReferences: Set<string> = new Set()
): ReconciledTransaction[] {
  return transactions.map((t) => matchTransaction(t, invoices, knownSystemReferences));
}

