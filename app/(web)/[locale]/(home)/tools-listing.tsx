import type { Prisma } from "@prisma/client";
import { cacheLife, cacheTag } from "next/cache";
import type { SearchParams } from "nuqs/server";
import type { ComponentProps } from "react";
import { ToolList } from "~/components/web/tool-list";
import { config } from "~/config";
import { findCategories } from "~/server/categories/queries";
import type { ToolMany } from "~/server/tools/payloads";
import { searchTools } from "~/server/tools/queries";
import { findAds } from "~/server/web/ads/queries";

type ToolsListingProps = Omit<
  ComponentProps<typeof ToolList>,
  "tools" | "categories" | "totalCount"
> & {
  searchParams: Promise<SearchParams>;
  where?: Prisma.ToolWhereInput;
};

const getToolsListingData = async (
  searchParams: SearchParams,
  where?: Prisma.ToolWhereInput
) => {
  "use cache";

  cacheLife("max");
  cacheTag("tools", "categories", "ads");

  return await Promise.all([
    searchTools(searchParams, { where }),
    findCategories({}),
    findAds({ where: { type: "Tools" } }),
  ]);
};

export const ToolsListing = async ({
  searchParams,
  where,
  ...props
}: ToolsListingProps) => {
  const resolvedParams = await searchParams;

  const [{ items: tools, totalCount }, categories, ads] =
    await getToolsListingData(resolvedParams, where);

  return (
    <ToolList
      ads={ads.length > 0 ? ads : [config.ads.defaultAd]}
      categories={where?.categories ? undefined : categories}
      tools={tools as ToolMany[]}
      totalCount={totalCount}
      {...props}
    />
  );
};
