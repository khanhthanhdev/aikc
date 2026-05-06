"use client";

import type { Category } from "@prisma/client";
import type { Table } from "@tanstack/react-table";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { batchTranslateCategoriesToVietnamese } from "~/app/admin/categories/_lib/actions";
import { Button } from "~/components/admin/ui/button";
import { CategoriesDeleteDialog } from "./categories-delete-dialog";

interface CategoriesTableToolbarActionsProps {
  table: Table<Category>;
}

export function CategoriesTableToolbarActions({
  table,
}: CategoriesTableToolbarActionsProps) {
  const { execute: batchTranslateAction, isPending: isTranslating } =
    useServerAction(batchTranslateCategoriesToVietnamese, {
      onSuccess: () => {
        toast.success("Translation started");
        table.toggleAllRowsSelected(false);
      },
      onError: ({ err }) => {
        toast.error(err.message);
      },
    });

  const selectedCategories = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);

  return (
    <>
      {selectedCategories.length > 0 ? (
        <>
          <Button
            disabled={isTranslating}
            onClick={() =>
              batchTranslateAction({ ids: selectedCategories.map((c) => c.id) })
            }
            size="sm"
            variant="outline"
          >
            Translate to Vietnamese ({selectedCategories.length})
          </Button>

          <CategoriesDeleteDialog
            categories={selectedCategories}
            onSuccess={() => table.toggleAllRowsSelected(false)}
          />
        </>
      ) : null}
    </>
  );
}
