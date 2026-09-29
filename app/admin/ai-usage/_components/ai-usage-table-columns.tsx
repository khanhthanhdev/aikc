"use client";

import type { AiQueryStatus } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { DataTableColumnHeader } from "~/components/admin/data-table/data-table-column-header";
import { Badge } from "~/components/admin/ui/badge";
import type { AiQueryRow } from "../_lib/queries";
import {
  AiQueryDetailDialog,
  formatTokens,
  statusStyles,
} from "./ai-query-detail-dialog";

const endpointColors: Record<string, string> = {
  chat: "bg-blue-100 text-blue-700",
  rag: "bg-purple-100 text-purple-700",
};

export function getColumns(): ColumnDef<AiQueryRow>[] {
  return [
    {
      accessorKey: "question",
      cell: ({ row }) => <AiQueryDetailDialog query={row.original} />,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Question" />
      ),
    },
    {
      accessorKey: "status",
      cell: ({ row }) => {
        const status = row.getValue("status") as AiQueryStatus;

        return (
          <Badge
            className={statusStyles[status]}
            title={row.original.error ?? undefined}
            variant="outline"
          >
            {status.toLowerCase()}
          </Badge>
        );
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      size: 0,
    },
    {
      accessorKey: "endpoint",
      cell: ({ row }) => {
        const endpoint = row.getValue("endpoint") as string;

        return (
          <Badge className={endpointColors[endpoint]} variant="outline">
            {endpoint}
          </Badge>
        );
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Endpoint" />
      ),
      size: 0,
    },
    {
      accessorKey: "toolSlug",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.getValue("toolSlug") || "—"}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tool" />
      ),
      size: 0,
    },
    {
      accessorKey: "locale",
      cell: ({ row }) => (
        <span className="text-muted-foreground uppercase">
          {row.getValue("locale") || "—"}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Locale" />
      ),
      size: 0,
    },
    {
      accessorKey: "cacheHit",
      cell: ({ row }) =>
        row.getValue("cacheHit") ? (
          <Badge className="bg-green-100 text-green-700" variant="outline">
            hit
          </Badge>
        ) : (
          <span className="text-muted-foreground">miss</span>
        ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Cache" />
      ),
      size: 0,
    },
    {
      accessorKey: "model",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground text-xs">
          {row.getValue("model") || "—"}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Model" />
      ),
      size: 0,
    },
    {
      accessorKey: "outputTokens",
      cell: ({ row }) => (
        <span
          className="whitespace-nowrap text-muted-foreground tabular-nums"
          title="Input / output tokens"
        >
          {formatTokens(row.original)}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tokens" />
      ),
      size: 0,
    },
    {
      accessorKey: "latencyMs",
      cell: ({ row }) => {
        const latency = row.getValue("latencyMs") as number | null;

        return (
          <span className="text-muted-foreground tabular-nums">
            {latency === null ? "—" : `${latency} ms`}
          </span>
        );
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Latency" />
      ),
      size: 0,
    },
    {
      accessorKey: "visitorId",
      cell: ({ row }) => {
        const visitorId = row.getValue("visitorId") as string | null;

        return (
          <span className="font-mono text-muted-foreground text-xs">
            {visitorId ? visitorId.slice(0, 8) : "—"}
          </span>
        );
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Visitor" />
      ),
      size: 0,
    },
    {
      accessorKey: "createdAt",
      cell: ({ cell }) => (
        <span className="text-muted-foreground tabular-nums">
          {format(cell.getValue() as Date, "yyyy-MM-dd HH:mm")}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Asked At" />
      ),
      size: 0,
    },
  ];
}
