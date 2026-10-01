"use client";

import { formatDate } from "@curiousleaf/utils";
import type { PricingTier } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { ToolActions } from "~/app/admin/tools/_components/tool-actions";
import { DataTableColumnHeader } from "~/components/admin/data-table/data-table-column-header";
import { DataTableLink } from "~/components/admin/data-table/data-table-link";
import { DataTableThumbnail } from "~/components/admin/data-table/data-table-thumbnail";
import { Badge } from "~/components/admin/ui/badge";
import { Checkbox } from "~/components/common/checkbox";
import { formatRole, isUserRole } from "~/config/roles";
import type { ToolRow, ToolStatus } from "../_lib/queries";

export const toolStatusLabels: Record<ToolStatus, string> = {
  published: "Published",
  scheduled: "Scheduled",
  draft: "Draft",
};

const toolStatusColors: Record<ToolStatus, string> = {
  published: "bg-green-100 text-green-700",
  scheduled: "bg-blue-100 text-blue-700",
  draft: "bg-gray-100 text-gray-700",
};

export const pricingTierLabels: Record<PricingTier, string> = {
  FREE: "Free",
  FREEMIUM: "Freemium",
  PAID: "Paid",
  OPEN_SOURCE: "Open source",
  CUSTOM: "Custom",
};

export function getColumns(): ColumnDef<ToolRow>[] {
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
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const { status } = row.original;

        return (
          <Badge className={toolStatusColors[status]} variant="outline">
            {toolStatusLabels[status]}
          </Badge>
        );
      },
      enableSorting: false,
      size: 0,
    },
    {
      accessorKey: "categories",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Categories" />
      ),
      cell: ({ row }) => {
        const names = row.original.categories.map(({ name }) => name);

        return names.length ? (
          <div
            className="max-w-64 truncate text-muted-foreground"
            title={names.join(", ")}
          >
            {names.join(", ")}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "roles",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Roles" />
      ),
      cell: ({ row }) => {
        const roles = row.original.roles.filter(isUserRole).map(formatRole);

        return roles.length ? (
          <div
            className="max-w-64 truncate text-muted-foreground"
            title={roles.join(", ")}
          >
            {roles.join(", ")}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "pricingTier",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Pricing" />
      ),
      cell: ({ row }) => {
        const { pricingTier: tier } = row.original;

        return (
          <span className="whitespace-nowrap text-muted-foreground">
            {tier ? pricingTierLabels[tier] : "—"}
          </span>
        );
      },
      size: 0,
    },
    {
      accessorKey: "isFeatured",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Featured" />
      ),
      cell: ({ row }) =>
        row.original.isFeatured ? (
          <Badge className="bg-purple-100 text-purple-700" variant="outline">
            Featured
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      size: 0,
    },
    {
      accessorKey: "isBroken",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Link" />
      ),
      cell: ({ row }) => {
        const { isBroken, lastCheckedAt } = row.original;
        const checked = lastCheckedAt
          ? `Last checked ${formatDate(lastCheckedAt)}`
          : "Not checked yet";

        return isBroken ? (
          <Badge
            className="bg-red-100 text-red-700"
            title={checked}
            variant="outline"
          >
            Broken
          </Badge>
        ) : (
          <span className="text-muted-foreground" title={checked}>
            {lastCheckedAt ? "OK" : "—"}
          </span>
        );
      },
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
