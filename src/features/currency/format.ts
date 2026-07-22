/** Number formatting tuned for exchange rates (VND is huge, BTC inverse is tiny). */
export function formatRate(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 10_000) return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
  if (abs >= 1) return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(value);
  return new Intl.NumberFormat("vi-VN", { maximumSignificantDigits: 6 }).format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** Popular codes pinned to the top of the pickers. */
export const POPULAR_FIAT = ["usd", "vnd", "eur", "jpy", "gbp", "cny", "krw", "sgd", "thb", "aud", "cad", "chf"];
export const POPULAR_CRYPTO = ["btc", "eth", "usdt", "bnb", "sol", "xrp", "ada", "doge"];
