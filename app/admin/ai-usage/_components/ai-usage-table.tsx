"use client";

import { use, useMemo } from "react";
import { DataTable } from "~/components/admin/data-table/data-table";
import { DataTableHeader } from "~/components/admin/data-table/data-table-header";
import { DataTableToolbar } from "~/components/admin/data-table/data-table-toolbar";
import { DataTableViewOptions } from "~/components/admin/data-table/data-table-view-options";
import { DateRangePicker } from "~/components/admin/date-range-picker";
import { useDataTable } from "~/hooks/use-data-table";
import type { DataTableFilterField } from "~/types";
import type { AiQueryRow, getAiQueries } from "../_lib/queries";
import { getColumns } from "./ai-usage-table-columns";

interface AiUsageTableProps {
  aiQueriesPromise: ReturnType<typeof getAiQueries>;
}

export function AiUsageTable({ aiQueriesPromise }: AiUsageTableProps) {
  const { aiQueries, aiQueriesTotal, pageCount } = use(aiQueriesPromise);

  const columns = useMemo(() => getColumns(), []);

  const filterFields: DataTableFilterField<AiQueryRow>[] = [
    {
      label: "Question",
      placeholder: "Search questions...",
      value: "question",
    },
    {
      label: "Endpoint",
      options: [
        { label: "Chat", value: "chat" },
        { label: "RAG", value: "rag" },
      ],
      value: "endpoint",
    },
    {
      label: "Status",
      options: [
        { label: "OK", value: "OK" },
        { label: "Error", value: "ERROR" },
        { label: "Aborted", value: "ABORTED" },
      ],
      value: "status",
    },
  ];

  const { table } = useDataTable({
    columns,
    data: aiQueries,
    filterFields,
    getRowId: (originalRow, index) => `${originalRow.id}-${index}`,
    initialState: {
      sorting: [{ desc: true, id: "createdAt" }],
    },
    pageCount,
  });

  return (
    <DataTable table={table}>
      <DataTableHeader title="AI Logs" total={aiQueriesTotal}>
        <DataTableToolbar filterFields={filterFields} table={table}>
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
