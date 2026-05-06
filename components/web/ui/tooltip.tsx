"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type {
  ComponentProps,
  ComponentPropsWithoutRef,
  ElementRef,
  ReactNode,
} from "react";
import { forwardRef } from "react";
import { cva, cx, type VariantProps } from "~/utils/cva";

export const tooltipVariants = cva({
  base: [
    "pointer-events-none z-50 inline-flex min-h-6 max-w-[12rem] select-none items-center gap-2 text-pretty rounded-md bg-background px-2.5 py-1 font-medium text-xs/tight shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] outline-none invert will-change-[transform,opacity]",
    "fade-in-0 data-[state=closed]:fade-out-0 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 animate-in data-[state=closed]:animate-out",
  ],

  variants: {
    align: {
      start: "text-start",
      center: "text-center",
      end: "text-end",
    },
  },

  defaultVariants: {
    align: "center",
  },
});

export const tooltipArrowVariants = cva({
  base: "block h-1 w-2 fill-background",
});

export type TooltipElement = ElementRef<typeof TooltipPrimitive.Trigger>;
export type TooltipProps = ComponentProps<typeof TooltipPrimitive.Root> &
  ComponentProps<typeof TooltipContent> & {
    tooltip: ReactNode;
  };

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipPortal = TooltipPrimitive.Portal;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> &
    VariantProps<typeof tooltipVariants>
>((props, ref) => {
  const {
    children,
    className,
    align = "center",
    collisionPadding = 5,
    sideOffset = 4,
    ...rest
  } = props;

  return (
    <TooltipPrimitive.Content
      align={align}
      className={cx(tooltipVariants({ align, className }))}
      collisionPadding={collisionPadding}
      ref={ref}
      sideOffset={sideOffset}
      {...rest}
    >
      {children}
      <TooltipArrow />
    </TooltipPrimitive.Content>
  );
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export const TooltipArrow = forwardRef<
  ElementRef<typeof TooltipPrimitive.Arrow>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Arrow> &
    VariantProps<typeof tooltipArrowVariants>
>(({ className, ...props }, ref) => (
  <TooltipPrimitive.Arrow
    className={cx(tooltipArrowVariants({ className }))}
    ref={ref}
    {...props}
  />
));
TooltipArrow.displayName = TooltipPrimitive.Arrow.displayName;

export const TooltipBase = ({
  children,
  className,
  delayDuration,
  tooltip,
  ...props
}: TooltipProps) => {
  if (!tooltip) {
    return children;
  }

  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild className={className}>
        {children}
      </TooltipPrimitive.Trigger>

      <TooltipContent {...props}>{tooltip}</TooltipContent>
    </TooltipPrimitive.Root>
  );
};

export const Tooltip = Object.assign(TooltipBase, {
  Provider: TooltipProvider,
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Portal: TooltipPortal,
  Content: TooltipContent,
  Arrow: TooltipArrow,
});
