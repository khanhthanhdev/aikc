"use client";

import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";
import { cx } from "~/utils/cva";

export const Toaster = (props: ComponentProps<typeof Sonner>) => {
  return (
    <Sonner
      className="!z-50 flex flex-col items-center gap-2"
      gap={8}
      offset="80px"
      position="top-center"
      richColors
      toastOptions={{
        classNames: {
          toast: cx(
            "justify-center !gap-3 !rounded-lg !border !border-foreground/15 !bg-background/75 backdrop-blur-xl !py-2.5 !shadow-sm sm:w-auto",
            "data-[type=error]:!text-red-500/75 data-[type=success]:!text-green-500/75 data-[type=info]:!text-foreground/65"
          ),
        },
      }}
      {...props}
    />
  );
};
