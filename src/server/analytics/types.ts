/**
 * Analytics domain model.
 *
 * Storage is abstracted behind `AnalyticsRepository` (Repository pattern) so the
 * app runs identically on Upstash Redis (production, Vercel Marketplace) and an
 * in-memory store (local dev without credentials). Swapping in another backend
 * (Postgres, Mongo…) only requires a new implementation + factory branch.
 */

export interface PageViewEvent {
  path: string;
  /** Event timestamp (defaults to now) */
  at?: Date;
}

export interface TrafficBucket {
  /** Stable bucket key, e.g. "2026072314", "20260723", "202607", "2026" */
  key: string;
  /** Human label for charts, e.g. "14:00", "23/07", "07/2026", "2026" */
  label: string;
  count: number;
}

export interface TopPath {
  path: string;
  count: number;
}

export interface TrafficStats {
  totalViews: number;
  /** Last 24 hours, oldest → newest */
  hourly: TrafficBucket[];
  /** Last 30 days */
  daily: TrafficBucket[];
  /** Last 12 months */
  monthly: TrafficBucket[];
  /** Last 5 years */
  yearly: TrafficBucket[];
  topPaths: TopPath[];
  /** Which storage backend served this response */
  backend: "redis" | "memory";
  /** IANA timezone used for bucketing */
  timezone: string;
}

export interface AnalyticsRepository {
  track(event: PageViewEvent): Promise<void>;
  getStats(): Promise<TrafficStats>;
}
