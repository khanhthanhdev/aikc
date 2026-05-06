import type { HTMLAttributes } from "react";
import { cva, cx, type VariantProps } from "~/utils/cva";

const wrapperVariants = cva({
  base: "flex w-full flex-col gap-8",
  variants: {
    size: {
      sm: "max-w-screen-sm",
      md: "max-w-screen-md",
      lg: "max-w-screen-lg",
    },
  },
});

type WrapperProps = HTMLAttributes<HTMLElement> &
  VariantProps<typeof wrapperVariants>;

export const Wrapper = ({ className, size, ...props }: WrapperProps) => {
  return (
    <div className={cx(wrapperVariants({ size, className }))} {...props} />
  );
};
