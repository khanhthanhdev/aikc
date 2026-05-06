import type { ComponentProps } from "react";
import { cva, cx, type VariantProps } from "~/utils/cva";

const wrapperVariants = cva({
  base: "mx-auto flex w-full flex-col gap-12",
  variants: {
    size: {
      sm: "max-w-screen-sm",
      md: "max-w-screen-md",
      lg: "max-w-screen-lg",
    },
  },
});

type WrapperProps = ComponentProps<"div"> &
  VariantProps<typeof wrapperVariants>;

export const Wrapper = ({ className, size, ...props }: WrapperProps) => {
  return (
    <div className={cx(wrapperVariants({ size, className }))} {...props} />
  );
};
