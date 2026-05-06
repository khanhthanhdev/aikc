"use server";

import { ReportType } from "@prisma/client";
import { headers } from "next/headers";
import { z } from "zod";
import { createServerAction } from "zsa";
import { prisma } from "~/services/prisma";

/**
 * In-memory rate limiter (resets on server restart).
 *
 * Hardened against:
 *  - Map memory growth: bounded with `MAX_ENTRIES` and lazy eviction of
 *    expired records on every check.
 *  - Header spoofing: prefers `CF-Connecting-IP` (set by Cloudflare and
 *    forwarded by Caddy) and falls back to `x-real-ip` and the *first*
 *    `x-forwarded-for` segment; never trusts arbitrary client headers.
 *
 * For multi-process / horizontal scaling, replace with a Redis or
 * database-backed limiter.
 */
const reportRateLimiter = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_ENTRIES = 10_000;

const evictExpired = (now: number) => {
  if (reportRateLimiter.size < MAX_ENTRIES) {
    return;
  }
  for (const [key, value] of reportRateLimiter) {
    if (now > value.resetAt) {
      reportRateLimiter.delete(key);
    }
  }
  // If still over the cap (lots of fresh entries), drop the oldest insertion.
  if (reportRateLimiter.size >= MAX_ENTRIES) {
    const firstKey = reportRateLimiter.keys().next().value;
    if (firstKey !== undefined) {
      reportRateLimiter.delete(firstKey);
    }
  }
};

const checkRateLimit = (
  ip: string
): { allowed: boolean; retryAfter?: number } => {
  const now = Date.now();
  evictExpired(now);

  const record = reportRateLimiter.get(ip);

  if (!record || now > record.resetAt) {
    reportRateLimiter.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
};

/**
 * Resolve the client IP from trusted upstream headers.
 * Order: CF-Connecting-IP > x-real-ip > first x-forwarded-for entry.
 */
const getClientIp = (h: Headers): string => {
  const cf = h.get("cf-connecting-ip");
  if (cf) {
    return cf.trim();
  }
  const real = h.get("x-real-ip");
  if (real) {
    return real.trim();
  }
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return "unknown";
};

const reportSchema = z.object({
  toolId: z.string().min(1, "Tool ID is required"),
  type: z.nativeEnum(ReportType),
  message: z.string().max(2000).optional(),
  userEmail: z.string().email("A valid email address is required").max(255),
});

/**
 * Submit a report for a tool
 */
export const reportTool = createServerAction()
  .input(reportSchema)
  .handler(async ({ input }) => {
    const headersList = await headers();
    const ip = getClientIp(headersList);

    // Skip rate limiting in development
    if (process.env.NODE_ENV !== "development") {
      const rateLimit = checkRateLimit(ip);
      if (!rateLimit.allowed) {
        throw new Error(
          `Too many reports. Please try again in ${rateLimit.retryAfter} seconds.`
        );
      }
    }

    // Verify the tool exists
    const tool = await prisma.tool.findUnique({
      where: { id: input.toolId },
      select: { id: true },
    });

    if (!tool) {
      throw new Error("Tool not found");
    }

    // Create the report
    const report = await prisma.report.create({
      data: {
        type: input.type,
        message: input.message,
        userEmail: input.userEmail,
        toolId: input.toolId,
      },
    });

    return { success: true, reportId: report.id };
  });
