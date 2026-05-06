import "server-only";

import type { Prisma } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "~/services/prisma";
import type { GetAdsSchema } from "./validations";

export async function getAds(input: GetAdsSchema) {
  noStore();
  const { page, per_page, sort, name, from, to } = input;

  try {
    const offset = (page - 1) * per_page;

    const [column, order] = (sort?.split(".").filter(Boolean) ?? [
      "stepOrder",
      "asc",
    ]) as [
      keyof Prisma.AdOrderByWithRelationInput | undefined,
      "asc" | "desc" | undefined,
    ];

    const fromDate = from ? startOfDay(new Date(from)) : undefined;
    const toDate = to ? endOfDay(new Date(to)) : undefined;

    const where: Prisma.AdWhereInput = {
      name: name ? { contains: name, mode: "insensitive" } : undefined,
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },
    };

    const [ads, adsTotal] = await prisma.$transaction([
      prisma.ad.findMany({
        where,
        orderBy: column ? { [column]: order } : undefined,
        take: per_page,
        skip: offset,
      }),

      prisma.ad.count({
        where,
      }),
    ]);

    const pageCount = Math.ceil(adsTotal / per_page);
    return { ads, adsTotal, pageCount };
  } catch (_err) {
    return { ads: [], adsTotal: 0, pageCount: 0 };
  }
}

export async function getAdById(id: string) {
  noStore();
  try {
    return await prisma.ad.findUnique({
      where: { id },
    });
  } catch (_err) {
    return null;
  }
}
