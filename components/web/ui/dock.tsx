"use client";

import { Slot } from "@radix-ui/react-slot";
import { type ComponentProps, isValidElement } from "react";
import { Box } from "~/components/common/box";
import { cva, cx, type VariantProps } from "~/utils/cva";

const Dock = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <Box>
      <div
        className={cx(
          "isolate flex flex-wrap items-center rounded-xl bg-background/50 px-2 py-1.5 shadow-[0_0_25px_0_var(--tw-shadow-color)] shadow-foreground/10 backdrop-blur-xl",
          className
        )}
        {...props}
      />
    </Box>
  );
};

const dockItemVariants = cva({
  base: [
    "relative rounded p-1.5 transition-all duration-150 ease-in-out",
    "hover:z-10 hover:-mt-1 hover:pb-2.5",
    "disabled:pointer-events-none disabled:opacity-50",
  ],

  variants: {
    isActive: {
      true: "after:pointer-events-none after:absolute after:left-1/2 after:mt-1 after:h-px after:w-2.5 after:-translate-x-1/2 after:rounded-full after:bg-current",
      false: "text-foreground/65",
    },
  },

  defaultVariants: {
    isActive: false,
  },
});

type DockItemProps = ComponentProps<"div"> &
  VariantProps<typeof dockItemVariants> & {
    /**
     * If series to `true`, the button will be rendered as a child within the component.
     * This child component must be a valid React component.
     */
    asChild?: boolean;
  };

const DockItem = ({
  className,
  asChild,
  isActive,
  ...props
}: DockItemProps) => {
  const useAsChild = asChild && isValidElement(props.children);
  const Component = useAsChild ? Slot : "div";

  return (
    <Component
      className={cx(dockItemVariants({ isActive, className }))}
      {...props}
    />
  );
};

const DockSeparator = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      className={cx("mx-1.5 -my-2 h-4 w-[1px] bg-foreground/15", className)}
      {...props}
    />
  );
};

export { Dock, DockItem, DockSeparator };
