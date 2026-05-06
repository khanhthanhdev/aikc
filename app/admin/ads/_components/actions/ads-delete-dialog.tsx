"use client";

import type { Ad } from "@prisma/client";
import type { Row } from "@tanstack/react-table";
import { TrashIcon } from "lucide-react";
import type * as React from "react";
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
import { deleteAds } from "../../_lib/actions";

interface AdsDeleteDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  ads: Row<Ad>["original"][];
  onSuccess?: () => void;
  showTrigger?: boolean;
}

export const AdsDeleteDialog = ({
  ads,
  showTrigger = true,
  onSuccess,
  ...props
}: AdsDeleteDialogProps) => {
  const { execute, isPending } = useServerAction(deleteAds, {
    onSuccess: () => {
      toast.success("Ad(s) deleted");
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
            Delete ({ads.length})
          </Button>
        </DialogTrigger>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your{" "}
            <span className="font-medium">{ads.length}</span>
            {ads.length === 1 ? " ad" : " ads"} from our servers.
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
            onClick={() => execute({ ids: ads.map(({ id }) => id) })}
            variant="destructive"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
