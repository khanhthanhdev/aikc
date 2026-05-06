"use client";

import { formatDate } from "@curiousleaf/utils";
import type { Ad } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "~/components/admin/data-table/data-table-column-header";
import { DataTableLink } from "~/components/admin/data-table/data-table-link";
import { DataTableThumbnail } from "~/components/admin/data-table/data-table-thumbnail";
import { Checkbox } from "~/components/common/checkbox";
import { AdActions } from "../actions/ad-actions";

export function getColumns(): ColumnDef<Ad>[] {
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

          <DataTableLink href={`/admin/ads/${row.original.id}`}>
            {row.original.faviconUrl && (
              <DataTableThumbnail src={row.original.faviconUrl} />
            )}
            {row.getValue("name")}
          </DataTableLink>
        </div>
      ),
    },
    {
      accessorKey: "stepOrder",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Order" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.getValue("stepOrder")}
        </span>
      ),
      size: 0,
    },
    {
      accessorKey: "type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.getValue("type")}</span>
      ),
      size: 0,
    },
    {
      accessorKey: "startsAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Starts At" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.getValue<Date>("startsAt"))}
        </span>
      ),
      size: 0,
    },
    {
      accessorKey: "endsAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ends At" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.getValue<Date>("endsAt"))}
        </span>
      ),
      size: 0,
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
      id: "actions",
      cell: ({ row }) => (
        <AdActions
          ad={row.original}
          className="float-right -my-0.5"
          row={row}
        />
      ),
      size: 0,
    },
  ];
}
