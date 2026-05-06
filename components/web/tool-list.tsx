"use client";

import type { Ad } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import React from "react";
import { AdCardDisplay } from "~/components/web/ads/ad-card-display";
import { ToolCard } from "~/components/web/cards/tool-card";
import { EmptyList } from "~/components/web/empty-list";
import { Pagination } from "~/components/web/pagination";
import {
  ToolListFilters,
  type ToolListFiltersProps,
} from "~/components/web/tool-list-filters";
import { Grid } from "~/components/web/ui/grid";
import type { DefaultAd } from "~/config/ads";
import type { CategoryMany } from "~/server/categories/payloads";
import type { ToolMany } from "~/server/tools/payloads";
import { searchParams } from "~/server/tools/search-params";

type ToolListProps = ToolListFiltersProps & {
  tools: ToolMany[];
  categories?: CategoryMany[];
  totalCount: number;
  showFilters?: boolean;
  ad?: never;
  ads?: (Ad | DefaultAd)[];
};

export const ToolList = ({
  tools,
  totalCount,
  categories,
  showFilters = true,
  ads,
  ...props
}: ToolListProps) => {
  const t = useTranslations("Tools");
  const [{ q, perPage }] = useQueryStates(searchParams);

  return (
    <>
      <div className="flex flex-col gap-6 lg:gap-8">
        {showFilters && <ToolListFilters categories={categories} {...props} />}

        <Grid>
          {tools.map((tool, index) => (
            <React.Fragment key={tool.id}>
              {ads
                ?.filter(
                  (ad) =>
                    ("listInjectionIndex" in ad ? ad.listInjectionIndex : 2) ===
                    index
                )
                .map((ad, i) => (
                  <AdCardDisplay
                    ad={ad}
                    key={"id" in ad ? ad.id : `default-${i}`}
                  />
                ))}
              <ToolCard tool={tool} />
            </React.Fragment>
          ))}

          {!tools.length && (
            <EmptyList>
              {q ? t("noToolsFoundFor", { query: q }) : t("noToolsFound")}
            </EmptyList>
          )}
        </Grid>
      </div>

      <Pagination pageSize={perPage} totalCount={totalCount} />
    </>
  );
};
