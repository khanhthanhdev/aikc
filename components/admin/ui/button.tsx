import { Slot } from "@radix-ui/react-slot";
import { LoaderIcon } from "lucide-react";
import * as React from "react";
import { Children, type ReactNode } from "react";
import { Slottable } from "~/components/common/slottable";
import { cva, cx, type VariantProps } from "~/utils/cva";

export const buttonVariants = cva({
  base: "group/button relative inline-flex min-w-0 shrink-0 items-center justify-center rounded-md font-medium text-sm/tight focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",

  variants: {
    variant: {
      default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
      destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      outline:
        "border border-input bg-background hover:bg-muted hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    },

    size: {
      sm: "gap-[0.66ch] rounded-md px-3 py-2 text-xs/tight",
      md: "gap-[0.75ch] px-4 py-2",
      lg: "gap-[1ch] rounded-md px-6 py-2.5",
    },

    isAffixOnly: {
      true: "",
    },

    isPending: {
      true: "select-none text-transparent",
    },
  },

  compoundVariants: [
    // Is affix only
    { size: "sm", isAffixOnly: true, class: "px-2" },
    { size: "md", isAffixOnly: true, class: "px-2" },
    { size: "lg", isAffixOnly: true, class: "px-2.5" },
  ],

  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

export const buttonAffixVariants = cva({
  base: "size-[1.1em] shrink-0 opacity-75",
});

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "prefix">,
    VariantProps<typeof buttonVariants> {
  /**
   * If set to `true`, the button will be rendered as a child within the component.
   * This child component must be a valid React component.
   */
  asChild?: boolean;

  /**
   * If set to `true`, the button will be rendered in the pending state.
   */
  isPending?: boolean;

  /**
   * The slot to be rendered before the label.
   */
  prefix?: React.ReactNode;

  /**
   * The slot to be rendered after the label.
   */
  suffix?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant,
      size,
      asChild,
      isPending,
      prefix,
      suffix,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    const isChildrenEmpty = (children: ReactNode) => {
      return Children.count(children) === 0;
    };

    // Determine if the button has affix only.
    const isAffixOnly = isChildrenEmpty(children) && !(prefix && suffix);

    return (
      <Comp
        className={cx(
          buttonVariants({ variant, size, isPending, isAffixOnly, className })
        )}
        ref={ref}
        {...props}
      >
        <Slottable asChild={asChild} child={children}>
          {(child) => (
            <>
              <Slot aria-hidden="true" className={buttonAffixVariants()}>
                {prefix}
              </Slot>

              {React.Children.count(child) !== 0 && (
                <span className="truncate">{child}</span>
              )}

              <Slot aria-hidden="true" className={buttonAffixVariants()}>
                {suffix}
              </Slot>

              {!!isPending && (
                <LoaderIcon className="absolute size-[1.25em] animate-spin text-white" />
              )}
            </>
          )}
        </Slottable>
      </Comp>
    );
  }
);
Button.displayName = "Button";
