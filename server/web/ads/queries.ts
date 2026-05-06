import type { Ad, AdType, Prisma } from "@prisma/client";
import { prisma } from "~/services/prisma";

export type AdOne = Ad;

export interface FindAdOptions {
  where?: { type?: AdType | string };
}

/**
 * Finds an active ad by type. Ads are active when the current date
 * is between startsAt and endsAt.
 */
export const findAd = async (
  options: FindAdOptions = {}
): Promise<AdOne | null> => {
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
};

/**
 * Finds all ads, optionally filtered by type.
 */
export const findAds = async (
  options: FindAdOptions = {}
): Promise<AdOne[]> => {
  const where: Prisma.AdWhereInput = {};

  if (options.where?.type) {
    where.OR = [{ type: options.where.type as AdType }, { type: "All" }];
  }

  return prisma.ad.findMany({
    where,
    orderBy: [{ stepOrder: "asc" }, { createdAt: "desc" }],
  });
};
