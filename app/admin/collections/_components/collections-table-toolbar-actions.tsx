"use client";

import type { Collection } from "@prisma/client";
import type { Table } from "@tanstack/react-table";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { batchTranslateCollectionsToVietnamese } from "~/app/admin/collections/_lib/actions";
import { Button } from "~/components/admin/ui/button";
import { CollectionsDeleteDialog } from "./collections-delete-dialog";

interface CollectionsTableToolbarActionsProps {
  table: Table<Collection>;
}

export function CollectionsTableToolbarActions({
  table,
}: CollectionsTableToolbarActionsProps) {
  const { execute: batchTranslateAction, isPending: isTranslating } =
    useServerAction(batchTranslateCollectionsToVietnamese, {
      onSuccess: () => {
        toast.success("Translation started");
        table.toggleAllRowsSelected(false);
      },
      onError: ({ err }) => {
        toast.error(err.message);
      },
    });

  const selectedCollections = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);

  return (
    <>
      {selectedCollections.length > 0 ? (
        <>
          <Button
            disabled={isTranslating}
            onClick={() =>
              batchTranslateAction({
                ids: selectedCollections.map((c) => c.id),
              })
            }
            size="sm"
            variant="outline"
          >
            Translate to Vietnamese ({selectedCollections.length})
          </Button>

          <CollectionsDeleteDialog
            collections={selectedCollections}
            onSuccess={() => table.toggleAllRowsSelected(false)}
          />
        </>
      ) : null}
    </>
  );
}
