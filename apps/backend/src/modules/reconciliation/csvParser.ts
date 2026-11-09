import { rupeesToPaise } from '@nivasa/shared';

export interface NormalizedBankTransaction {
  id: string;
  rowNumber: number;
  rawRow: string;
  transactionDate: string; // ISO 8601
  amountPaise: number;
  reference: string;
  upiId: string | null;
  description: string;
  isDuplicateInBatch: boolean;
}

export interface ParseRowError {
  line: number;
  message: string;
  rawRow: string;
}

export interface ParseResult {
  success: boolean;
  transactions: NormalizedBankTransaction[];
  errors: ParseRowError[];
  totalRows: number;
  validRows: number;
  duplicateRows: number;
}

const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit

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
 * Parses date string in multiple common bank formats:
 * - ISO: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ
 * - Indian/UK standard: DD/MM/YYYY or DD-MM-YYYY
 */
export function parseTransactionDate(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();

  // 1. Try standard ISO parse
  const isoParsed = new Date(trimmed);
  if (!isNaN(isoParsed.getTime()) && trimmed.includes('-') && trimmed.length >= 10) {
    return isoParsed.toISOString();
  }

  // 2. Try DD/MM/YYYY or DD-MM-YYYY
  const parts = trimmed.split(/[/.-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    // Handle 2-digit year (e.g. 26 -> 2026)
    if (year < 100) year += 2000;

    // Check if month/day swapped (e.g. YYYY/MM/DD)
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000) {
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    }
  }

  return !isNaN(isoParsed.getTime()) ? isoParsed.toISOString() : null;
}

/**
 * Parses bank CSV contents according to TDD Section 8:
 * Fields: Transaction date, Amount, Reference, UPI ID, Description.
 */
export function parseBankCsv(csvContent: string): ParseResult {
  if (!csvContent || typeof csvContent !== 'string') {
    return {
      success: false,
      transactions: [],
      errors: [{ line: 0, message: 'CSV content must be non-empty string.', rawRow: '' }],
      totalRows: 0,
      validRows: 0,
      duplicateRows: 0,
    };
  }

  if (Buffer.byteLength(csvContent, 'utf-8') > MAX_CSV_SIZE_BYTES) {
    return {
      success: false,
      transactions: [],
      errors: [{ line: 0, message: 'File size exceeds maximum allowed limit of 5MB.', rawRow: '' }],
      totalRows: 0,
      validRows: 0,
      duplicateRows: 0,
    };
  }

  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { success: true, transactions: [], errors: [], totalRows: 0, validRows: 0, duplicateRows: 0 };
  }

  // Parse and validate header
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
          message: 'Invalid CSV header. Expected at least Date, Amount, and Reference columns.',
          rawRow: lines[0],
        },
      ],
      totalRows: lines.length,
      validRows: 0,
      duplicateRows: 0,
    };
  }

  const transactions: NormalizedBankTransaction[] = [];
  const errors: ParseRowError[] = [];
  const seenReferencesInBatch = new Set<string>();
  let duplicateCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const tokens = tokenizeCsvLine(rawLine);

    // Validate column count
    if (tokens.length <= Math.max(dateIdx, amountIdx, refIdx)) {
      errors.push({
        line: i + 1,
        message: `Incomplete CSV row: missing expected columns.`,
        rawRow: rawLine,
      });
      continue;
    }

    const dateStr = tokens[dateIdx];
    const amountStr = tokens[amountIdx].replace(/[₹, ]/g, '');
    const reference = tokens[refIdx].toUpperCase().trim();
    let upiId = upiIdx !== -1 && tokens[upiIdx] ? tokens[upiIdx].toLowerCase().trim() : null;
    const description = descIdx !== -1 && tokens[descIdx] ? tokens[descIdx].trim() : '';

    // If UPI ID was not in separate column, search for UPI format in description/reference
    if (!upiId) {
      const upiMatch = `${reference} ${description}`.match(/([a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+)/);
      if (upiMatch) {
        upiId = upiMatch[1].toLowerCase();
      }
    }

    // Validate reference presence
    if (!reference) {
      errors.push({
        line: i + 1,
        message: 'Missing transaction reference/UTR in row.',
        rawRow: rawLine,
      });
      continue;
    }

    // Validate numeric amount
    const numericAmount = parseFloat(amountStr);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      errors.push({
        line: i + 1,
        message: `Invalid transaction amount: "${tokens[amountIdx]}". Amount must be a positive number.`,
        rawRow: rawLine,
      });
      continue;
    }

    // Validate date format
    const parsedDate = parseTransactionDate(dateStr);
    if (!parsedDate) {
      errors.push({
        line: i + 1,
        message: `Invalid date format: "${dateStr}". Expected ISO (YYYY-MM-DD) or DD/MM/YYYY.`,
        rawRow: rawLine,
      });
      continue;
    }

    const isDuplicate = seenReferencesInBatch.has(reference);
    if (isDuplicate) {
      duplicateCount++;
    } else {
      seenReferencesInBatch.add(reference);
    }

    transactions.push({
      id: `txn-row-${i + 1}-${Date.now()}`,
      rowNumber: i + 1,
      rawRow: rawLine,
      transactionDate: parsedDate,
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
    validRows: transactions.length,
    duplicateRows: duplicateCount,
  };
}
