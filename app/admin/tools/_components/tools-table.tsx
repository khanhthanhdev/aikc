"use client";

import { PricingTier } from "@prisma/client";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { use, useMemo } from "react";
import { DataTable } from "~/components/admin/data-table/data-table";
import { DataTableHeader } from "~/components/admin/data-table/data-table-header";
import { DataTableToolbar } from "~/components/admin/data-table/data-table-toolbar";
import { DataTableViewOptions } from "~/components/admin/data-table/data-table-view-options";
import { DateRangePicker } from "~/components/admin/date-range-picker";
import { Button } from "~/components/admin/ui/button";
import { formatRole, userRoles } from "~/config/roles";
import { useDataTable } from "~/hooks/use-data-table";
import type { DataTableFilterField } from "~/types";
import type {
  getCategoryFilterOptions,
  getTools,
  ToolRow,
} from "../_lib/queries";
import { FILTER_NONE } from "../_lib/validations";
import {
  getColumns,
  pricingTierLabels,
  toolStatusLabels,
} from "./tools-table-columns";
import { ToolsTableToolbarActions } from "./tools-table-toolbar-actions";

interface ToolsTableProps {
  categoriesPromise: ReturnType<typeof getCategoryFilterOptions>;
  toolsPromise: ReturnType<typeof getTools>;
}

export function ToolsTable({
  categoriesPromise,
  toolsPromise,
}: ToolsTableProps) {
  const { tools, toolsTotal, pageCount } = use(toolsPromise);
  const categories = use(categoriesPromise);

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
  const filterFields: DataTableFilterField<ToolRow>[] = [
    {
      label: "Name",
      value: "name",
      placeholder: "Filter by name...",
    },
    {
      label: "Status",
      value: "status",
      options: Object.entries(toolStatusLabels).map(([value, label]) => ({
        label,
        value,
      })),
    },
    {
      label: "Category",
      value: "categories",
      options: [
        { label: "Uncategorized", value: FILTER_NONE },
        ...categories.map(({ name, slug }) => ({ label: name, value: slug })),
      ],
    },
    {
      label: "Role",
      value: "roles",
      options: [
        { label: "No role", value: FILTER_NONE },
        ...userRoles.map((role) => ({ label: formatRole(role), value: role })),
      ],
    },
    {
      label: "VI",
      value: "translationStatusVi",
      options: [
        { label: "Missing", value: "MISSING" },
        { label: "Machine", value: "MACHINE" },
        { label: "Reviewed", value: "REVIEWED" },
      ],
    },
    {
      label: "Link",
      value: "isBroken",
      options: [
        { label: "Broken", value: "broken" },
        { label: "OK", value: "ok" },
      ],
    },
    {
      label: "Pricing",
      value: "pricingTier",
      options: [
        { label: "Not set", value: FILTER_NONE },
        ...Object.values(PricingTier).map((tier) => ({
          label: pricingTierLabels[tier],
          value: tier,
        })),
      ],
    },
    {
      label: "Featured",
      value: "isFeatured",
      options: [
        { label: "Featured", value: "featured" },
        { label: "Not featured", value: "regular" },
      ],
    },
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
      // Still filterable from the toolbar; shown through "View" when needed.
      columnVisibility: {
        categories: false,
        roles: false,
        pricingTier: false,
        isFeatured: false,
      },
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
