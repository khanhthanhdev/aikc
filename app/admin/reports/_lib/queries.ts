import "server-only";

import { type Prisma, ReportType } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "~/services/prisma";
import { endOfAdminDay, startOfAdminDay } from "~/utils/admin-dates";
import type { GetReportsSchema } from "./validations";

/** Faceted filters arrive as a dot-joined string, e.g. `OUTDATED.OTHER`. */
const parseFacet = (value?: string) => value?.split(".").filter(Boolean) ?? [];

const isReportType = (value: string): value is ReportType =>
  Object.hasOwn(ReportType, value);

const reportInclude = {
  tool: {
    select: {
      id: true,
      name: true,
      slug: true,
      faviconUrl: true,
      websiteUrl: true,
      isBroken: true,
    },
  },
} satisfies Prisma.ReportInclude;

export type ReportStatus = "open" | "resolved";

/**
 * `status` is derived from `resolvedAt` so the table can filter on it like any
 * other column.
 */
export type ReportRow = Prisma.ReportGetPayload<{
  include: typeof reportInclude;
}> & { status: ReportStatus };

export async function getReports(input: GetReportsSchema) {
  noStore();
  const { page, per_page, sort, message, type, status, from, to } = input;

  try {
    const offset = (page - 1) * per_page;

    const [column, order] = (sort?.split(".").filter(Boolean) ?? [
      "createdAt",
      "desc",
    ]) as [
      keyof Prisma.ReportOrderByWithRelationInput | undefined,
      "asc" | "desc" | undefined,
    ];

    const fromDate = from ? startOfAdminDay(from) : undefined;
    const toDate = to ? endOfAdminDay(to) : undefined;
    const types = parseFacet(type).filter(isReportType);
    const statuses = parseFacet(status);

    // Both or neither selected means no filter on status.
    const resolvedAt =
      statuses.includes("open") === statuses.includes("resolved")
        ? undefined
        : statuses.includes("open")
          ? null
          : { not: null };

    const where: Prisma.ReportWhereInput = {
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },

      type: types.length ? { in: types } : undefined,
      resolvedAt,

      // Searching by tool name is what admins reach for; the message and the
      // reporter's email are matched too.
      OR: message
        ? [
            { message: { contains: message, mode: "insensitive" } },
            { userEmail: { contains: message, mode: "insensitive" } },
            { tool: { name: { contains: message, mode: "insensitive" } } },
          ]
        : undefined,
    };

    const [reports, reportsTotal] = await prisma.$transaction([
      prisma.report.findMany({
        include: reportInclude,
        orderBy: column ? { [column]: order } : undefined,
        skip: offset,
        take: per_page,
        where,
      }),

      prisma.report.count({ where }),
    ]);

    const rows: ReportRow[] = reports.map((report) => ({
      ...report,
      status: report.resolvedAt ? "resolved" : "open",
    }));

    const pageCount = Math.ceil(reportsTotal / per_page);
    return { reports: rows, reportsTotal, pageCount };
  } catch {
    return { reports: [], reportsTotal: 0, pageCount: 0 };
  }
}
