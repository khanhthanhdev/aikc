import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { DataTableSkeleton } from "~/components/admin/data-table/data-table-skeleton";
import { Skeleton } from "~/components/common/skeleton";
import { ToolSubmitters } from "./_components/tool-submitters";
import { UsersTable } from "./_components/users-table";
import { UsersTabs } from "./_components/users-tabs";
import { getToolSubmitters, getUsers } from "./_lib/queries";
import { searchParamsSchema } from "./_lib/validations";

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export const metadata: Metadata = {
  title: "Users",
};

export default async function UsersPage({ searchParams }: PageProps) {
  const search = searchParamsSchema.parse(await searchParams);

  return (
    <div className="flex flex-col gap-6">
      <UsersTabs active={search.tab} />

      {search.tab === "submitters" ? (
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <ToolSubmitters submittersPromise={getToolSubmitters()} />
        </Suspense>
      ) : (
        <Suspense
          fallback={
            <DataTableSkeleton
              cellWidths={["40%", "12%", "14%", "16%", "12%", "6%"]}
              columnCount={6}
              filterableColumnCount={0}
              rowCount={5}
              searchableColumnCount={1}
              shrinkZero
              title="Admins"
            />
          }
        >
          <UsersTable usersPromise={getUsers(search)} />
        </Suspense>
      )}
    </div>
  );
}
