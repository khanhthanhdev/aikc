import type { ComponentProps } from "react";
import { cx } from "~/utils/cva";

export const Grid = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      className={cx("grid-auto-fill-lg grid w-full gap-5", className)}
      {...props}
    />
  );
};
