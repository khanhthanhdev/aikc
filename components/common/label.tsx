"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";
import { cva, cx, type VariantProps } from "~/utils/cva";

const labelVariants = cva({
  base: "block self-start font-semibold text-foreground text-sm [&[for]]:cursor-pointer",

  variants: {
    isRequired: {
      true: "after:ml-0.5 after:text-red-500/75 after:content-['*']",
    },
  },
});

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, isRequired, ...props }, ref) => {
  return (
    <LabelPrimitive.Root
      aria-label="Label"
      className={cx(labelVariants({ isRequired, className }))}
      ref={ref}
      {...props}
    />
  );
});
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
