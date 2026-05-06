import { Prisma } from "@prisma/client";

export const categoryOnePayload = () =>
  Prisma.validator<Prisma.CategoryInclude>()({
    _count: {
      select: { tools: { where: { publishedAt: { lte: new Date() } } } },
    },
  });

export const categoryManyPayload = () =>
  Prisma.validator<Prisma.CategoryInclude>()({
    _count: {
      select: { tools: { where: { publishedAt: { lte: new Date() } } } },
    },
  });

export type CategoryOne = Prisma.CategoryGetPayload<{
  include: ReturnType<typeof categoryOnePayload>;
}>;
export type CategoryMany = Prisma.CategoryGetPayload<{
  include: ReturnType<typeof categoryManyPayload>;
}>;
