import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
import { cva, cx, type VariantProps } from "~/utils/cva";

export const boxVariants = cva({
  base: "border",

  variants: {
    hover: {
      true: "hover:border-foreground/25 hover:ring-[3px] hover:ring-foreground/10 enabled:cursor-pointer",
    },
    focus: {
      true: "focus-visible:z-10 focus-visible:border-foreground/25 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-foreground/10",
    },
    focusWithin: {
      true: "focus-within:z-10 focus-within:border-foreground/25 focus-within:outline-none focus-within:ring-[3px] focus-within:ring-foreground/10",
    },
  },
});

export type BoxProps = ComponentProps<"div"> & VariantProps<typeof boxVariants>;

export const Box = ({
  hover,
  focus,
  focusWithin,
  className,
  ...props
}: BoxProps) => {
  return (
    <Slot
      className={cx(boxVariants({ hover, focus, focusWithin, className }))}
      {...props}
    />
  );
};
