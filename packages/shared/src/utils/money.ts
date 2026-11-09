import { DEFAULT_MAINTENANCE_RATE_PAISE } from '../constants/index.js';

/**
 * Converts Indian Rupees (INR) to integer paise.
 * Avoids floating point errors by rounding.
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Converts integer paise to Indian Rupees (INR).
 */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/**
 * Calculates monthly base maintenance in integer paise.
 * Formula: areaSqFt * ratePerSqFtPaise
 */
export function calculateMaintenancePaise(
  areaSqFt: number,
  ratePerSqFtPaise: number = DEFAULT_MAINTENANCE_RATE_PAISE
): number {
  if (areaSqFt < 0) {
    throw new Error('Area in square feet cannot be negative');
  }
  if (ratePerSqFtPaise < 0) {
    throw new Error('Rate per square foot cannot be negative');
  }
  return Math.round(areaSqFt * ratePerSqFtPaise);
}

/**
 * Formats integer paise as standard Indian Rupee currency string.
 * Example: 747500 -> "₹7,475.00" or "₹7,475"
 */
export function formatPaiseToINR(paise: number, includeDecimals = false): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(rupees);
}

