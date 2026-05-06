"use client";

import type { Tag } from "@prisma/client";
import type { Table } from "@tanstack/react-table";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { batchTranslateTagsToVietnamese } from "~/app/admin/tags/_lib/actions";
import { Button } from "~/components/admin/ui/button";
import { TagsDeleteDialog } from "./tags-delete-dialog";

interface TagsTableToolbarActionsProps {
  table: Table<Tag>;
}

export function TagsTableToolbarActions({
  table,
}: TagsTableToolbarActionsProps) {
  const { execute: batchTranslateAction, isPending: isTranslating } =
    useServerAction(batchTranslateTagsToVietnamese, {
      onSuccess: () => {
        toast.success("Translation started");
        table.toggleAllRowsSelected(false);
      },
      onError: ({ err }) => {
        toast.error(err.message);
      },
    });

  const selectedTags = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);

  return (
    <>
      {selectedTags.length > 0 ? (
        <>
          <Button
            disabled={isTranslating}
            onClick={() =>
              batchTranslateAction({ ids: selectedTags.map((t) => t.id) })
            }
            size="sm"
            variant="outline"
          >
            Translate to Vietnamese ({selectedTags.length})
          </Button>

          <TagsDeleteDialog
            onSuccess={() => table.toggleAllRowsSelected(false)}
            tags={selectedTags}
          />
        </>
      ) : null}
    </>
  );
}
