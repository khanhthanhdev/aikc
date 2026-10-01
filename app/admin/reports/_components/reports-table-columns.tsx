"use client";

import { formatDate } from "@curiousleaf/utils";
import type { ReportType } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "~/components/admin/data-table/data-table-column-header";
import { DataTableLink } from "~/components/admin/data-table/data-table-link";
import { DataTableThumbnail } from "~/components/admin/data-table/data-table-thumbnail";
import { Badge } from "~/components/admin/ui/badge";
import { Checkbox } from "~/components/common/checkbox";
import type { ReportRow, ReportStatus } from "../_lib/queries";
import { ReportActions } from "./report-actions";

export const reportTypeLabels: Record<ReportType, string> = {
  BROKEN_LINK: "Broken link",
  WRONG_CATEGORY: "Wrong category",
  OUTDATED: "Outdated",
  OTHER: "Other",
};

const reportTypeColors: Record<ReportType, string> = {
  BROKEN_LINK: "bg-red-100 text-red-700",
  WRONG_CATEGORY: "bg-blue-100 text-blue-700",
  OUTDATED: "bg-yellow-100 text-yellow-700",
  OTHER: "bg-gray-100 text-gray-700",
};

const statusColors: Record<ReportStatus, string> = {
  open: "bg-orange-100 text-orange-700",
  resolved: "bg-green-100 text-green-700",
};

export function getColumns(): ColumnDef<ReportRow>[] {
  return [
    {
      id: "tool",
      accessorFn: (report) => report.tool.name,
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

          <DataTableColumnHeader column={column} title="Tool" />
        </div>
      ),
      cell: ({ row }) => {
        const { tool } = row.original;

        return (
          <div className="flex items-center gap-2">
            <Checkbox
              aria-label="Select row"
              checked={row.getIsSelected()}
              className="mx-1.5 my-auto block"
              onCheckedChange={(value) => row.toggleSelected(!!value)}
            />

            <DataTableLink href={`/admin/tools/${tool.slug}`}>
              {tool.faviconUrl && <DataTableThumbnail src={tool.faviconUrl} />}
              {tool.name}
            </DataTableLink>

            {tool.isBroken && (
              <Badge
                className="bg-red-100 text-red-700"
                title="The weekly link check could not reach this website"
                variant="outline"
              >
                Broken
              </Badge>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => {
        const type = row.getValue<ReportType>("type");

        return (
          <Badge className={reportTypeColors[type]} variant="outline">
            {reportTypeLabels[type]}
          </Badge>
        );
      },
      size: 0,
    },
    {
      accessorKey: "message",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Message" />
      ),
      cell: ({ row }) => {
        const { message } = row.original;

        return message ? (
          <div
            className="max-w-96 truncate text-muted-foreground"
            title={message}
          >
            {message}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const { status, resolvedAt } = row.original;

        return (
          <Badge
            className={statusColors[status]}
            title={
              resolvedAt ? `Resolved ${formatDate(resolvedAt)}` : undefined
            }
            variant="outline"
          >
            {status}
          </Badge>
        );
      },
      enableSorting: false,
      size: 0,
    },
    {
      accessorKey: "userEmail",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Reporter" />
      ),
      cell: ({ row }) => (
        <a
          className="whitespace-nowrap text-muted-foreground hover:text-foreground hover:underline"
          href={`mailto:${row.original.userEmail}`}
        >
          {row.original.userEmail}
        </a>
      ),
      size: 0,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Reported At" />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDate(row.getValue<Date>("createdAt"))}
        </span>
      ),
      size: 0,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <ReportActions
          className="float-right -my-0.5"
          report={row.original}
          row={row}
        />
      ),
      size: 0,
    },
  ];
}
