import type { Column } from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  EyeOffIcon,
} from "lucide-react";

import { Button } from "~/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/admin/ui/dropdown-menu";
import { cx } from "~/utils/cva";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!(column.getCanSort() || column.getCanHide())) {
    return <div className={cx(className)}>{title}</div>;
  }

  const buttonLabel =
    column.getCanSort() && column.getIsSorted() === "desc"
      ? "Sorted descending. Click to sort ascending."
      : column.getIsSorted() === "asc"
        ? "Sorted ascending. Click to sort descending."
        : "Not sorted. Click to sort ascending.";

  const buttonSuffix =
    column.getCanSort() && column.getIsSorted() === "desc" ? (
      <ArrowDownIcon />
    ) : column.getIsSorted() === "asc" ? (
      <ArrowUpIcon />
    ) : (
      <ChevronsUpDownIcon />
    );

  return (
    <div className={cx("flex items-center space-x-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={buttonLabel}
            className="-ml-1.5 h-auto px-1.5 py-1 data-[state=open]:bg-accent"
            size="sm"
            suffix={buttonSuffix}
            variant="ghost"
          >
            {title}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start">
          {column.getCanSort() && (
            <>
              <DropdownMenuItem
                aria-label="Sort ascending"
                onClick={() => column.toggleSorting(false)}
              >
                <ArrowUpIcon
                  aria-hidden="true"
                  className="mr-2 text-muted-foreground/70"
                />
                Asc
              </DropdownMenuItem>

              <DropdownMenuItem
                aria-label="Sort descending"
                onClick={() => column.toggleSorting(true)}
              >
                <ArrowDownIcon
                  aria-hidden="true"
                  className="mr-2 text-muted-foreground/70"
                />
                Desc
              </DropdownMenuItem>
            </>
          )}
          {column.getCanSort() && column.getCanHide() && (
            <DropdownMenuSeparator />
          )}
          {column.getCanHide() && (
            <DropdownMenuItem
              aria-label="Hide column"
              onClick={() => column.toggleVisibility(false)}
            >
              <EyeOffIcon
                aria-hidden="true"
                className="mr-2 text-muted-foreground/70"
              />
              Hide
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
