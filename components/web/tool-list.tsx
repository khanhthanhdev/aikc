"use client";

import type { Ad } from "@prisma/client";
import { XIcon } from "lucide-react";
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
import { useTrackSearch } from "~/hooks/use-track-search";
import type { CategoryMany } from "~/server/categories/payloads";
import type { ToolCardData } from "~/server/tools/payloads";
import { searchParams } from "~/server/tools/search-params";

type ToolListProps = ToolListFiltersProps & {
  tools: ToolCardData[];
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
  const [{ q, perPage }, setFilters] = useQueryStates(searchParams, {
    shallow: false,
  });
  // Without its own search box, the list says what it is filtered by
  const showQuery = !!q && props.showSearch === false;

  // Both the hero search and the filter box end up in `q`, so this one place
  // sees every directory search along with its result count
  useTrackSearch(q, totalCount, "directory");

  return (
    <>
      <div className="flex flex-col gap-6 lg:gap-8">
        {showFilters && <ToolListFilters categories={categories} {...props} />}

        {showQuery && (
          <p className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-foreground/65 text-sm">
            <span>{t("resultsFor", { query: q, count: totalCount })}</span>
            <button
              className="inline-flex items-center gap-1 font-medium text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setFilters({ q: null, page: null })}
              type="button"
            >
              <XIcon className="size-3.5" />
              {t("clearSearch")}
            </button>
          </p>
        )}

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
