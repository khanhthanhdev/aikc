"use client";

import type { Tool } from "@prisma/client";
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
import type { getTools } from "../_lib/queries";
import { getColumns } from "./tools-table-columns";
import { ToolsTableToolbarActions } from "./tools-table-toolbar-actions";

interface ToolsTableProps {
  toolsPromise: ReturnType<typeof getTools>;
}

export function ToolsTable({ toolsPromise }: ToolsTableProps) {
  const { tools, toolsTotal, pageCount } = use(toolsPromise);

  // Memoize the columns so they don't re-render on every render
  const columns = useMemo(() => getColumns(), []);

  /**
   * This component can render either a faceted filter or a search filter based on the `options` prop.
   *
   * @prop options - An array of objects, each representing a filter option. If provided, a faceted filter is rendered. If not, a search filter is rendered.
   *
   * Each `option` object has the following properties:
   * @prop {string} label - The label for the filter option.
   * @prop {string} value - The value for the filter option.
   * @prop {React.ReactNode} [icon] - An optional icon to display next to the label.
   * @prop {boolean} [withCount] - An optional boolean to display the count of the filter option.
   */
  const filterFields: DataTableFilterField<Tool>[] = [
    {
      label: "Name",
      value: "name",
      placeholder: "Filter by name...",
    },
    // {
    //   label: "Status",
    //   value: "publishedAt",
    //   options: [
    //     {
    //       label: "Published",
    //       value: "published",
    //       icon: CheckIcon,
    //     },
    //   ],
    // },
  ];

  const { table } = useDataTable({
    data: tools,
    columns,
    pageCount,
    /* optional props */
    filterFields,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
      columnPinning: { right: ["actions"] },
    },
    // For remembering the previous row selection on page change
    getRowId: (originalRow, index) => `${originalRow.id}-${index}`,
  });

  return (
    <DataTable table={table}>
      <DataTableHeader
        callToAction={
          <Button asChild prefix={<PlusIcon />} size="sm">
            <Link href="/admin/tools/new">
              <span className="max-sm:sr-only">New tool</span>
            </Link>
          </Button>
        }
        title="Tools"
        total={toolsTotal}
      >
        <DataTableToolbar filterFields={filterFields} table={table}>
          <ToolsTableToolbarActions table={table} />
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
