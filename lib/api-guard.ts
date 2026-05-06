import "server-only";

import { env } from "~/env";

/**
 * Lightweight per-IP token-bucket limiter shared across server modules.
 * Bounded so it cannot grow unbounded under random-IP floods.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_ENTRIES = 10_000;

const evictExpired = (now: number) => {
  if (buckets.size < MAX_ENTRIES) {
    return;
  }
  for (const [key, value] of buckets) {
    if (now > value.resetAt) {
      buckets.delete(key);
    }
  }
  if (buckets.size >= MAX_ENTRIES) {
    const first = buckets.keys().next().value;
    if (first !== undefined) {
      buckets.delete(first);
    }
  }
};

export interface RateLimitOptions {
  /** Unique limiter name (e.g. "chat", "rag") to namespace buckets */
  scope: string;
  /** Max requests in `windowMs` per IP */
  max: number;
  /** Sliding window length in ms */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export function rateLimit(
  ip: string,
  { scope, max, windowMs }: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  evictExpired(now);

  const key = `${scope}:${ip}`;
  const record = buckets.get(key);

  if (!record || now > record.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (record.count >= max) {
    return {
      allowed: false,
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    };
  }
  record.count++;
  return { allowed: true };
}

/**
 * Resolve the client IP from upstream headers in trust order.
 * CF-Connecting-IP is set by Cloudflare and forwarded by Caddy as
 * X-Real-IP; either is acceptable.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Reject cross-origin requests to JSON APIs that should only be reachable
 * from our own site (or from same-origin server-side fetches).
 *
 * We accept:
 *   - Requests with no Origin (server-side fetch / curl with auth) when
 *     `allowMissingOrigin` is true.
 *   - Requests whose Origin matches the configured site URL.
 */
export function isSameOrigin(
  request: Request,
  { allowMissingOrigin = false }: { allowMissingOrigin?: boolean } = {}
): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return allowMissingOrigin;
  }

  let allowed: string;
  try {
    allowed = new URL(env.NEXT_PUBLIC_SITE_URL).origin;
  } catch {
    return false;
  }

  if (origin === allowed) {
    return true;
  }

  // In dev, allow localhost variants of the same port
  if (process.env.NODE_ENV !== "production") {
    try {
      const o = new URL(origin);
      if (o.hostname === "localhost" || o.hostname === "127.0.0.1") {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}
