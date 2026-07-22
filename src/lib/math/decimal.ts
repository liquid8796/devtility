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

/** Parse user input ("1.234,56" vi / "1,234.56" en / "1234.56") into a Decimal, or null. */
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
    // "1,234,567" → thousands; "3,14" → decimal comma
    const parts = normalized.split(",");
    const looksLikeThousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
    normalized = looksLikeThousands ? parts.join("") : normalized.replace(",", ".");
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

/** Format with Vietnamese thousands separators (1.234.567,89). */
export function formatDecimalVN(value: Decimal, dp = 2): string {
  if (!value.isFinite()) return "—";
  const n = value.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP).toNumber();
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: dp }).format(n);
}
