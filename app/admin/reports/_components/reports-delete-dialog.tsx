"use client";

import { TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { Button } from "~/components/admin/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/admin/ui/dialog";
import { deleteReports } from "../_lib/actions";
import type { ReportRow } from "../_lib/queries";

interface ReportsDeleteDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  onSuccess?: () => void;
  reports: ReportRow[];
  showTrigger?: boolean;
}

export const ReportsDeleteDialog = ({
  reports,
  showTrigger = true,
  onSuccess,
  ...props
}: ReportsDeleteDialogProps) => {
  const { execute, isPending } = useServerAction(deleteReports, {
    onSuccess: () => {
      toast.success("Reports deleted");
      onSuccess?.();
    },

    onError: ({ err }) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog {...props}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button prefix={<TrashIcon />} size="sm" variant="outline">
            Delete ({reports.length})
          </Button>
        </DialogTrigger>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete{" "}
            <span className="font-medium">{reports.length}</span>
            {reports.length === 1 ? " report" : " reports"}. To keep a record of
            a report you have dealt with, mark it resolved instead.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>

          <Button
            aria-label="Delete selected rows"
            disabled={isPending}
            isPending={isPending}
            onClick={() => execute({ ids: reports.map(({ id }) => id) })}
            variant="destructive"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
