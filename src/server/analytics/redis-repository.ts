import { Redis } from "@upstash/redis";

import { ANALYTICS_TZ, bucketKeysFor, bucketWindows } from "./buckets";
import type { AnalyticsRepository, PageViewEvent, TrafficStats } from "./types";

const PREFIX = "dt:pv";

/** TTLs keep hourly/daily key cardinality bounded; month/year keys are kept forever. */
const HOUR_TTL_S = 60 * 60 * 24 * 8; // 8 days
const DAY_TTL_S = 60 * 60 * 24 * 400; // ~13 months

export class RedisAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly redis: Redis) {}

  async track(event: PageViewEvent): Promise<void> {
    const at = event.at ?? new Date();
    const keys = bucketKeysFor(at);

    const pipeline = this.redis.pipeline();
    pipeline.incr(`${PREFIX}:total`);
    pipeline.incr(`${PREFIX}:h:${keys.hour}`);
    pipeline.expire(`${PREFIX}:h:${keys.hour}`, HOUR_TTL_S);
    pipeline.incr(`${PREFIX}:d:${keys.day}`);
    pipeline.expire(`${PREFIX}:d:${keys.day}`, DAY_TTL_S);
    pipeline.incr(`${PREFIX}:m:${keys.month}`);
    pipeline.incr(`${PREFIX}:y:${keys.year}`);
    pipeline.zincrby(`${PREFIX}:paths`, 1, event.path);
    await pipeline.exec();
  }

  async getStats(): Promise<TrafficStats> {
    const windows = bucketWindows();

    const hourKeys = windows.hours.map((w) => `${PREFIX}:h:${w.key}`);
    const dayKeys = windows.days.map((w) => `${PREFIX}:d:${w.key}`);
    const monthKeys = windows.months.map((w) => `${PREFIX}:m:${w.key}`);
    const yearKeys = windows.years.map((w) => `${PREFIX}:y:${w.key}`);

    const [total, counts, topRaw] = await Promise.all([
      this.redis.get<number>(`${PREFIX}:total`),
      this.redis.mget<Array<number | null>>(...hourKeys, ...dayKeys, ...monthKeys, ...yearKeys),
      this.redis.zrange<Array<string | number>>(`${PREFIX}:paths`, 0, 9, {
        rev: true,
        withScores: true,
      }),
    ]);

    let cursor = 0;
    const slice = (n: number) => {
      const part = counts.slice(cursor, cursor + n);
      cursor += n;
      return part;
    };
    const hourCounts = slice(windows.hours.length);
    const dayCounts = slice(windows.days.length);
    const monthCounts = slice(windows.months.length);
    const yearCounts = slice(windows.years.length);

    const zip = (entries: typeof windows.hours, values: Array<number | null>) =>
      entries.map((w, i) => ({ key: w.key, label: w.label, count: Number(values[i] ?? 0) }));

    const topPaths: TrafficStats["topPaths"] = [];
    for (let i = 0; i + 1 < topRaw.length; i += 2) {
      topPaths.push({ path: String(topRaw[i]), count: Number(topRaw[i + 1]) });
    }

    return {
      totalViews: Number(total ?? 0),
      hourly: zip(windows.hours, hourCounts),
      daily: zip(windows.days, dayCounts),
      monthly: zip(windows.months, monthCounts),
      yearly: zip(windows.years, yearCounts),
      topPaths,
      backend: "redis",
      timezone: ANALYTICS_TZ,
    };
  }
}
