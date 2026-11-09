import { rupeesToPaise } from '@nivasa/shared';

export interface RawCsvTransaction {
  date: string;
  amount: string;
  reference: string;
  upiId?: string;
  description: string;
}

export interface NormalizedBankTransaction {
  rowNumber: number;
  rawRow: string;
  transactionDate: string; // ISO 8601
  amountPaise: number;
  reference: string;
  upiId: string | null;
  description: string;
  isDuplicateInBatch: boolean;
}

export interface ParseResult {
  success: boolean;
  transactions: NormalizedBankTransaction[];
  errors: Array<{ line: number; message: string }>;
  totalRows: number;
}

/**
 * Robust RFC 4180 compliant CSV line tokenizer.
 * Properly handles quoted fields, inner commas, and double quotes.
 */
export function tokenizeCsvLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  fields.push(currentField.trim());
  return fields;
}

/**
 * Parses bank CSV contents according to TDD Section 8:
 * Fields: Transaction date, Amount, Reference, UPI ID, Description.
 */
export function parseBankCsv(csvContent: string): ParseResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { success: true, transactions: [], errors: [], totalRows: 0 };
  }

  // Parse header
  const headerTokens = tokenizeCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const dateIdx = headerTokens.findIndex((h) => h.includes('date'));
  const amountIdx = headerTokens.findIndex((h) => h.includes('amount'));
  const refIdx = headerTokens.findIndex((h) => h.includes('ref') || h.includes('txn') || h.includes('utr'));
  const upiIdx = headerTokens.findIndex((h) => h.includes('upi'));
  const descIdx = headerTokens.findIndex((h) => h.includes('desc') || h.includes('narr') || h.includes('particular'));

  if (dateIdx === -1 || amountIdx === -1 || refIdx === -1) {
    return {
      success: false,
      transactions: [],
      errors: [
        {
          line: 1,
          message:
            'Invalid CSV header. Expected at least Date, Amount, and Reference columns.',
        },
      ],
      totalRows: lines.length,
    };
  }

  const transactions: NormalizedBankTransaction[] = [];
  const errors: Array<{ line: number; message: string }> = [];
  const seenReferences = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const tokens = tokenizeCsvLine(rawLine);

    if (tokens.length <= Math.max(dateIdx, amountIdx, refIdx)) {
      errors.push({ line: i + 1, message: `Incomplete CSV row: expected columns missing.` });
      continue;
    }

    const dateStr = tokens[dateIdx];
    const amountStr = tokens[amountIdx].replace(/[₹, ]/g, '');
    const reference = tokens[refIdx].toUpperCase().trim();
    const upiId = upiIdx !== -1 && tokens[upiIdx] ? tokens[upiIdx].toLowerCase().trim() : null;
    const description = descIdx !== -1 && tokens[descIdx] ? tokens[descIdx].trim() : '';

    const numericAmount = parseFloat(amountStr);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      errors.push({ line: i + 1, message: `Invalid transaction amount: "${tokens[amountIdx]}".` });
      continue;
    }

    const parsedDate = new Date(dateStr);
    const validDate = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();

    const isDuplicate = seenReferences.has(reference);
    if (reference) {
      seenReferences.add(reference);
    }

    transactions.push({
      rowNumber: i + 1,
      rawRow: rawLine,
      transactionDate: validDate,
      amountPaise: rupeesToPaise(numericAmount),
      reference,
      upiId: upiId || null,
      description,
      isDuplicateInBatch: isDuplicate,
    });
  }

  return {
    success: errors.length === 0,
    transactions,
    errors,
    totalRows: lines.length - 1,
  };
}
