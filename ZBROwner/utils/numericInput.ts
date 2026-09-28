/**
 * Text-first numeric input handling.
 *
 * A numeric TextInput cannot hold a number in state. The obvious shape,
 *
 *   value={n ? String(n) : ''}
 *   onChangeText={(v) => setN(Number(v) || 0)}
 *
 * destroys the thing being typed, in three ways that all reached production:
 *
 *   "12."   parses to 12 and re-renders as "12", so the decimal point is
 *           deleted the instant it is typed. A decimal value cannot be entered.
 *   "12,5"  parses to NaN, and `|| 0` turns that into 0 — the price is silently
 *           wiped. A comma is the decimal separator on Uzbek and Russian
 *           keyboards, so this is the normal typing path here, not an edge case.
 *   0       is falsy, so the field blanks instead of showing "0", and a leading
 *           zero cannot be typed either ("0.5" is unreachable).
 *
 * The fix is to keep the raw text in state and convert once, on submit. These
 * helpers are that conversion, kept pure so they can be tested without a
 * component.
 */

/**
 * What the field should display after a keystroke.
 *
 * Normalises a comma to a dot, drops anything that is not a digit or a
 * separator, and keeps only the first separator. Deliberately preserves a
 * TRAILING dot — "12." is a legitimate intermediate state, and erasing it is
 * what makes decimals impossible to type.
 */
export function sanitizeDecimalText(text: string): string {
  const normalized = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const firstDot = normalized.indexOf('.');
  if (firstDot === -1) return normalized;
  return (
    normalized.slice(0, firstDot + 1) + normalized.slice(firstDot + 1).replace(/\./g, '')
  );
}

/** As above, for fields that take whole numbers only (minutes, calories, counts). */
export function sanitizeIntegerText(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

/**
 * The number the text means, or null when it does not mean one.
 *
 * null is "no usable value", never 0 — the caller decides whether that is an
 * empty optional field or a validation failure. Collapsing the two is what
 * turned a mistyped price into a price of zero.
 */
export function parseDecimal(text: string): number | null {
  const trimmed = sanitizeDecimalText(text).trim();
  if (trimmed === '' || trimmed === '.') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** parseDecimal for whole numbers; rejects a fractional value outright. */
export function parseInteger(text: string): number | null {
  const n = parseDecimal(text);
  return n !== null && Number.isInteger(n) ? n : null;
}

/**
 * A stored number rendered back into editable text.
 *
 * 0 becomes "0", not "" — the old falsy check is why a zero could not be shown
 * or typed.
 */
export function numberToText(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '' : String(value);
}
