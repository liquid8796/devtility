import type { Localized } from "@/lib/i18n";
import { Decimal } from "@/lib/math/decimal";

/**
 * Pure helpers for converting numbers between positional bases (2–36) and for
 * converting text to/from raw UTF-8 bytes rendered in various bases.
 *
 * All error messages are user-facing `Localized` objects (vi/en) so UI
 * components can surface them directly via `t(...)`.
 */

/** Digit alphabet for bases up to 36 (lowercase canonical form). */
const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Maximum number of fractional digits emitted in the target base. */
export const MAX_FRACTION_DIGITS = 24;

/** Guard against pathological inputs freezing the UI. */
const MAX_INPUT_LENGTH = 10_000;

export type Result =
  | {
      ok: true;
      value: string;
      /** True when the fractional part was cut off at {@link MAX_FRACTION_DIGITS} digits. */
      truncated?: boolean;
    }
  | { ok: false; error: Localized };

function err(error: Localized): Result {
  return { ok: false, error };
}

/** Shared "empty input" message. */
const EMPTY_VALUE: Localized = {
  vi: "Vui lòng nhập giá trị cần chuyển đổi.",
  en: "Please enter a value to convert.",
};

/** Returns true when `base` is an integer within [2, 36]. */
export function isValidBase(base: number): boolean {
  return Number.isInteger(base) && base >= 2 && base <= 36;
}

/** Numeric value of a digit character, or -1 when it is not a base-36 digit. */
function digitValue(ch: string): number {
  return DIGITS.indexOf(ch);
}

/**
 * Convert `value` (optionally signed, optionally fractional, e.g. "-1010.101")
 * from `fromBase` to `toBase`.
 *
 * - Bases 2–36, digits `0-9 a-z` (case-insensitive).
 * - The integer part uses BigInt, so it supports arbitrarily large numbers.
 * - The fractional part is computed with Decimal (precision 40) and emitted
 *   with at most {@link MAX_FRACTION_DIGITS} digits in the target base;
 *   trailing zeros are trimmed and `truncated` is set when digits were cut.
 * - Output digits are lowercase; callers may uppercase for display.
 */
