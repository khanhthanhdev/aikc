"use client";

import type { Tool } from "@prisma/client";
import type { Row } from "@tanstack/react-table";
import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { ToolsDeleteDialog } from "~/app/admin/tools/_components/tools-delete-dialog";
import { ToolsScheduleDialog } from "~/app/admin/tools/_components/tools-schedule-dialog";
import {
  processTools,
  reuploadToolAssets,
} from "~/app/admin/tools/_lib/actions";
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

interface ToolActionsProps
  extends React.ComponentPropsWithoutRef<typeof Button> {
  row?: Row<Tool>;
  tool: Tool;
}

export const ToolActions = ({
  tool,
  row,
  className,
  ...props
}: ToolActionsProps) => {
  const router = useRouter();
  const [dialog, setDialog] = useState<"delete" | "schedule" | null>(null);

  const { execute: reuploadAssetsAction } = useServerAction(
    reuploadToolAssets,
    {
      onSuccess: () => {
        toast.success("Tool assets reuploaded");
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    }
  );

  const { execute: processToolsAction, isPending: isProcessing } =
    useServerAction(processTools, {
      onSuccess: () => {
        toast.success("Tool processing started");
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    });

  const handleDialogSuccess = () => {
    setDialog(null);
    row?.toggleSelected(false);
    router.push("/admin/tools");
  };

  return (
    <>
      <ToolsDeleteDialog
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        onSuccess={handleDialogSuccess}
        open={dialog === "delete"}
        showTrigger={false}
        tools={[tool]}
      />

      <ToolsScheduleDialog
        onOpenChange={(open) => setDialog(open ? "schedule" : null)}
        onSuccess={handleDialogSuccess}
        open={dialog === "schedule"}
        showTrigger={false}
        tools={[tool]}
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
            <Link href={`/admin/tools/${tool.slug}`}>Edit</Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link
              href={`${config.site.url}/tools/${tool.slug}?preview=${tool.id}`}
              target="_blank"
            >
              View
            </Link>
          </DropdownMenuItem>

          {!tool.publishedAt && (
            <DropdownMenuItem
              className="text-green-600"
              onSelect={() => setDialog("schedule")}
            >
              Schedule
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            className="text-blue-600"
            disabled={isProcessing}
            onSelect={() => processToolsAction({ ids: [tool.id] })}
          >
            Process
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => reuploadAssetsAction({ id: tool.id })}
          >
            Reupload Assets
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href={tool.websiteUrl} target="_blank">
              Visit website
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => setDialog("delete")}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
