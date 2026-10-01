import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { DataTableSkeleton } from "~/components/admin/data-table/data-table-skeleton";
import { ReportsTable } from "./_components/reports-table";
import { getReports } from "./_lib/queries";
import { searchParamsSchema } from "./_lib/validations";

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export const metadata: Metadata = {
  title: "Reports",
};

export default async function ReportsPage({ searchParams }: PageProps) {
  const search = searchParamsSchema.parse(await searchParams);
  const reportsPromise = getReports(search);

  return (
    <Suspense
      fallback={
        <DataTableSkeleton
          cellWidths={["18%", "10%", "36%", "8%", "14%", "10%", "4%"]}
          columnCount={7}
          filterableColumnCount={2}
          rowCount={15}
          searchableColumnCount={1}
          shrinkZero
          title="Reports"
        />
      }
    >
      <ReportsTable reportsPromise={reportsPromise} />
    </Suspense>
  );
}
