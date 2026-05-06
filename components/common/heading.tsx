import { Slot } from "@radix-ui/react-slot";
import { type ComponentProps, type ElementType, isValidElement } from "react";
import { cva, cx, type VariantProps } from "~/utils/cva";

const headingVariants = cva({
  base: "bg-gradient-to-b from-foreground to-foreground/75 bg-clip-text font-display font-semibold text-transparent",

  variants: {
    size: {
      h1: "text-3xl tracking-micro sm:text-4xl md:text-5xl/[1.05]",
      h2: "text-2xl tracking-micro md:text-3xl lg:text-4xl",
      h3: "text-2xl tracking-micro lg:text-3xl",
      h4: "!to-foreground text-xl tracking-micro md:text-2xl",
      h5: "!to-foreground font-medium text-base tracking-micro md:text-lg",
      h6: "!to-foreground font-medium text-sm",
    },
  },

  defaultVariants: {
    size: "h3",
  },
});

export type HeadingProps = Omit<ComponentProps<"h1">, "size"> &
  VariantProps<typeof headingVariants> & {
    /**
     * If set to `true`, the button will be rendered as a child within the component.
     * This child component must be a valid React component.
     */
    as?: ElementType;

    /**
     * If set to `true`, the button will be rendered as a child within the component.
     * This child component must be a valid React component.
     */
    asChild?: boolean;
  };

export const Heading = ({
  className,
  as,
  asChild,
  size,
  ...props
}: HeadingProps) => {
  const useAsChild = asChild && isValidElement(props.children);
  const Comp = useAsChild ? Slot : (as ?? size ?? "h2");

  return (
    <Comp className={cx(headingVariants({ size, className }))} {...props} />
  );
};

export const H1 = (props: HeadingProps) => {
  return <Heading size="h1" {...props} />;
};

export const H2 = (props: HeadingProps) => {
  return <Heading size="h2" {...props} />;
};

export const H3 = (props: HeadingProps) => {
  return <Heading size="h3" {...props} />;
};

export const H4 = (props: HeadingProps) => {
  return <Heading size="h4" {...props} />;
};

export const H5 = (props: HeadingProps) => {
  return <Heading size="h5" {...props} />;
};

export const H6 = (props: HeadingProps) => {
  return <Heading size="h6" {...props} />;
};
