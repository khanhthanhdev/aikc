import type { ComponentProps } from "react";
import { cx } from "~/utils/cva";

export const Ping = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      className={cx("relative size-3 text-foreground", className)}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-current opacity-30 blur-[1px]" />
      <div className="pointer-events-none absolute inset-0 animate-pulse rounded-full bg-current opacity-30" />
      <div className="absolute inset-[3px] rounded-full bg-current" />
    </div>
  );
};
