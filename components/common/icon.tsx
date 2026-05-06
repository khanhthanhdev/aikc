import type { SVGProps } from "react";
import type { IconName } from "~/types/icons";
import { cx } from "~/utils/cva";

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
};

export const Icon = ({
  name,
  className,
  "aria-label": ariaLabel,
  ...props
}: IconProps) => {
  return (
    <svg
      aria-label={ariaLabel ?? `${name} icon`}
      className={cx("size-[1em]", className)}
      role="img"
      {...props}
    >
      <use href={`/icons/sprite.svg#${name}`} />
    </svg>
  );
};
