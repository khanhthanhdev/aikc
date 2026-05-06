import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";
import { H4 } from "~/components/common/heading";

import { cx } from "~/utils/cva";

interface DataTableHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  callToAction?: React.ReactNode;
  total?: number;
}

export function DataTableHeader({
  title,
  total,
  callToAction,
  children,
  className,
  ...props
}: DataTableHeaderProps) {
  return (
    <div
      className={cx(
        "sticky top-0 z-20 -my-4 flex w-full flex-col gap-4 overflow-auto bg-background py-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-4">
        <H4 as="h1">
          {title}
          {typeof total === "number" && (
            <span className="ml-1.5 opacity-40">({total})</span>
          )}
        </H4>

        <Slot className="-my-0.5">{callToAction}</Slot>
      </div>

      {children}
    </div>
  );
}
