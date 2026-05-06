import type { ComponentProps } from "react";
import { Box } from "~/components/common/box";
import { inputVariants } from "~/components/web/ui/input";
import { cx, type VariantProps } from "~/utils/cva";

export type TextAreaProps = ComponentProps<"textarea"> &
  VariantProps<typeof inputVariants>;

export const Textarea = ({ className, ...props }: TextAreaProps) => {
  return (
    <Box focus>
      <textarea className={cx(inputVariants({ className }))} {...props} />
    </Box>
  );
};
