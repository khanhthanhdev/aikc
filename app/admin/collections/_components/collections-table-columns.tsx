"use client";

import { formatDate } from "@curiousleaf/utils";
import type { Collection } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { CollectionActions } from "~/app/admin/collections/_components/collection-actions";
import { DataTableColumnHeader } from "~/components/admin/data-table/data-table-column-header";
import { DataTableLink } from "~/components/admin/data-table/data-table-link";
import { Badge } from "~/components/admin/ui/badge";
import { Checkbox } from "~/components/common/checkbox";

export function getColumns(): ColumnDef<Collection>[] {
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

          <DataTableLink href={`/admin/collections/${row.original.slug}`}>
            {row.getValue("name")}
          </DataTableLink>
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created At" />
      ),
      cell: ({ cell }) => (
        <span className="text-muted-foreground">
          {formatDate(cell.getValue() as Date)}
        </span>
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
        <CollectionActions
          className="float-right -my-0.5"
          collection={row.original}
          row={row}
        />
      ),
      size: 0,
    },
  ];
}
