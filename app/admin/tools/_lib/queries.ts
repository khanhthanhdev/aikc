import "server-only";

import { type Prisma, PricingTier, TranslationStatus } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "~/services/prisma";
import { endOfAdminDay, startOfAdminDay } from "~/utils/admin-dates";
import { FILTER_NONE, type GetToolsSchema } from "./validations";

/** Faceted filters arrive as a dot-joined string, e.g. `draft.scheduled`. */
const parseFacet = (value?: string) => value?.split(".").filter(Boolean) ?? [];

export type ToolStatus = "published" | "scheduled" | "draft";

const toolInclude = {
  categories: { select: { name: true, slug: true } },
} satisfies Prisma.ToolInclude;

/**
 * `status` is derived from `publishedAt` so the table can show and filter it
 * like any other column.
 */
export type ToolRow = Prisma.ToolGetPayload<{ include: typeof toolInclude }> & {
  status: ToolStatus;
};

const getToolStatus = (publishedAt: Date | null, now: Date): ToolStatus => {
  if (!publishedAt) return "draft";
  return publishedAt > now ? "scheduled" : "published";
};

/**
 * A two-way facet (e.g. broken / ok) filters only when exactly one side is
 * picked; both or neither means every tool.
 */
const parseToggle = (value: string | undefined, on: string, off: string) => {
  const values = parseFacet(value);
  if (values.includes(on) === values.includes(off)) return undefined;
  return values.includes(on);
};

const isPricingTier = (value: string): value is PricingTier =>
  Object.hasOwn(PricingTier, value);

const isTranslationStatus = (value: string): value is TranslationStatus =>
  Object.hasOwn(TranslationStatus, value);

export async function getTools(input: GetToolsSchema) {
  noStore();
  const { page, per_page, sort, name, from, to } = input;

  try {
    // Offset to paginate the results
    const offset = (page - 1) * per_page;

    // Column and order to sort by
    // Spliting the sort string by "." to get the column and order
    // Example: "title.desc" => ["title", "desc"]
    const [column, order] = (sort?.split(".").filter(Boolean) ?? [
      "createdAt",
      "desc",
    ]) as [
      keyof Prisma.ToolOrderByWithRelationInput | undefined,
      "asc" | "desc" | undefined,
    ];

    // Convert the date strings to date objects
    const fromDate = from ? startOfAdminDay(from) : undefined;
    const toDate = to ? endOfAdminDay(to) : undefined;
    const now = new Date();

    const statusFilters: Record<ToolStatus, Prisma.ToolWhereInput> = {
      published: { publishedAt: { lte: now } },
      scheduled: { publishedAt: { gt: now } },
      draft: { publishedAt: null },
    };

    const statuses = parseFacet(input.status).filter(
      (status): status is ToolStatus => Object.hasOwn(statusFilters, status)
    );
    const categories = parseFacet(input.categories);
    const roles = parseFacet(input.roles);
    const pricingTiers = parseFacet(input.pricingTier);
    const translationStatuses = parseFacet(input.translationStatusVi).filter(
      isTranslationStatus
    );

    // Each multi-value facet becomes one OR group, and the groups are ANDed,
    // so "Draft + Scheduled" in a category means either status, in that
    // category. `FILTER_NONE` matches tools with the field left empty.
    const facetFilters = [
      statuses.map((status) => statusFilters[status]),
      categories.map(
        (slug): Prisma.ToolWhereInput =>
          slug === FILTER_NONE
            ? { categories: { none: {} } }
            : { categories: { some: { slug } } }
      ),
      roles.map(
        (role): Prisma.ToolWhereInput =>
          role === FILTER_NONE
            ? { roles: { isEmpty: true } }
            : { roles: { has: role } }
      ),
      pricingTiers
        .filter((tier) => tier === FILTER_NONE || isPricingTier(tier))
        .map(
          (tier): Prisma.ToolWhereInput => ({
            pricingTier: isPricingTier(tier) ? tier : null,
          })
        ),
    ]
      .filter((group) => group.length)
      .map((group): Prisma.ToolWhereInput => ({ OR: group }));

    const where: Prisma.ToolWhereInput = {
      // Filter by name
      name: name ? { contains: name, mode: "insensitive" } : undefined,

      // Filter by createdAt
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },

      translationStatusVi: translationStatuses.length
        ? { in: translationStatuses }
        : undefined,
      isBroken: parseToggle(input.isBroken, "broken", "ok"),
      isFeatured: parseToggle(input.isFeatured, "featured", "regular"),

      AND: facetFilters.length ? facetFilters : undefined,
    };

    // Transaction is used to ensure both queries are executed in a single transaction
    const [tools, toolsTotal] = await prisma.$transaction([
      prisma.tool.findMany({
        where,
        include: toolInclude,
        orderBy: column ? { [column]: order } : undefined,
        take: per_page,
        skip: offset,
      }),

      prisma.tool.count({
        where,
      }),
    ]);

    const rows: ToolRow[] = tools.map((tool) => ({
      ...tool,
      status: getToolStatus(tool.publishedAt, now),
    }));

    const pageCount = Math.ceil(toolsTotal / per_page);
    return { tools: rows, toolsTotal, pageCount };
  } catch (_err) {
    return { tools: [], toolsTotal: 0, pageCount: 0 };
  }
}

export async function getToolSlugs() {
  noStore();
  try {
    return await prisma.tool.findMany({ select: { slug: true } });
  } catch (_err) {
    return [];
  }
}

export async function getCategories() {
  noStore();
  try {
    return await prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch (_err) {
    return [];
  }
}

export async function getCategoryFilterOptions() {
  noStore();
  try {
    return await prisma.category.findMany({
      select: { name: true, slug: true },
      orderBy: { name: "asc" },
    });
  } catch (_err) {
    return [];
  }
}

export async function getTags() {
  noStore();
  try {
    return await prisma.tag.findMany({
      select: { id: true, slug: true },
      orderBy: { slug: "asc" },
    });
  } catch (_err) {
    return [];
  }
}

export async function getToolCountByStatus() {
  noStore();
  try {
    return await prisma.tool.groupBy({
      by: ["publishedAt"],
      _count: {
        publishedAt: true,
      },
    });
  } catch (_err) {
    return [];
  }
}

export async function getToolBySlug(slug: string) {
  noStore();
  try {
    return await prisma.tool.findUnique({
      where: { slug },
      include: {
        categories: true,
        tags: true,
      },
    });
  } catch (_err) {
    return null;
  }
}
