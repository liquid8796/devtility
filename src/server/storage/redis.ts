import { Redis } from "@upstash/redis";

/**
 * Shared Upstash Redis client (REST — works on Vercel Fluid Compute).
 * Supports both env conventions:
 *  - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  (Upstash Marketplace integration)
 *  - KV_REST_API_URL / KV_REST_API_TOKEN                (legacy Vercel KV naming)
 * Returns null when not configured — callers must degrade gracefully.
 */

declare global {
  var __devtilityRedis: Redis | null | undefined;
}

export function getRedis(): Redis | null {
  if (globalThis.__devtilityRedis !== undefined) return globalThis.__devtilityRedis;

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  globalThis.__devtilityRedis = url && token ? new Redis({ url, token }) : null;
  return globalThis.__devtilityRedis;
}
