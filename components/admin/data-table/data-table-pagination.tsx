import type { Table } from "@tanstack/react-table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";

import { Button } from "~/components/admin/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/admin/ui/select";

interface DataTablePaginationProps<TData> {
  pageSizeOptions?: number[];
  table: Table<TData>;
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [25, 50, 100],
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex flex-row flex-wrap items-center justify-between gap-4 overflow-auto tabular-nums sm:gap-6 lg:gap-8">
      <div className="grow whitespace-nowrap text-muted-foreground text-sm max-sm:hidden">
        {table.getFilteredSelectedRowModel().rows.length} of{" "}
        {table.getFilteredRowModel().rows.length} row(s) selected.
      </div>

      <div className="flex items-center space-x-2 max-sm:grow">
        <p className="font-medium text-sm">Rows per page</p>

        <Select
          onValueChange={(value) => {
            table.setPageSize(Number(value));
          }}
          value={`${table.getState().pagination.pageSize}`}
        >
          <SelectTrigger className="h-8 w-auto tabular-nums">
            <SelectValue placeholder={table.getState().pagination.pageSize} />
          </SelectTrigger>

          <SelectContent className="tabular-nums" side="top">
            {pageSizeOptions.map((pageSize) => (
              <SelectItem key={pageSize} value={`${pageSize}`}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="font-medium text-sm max-sm:hidden">
        Page {table.getState().pagination.pageIndex + 1} of{" "}
        {table.getPageCount() || 1}
      </div>

      <div className="flex items-center gap-2">
        <Button
          aria-label="Go to first page"
          className="max-lg:hidden"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.setPageIndex(0)}
          prefix={<ChevronsLeftIcon />}
          size="sm"
          variant="outline"
        />

        <Button
          aria-label="Go to previous page"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
          prefix={<ChevronLeftIcon />}
          size="sm"
          variant="outline"
        />

        <Button
          aria-label="Go to next page"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
          size="sm"
          suffix={<ChevronRightIcon />}
          variant="outline"
        />

        <Button
          aria-label="Go to last page"
          className="max-lg:hidden"
          disabled={!table.getCanNextPage()}
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          size="sm"
          suffix={<ChevronsRightIcon />}
          variant="outline"
        />
      </div>
    </div>
  );
}
