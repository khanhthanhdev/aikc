"use client";

import type { Collection } from "@prisma/client";
import type { Row } from "@tanstack/react-table";
import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { CollectionsDeleteDialog } from "~/app/admin/collections/_components/collections-delete-dialog";
import { Button } from "~/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/admin/ui/dropdown-menu";
import { siteConfig } from "~/config/site";
import { cx } from "~/utils/cva";

interface CollectionActionsProps
  extends React.ComponentPropsWithoutRef<typeof Button> {
  collection: Collection;
  row?: Row<Collection>;
}

export const CollectionActions = ({
  collection,
  row,
  className,
  ...props
}: CollectionActionsProps) => {
  const router = useRouter();
  const [showCollectionsDeleteDialog, setShowCollectionsDeleteDialog] =
    useState(false);

  return (
    <>
      <CollectionsDeleteDialog
        collections={[collection]}
        onOpenChange={setShowCollectionsDeleteDialog}
        onSuccess={() =>
          row?.toggleSelected(false) || router.push("/admin/collections")
        }
        open={showCollectionsDeleteDialog}
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
            <Link href={`/admin/collections/${collection.slug}`}>Edit</Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link
              href={`${siteConfig.url}/collections/${collection.slug}`}
              target="_blank"
            >
              View
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-red-500"
            onSelect={() => setShowCollectionsDeleteDialog(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