export function convertBase(value: string, fromBase: number, toBase: number): Result {
  if (!isValidBase(fromBase) || !isValidBase(toBase)) {
    return err({
      vi: "Hệ cơ số phải là số nguyên từ 2 đến 36.",
      en: "The base must be an integer between 2 and 36.",
    });
  }

  let s = value.trim().toLowerCase();
  if (!s) return err(EMPTY_VALUE);
  if (s.length > MAX_INPUT_LENGTH) {
    return err({
      vi: "Giá trị quá dài (tối đa 10.000 ký tự).",
      en: "The value is too long (maximum 10,000 characters).",
    });
  }

  // Optional sign
  let negative = false;
  if (s.startsWith("+") || s.startsWith("-")) {
    negative = s.startsWith("-");
    s = s.slice(1);
  }

  // Allow digit grouping with spaces / underscores ("1010 1010", "ff_ff")
  s = s.replace(/[\s_]/g, "");
  if (!s) return err(EMPTY_VALUE);

  if ((s.match(/\./g) ?? []).length > 1) {
    return err({
      vi: "Giá trị chỉ được chứa tối đa một dấu chấm thập phân.",
      en: "The value may contain at most one decimal point.",
    });
  }

  const dotIndex = s.indexOf(".");
  const intRaw = dotIndex === -1 ? s : s.slice(0, dotIndex);
  const fracRaw = dotIndex === -1 ? "" : s.slice(dotIndex + 1);
  if (!intRaw && !fracRaw) {
    return err(EMPTY_VALUE);
  }

  // Validate every digit against the source base
  for (const ch of intRaw + fracRaw) {
    const d = digitValue(ch);
    if (d === -1 || d >= fromBase) {
      return err({
        vi: `Ký tự không hợp lệ cho hệ cơ số ${fromBase}: "${ch}"`,
        en: `Invalid character for base ${fromBase}: "${ch}"`,
      });
    }
  }

  // ---- Integer part (BigInt → arbitrary precision) ----
  const bigFrom = BigInt(fromBase);
  let intVal = BigInt(0);
  for (const ch of intRaw) {
    intVal = intVal * bigFrom + BigInt(digitValue(ch));
  }
  const intOut = intVal.toString(toBase);

  // ---- Fractional part (Decimal, precision 40) ----
  let fracOut = "";
  let truncated = false;
  if (fracRaw) {
    // Horner evaluation from the right: frac = (frac + digit) / fromBase
    const fb = new Decimal(fromBase);
    let frac = new Decimal(0);
    for (let i = fracRaw.length - 1; i >= 0; i--) {
      frac = frac.plus(digitValue(fracRaw[i])).div(fb);
    }

    const tb = new Decimal(toBase);
    const out: string[] = [];
    for (let i = 0; i < MAX_FRACTION_DIGITS && !frac.isZero(); i++) {
      frac = frac.mul(tb);
      // Clamp guards against rare rounding drift at precision limits
      const d = Math.min(Math.max(frac.floor().toNumber(), 0), toBase - 1);
      out.push(DIGITS[d]);
      frac = frac.minus(d);
    }
    if (!frac.isZero()) truncated = true;
    fracOut = out.join("").replace(/0+$/, "");
  }

  const isZero = intOut === "0" && !fracOut;
  const sign = negative && !isZero ? "-" : "";
  return {
    ok: true,
    value: sign + intOut + (fracOut ? "." + fracOut : ""),
    ...(truncated ? { truncated: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// Text ⇄ bytes (UTF-8)
// ---------------------------------------------------------------------------

/** Encode text into its UTF-8 byte sequence (each entry 0–255). */
export function textToBytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

/**
 * Decode a UTF-8 byte sequence back into text. Uses a fatal decoder so an
 * invalid sequence yields a friendly localized error instead of U+FFFD noise.
 */
export function bytesToText(bytes: number[]): Result {
  for (const b of bytes) {
    if (!Number.isInteger(b) || b < 0 || b > 255) {
      return err({
        vi: "Danh sách byte chứa giá trị nằm ngoài phạm vi 0–255.",
        en: "The byte list contains a value outside the 0–255 range.",
      });
    }
  }
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return { ok: true, value: decoder.decode(new Uint8Array(bytes)) };
  } catch {
    return err({
      vi: "Chuỗi byte không phải là UTF-8 hợp lệ nên không thể giải mã thành văn bản.",
      en: "The byte sequence is not valid UTF-8, so it cannot be decoded into text.",
    });
  }
}

export type ByteBase = 2 | 8 | 10 | 16;

export interface FormatBytesOptions {
  /** Token separator, default a single space. */
  separator?: string;
  /** Uppercase hex digits, default true. */
  uppercase?: boolean;
}

/**
 * Render bytes in the given base, space-separated. Binary is padded to 8 bits,
 * octal to 3 digits, hex to 2 digits (uppercase by default); decimal unpadded.
 */
export function formatBytes(bytes: number[], base: ByteBase, opts?: FormatBytesOptions): string {
  const separator = opts?.separator ?? " ";
  const uppercase = opts?.uppercase ?? true;
  return bytes
    .map((b) => {
      let s = b.toString(base);
      if (base === 2) s = s.padStart(8, "0");
      else if (base === 8) s = s.padStart(3, "0");
      else if (base === 16) s = s.padStart(2, "0");
      return uppercase ? s.toUpperCase() : s;
    })
    .join(separator);
}

const BYTE_TOKEN_PATTERNS: Record<ByteBase, RegExp> = {
  2: /^[01]+$/,
  8: /^[0-7]+$/,
  10: /^[0-9]+$/,
  16: /^[0-9a-f]+$/,
};

/**
 * Parse a whitespace/comma-separated list of byte tokens in the given base
 * (e.g. "48 65 6c" for hex). Each token must decode to 0–255. A hex "0x"
 * prefix per token is tolerated. Empty input yields an empty byte list.
 */
export function parseByteString(
  input: string,
  base: ByteBase,
): { ok: true; bytes: number[] } | { ok: false; error: Localized } {
  const tokens = input.trim().split(/[\s,;]+/).filter(Boolean);
  const bytes: number[] = [];
  for (const raw of tokens) {
    let tok = raw.toLowerCase();
    if (base === 16 && tok.startsWith("0x")) tok = tok.slice(2);
    if (!tok || !BYTE_TOKEN_PATTERNS[base].test(tok)) {
      return {
        ok: false,
        error: {
          vi: `Giá trị "${raw}" không hợp lệ cho hệ cơ số ${base}.`,
          en: `The value "${raw}" is not valid for base ${base}.`,
        },
      };
    }
    const n = parseInt(tok, base);
    if (n > 255) {
      return {
        ok: false,
        error: {
          vi: `Giá trị "${raw}" vượt quá phạm vi một byte (0–255).`,
          en: `The value "${raw}" exceeds the range of a single byte (0–255).`,
        },
      };
    }
    bytes.push(n);
  }
  return { ok: true, bytes };
}
