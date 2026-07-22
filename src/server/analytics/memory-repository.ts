import { ANALYTICS_TZ, bucketKeysFor, bucketWindows } from "./buckets";
import type { AnalyticsRepository, PageViewEvent, TrafficStats } from "./types";

/**
 * In-memory fallback used when no Redis credentials are configured
 * (local development, or preview deployments without storage).
 * Data lives only as long as the server process.
 */
export class MemoryAnalyticsRepository implements AnalyticsRepository {
  private total = 0;
  private readonly counters = new Map<string, number>();
  private readonly paths = new Map<string, number>();

  private incr(key: string): void {
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
  }

  async track(event: PageViewEvent): Promise<void> {
    const keys = bucketKeysFor(event.at ?? new Date());
    this.total += 1;
    this.incr(`h:${keys.hour}`);
    this.incr(`d:${keys.day}`);
    this.incr(`m:${keys.month}`);
    this.incr(`y:${keys.year}`);
    this.paths.set(event.path, (this.paths.get(event.path) ?? 0) + 1);
  }

  async getStats(): Promise<TrafficStats> {
    const windows = bucketWindows();
    const read = (prefix: string, entries: Array<{ key: string; label: string }>) =>
      entries.map((w) => ({ key: w.key, label: w.label, count: this.counters.get(`${prefix}:${w.key}`) ?? 0 }));

    const topPaths = [...this.paths.entries()]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalViews: this.total,
      hourly: read("h", windows.hours),
      daily: read("d", windows.days),
      monthly: read("m", windows.months),
      yearly: read("y", windows.years),
      topPaths,
      backend: "memory",
      timezone: ANALYTICS_TZ,
    };
  }
}
