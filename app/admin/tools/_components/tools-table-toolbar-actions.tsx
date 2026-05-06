"use client";

import type { Tool } from "@prisma/client";
import type { Table } from "@tanstack/react-table";
import { PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { ToolsScheduleDialog } from "~/app/admin/tools/_components/tools-schedule-dialog";
import {
  batchTranslateToVietnamese,
  processTools,
} from "~/app/admin/tools/_lib/actions";
import { Button } from "~/components/admin/ui/button";
import { ToolsDeleteDialog } from "./tools-delete-dialog";

interface ToolsTableToolbarActionsProps {
  table: Table<Tool>;
}

export function ToolsTableToolbarActions({
  table,
}: ToolsTableToolbarActionsProps) {
  const { execute: processToolsAction, isPending } = useServerAction(
    processTools,
    {
      onSuccess: () => {
        toast.success("Tools processing started");
        table.toggleAllRowsSelected(false);
      },
      onError: ({ err }) => {
        toast.error(err.message);
      },
    }
  );

  const { execute: batchTranslateAction, isPending: isTranslating } =
    useServerAction(batchTranslateToVietnamese, {
      onSuccess: () => {
        toast.success("Translation started");
        table.toggleAllRowsSelected(false);
      },
      onError: ({ err }) => {
        toast.error(err.message);
      },
    });

  const selectedTools = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);

  return (
    <>
      {selectedTools.length > 0 ? (
        <>
          <Button
            disabled={isPending}
            onClick={() =>
              processToolsAction({ ids: selectedTools.map((t) => t.id) })
            }
            prefix={<PlayIcon />}
            size="sm"
            variant="outline"
          >
            Process ({selectedTools.length})
          </Button>

          <Button
            disabled={isPending || isTranslating}
            onClick={() =>
              batchTranslateAction({ ids: selectedTools.map((t) => t.id) })
            }
            size="sm"
            variant="outline"
          >
            Translate to Vietnamese ({selectedTools.length})
          </Button>

          <ToolsScheduleDialog
            onSuccess={() => table.toggleAllRowsSelected(false)}
            tools={selectedTools}
          />

          <ToolsDeleteDialog
            onSuccess={() => table.toggleAllRowsSelected(false)}
            tools={selectedTools}
          />
        </>
      ) : null}
    </>
  );
}
