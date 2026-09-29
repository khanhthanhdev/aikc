"use client";

import type { Row } from "@tanstack/react-table";
import { EllipsisIcon } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { UsersDeleteDialog } from "~/app/admin/users/_components/users-delete-dialog";
import { setUsersDisabled } from "~/app/admin/users/_lib/actions";
import type { UserRow } from "~/app/admin/users/_lib/queries";
import { Button } from "~/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/admin/ui/dropdown-menu";
import { cx } from "~/utils/cva";

type UserActionsProps = React.ComponentPropsWithoutRef<typeof Button> & {
  row?: Row<UserRow>;
  user: UserRow;
};

export const UserActions = ({
  user,
  row,
  className,
  ...props
}: UserActionsProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isDisabled = Boolean(user.disabledAt);

  const { execute: setDisabled, isPending } = useServerAction(
    setUsersDisabled,
    {
      onSuccess: () => {
        toast.success(
          isDisabled ? `${user.email} unblocked` : `${user.email} blocked`
        );
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    }
  );

  // Your own row gets no actions: blocking or removing yourself is refused
  // on the server anyway, and an empty menu is clearer than an error.
  if (user.isCurrentUser) {
    return null;
  }

  return (
    <>
      <UsersDeleteDialog
        onOpenChange={setShowDeleteDialog}
        onSuccess={() => row?.toggleSelected(false)}
        open={showDeleteDialog}
        showTrigger={false}
        users={[user]}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Open menu"
            className={cx("size-7 data-[state=open]:bg-muted", className)}
            disabled={isPending}
            prefix={<EllipsisIcon />}
            size="sm"
            variant="outline"
            {...props}
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              setDisabled({ ids: [user.id], disabled: !isDisabled })
            }
          >
            {isDisabled ? "Unblock" : "Block"}
          </DropdownMenuItem>

          {!user.isFromEnv && (
            <>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="text-red-500"
                onSelect={() => setShowDeleteDialog(true)}
              >
                Remove
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
