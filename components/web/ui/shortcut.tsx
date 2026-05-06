import type { ComponentProps } from "react";
import { Heading } from "~/components/common/heading";
import { cva, cx, type VariantProps } from "~/utils/cva";

const shortcutVariants = cva({
  base: "inline-flex whitespace-nowrap rounded border px-[0.4em] py-[0.088em] font-medium text-foregroud/60 text-xs/tight",

  variants: {
    variant: {
      soft: "border-transparent bg-foreground/10",
      outline: "",
    },
  },

  defaultVariants: {
    variant: "outline",
  },
});

export type ShortcutProps = ComponentProps<typeof Heading> &
  VariantProps<typeof shortcutVariants>;

export const Shortcut = ({
  className,
  variant,
  size = "h6",
  ...props
}: ShortcutProps) => {
  return (
    <Heading
      className={cx(shortcutVariants({ variant, className }))}
      size={size}
      {...props}
    />
  );
};
