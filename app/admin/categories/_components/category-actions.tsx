"use client";

import type { Category } from "@prisma/client";
import type { Row } from "@tanstack/react-table";
import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { CategoriesDeleteDialog } from "~/app/admin/categories/_components/categories-delete-dialog";
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

interface CategoryActionsProps
  extends React.ComponentPropsWithoutRef<typeof Button> {
  category: Category;
  row?: Row<Category>;
}

export const CategoryActions = ({
  category,
  row,
  className,
  ...props
}: CategoryActionsProps) => {
  const router = useRouter();
  const [showCategoriesDeleteDialog, setShowCategoriesDeleteDialog] =
    useState(false);

  return (
    <>
      <CategoriesDeleteDialog
        categories={[category]}
        onOpenChange={setShowCategoriesDeleteDialog}
        onSuccess={() =>
          row?.toggleSelected(false) || router.push("/admin/categories")
        }
        open={showCategoriesDeleteDialog}
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
            <Link href={`/admin/categories/${category.slug}`}>Edit</Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link
              href={`${siteConfig.url}/categories/${category.slug}`}
              target="_blank"
            >
              View
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-red-500"
            onSelect={() => setShowCategoriesDeleteDialog(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
