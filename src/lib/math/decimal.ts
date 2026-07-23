import Decimal from "decimal.js";

/**
 * Central Decimal configuration — every calculator/converter must go through
 * this module instead of doing raw floating-point arithmetic, so results like
 * 0.1 + 0.2 render as 0.3 (not 0.30000000000000004).
 */
Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -21,
  toExpPos: 21,
});

export { Decimal };

export type DecimalInput = Decimal.Value;

export function dec(value: DecimalInput): Decimal {
  return new Decimal(value);
}

/**
 * Parse user input into a Decimal, or null (vi-first separator policy).
 *
 * - Comma only: exactly 1 comma is a decimal comma ("3,14" → 3.14, "1,234" → 1.234);
 *   2+ commas are thousands when every group after the first has 3 digits
 *   ("1,234,567" → 1234567), otherwise null.
 * - Dot only: exactly 1 dot is a decimal point ("1.234" → 1.234);
 *   2+ dots are vi thousands when every group after the first has 3 digits
 *   ("1.234.567" → 1234567), otherwise null.
 * - Mixed ("1.234,56" vi / "1,234.56" en): the right-most separator is the decimal point.
 */
export function parseDecimal(raw: string): Decimal | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let normalized = trimmed.replace(/\s+/g, "");
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    // The right-most separator is the decimal point; the other is thousands
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    // "3,14" / "1,234" → decimal comma; "1,234,567" → thousands; anything else → invalid
    const parts = normalized.split(",");
    if (parts.length === 2) {
      normalized = parts.join(".");
    } else if (parts.slice(1).every((p) => p.length === 3)) {
      normalized = parts.join("");
    } else {
      return null;
    }
  } else if (hasDot) {
    // "1.234" → decimal point; "1.234.567" → vi thousands; anything else → invalid
    const parts = normalized.split(".");
    if (parts.length > 2) {
      if (!parts.slice(1).every((p) => p.length === 3)) return null;
      normalized = parts.join("");
    }
  }

  try {
    const d = new Decimal(normalized);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

/** Format a Decimal for display, trimming trailing zeros, max `dp` decimal places. */
export function formatDecimal(value: Decimal, dp = 10): string {
  if (!value.isFinite()) return value.isNaN() ? "NaN" : value.isNegative() ? "-∞" : "∞";
  const fixed = value.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
  return fixed.toString();
}

/** Format with locale thousands separators (default vi-VN: 1.234.567,89). */
export function formatDecimalVN(value: Decimal, dp = 2, locale = "vi-VN"): string {
  if (!value.isFinite()) return "—";
  const n = value.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP).toNumber();
  return new Intl.NumberFormat(locale, { maximumFractionDigits: dp }).format(n);
}
