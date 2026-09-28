import {
  sanitizeDecimalText,
  sanitizeIntegerText,
  parseDecimal,
  parseInteger,
  numberToText,
} from '../utils/numericInput';

describe('sanitizeDecimalText', () => {
  it('keeps a trailing dot, so a decimal can actually be typed', () => {
    expect(sanitizeDecimalText('12.')).toBe('12.');
  });

  it('accepts a comma as the decimal separator', () => {
    // Uzbek and Russian keyboards give a comma; the old code turned this into
    // NaN and then into a price of 0.
    expect(sanitizeDecimalText('12,5')).toBe('12.5');
  });

  it('keeps only the first separator', () => {
    expect(sanitizeDecimalText('1.2.3')).toBe('1.23');
    expect(sanitizeDecimalText('1,2,3')).toBe('1.23');
  });

  it('strips letters, spaces, currency symbols and signs', () => {
    expect(sanitizeDecimalText('  35 000 so\'m ')).toBe('35000');
    expect(sanitizeDecimalText('-12')).toBe('12');
    expect(sanitizeDecimalText('1e5')).toBe('15');
  });

  it('preserves a leading zero and a leading separator', () => {
    expect(sanitizeDecimalText('0')).toBe('0');
    expect(sanitizeDecimalText('0.5')).toBe('0.5');
    expect(sanitizeDecimalText('.5')).toBe('.5');
  });

  it('passes an empty field through', () => {
    expect(sanitizeDecimalText('')).toBe('');
  });
});

describe('sanitizeIntegerText', () => {
  it('drops separators and everything non-numeric', () => {
    expect(sanitizeIntegerText('15.7')).toBe('157');
    expect(sanitizeIntegerText('15 min')).toBe('15');
    expect(sanitizeIntegerText('')).toBe('');
  });
});

describe('parseDecimal', () => {
  it('reads plain and comma-separated numbers', () => {
    expect(parseDecimal('35000')).toBe(35000);
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('0.5')).toBe(0.5);
    expect(parseDecimal('.5')).toBe(0.5);
  });

  it('reads zero as zero, not as absent', () => {
    expect(parseDecimal('0')).toBe(0);
  });

  it('returns null — never 0 — when there is no usable number', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
    expect(parseDecimal('.')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });

  it('treats a half-typed decimal as its integer part', () => {
    expect(parseDecimal('12.')).toBe(12);
  });
});

describe('parseInteger', () => {
  it('accepts whole numbers and rejects fractions', () => {
    expect(parseInteger('15')).toBe(15);
    expect(parseInteger('0')).toBe(0);
    expect(parseInteger('15.5')).toBeNull();
    expect(parseInteger('')).toBeNull();
  });
});

describe('numberToText', () => {
  it('renders zero as "0" rather than blanking the field', () => {
    expect(numberToText(0)).toBe('0');
  });

  it('renders absent and unusable values as an empty field', () => {
    expect(numberToText(undefined)).toBe('');
    expect(numberToText(null)).toBe('');
    expect(numberToText(Number.NaN)).toBe('');
  });

  it('round-trips a normal value', () => {
    expect(numberToText(35000)).toBe('35000');
    expect(numberToText(12.5)).toBe('12.5');
  });
});
