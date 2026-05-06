import { Prisma } from "@prisma/client";
import { categoryManyPayload } from "../categories/payloads";
import { collectionManyPayload } from "../collections/payloads";
import { tagManyPayload } from "../tags/payloads";

export const toolOnePayload = () =>
  Prisma.validator<Prisma.ToolInclude>()({
    categories: { include: categoryManyPayload() },
    collections: { include: collectionManyPayload() },
    tags: { include: tagManyPayload() },
  });

export const toolManyPayload = () =>
  Prisma.validator<Prisma.ToolInclude>()({
    categories: { include: categoryManyPayload() },
    collections: { include: collectionManyPayload() },
  });

export type ToolOne = Prisma.ToolGetPayload<{
  include: ReturnType<typeof toolOnePayload>;
}>;
export type ToolMany = Prisma.ToolGetPayload<{
  include: ReturnType<typeof toolManyPayload>;
}>;
