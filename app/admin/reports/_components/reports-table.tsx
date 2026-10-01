"use client";

import { ReportType } from "@prisma/client";
import { use, useMemo } from "react";
import { DataTable } from "~/components/admin/data-table/data-table";
import { DataTableHeader } from "~/components/admin/data-table/data-table-header";
import { DataTableToolbar } from "~/components/admin/data-table/data-table-toolbar";
import { DataTableViewOptions } from "~/components/admin/data-table/data-table-view-options";
import { DateRangePicker } from "~/components/admin/date-range-picker";
import { useDataTable } from "~/hooks/use-data-table";
import type { DataTableFilterField } from "~/types";
import type { getReports, ReportRow } from "../_lib/queries";
import { getColumns, reportTypeLabels } from "./reports-table-columns";
import { ReportsTableToolbarActions } from "./reports-table-toolbar-actions";

interface ReportsTableProps {
  reportsPromise: ReturnType<typeof getReports>;
}

export function ReportsTable({ reportsPromise }: ReportsTableProps) {
  const { reports, reportsTotal, pageCount } = use(reportsPromise);

  const columns = useMemo(() => getColumns(), []);

  const filterFields: DataTableFilterField<ReportRow>[] = [
    {
      label: "Search",
      placeholder: "Search tool, message or email...",
      value: "message",
    },
    {
      label: "Status",
      options: [
        { label: "Open", value: "open" },
        { label: "Resolved", value: "resolved" },
      ],
      value: "status",
    },
    {
      label: "Type",
      options: Object.values(ReportType).map((type) => ({
        label: reportTypeLabels[type],
        value: type,
      })),
      value: "type",
    },
  ];

  const { table } = useDataTable({
    columns,
    data: reports,
    filterFields,
    getRowId: (originalRow, index) => `${originalRow.id}-${index}`,
    initialState: {
      columnPinning: { right: ["actions"] },
      sorting: [{ desc: true, id: "createdAt" }],
    },
    pageCount,
  });

  return (
    <DataTable table={table}>
      <DataTableHeader title="Reports" total={reportsTotal}>
        <DataTableToolbar filterFields={filterFields} table={table}>
          <ReportsTableToolbarActions table={table} />
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
