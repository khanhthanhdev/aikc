"use client";

import type { Row } from "@tanstack/react-table";
import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { Button } from "~/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/admin/ui/dropdown-menu";
import { config } from "~/config";
import { cx } from "~/utils/cva";
import { resolveReports } from "../_lib/actions";
import type { ReportRow } from "../_lib/queries";
import { ReportsDeleteDialog } from "./reports-delete-dialog";

interface ReportActionsProps
  extends React.ComponentPropsWithoutRef<typeof Button> {
  report: ReportRow;
  row?: Row<ReportRow>;
}

export const ReportActions = ({
  report,
  row,
  className,
  ...props
}: ReportActionsProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isOpen = report.status === "open";

  const { execute: resolveAction, isPending } = useServerAction(
    resolveReports,
    {
      onSuccess: () => {
        toast.success(isOpen ? "Report resolved" : "Report reopened");
        row?.toggleSelected(false);
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    }
  );

  return (
    <>
      <ReportsDeleteDialog
        onOpenChange={setShowDeleteDialog}
        onSuccess={() => {
          setShowDeleteDialog(false);
          row?.toggleSelected(false);
        }}
        open={showDeleteDialog}
        reports={[report]}
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
          <DropdownMenuItem
            className={isOpen ? "text-green-600" : undefined}
            disabled={isPending}
            onSelect={() =>
              resolveAction({ ids: [report.id], resolved: isOpen })
            }
          >
            {isOpen ? "Mark resolved" : "Reopen"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href={`/admin/tools/${report.tool.slug}`}>Edit tool</Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link
              href={`${config.site.url}/tools/${report.tool.slug}`}
              target="_blank"
            >
              View tool
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href={report.tool.websiteUrl} target="_blank">
              Visit website
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <a href={`mailto:${report.userEmail}`}>Email reporter</a>
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
