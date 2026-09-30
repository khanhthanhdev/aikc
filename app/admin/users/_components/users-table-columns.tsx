"use client";

import { formatDate } from "@curiousleaf/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNowStrict } from "date-fns";
import { UserActions } from "~/app/admin/users/_components/user-actions";
import type { UserRow } from "~/app/admin/users/_lib/queries";
import { DataTableColumnHeader } from "~/components/admin/data-table/data-table-column-header";
import { Badge } from "~/components/admin/ui/badge";

export function getColumns(): ColumnDef<UserRow>[] {
  return [
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Account" />
      ),
      cell: ({ row }) => {
        const { email, name, image, isCurrentUser, isFromEnv } = row.original;

        return (
          <div className="flex items-center gap-3">
            {image ? (
              // Google avatars; tiny and already optimised, not worth next/image.
              // biome-ignore lint/performance/noImgElement: see above
              <img
                alt=""
                className="size-7 shrink-0 rounded-full"
                height={28}
                referrerPolicy="no-referrer"
                src={image}
                width={28}
              />
            ) : (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-xs uppercase">
                {email[0]}
              </span>
            )}

            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-2 truncate font-medium">
                {name || email}
                {isCurrentUser && <Badge variant="outline">You</Badge>}
                {isFromEnv && (
                  <Badge
                    title="Listed in ALLOWED_EMAILS: can be blocked here, but only removed by editing the env var"
                    variant="outline"
                  >
                    ALLOWED_EMAILS
                  </Badge>
                )}
              </span>
              {name && (
                <span className="truncate text-muted-foreground text-xs">
                  {email}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "disabledAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) =>
        row.original.disabledAt ? (
          <Badge className="bg-red-100 text-red-700" variant="outline">
            Blocked
          </Badge>
        ) : row.original.lastLoginAt ? (
          <Badge className="bg-green-100 text-green-700" variant="outline">
            Active
          </Badge>
        ) : (
          <Badge className="bg-yellow-100 text-yellow-700" variant="outline">
            Not signed in yet
          </Badge>
        ),
      size: 0,
    },
    {
      accessorKey: "lastLoginAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last Sign-in" />
      ),
      cell: ({ cell }) => {
        const value = cell.getValue() as Date | null;

        return (
          <span
            className="whitespace-nowrap text-muted-foreground"
            title={value ? value.toLocaleString() : undefined}
          >
            {value
              ? formatDistanceToNowStrict(value, { addSuffix: true })
              : "—"}
          </span>
        );
      },
      size: 0,
    },
    {
      accessorKey: "invitedBy",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Added By" />
      ),
      cell: ({ cell }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {(cell.getValue() as string | null) ?? "ALLOWED_EMAILS"}
        </span>
      ),
      size: 0,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Added At" />
      ),
      cell: ({ cell }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDate(cell.getValue() as Date)}
        </span>
      ),
      size: 0,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <UserActions
          className="float-right -my-0.5"
          row={row}
          user={row.original}
        />
      ),
      size: 0,
    },
  ];
}
