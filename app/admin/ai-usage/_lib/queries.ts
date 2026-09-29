import "server-only";

import { AiQueryStatus, type Prisma } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "~/services/prisma";
import { endOfAdminDay, startOfAdminDay } from "~/utils/admin-dates";
import type { GetAiQueriesSchema } from "./validations";

/** Faceted filters arrive as a dot-joined string, e.g. `chat.rag`. */
const parseFacet = (value?: string) => value?.split(".").filter(Boolean) ?? [];

const isStatus = (value: string): value is AiQueryStatus =>
  value in AiQueryStatus;

/**
 * Answers can run to thousands of characters, so the list leaves them out and
 * the detail dialog fetches one with `getAiQueryAnswer`.
 */
export type AiQueryRow = Omit<Prisma.AiQueryGetPayload<object>, "answer">;

export async function getAiQueries(input: GetAiQueriesSchema) {
  noStore();
  const { page, per_page, sort, question, endpoint, status, from, to } =
    input;

  try {
    const offset = (page - 1) * per_page;

    const [column, order] = (sort?.split(".").filter(Boolean) ?? [
      "createdAt",
      "desc",
    ]) as [
      keyof Prisma.AiQueryOrderByWithRelationInput | undefined,
      "asc" | "desc" | undefined,
    ];

    const fromDate = from ? startOfAdminDay(from) : undefined;
    const toDate = to ? endOfAdminDay(to) : undefined;
    const endpoints = parseFacet(endpoint);
    const statuses = parseFacet(status).filter(isStatus);

    const where: Prisma.AiQueryWhereInput = {
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },

      endpoint: endpoints.length ? { in: endpoints } : undefined,
      status: statuses.length ? { in: statuses } : undefined,
      question: question
        ? { contains: question, mode: "insensitive" }
        : undefined,
    };

    const [aiQueries, aiQueriesTotal] = await prisma.$transaction([
      prisma.aiQuery.findMany({
        omit: { answer: true },
        orderBy: column ? { [column]: order } : undefined,
        skip: offset,
        take: per_page,
        where,
      }),

      prisma.aiQuery.count({ where }),
    ]);

    const pageCount = Math.ceil(aiQueriesTotal / per_page);
    return { aiQueries, aiQueriesTotal, pageCount };
  } catch {
    return { aiQueries: [], aiQueriesTotal: 0, pageCount: 0 };
  }
}

export type AiUsageSummary = {
  total: number;
  today: number;
  visitors: number;
  cacheHitRate: number | null;
  failed: number;
};

/**
 * Headline numbers shown above the log table.
 *
 * `visitors` counts distinct salted IP hashes, so it answers "how many people"
 * without the table ever holding an address.
 */
export async function getAiUsageSummary(): Promise<AiUsageSummary> {
  noStore();

  try {
    const [total, today, [{ visitors }], cacheHits, failed] =
      await prisma.$transaction([
        prisma.aiQuery.count(),

        prisma.aiQuery.count({
          where: { createdAt: { gte: startOfAdminDay() } },
        }),

        // Counted in the database: Prisma's `distinct` would load every id
        // into memory just to take the length of the list.
        prisma.$queryRaw<[{ visitors: number }]>`
          SELECT COUNT(DISTINCT "visitorId")::int AS visitors FROM "AiQuery"
        `,

        prisma.aiQuery.count({ where: { cacheHit: true } }),

        prisma.aiQuery.count({ where: { status: "ERROR" } }),
      ]);

    return {
      cacheHitRate: total > 0 ? cacheHits / total : null,
      failed,
      today,
      total,
      visitors,
    };
  } catch {
    return { cacheHitRate: null, failed: 0, today: 0, total: 0, visitors: 0 };
  }
}
