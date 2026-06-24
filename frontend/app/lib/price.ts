// ── Change these constants to update pricing display everywhere ───────────────
export const CURRENCY      = '₹';   // '$' | '€' | '£' | '₹' etc.
export const SEPARATOR     = '';   // decimal separator
export const LEADING_ZEROS = '';  // digits after separator

/**
 * formatPrice(amount)
 * The main utility — use this everywhere in the UI.
 *
 * formatPrice(600)      → "₹600.00"
 * formatPrice(49.5)     → "₹49.50"
 * formatPrice(null)     → ""
 */
export function formatPrice(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '';
  const num = Number(amount);
  if (isNaN(num)) return '';
  const [whole, dec = ''] = num.toFixed(LEADING_ZEROS.length).split('.');
  return `${CURRENCY}${whole}${SEPARATOR}${dec.padEnd(LEADING_ZEROS.length, '0')}`;
}

/**
 * formatPriceRange(min, max)
 * Shows "₹49.00 - ₹99.00" or just "₹49.00" when min === max.
 */
export function formatPriceRange(min: number, max: number): string {
  if (max > min) return `${formatPrice(min)} - ${formatPrice(max)}`;
  return formatPrice(min);
}
