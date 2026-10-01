"use client";

import type { Table } from "@tanstack/react-table";
import { CheckIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { Button } from "~/components/admin/ui/button";
import { resolveReports } from "../_lib/actions";
import type { ReportRow } from "../_lib/queries";
import { ReportsDeleteDialog } from "./reports-delete-dialog";

interface ReportsTableToolbarActionsProps {
  table: Table<ReportRow>;
}

export function ReportsTableToolbarActions({
  table,
}: ReportsTableToolbarActionsProps) {
  const { execute: resolveAction, isPending } = useServerAction(
    resolveReports,
    {
      onSuccess: () => {
        toast.success("Reports updated");
        table.toggleAllRowsSelected(false);
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    }
  );

  const selectedReports = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);

  if (!selectedReports.length) {
    return null;
  }

  const openIds = selectedReports
    .filter((report) => report.status === "open")
    .map(({ id }) => id);

  const resolvedIds = selectedReports
    .filter((report) => report.status === "resolved")
    .map(({ id }) => id);

  return (
    <>
      {openIds.length > 0 && (
        <Button
          disabled={isPending}
          onClick={() => resolveAction({ ids: openIds, resolved: true })}
          prefix={<CheckIcon />}
          size="sm"
          variant="outline"
        >
          Mark resolved ({openIds.length})
        </Button>
      )}

      {resolvedIds.length > 0 && (
        <Button
          disabled={isPending}
          onClick={() => resolveAction({ ids: resolvedIds, resolved: false })}
          prefix={<RotateCcwIcon />}
          size="sm"
          variant="outline"
        >
          Reopen ({resolvedIds.length})
        </Button>
      )}

      <ReportsDeleteDialog
        onSuccess={() => table.toggleAllRowsSelected(false)}
        reports={selectedReports}
      />
    </>
  );
}
