import type { ComponentProps } from "react";

import { cx } from "~/utils/cva";

export const DataTableThumbnail = ({
  className,
  ...props
}: ComponentProps<"img">) => {
  return (
    <img
      alt="Thumbnail"
      className={cx(
        "mr-2 inline-block size-4 rounded align-text-bottom",
        className
      )}
      height={16}
      loading="lazy"
      width={16}
      {...props}
    />
  );
};
