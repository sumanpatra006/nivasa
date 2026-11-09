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

export interface CandidateFlatSummary {
  flatId: string;
  tower: string;
  flatNumber: string;
  residentName: string;
}

export interface ReconciliationSuggestion {
  invoiceId: string;
  flatIdentifier: string;
  candidateInvoice: CandidateInvoice;
  candidateFlat: CandidateFlatSummary;
  confidence: number; // 0.0 to 1.0
  matchingReasons: string[];
  missingEvidence: string[];
}

export interface ReconciledTransaction {
  id: string;
  transaction: NormalizedBankTransaction;
  status: TransactionMatchStatus;
  suggestedMatch: ReconciliationSuggestion | null;
  alternativeMatches: ReconciliationSuggestion[];
  isAmbiguous: boolean;
  selectedInvoiceId?: string | null;
  postedPaymentId?: string | null;
  postedAt?: string | null;
  rejectionReason?: string | null;
}

/**
 * ============================================================================
 * DETERMINISTIC RECONCILIATION SCORING ENGINE (Max 100 points)
 * ============================================================================
 * Evidence Breakdown:
 * 1. Flat Identifier Match (Max 35 points):
 *    - Exact tower + flat number (e.g. "T07-1203", "T12-0408"): +35 points
 *    - Flat number alone (e.g. "1203", "0408"): +25 points
 *    - Missing evidence: "Missing: Flat identifier not detected in narration"
 *
 * 2. Amount Match (Max 25 points):
 *    - Exact match with outstanding invoice balance or total: +25 points
 *    - Near match within ₹10 (1,000 paise): +10 points
 *    - Missing evidence: "Missing: Amount does not match invoice balance"
 *
 * 3. Resident Name Match (Max 20 points):
 *    - Full or partial resident surname/given name found in narration: +20 points
 *    - Missing evidence: "Missing: Resident name not found in narration"
 *
 * 4. Resident UPI Match (Max 15 points):
 *    - Transaction UPI matches registered resident UPI identifier: +15 points
 *    - Missing evidence: "Missing: Registered resident UPI ID not found"
 *
 * 5. Billing Cycle Date Proximity (Max 5 points):
 *    - Transaction occurs within the invoice billing month/year: +5 points
 *    - Missing evidence: "Missing: Transaction date outside invoice billing period"
 *
 * ----------------------------------------------------------------------------
 * CRITICAL THRESHOLDS:
 * - Amount-Only Match: Max 25 points -> Confidence 0.25 -> UNMATCHED!
 *   (Strictly prevents auto-matching on amount alone without unit identity).
 * - Duplicate Reference: System or batch duplicate -> DUPLICATE!
 * - Suggested Match: Confidence >= 0.85 AND no ambiguous second candidate (gap >= 0.15).
 * - Needs Review: Confidence between 0.40 and 0.84 OR ambiguous competing candidates.
 * - Unmatched: Confidence < 0.40.
 * ============================================================================
 */
