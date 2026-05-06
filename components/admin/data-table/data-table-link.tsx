import Link from "next/link";
import type { ComponentProps } from "react";

import { cx } from "~/utils/cva";

export const DataTableLink = ({
  className,
  ...props
}: ComponentProps<typeof Link>) => {
  return (
    <Link
      className={cx(
        "max-w-40 truncate font-medium text-primary underline decoration-foreground/10 underline-offset-4 hover:decoration-foreground/25",
        className
      )}
      {...props}
    />
  );
};
