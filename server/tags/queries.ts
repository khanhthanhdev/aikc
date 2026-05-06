import type { Prisma } from "@prisma/client";
import {
  type TagMany,
  tagManyPayload,
  tagOnePayload,
} from "~/server/tags/payloads";
import { prisma } from "~/services/prisma";

type FindTagsArgs = Omit<Prisma.TagFindManyArgs, "select" | "include">;

export const findTags = async ({
  where,
  orderBy,
  ...args
}: FindTagsArgs): Promise<TagMany[]> => {
  return prisma.tag.findMany({
    ...args,
    orderBy: { name: "asc", ...orderBy },
    where: { tools: { some: { publishedAt: { lte: new Date() } } }, ...where },
    include: tagManyPayload(),
  }) as unknown as Promise<TagMany[]>;
};

export const findTagSlugs = async ({
  where,
  orderBy,
  ...args
}: Prisma.TagFindManyArgs) => {
  return prisma.tag.findMany({
    ...args,
    orderBy: { name: "asc", ...orderBy },
    where: { tools: { some: { publishedAt: { lte: new Date() } } }, ...where },
    select: { slug: true, updatedAt: true, createdAt: true },
  });
};

export const countTags = async ({ where, ...args }: Prisma.TagCountArgs) => {
  return prisma.tag.count({
    ...args,
    where: { tools: { some: { publishedAt: { lte: new Date() } } }, ...where },
  });
};

export const findUniqueTag = async ({ ...args }: Prisma.TagFindUniqueArgs) => {
  return prisma.tag.findUnique({
    ...args,
    include: tagOnePayload(),
  });
};
