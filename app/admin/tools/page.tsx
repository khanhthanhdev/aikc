import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { DataTableSkeleton } from "~/components/admin/data-table/data-table-skeleton";
import { searchParamsSchema } from "~/schema/search-params";
import { ToolsTable } from "./_components/tools-table";
import { getTools } from "./_lib/queries";

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export const metadata: Metadata = {
  title: "Tools",
};

export default async function ToolsPage({ searchParams }: PageProps) {
  const search = searchParamsSchema.parse(await searchParams);
  const toolsPromise = getTools(search);

  return (
    <Suspense
      fallback={
        <DataTableSkeleton
          cellWidths={["12%", "48%", "15%", "15%", "10%"]}
          columnCount={5}
          filterableColumnCount={2}
          rowCount={15}
          searchableColumnCount={1}
          shrinkZero
          title="Tools"
        />
      }
    >
      <ToolsTable toolsPromise={toolsPromise} />
    </Suspense>
  );
}
