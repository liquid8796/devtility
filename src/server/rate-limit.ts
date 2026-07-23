import { getRedis } from "@/server/storage/redis";

/**
 * Fixed-window rate limiter for API abuse protection.
 * Redis-backed when configured (INCR + EXPIRE on a per-window key),
 * in-memory Map fallback for local dev. Fails open when Redis errors,
 * so a storage outage never blocks legitimate traffic.
 */

interface MemoryWindow {
  count: number;
  /** Unix ms after which this window's entry can be discarded */
  expiresAt: number;
}

declare global {
  var __devtilityRateLimit: Map<string, MemoryWindow> | undefined;
}

/** In-memory fallback store. Singleton across HMR. */
function getMemoryStore(): Map<string, MemoryWindow> {
  globalThis.__devtilityRateLimit ??= new Map();
  return globalThis.__devtilityRateLimit;
}

export interface RateLimitOptions {
  /** Logical bucket name, e.g. "execute" or "snippets" */
  scope: string;
  /** Caller identity, typically the client IP */
  id: string;
  /** Max requests allowed per window */
  limit: number;
  /** Window length in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window resets (for the Retry-After header) */
  retryAfterSeconds: number;
}

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { scope, id, limit, windowSeconds } = options;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - (nowSeconds % windowSeconds);
  const retryAfterSeconds = Math.max(1, windowStart + windowSeconds - nowSeconds);
  const key = `dt:rl:${scope}:${id}:${windowStart}`;

  const redis = getRedis();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds);
      return { allowed: count <= limit, retryAfterSeconds };
    } catch (error) {
      console.error("[rate-limit] Redis failed, allowing request:", error);
      return { allowed: true, retryAfterSeconds };
    }
  }

  const store = getMemoryStore();
  // Lazy cleanup: drop windows that have already ended
  const nowMs = Date.now();
  for (const [staleKey, entry] of store) {
    if (entry.expiresAt <= nowMs) store.delete(staleKey);
  }

  const count = (store.get(key)?.count ?? 0) + 1;
  store.set(key, { count, expiresAt: (windowStart + windowSeconds) * 1000 });
  return { allowed: count <= limit, retryAfterSeconds };
}