export function matchTransaction(
  txn: NormalizedBankTransaction,
  invoices: CandidateInvoice[],
  knownSystemReferences: Set<string> = new Set()
): ReconciledTransaction {
  // 1. Duplicate check: if reference already recorded or duplicated in batch
  if (txn.isDuplicateInBatch || (txn.reference && knownSystemReferences.has(txn.reference))) {
    return {
      id: txn.id,
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
    const positiveReasons: string[] = [];
    const missingEvidence: string[] = [];

    // Factor 1: Flat Identifier in Narration / Reference (35 points)
    const towerFlatExact = `${inv.tower.toLowerCase()}-${inv.flatNumber.toLowerCase()}`;
    const towerFlatSpaced = `${inv.tower.toLowerCase()} ${inv.flatNumber.toLowerCase()}`;
    const flatOnly = inv.flatNumber.toLowerCase();

    if (normalizedNarrative.includes(towerFlatExact) || normalizedNarrative.includes(towerFlatSpaced)) {
      score += 35;
      positiveReasons.push(`Exact flat code "${inv.tower}-${inv.flatNumber}" found in narration (+35 pts)`);
    } else if (normalizedNarrative.includes(flatOnly)) {
      score += 25;
      positiveReasons.push(`Flat number "${inv.flatNumber}" found in narration (+25 pts)`);
    } else {
      missingEvidence.push(`Missing: Flat identifier (${inv.tower}-${inv.flatNumber}) not found in narration`);
    }

    // Factor 2: Amount Match vs Invoice Balance or Total (25 points)
    if (inv.balancePaise === txn.amountPaise || inv.totalAmountPaise === txn.amountPaise) {
      score += 25;
      positiveReasons.push(`Exact amount match: ₹${(txn.amountPaise / 100).toFixed(2)} (+25 pts)`);
    } else if (Math.abs(inv.balancePaise - txn.amountPaise) <= 1000) {
      score += 10;
      positiveReasons.push(`Near amount match within ₹10 of balance (+10 pts)`);
    } else {
      missingEvidence.push(
        `Missing: Transaction amount (₹${(txn.amountPaise / 100).toFixed(2)}) does not match balance (₹${(
          inv.balancePaise / 100
        ).toFixed(2)})`
      );
    }

    // Factor 3: Resident Name in Narration (20 points)
    const nameTokens = inv.residentName
      .toLowerCase()
      .split(' ')
      .filter((p) => p.length > 2);
    const hasNameMatch = nameTokens.some((part) => normalizedNarrative.includes(part));

    if (hasNameMatch) {
      score += 20;
      positiveReasons.push(`Resident name "${inv.residentName}" found in narration (+20 pts)`);
    } else {
      missingEvidence.push(`Missing: Resident name "${inv.residentName}" not found in narration`);
    }

    // Factor 4: Registered Resident UPI Match (15 points)
    if (txn.upiId && inv.residentUpi && txn.upiId.includes(inv.residentUpi.toLowerCase())) {
      score += 15;
      positiveReasons.push(`Registered resident UPI ID match: "${txn.upiId}" (+15 pts)`);
    } else {
      missingEvidence.push(`Missing: Registered resident UPI ID match`);
    }

    // Factor 5: Date Proximity within Billing Period (5 points)
    const txnMonth = txn.transactionDate.substring(0, 7);
    const invMonth = inv.dueDate.substring(0, 7);
    if (txnMonth === invMonth) {
      score += 5;
      positiveReasons.push(`Billing period proximity match (+5 pts)`);
    } else {
      missingEvidence.push(`Missing: Transaction date outside invoice month`);
    }

    // Only record candidate suggestion if score meets minimum threshold (>= 20 points)
    if (score >= 20) {
      suggestions.push({
        invoiceId: inv.id,
        flatIdentifier: `${inv.tower}-${inv.flatNumber}`,
        candidateInvoice: inv,
        candidateFlat: {
          flatId: inv.flatId,
          tower: inv.tower,
          flatNumber: inv.flatNumber,
          residentName: inv.residentName,
        },
        confidence: Math.min(1.0, score / 100),
        matchingReasons: positiveReasons,
        missingEvidence,
      });
    }
  }

  // Sort candidate suggestions descending by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence);

  // If no candidates met threshold
  if (suggestions.length === 0) {
    return {
      id: txn.id,
      transaction: txn,
      status: 'UNMATCHED',
      suggestedMatch: null,
      alternativeMatches: [],
      isAmbiguous: false,
    };
  }

  const topMatch = suggestions[0];
  const secondMatch = suggestions[1];

  // Ambiguity evaluation:
  // If multiple candidates have very close scores (score gap < 0.15)
  // or top match is moderate (0.40 <= c < 0.85), mark as NEEDS_REVIEW
  const isAmbiguous =
    (secondMatch && Math.abs(topMatch.confidence - secondMatch.confidence) < 0.15) ||
    (topMatch.confidence >= 0.4 && topMatch.confidence < 0.85);

  let status: TransactionMatchStatus = 'UNMATCHED';

  // Rule: High confidence (>= 0.85) without ambiguity qualifies as SUGGESTED
  if (topMatch.confidence >= 0.85 && !isAmbiguous) {
    status = 'SUGGESTED';
  } else if (topMatch.confidence >= 0.4 || isAmbiguous) {
    status = 'NEEDS_REVIEW';
  } else {
    status = 'UNMATCHED';
  }

  return {
    id: txn.id,
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
