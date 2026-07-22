import type { CurrencyInfo, RateProvider, RateSnapshot } from "./types";

/**
 * Free, keyless rate source: https://github.com/fawazahmed0/exchange-api
 * Primary CDN (jsDelivr) with an automatic fallback host, as recommended upstream.
 */

const PRIMARY = (version: string, file: string) =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${version}/v1/${file}`;
const FALLBACK = (version: string, file: string) =>
  `https://${version}.currency-api.pages.dev/v1/${file}`;

async function fetchJsonWithFallback<T>(
  version: string,
  file: string,
  revalidateSeconds: number | false,
): Promise<T | null> {
  const init: RequestInit & { next: { revalidate: number | false } } = {
    next: { revalidate: revalidateSeconds },
  };
  for (const url of [PRIMARY(version, file), FALLBACK(version, file)]) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return (await res.json()) as T;
    } catch {
      // try the next host
    }
  }
  return null;
}

const CODE_PATTERN = /^[a-z0-9]{2,10}$/;

export function normalizeCode(code: string): string {
  const c = code.trim().toLowerCase();
  if (!CODE_PATTERN.test(c)) throw new Error(`Mã tiền tệ không hợp lệ: ${code}`);
  return c;
}

export class CdnCurrencyApiProvider implements RateProvider {
  async listCurrencies(): Promise<CurrencyInfo[]> {
    const data = await fetchJsonWithFallback<Record<string, string>>(
      "latest",
      "currencies.json",
      60 * 60 * 24,
    );
    if (!data) return [];
    return Object.entries(data)
      .filter(([code, name]) => CODE_PATTERN.test(code) && typeof name === "string" && name.length > 0)
      .map(([code, name]) => ({ code, name }));
  }

  async getLatest(base: string): Promise<RateSnapshot> {
    const code = normalizeCode(base);
    const data = await fetchJsonWithFallback<{ date: string } & Record<string, unknown>>(
      "latest",
      `currencies/${code}.json`,
      60 * 15,
    );
    const rates = data?.[code];
    if (!data || typeof rates !== "object" || rates === null) {
      throw new Error(`Không lấy được tỷ giá cho ${code.toUpperCase()}`);
    }
    return { date: data.date, base: code, rates: rates as Record<string, number> };
  }

  async getHistorical(base: string, date: string): Promise<RateSnapshot | null> {
    const code = normalizeCode(base);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    // Historical snapshots are immutable — cache them indefinitely.
    const data = await fetchJsonWithFallback<{ date: string } & Record<string, unknown>>(
      date,
      `currencies/${code}.json`,
      false,
    );
    const rates = data?.[code];
    if (!data || typeof rates !== "object" || rates === null) return null;
    return { date: data.date ?? date, base: code, rates: rates as Record<string, number> };
  }
}
