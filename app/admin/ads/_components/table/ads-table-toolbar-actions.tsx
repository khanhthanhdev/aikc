"use client";

import type { Ad } from "@prisma/client";
import type { Table } from "@tanstack/react-table";
import { AdsDeleteDialog } from "../actions/ads-delete-dialog";

interface AdsTableToolbarActionsProps {
  table: Table<Ad>;
}

export function AdsTableToolbarActions({ table }: AdsTableToolbarActionsProps) {
  const selectedAds = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);

  return (
    <>
      {selectedAds.length > 0 ? (
        <AdsDeleteDialog
          ads={selectedAds}
          onSuccess={() => table.toggleAllRowsSelected(false)}
        />
      ) : null}
    </>
  );
}
