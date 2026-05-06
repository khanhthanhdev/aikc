import type { ComponentProps } from "react";
import { Box } from "~/components/common/box";
import { inputVariants } from "~/components/web/ui/input";
import { cx, type VariantProps } from "~/utils/cva";

export type SelectProps = Omit<ComponentProps<"select">, "size"> &
  VariantProps<typeof inputVariants>;

export const Select = ({ size, className, ...props }: SelectProps) => {
  return (
    <Box focus hover>
      <select
        className={cx(
          inputVariants({ size, className }),
          "[&_option]:bg-background [&_option]:text-foreground"
        )}
        {...props}
      />
    </Box>
  );
};
