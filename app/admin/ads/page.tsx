import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { DataTableSkeleton } from "~/components/admin/data-table/data-table-skeleton";
import { searchParamsSchema } from "~/schema/search-params";
import { AdsTable } from "./_components/table/ads-table";
import { getAds } from "./_lib/queries";

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export const metadata: Metadata = {
  title: "Ads",
};

export default async function AdsPage({ searchParams }: PageProps) {
  const search = searchParamsSchema.parse(await searchParams);
  const adsPromise = getAds(search);

  return (
    <Suspense
      fallback={
        <DataTableSkeleton
          cellWidths={["20%", "15%", "15%", "15%", "10%"]}
          columnCount={5}
          filterableColumnCount={0}
          rowCount={15}
          searchableColumnCount={1}
          shrinkZero
          title="Ads"
        />
      }
    >
      <AdsTable adsPromise={adsPromise} />
    </Suspense>
  );
}
