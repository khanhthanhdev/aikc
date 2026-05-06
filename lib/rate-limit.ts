import { env } from "~/env";

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_ENTRIES = 10_000;

// Clean up expired entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

export interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Optional scope so multiple independent limits can share an IP */
  scope?: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  scope?: string;
}

/**
 * Resolve the client IP from upstream headers in trust order.
 * Cloudflare provides CF-Connecting-IP; Caddy forwards X-Real-IP from it.
 * X-Forwarded-For is only consulted as a last resort because it is the most
 * easily spoofed header.
 */
export function getClientIpFromHeaders(h: Headers): string {
  return (
    h.get("cf-connecting-ip")?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function getClientIp(req: Request): string {
  return getClientIpFromHeaders(req.headers);
}

/**
 * Lazy eviction so the map cannot grow unbounded under random-IP floods.
 */
function evictIfFull(now: number) {
  if (rateLimitMap.size < MAX_ENTRIES) {
    return;
  }
  for (const [key, value] of rateLimitMap) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
  if (rateLimitMap.size >= MAX_ENTRIES) {
    const first = rateLimitMap.keys().next().value;
    if (first !== undefined) {
      rateLimitMap.delete(first);
    }
  }
}

/**
 * Core fixed-window check given an explicit IP address.
 */
export function rateLimitByAddress(
  ip: string,
  config: RateLimitConfig
): RateLimitResult {
  const scope = config.scope ?? "default";
  const key = `rate:${scope}:${ip}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  evictIfFull(now);

  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return {
      success: true,
      remaining: config.limit - 1,
      resetAt: now + windowMs,
      scope,
    };
  }

  if (entry.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetTime,
      scope,
    };
  }

  entry.count++;
  return {
    success: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetTime,
    scope,
  };
}

/**
 * Request-based wrapper that resolves the client IP from headers.
 */
export function rateLimitByIp(
  req: Request,
  config: RateLimitConfig
): RateLimitResult {
  return rateLimitByAddress(getClientIp(req), config);
}

/**
 * Apply multiple rate limits in order against an explicit IP. Returns the
 * first failing result, or the most restrictive successful result.
 */
export function rateLimitByAddressMulti(
  ip: string,
  configs: RateLimitConfig[]
): RateLimitResult {
  let tightest: RateLimitResult | null = null;

  for (const config of configs) {
    const result = rateLimitByAddress(ip, config);
    if (!result.success) {
      return result;
    }
    if (tightest === null || result.remaining < tightest.remaining) {
      tightest = result;
    }
  }

  return (
    tightest ?? {
      success: true,
      remaining: Number.POSITIVE_INFINITY,
      resetAt: Date.now(),
    }
  );
}

/**
 * Request-based wrapper. Note: when an earlier limit succeeds and a later
 * one fails, the earlier counter has still been incremented. Acceptable for
 * typical IP rate-limit use cases.
 */
export function rateLimitByIpMulti(
  req: Request,
  configs: RateLimitConfig[]
): RateLimitResult {
  return rateLimitByAddressMulti(getClientIp(req), configs);
}

/**
 * Reject cross-origin requests to JSON APIs that should only be reachable
 * from our own site (or same-origin server-side calls).
 *
 * Accepts:
 *  - Same-origin requests whose Origin matches NEXT_PUBLIC_SITE_URL.
 *  - Requests with no Origin (server-to-server) only when allowed.
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

/**
 * Helper that builds a 429 JSON response from a `RateLimitResult`.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  message?: string
): Response {
  const retryAfter = Math.max(
    1,
    Math.ceil((result.resetAt - Date.now()) / 1000)
  );
  return new Response(
    JSON.stringify({
      error: message ?? "Too many requests. Please slow down.",
      scope: result.scope,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}
