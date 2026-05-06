import { Prisma } from "@prisma/client";

export const collectionOnePayload = () =>
  Prisma.validator<Prisma.CollectionInclude>()({
    _count: {
      select: { tools: { where: { publishedAt: { lte: new Date() } } } },
    },
  });

export const collectionManyPayload = () =>
  Prisma.validator<Prisma.CollectionInclude>()({
    _count: {
      select: { tools: { where: { publishedAt: { lte: new Date() } } } },
    },
  });

export type CollectionOne = Prisma.CollectionGetPayload<{
  include: ReturnType<typeof collectionOnePayload>;
}>;
export type CollectionMany = Prisma.CollectionGetPayload<{
  include: ReturnType<typeof collectionManyPayload>;
}>;
