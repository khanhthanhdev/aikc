"use client";

import type { Ad } from "@prisma/client";
import type { Row } from "@tanstack/react-table";
import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Button } from "~/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/admin/ui/dropdown-menu";
import { cx } from "~/utils/cva";
import { AdsDeleteDialog } from "./ads-delete-dialog";

interface AdActionsProps extends React.ComponentPropsWithoutRef<typeof Button> {
  ad: Ad;
  row?: Row<Ad>;
}

export const AdActions = ({ ad, row, className, ...props }: AdActionsProps) => {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDialogSuccess = () => {
    setShowDeleteDialog(false);
    row?.toggleSelected(false);
    router.push("/admin/ads");
  };

  return (
    <>
      <AdsDeleteDialog
        ads={[ad]}
        onOpenChange={setShowDeleteDialog}
        onSuccess={handleDialogSuccess}
        open={showDeleteDialog}
        showTrigger={false}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Open menu"
            className={cx("size-7 data-[state=open]:bg-muted", className)}
            prefix={<EllipsisIcon />}
            size="sm"
            variant="outline"
            {...props}
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/ads/${ad.id}`}>Edit</Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href={ad.websiteUrl} target="_blank">
              Visit website
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => setShowDeleteDialog(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
