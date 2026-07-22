/**
 * Exchange-rate domain model.
 *
 * `RateProvider` (Strategy pattern) abstracts the upstream data source.
 * Default implementation uses the free fawazahmed0/currency-api CDN
 * (200+ fiat currencies + major cryptocurrencies, daily snapshots).
 * Swapping to a paid provider only requires a new implementation.
 */

export interface RateSnapshot {
  /** ISO date of the snapshot, e.g. "2026-07-23" */
  date: string;
  /** Base currency code (lowercase), e.g. "usd" */
  base: string;
  /** Map of quote currency code → rate (1 base = rate quote) */
  rates: Record<string, number>;
}

export interface CurrencyInfo {
  code: string;
  name: string;
}

export interface HistoryPoint {
  date: string;
  rate: number;
}

export type HistoryRange = "7d" | "1m" | "3m" | "1y";

export interface RateProvider {
  listCurrencies(): Promise<CurrencyInfo[]>;
  getLatest(base: string): Promise<RateSnapshot>;
  /** Returns null when the date is unavailable upstream. */
  getHistorical(base: string, date: string): Promise<RateSnapshot | null>;
}
