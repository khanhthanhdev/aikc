import { Prisma } from "@prisma/client";
import { categoryManyPayload } from "../categories/payloads";
import { collectionManyPayload } from "../collections/payloads";
import { tagManyPayload } from "../tags/payloads";

const publicToolFields = {
  id: true,
  name: true,
  nameVi: true,
  slug: true,
  tagline: true,
  taglineVi: true,
  description: true,
  descriptionVi: true,
  summary: true,
  summaryVi: true,
  content: true,
  contentVi: true,
  websiteUrl: true,
  affiliateUrl: true,
  faviconUrl: true,
  screenshotUrl: true,
  pricing: true,
  pricingVi: true,
  pricingTier: true,
  socials: true,
  isFeatured: true,
  isBroken: true,
  translationStatusVi: true,
  translationUpdatedAtVi: true,
  lastCheckedAt: true,
  xHandle: true,
  publishedAt: true,
  updatedAt: true,
  createdAt: true,
  relatedTools: true,
} satisfies Prisma.ToolSelect;

export const toolOnePayload = () =>
  Prisma.validator<Prisma.ToolSelect>()({
    ...publicToolFields,
    categories: { include: categoryManyPayload() },
    collections: { include: collectionManyPayload() },
    tags: { include: tagManyPayload() },
  });

export const toolManyPayload = () =>
  Prisma.validator<Prisma.ToolSelect>()({
    ...publicToolFields,
    categories: { include: categoryManyPayload() },
    collections: { include: collectionManyPayload() },
  });

export type ToolOne = Prisma.ToolGetPayload<{
  select: ReturnType<typeof toolOnePayload>;
}>;
export type ToolMany = Prisma.ToolGetPayload<{
  select: ReturnType<typeof toolManyPayload>;
}>;
