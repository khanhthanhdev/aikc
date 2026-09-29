import type { Prisma } from "@prisma/client";
import { cacheLife, cacheTag } from "next/cache";
import type { SearchParams } from "nuqs/server";
import type { ComponentProps } from "react";
import { ToolList } from "~/components/web/tool-list";
import { config } from "~/config";
import { findCategories } from "~/server/categories/queries";
import type { ToolCardData } from "~/server/tools/payloads";
import { searchToolsFromParsedParams } from "~/server/tools/queries";
import {
  type FilterSchema,
  searchParamsCache,
} from "~/server/tools/search-params";
import { findAds } from "~/server/web/ads/queries";

type ToolsListingProps = Omit<
  ComponentProps<typeof ToolList>,
  "tools" | "categories" | "totalCount"
> & {
  searchParams: Promise<SearchParams>;
  where?: Prisma.ToolWhereInput;
};

const getToolsListingData = async (
  searchParams: FilterSchema,
  where?: Prisma.ToolWhereInput
) => {
  "use cache";

  cacheLife("max");
  cacheTag("tools", "categories", "ads");

  return await Promise.all([
    searchToolsFromParsedParams(searchParams, { where }),
    findCategories({}),
    findAds({ where: { type: "Tools" } }),
  ]);
};

export const ToolsListing = async ({
  searchParams,
  where,
  ...props
}: ToolsListingProps) => {
  const resolvedParams = searchParamsCache.parse(await searchParams);

  const [{ items: tools, totalCount }, categories, ads] =
    await getToolsListingData(resolvedParams, where);

  return (
    <ToolList
      ads={ads.length > 0 ? ads : [config.ads.defaultAd]}
      categories={where?.categories ? undefined : categories}
      tools={tools as ToolCardData[]}
      totalCount={totalCount}
      {...props}
    />
  );
};
