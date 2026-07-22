import { DateTime } from "luxon";

import { getRedis } from "@/server/storage/redis";

import { CdnCurrencyApiProvider, normalizeCode } from "./cdn-provider";
import type { HistoryPoint, HistoryRange, RateProvider } from "./types";

/**
 * Builds pair history (base/quote) for chart display.
 *
 * Upstream only exposes one full snapshot per day, so a range means N fetches.
 * Two cache layers keep this cheap:
 *  1. Next.js Data Cache on each snapshot fetch (immutable → cached forever)
 *  2. Redis per-pair values (`dt:rates:<date>:<base>:<quote>`) so repeat chart
 *     requests never re-download the ~200 KB daily snapshots at all.
 */

const provider: RateProvider = new CdnCurrencyApiProvider();

export function getRateProvider(): RateProvider {
  return provider;
}

const RANGE_CONFIG: Record<HistoryRange, { days: number; stepDays: number }> = {
  "7d": { days: 7, stepDays: 1 },
  "1m": { days: 30, stepDays: 1 },
  "3m": { days: 90, stepDays: 3 },
  "1y": { days: 364, stepDays: 7 },
};

export function isHistoryRange(value: string): value is HistoryRange {
  return value in RANGE_CONFIG;
}

function datesForRange(range: HistoryRange): string[] {
  const { days, stepDays } = RANGE_CONFIG[range];
  // Latest daily snapshot may not exist yet for "today" (UTC) — start from yesterday.
  const end = DateTime.utc().minus({ days: 1 }).startOf("day");
  const dates: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= stepDays) {
    dates.push(end.minus({ days: offset }).toISODate());
  }
  return dates;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const i = index++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

export async function getPairHistory(
  baseRaw: string,
  quoteRaw: string,
  range: HistoryRange,
): Promise<HistoryPoint[]> {
  const base = normalizeCode(baseRaw);
  const quote = normalizeCode(quoteRaw);
  const dates = datesForRange(range);
  const redis = getRedis();

  const cacheKey = (date: string) => `dt:rates:${date}:${base}:${quote}`;
  const cached = new Map<string, number>();

  if (redis) {
    try {
      const values = await redis.mget<Array<number | null>>(...dates.map(cacheKey));
      values.forEach((v, i) => {
        if (typeof v === "number" && Number.isFinite(v)) cached.set(dates[i], v);
      });
    } catch {
      // cache is best-effort
    }
  }

  const missing = dates.filter((d) => !cached.has(d));
  const fetched = await mapWithConcurrency(missing, 8, async (date) => {
    const snapshot = await provider.getHistorical(base, date);
    const rate = snapshot?.rates[quote];
    return { date, rate: typeof rate === "number" && Number.isFinite(rate) ? rate : null };
  });

  if (redis) {
    const pipeline = redis.pipeline();
    let writes = 0;
    for (const { date, rate } of fetched) {
      if (rate !== null) {
        pipeline.set(cacheKey(date), rate);
        writes++;
      }
    }
    if (writes > 0) {
      try {
        await pipeline.exec();
      } catch {
        // best-effort
      }
    }
  }

  for (const { date, rate } of fetched) {
    if (rate !== null) cached.set(date, rate);
  }

  return dates
    .filter((d) => cached.has(d))
    .map((date) => ({ date, rate: cached.get(date)! }));
}
