import type { ComponentProps } from "react";
import { Box } from "~/components/common/box";
import { cva, cx, type VariantProps } from "~/utils/cva";

export const inputVariants = cva({
  base: [
    "min-h-0 appearance-none truncate break-words rounded-lg bg-transparent text-foreground transition duration-150 placeholder:text-inherit placeholder:opacity-50 disabled:opacity-25",
    "resize-none [field-sizing:content]",
  ],

  variants: {
    size: {
      sm: "rounded-md px-2 py-0.5 text-[13px]/normal",
      md: "rounded-md px-3 py-1 text-[13px]/normal",
      lg: "rounded-lg px-4 py-2.5 text-sm/normal",
    },
  },

  defaultVariants: {
    size: "md",
  },
});

export type InputProps = Omit<ComponentProps<"input">, "size"> &
  VariantProps<typeof inputVariants>;

export const Input = ({ size, className, ...props }: InputProps) => {
  return (
    <Box focus>
      <input className={cx(inputVariants({ size, className }))} {...props} />
    </Box>
  );
};
