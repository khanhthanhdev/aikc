"use client";

import { formatDate } from "@curiousleaf/utils";
import type { Tool } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { ToolActions } from "~/app/admin/tools/_components/tool-actions";
import { DataTableColumnHeader } from "~/components/admin/data-table/data-table-column-header";
import { DataTableLink } from "~/components/admin/data-table/data-table-link";
import { DataTableThumbnail } from "~/components/admin/data-table/data-table-thumbnail";
import { Badge } from "~/components/admin/ui/badge";
import { Checkbox } from "~/components/common/checkbox";

export function getColumns(): ColumnDef<Tool>[] {
  return [
    {
      accessorKey: "name",
      header: ({ table, column }) => (
        <div className="flex items-center gap-2">
          <Checkbox
            aria-label="Select all"
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            className="mx-1.5 my-auto block"
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
          />

          <DataTableColumnHeader column={column} title="Name" />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Checkbox
            aria-label="Select row"
            checked={row.getIsSelected()}
            className="mx-1.5 my-auto block"
            onCheckedChange={(value) => row.toggleSelected(!!value)}
          />

          <DataTableLink href={`/admin/tools/${row.original.slug}`}>
            {row.original.faviconUrl && (
              <DataTableThumbnail src={row.original.faviconUrl} />
            )}
            {row.getValue("name")}
          </DataTableLink>
        </div>
      ),
    },
    {
      accessorKey: "tagline",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tagline" />
      ),
      cell: ({ row }) => (
        <div className="max-w-96 truncate text-muted-foreground">
          {row.getValue("tagline")}
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created At" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.getValue<Date>("createdAt"))}
        </span>
      ),
      size: 0,
    },
    {
      accessorKey: "publishedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Published At" />
      ),
      cell: ({ row }) =>
        row.original.publishedAt ? (
          <span className="text-muted-foreground">
            {formatDate(row.getValue<Date>("publishedAt"))}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      size: 0,
    },
    {
      accessorKey: "translationStatusVi",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="VI Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue("translationStatusVi") as string;
        if (!status) {
          return <span className="text-muted-foreground">—</span>;
        }

        const statusLabels: Record<string, string> = {
          MISSING: "Missing",
          MACHINE: "Machine",
          REVIEWED: "Reviewed",
        };

        const statusColors: Record<string, string> = {
          MISSING: "bg-gray-100 text-gray-700",
          MACHINE: "bg-yellow-100 text-yellow-700",
          REVIEWED: "bg-green-100 text-green-700",
        };

        return (
          <Badge className={statusColors[status]} variant="outline">
            {statusLabels[status]}
          </Badge>
        );
      },
      size: 0,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <ToolActions
          className="float-right -my-0.5"
          row={row}
          tool={row.original}
        />
      ),
      size: 0,
    },
  ];
}
