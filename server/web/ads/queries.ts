import type { Ad, AdType, Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "~/services/prisma";

export type AdOne = Ad;

export interface FindAdOptions {
  where?: { type?: AdType | string };
}

/**
 * Finds an active ad by type. Ads are active when the current date
 * is between startsAt and endsAt.
 */
export const findAd = unstable_cache(
  async (options: FindAdOptions = {}): Promise<AdOne | null> => {
    const now = new Date();

    const where: Prisma.AdWhereInput = {
      startsAt: { lte: now },
      endsAt: { gte: now },
    };

    if (options.where?.type) {
      // Match exact type or "All" type
      where.OR = [{ type: options.where.type as AdType }, { type: "All" }];
    }

    return prisma.ad.findFirst({
      where,
      orderBy: { createdAt: "desc" },
    });
  },
  ["find-active-ad"],
  { revalidate: 300, tags: ["ads"] }
);

/**
 * Finds all ads, optionally filtered by type.
 * Short-lived cache limits active-window staleness, while admin ad actions
 * call revalidateTag("ads") when ads are created/updated/deleted.
 */
export const findAds = unstable_cache(
  async (options: FindAdOptions = {}): Promise<AdOne[]> => {
    const now = new Date();
    const where: Prisma.AdWhereInput = {
      startsAt: { lte: now },
      endsAt: { gte: now },
    };

    if (options.where?.type) {
      where.OR = [{ type: options.where.type as AdType }, { type: "All" }];
    }

    return prisma.ad.findMany({
      where,
      orderBy: [{ stepOrder: "asc" }, { createdAt: "desc" }],
    });
  },
  ["find-active-ads"],
  { revalidate: 300, tags: ["ads"] }
);
