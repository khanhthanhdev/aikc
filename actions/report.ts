"use server";

import { ReportType } from "@prisma/client";
import { headers } from "next/headers";
import { z } from "zod";
import { createServerAction } from "zsa";
import { prisma } from "~/services/prisma";

// In-memory rate limiter (resets on server restart)
// For production, consider using Redis or a database-backed solution
const reportRateLimiter = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const checkRateLimit = (
  ip: string
): { allowed: boolean; retryAfter?: number } => {
  const now = Date.now();
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

const reportSchema = z.object({
  toolId: z.string().min(1, "Tool ID is required"),
  type: z.nativeEnum(ReportType),
  message: z.string().optional(),
  userEmail: z.string().email("A valid email address is required"),
});

/**
 * Submit a report for a tool
 */
export const reportTool = createServerAction()
  .input(reportSchema)
  .handler(async ({ input }) => {
    // Get IP for rate limiting
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0] || "unknown";

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
