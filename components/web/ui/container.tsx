import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
import { cva, cx, type VariantProps } from "~/utils/cva";

const containerVariants = cva({
  base: "relative mx-auto w-full max-w-[75rem] px-6 lg:px-8",
});

type ContainerProps = ComponentProps<"div"> &
  VariantProps<typeof containerVariants> & {
    asChild?: boolean;
  };

export const Container = ({ className, asChild, ...props }: ContainerProps) => {
  const Component = asChild ? Slot : "div";
  return (
    <Component className={cx(containerVariants({ className }))} {...props} />
  );
};
