"use client";

import { TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import type { UserRow } from "~/app/admin/users/_lib/queries";
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
import { deleteUsers } from "../_lib/actions";

type UsersDeleteDialogProps = React.ComponentPropsWithoutRef<typeof Dialog> & {
  onSuccess?: () => void;
  showTrigger?: boolean;
  users: UserRow[];
};

export const UsersDeleteDialog = ({
  users,
  showTrigger = true,
  onSuccess,
  ...props
}: UsersDeleteDialogProps) => {
  const { execute, isPending } = useServerAction(deleteUsers, {
    onSuccess: () => {
      toast.success(users.length === 1 ? "Admin removed" : "Admins removed");
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
            Remove ({users.length})
          </Button>
        </DialogTrigger>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove admin access?</DialogTitle>
          <DialogDescription>
            {users.length === 1 ? (
              <span className="font-medium">{users[0]?.email}</span>
            ) : (
              <>
                <span className="font-medium">{users.length}</span> accounts
              </>
            )}{" "}
            will be signed out of the admin panel on their next request and
            cannot sign in again unless someone adds them back.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>

          <Button
            aria-label="Remove selected admins"
            disabled={isPending}
            isPending={isPending}
            onClick={() => execute({ ids: users.map(({ id }) => id) })}
            variant="destructive"
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
