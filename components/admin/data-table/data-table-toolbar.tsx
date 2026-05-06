"use client";

import type { Table } from "@tanstack/react-table";
import { XIcon } from "lucide-react";
import * as React from "react";
import { DataTableFacetedFilter } from "~/components/admin/data-table/data-table-faceted-filter";
import { Button } from "~/components/admin/ui/button";
import { Input } from "~/components/admin/ui/input";
import type { DataTableFilterField } from "~/types";
import { cx } from "~/utils/cva";

interface DataTableToolbarProps<TData>
  extends React.HTMLAttributes<HTMLDivElement> {
  filterFields?: DataTableFilterField<TData>[];
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
  filterFields = [],
  children,
  className,
  ...props
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  // Memoize computation of searchableColumns and filterableColumns
  const { searchableColumns, filterableColumns } = React.useMemo(() => {
    return {
      searchableColumns: filterFields.filter((field) => !field.options),
      filterableColumns: filterFields.filter((field) => field.options),
    };
  }, [filterFields]);

  return (
    <div
      className={cx(
        "flex w-full items-center justify-between gap-2 overflow-auto",
        className
      )}
      {...props}
    >
      <div className="flex flex-1 items-center space-x-2">
        {searchableColumns.length > 0 &&
          searchableColumns.map(
            (column) =>
              table.getColumn(column.value ? String(column.value) : "") && (
                <Input
                  className="h-8 w-full min-w-40 lg:min-w-64"
                  key={String(column.value)}
                  onChange={(event) =>
                    table
                      .getColumn(String(column.value))
                      ?.setFilterValue(event.target.value)
                  }
                  placeholder={column.placeholder}
                  value={
                    (table
                      .getColumn(String(column.value))
                      ?.getFilterValue() as string) ?? ""
                  }
                />
              )
          )}
        {filterableColumns.length > 0 &&
          filterableColumns.map(
            (column) =>
              table.getColumn(column.value ? String(column.value) : "") && (
                <DataTableFacetedFilter
                  column={table.getColumn(
                    column.value ? String(column.value) : ""
                  )}
                  key={String(column.value)}
                  options={column.options ?? []}
                  title={column.label}
                />
              )
          )}
        {isFiltered && (
          <Button
            aria-label="Reset filters"
            className="h-8 px-2 lg:px-3"
            onClick={() => table.resetColumnFilters()}
            suffix={<XIcon />}
            variant="ghost"
          >
            Reset
          </Button>
        )}
      </div>

      {children}
    </div>
  );
}
