import { Slot } from "@radix-ui/react-slot";
import { type ComponentProps, isValidElement, type ReactNode } from "react";
import { Slottable } from "~/components/common/slottable";
import { cva, cx, type VariantProps } from "~/utils/cva";

export const badgeVariants = cva({
  base: "flex items-center rounded font-display text-foreground/80",

  variants: {
    variant: {
      soft: "bg-foreground/10 hover:[&[href]]:bg-foreground/[15%]",
      outline:
        "bg-background ring-1 ring-foreground/15 hover:[&[href]]:text-foreground hover:[&[href]]:ring-foreground/25",
      ghost: "!p-0 bg-transparent hover:[&[href]]:text-foreground",
      success: "bg-green-500/50 text-foreground",
      error: "bg-red-500/50 text-foreground",
    },
    size: {
      sm: "gap-1 px-1 py-px text-[10px]/tight",
      md: "gap-1.5 px-1.5 py-[3px] text-xs/tight",
      lg: "gap-2 px-2 py-1 text-xs/tight",
    },
  },

  defaultVariants: {
    variant: "soft",
    size: "md",
  },
});

export const badgeAffixVariants = cva({
  base: "size-[1em] shrink-0",
});

type BadgeProps = Omit<ComponentProps<"span">, "prefix"> &
  VariantProps<typeof badgeVariants> & {
    /**
     * If set to `true`, the button will be rendered as a child within the component.
     * This child component must be a valid React component.
     */
    asChild?: boolean;

    /**
     * The slot to be rendered before the label.
     */
    prefix?: ReactNode;

    /**
     * The slot to be rendered after the label.
     */
    suffix?: ReactNode;
  };

export const Badge = ({
  children,
  className,
  asChild,
  variant,
  size,
  prefix,
  suffix,
  ...props
}: BadgeProps) => {
  const useAsChild = asChild && isValidElement(children);
  const Component = useAsChild ? Slot : "span";

  return (
    <Component
      className={cx(badgeVariants({ variant, size, className }))}
      {...props}
    >
      <Slottable asChild={asChild} child={children}>
        {(child) => (
          <>
            {prefix && (
              <Slot className={cx(badgeAffixVariants())}>{prefix}</Slot>
            )}
            {child}
            {suffix && (
              <Slot className={cx(badgeAffixVariants())}>{suffix}</Slot>
            )}
          </>
        )}
      </Slottable>
    </Component>
  );
};
