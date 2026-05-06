"use client";

import type { Ad } from "@prisma/client";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { use, useMemo } from "react";
import { DataTable } from "~/components/admin/data-table/data-table";
import { DataTableHeader } from "~/components/admin/data-table/data-table-header";
import { DataTableToolbar } from "~/components/admin/data-table/data-table-toolbar";
import { DataTableViewOptions } from "~/components/admin/data-table/data-table-view-options";
import { DateRangePicker } from "~/components/admin/date-range-picker";
import { Button } from "~/components/admin/ui/button";
import { useDataTable } from "~/hooks/use-data-table";
import type { DataTableFilterField } from "~/types";
import type { getAds } from "../../_lib/queries";
import { getColumns } from "./ads-table-columns";
import { AdsTableToolbarActions } from "./ads-table-toolbar-actions";

interface AdsTableProps {
  adsPromise: ReturnType<typeof getAds>;
}

export function AdsTable({ adsPromise }: AdsTableProps) {
  const { ads, adsTotal, pageCount } = use(adsPromise);

  const columns = useMemo(() => getColumns(), []);

  const filterFields: DataTableFilterField<Ad>[] = [
    {
      label: "Name",
      value: "name",
      placeholder: "Filter by name...",
    },
  ];

  const { table } = useDataTable({
    data: ads,
    columns,
    pageCount,
    filterFields,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
      columnPinning: { right: ["actions"] },
    },
    getRowId: (originalRow, index) => `${originalRow.id}-${index}`,
  });

  return (
    <DataTable table={table}>
      <DataTableHeader
        callToAction={
          <Button asChild prefix={<PlusIcon />} size="sm">
            <Link href="/admin/ads/new">
              <span className="max-sm:sr-only">New ad</span>
            </Link>
          </Button>
        }
        title="Ads"
        total={adsTotal}
      >
        <DataTableToolbar filterFields={filterFields} table={table}>
          <AdsTableToolbarActions table={table} />
          <DateRangePicker
            align="end"
            triggerClassName="ml-auto"
            triggerSize="sm"
          />
          <DataTableViewOptions table={table} />
        </DataTableToolbar>
      </DataTableHeader>
    </DataTable>
  );
}
