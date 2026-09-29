"use client";

import { use, useMemo } from "react";
import { UserInviteDialog } from "~/app/admin/users/_components/user-invite-dialog";
import type { getUsers, UserRow } from "~/app/admin/users/_lib/queries";
import { DataTable } from "~/components/admin/data-table/data-table";
import { DataTableHeader } from "~/components/admin/data-table/data-table-header";
import { DataTableToolbar } from "~/components/admin/data-table/data-table-toolbar";
import { DataTableViewOptions } from "~/components/admin/data-table/data-table-view-options";
import { useDataTable } from "~/hooks/use-data-table";
import type { DataTableFilterField } from "~/types";
import { getColumns } from "./users-table-columns";

type UsersTableProps = {
  usersPromise: ReturnType<typeof getUsers>;
};

export function UsersTable({ usersPromise }: UsersTableProps) {
  const { users, usersTotal, pageCount } = use(usersPromise);

  const columns = useMemo(() => getColumns(), []);

  const filterFields: DataTableFilterField<UserRow>[] = [
    {
      label: "Email",
      value: "email",
      placeholder: "Filter by email...",
    },
  ];

  const { table } = useDataTable({
    data: users,
    columns,
    pageCount,
    filterFields,
    initialState: {
      sorting: [{ id: "createdAt", desc: false }],
      columnPinning: { right: ["actions"] },
    },
    getRowId: (originalRow, index) => `${originalRow.id}-${index}`,
  });

  return (
    <DataTable table={table}>
      <DataTableHeader
        callToAction={<UserInviteDialog />}
        title="Admins"
        total={usersTotal}
      >
        <DataTableToolbar filterFields={filterFields} table={table}>
          <DataTableViewOptions table={table} />
        </DataTableToolbar>
      </DataTableHeader>
    </DataTable>
  );
}
