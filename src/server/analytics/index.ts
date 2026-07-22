import { getRedis } from "@/server/storage/redis";

import { MemoryAnalyticsRepository } from "./memory-repository";
import { RedisAnalyticsRepository } from "./redis-repository";
import type { AnalyticsRepository } from "./types";

declare global {
  var __devtilityAnalytics: AnalyticsRepository | undefined;
}

/** Factory: Redis in production, in-memory fallback for local dev. Singleton across HMR. */
export function getAnalyticsRepository(): AnalyticsRepository {
  if (!globalThis.__devtilityAnalytics) {
    const redis = getRedis();
    globalThis.__devtilityAnalytics = redis
      ? new RedisAnalyticsRepository(redis)
      : new MemoryAnalyticsRepository();
  }
  return globalThis.__devtilityAnalytics;
}

export type { AnalyticsRepository, TrafficStats } from "./types";
