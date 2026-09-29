import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { DataTableSkeleton } from "~/components/admin/data-table/data-table-skeleton";
import { Card, CardHeader } from "~/components/admin/ui/card";
import { Skeleton } from "~/components/common/skeleton";
import { AiUsageSummary } from "./_components/ai-usage-summary";
import { AiUsageTable } from "./_components/ai-usage-table";
import { getAiQueries } from "./_lib/queries";
import { searchParamsSchema } from "./_lib/validations";

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export const metadata: Metadata = {
  title: "AI Logs",
};

export default async function AiUsagePage({ searchParams }: PageProps) {
  const search = searchParamsSchema.parse(await searchParams);
  const aiQueriesPromise = getAiQueries(search);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 overflow-clip lg:grid-cols-5">
        <Suspense
          fallback={Array.from({ length: 5 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="w-12 text-3xl">&nbsp;</Skeleton>
              </CardHeader>
            </Card>
          ))}
        >
          <AiUsageSummary />
        </Suspense>
      </div>

      <Suspense
        fallback={
          <DataTableSkeleton
            cellWidths={[
              "28%",
              "6%",
              "8%",
              "8%",
              "10%",
              "6%",
              "6%",
              "8%",
              "8%",
              "8%",
              "10%",
            ]}
            columnCount={11}
            filterableColumnCount={2}
            rowCount={15}
            searchableColumnCount={1}
            shrinkZero
            title="AI Logs"
          />
        }
      >
        <AiUsageTable aiQueriesPromise={aiQueriesPromise} />
      </Suspense>
    </div>
  );
}
