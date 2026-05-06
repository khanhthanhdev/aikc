import type { Prisma } from "@prisma/client";
import {
  type CategoryMany,
  categoryManyPayload,
  categoryOnePayload,
} from "~/server/categories/payloads";
import { prisma } from "~/services/prisma";

type FindCategoriesArgs = Omit<
  Prisma.CategoryFindManyArgs,
  "select" | "include"
>;

export const findCategories = async ({
  where,
  orderBy,
  ...args
}: FindCategoriesArgs): Promise<CategoryMany[]> => {
  return prisma.category.findMany({
    ...args,
    orderBy: { name: "asc", ...orderBy },
    where,
    include: categoryManyPayload(),
  }) as unknown as Promise<CategoryMany[]>;
};

export const findCategorySlugs = async ({
  where,
  orderBy,
  ...args
}: Prisma.CategoryFindManyArgs) => {
  return prisma.category.findMany({
    ...args,
    orderBy: { name: "asc", ...orderBy },
    where,
    select: { slug: true, updatedAt: true, createdAt: true },
  });
};

export const findUniqueCategory = async ({
  ...args
}: Prisma.CategoryFindUniqueArgs) => {
  return prisma.category.findUnique({
    ...args,
    include: categoryOnePayload(),
  });
};
