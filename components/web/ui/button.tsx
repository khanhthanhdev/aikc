import { Slot } from "@radix-ui/react-slot";
import { LoaderIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Children, isValidElement } from "react";
import { Box } from "~/components/common/box";
import { Slottable } from "~/components/common/slottable";
import { cva, cx, type VariantProps } from "~/utils/cva";

export const buttonVariants = cva({
  base: [
    "group/button relative inline-flex max-w-80 items-center justify-center rounded-md text-left font-display font-semibold -tracking-micro",
    "disabled:pointer-events-none disabled:opacity-60",
  ],

  variants: {
    variant: {
      primary:
        "border-transparent bg-foreground text-background opacity-90 hover:opacity-100",
      secondary: "font-medium text-foreground/65 hover:text-foreground",
    },
    size: {
      sm: "gap-[0.66ch] px-2 py-0.5 text-[13px]/normal",
      md: "gap-[0.75ch] px-3 py-1 text-[13px]/normal",
      lg: "gap-[1ch] px-4 py-2 text-[13px]/normal sm:text-sm/normal",
    },
    isAffixOnly: {
      true: "",
    },
    isPending: {
      true: "select-none [&>*:not(.animate-spin)]:text-transparent",
    },
  },

  compoundVariants: [
    // Is affix only
    { size: "sm", isAffixOnly: true, class: "px-1" },
    { size: "md", isAffixOnly: true, class: "px-1.5" },
    { size: "lg", isAffixOnly: true, class: "px-2" },
  ],

  defaultVariants: {
    variant: "primary",
    size: "lg",
  },
});

export const buttonAffixVariants = cva({
  base: "my-[0.2em] size-[1.1em] shrink-0",
});

export type ButtonProps = Omit<ComponentProps<"button">, "size" | "prefix"> &
  Omit<VariantProps<typeof buttonVariants>, "isAffixOnly"> & {
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
    prefix?: ReactNode;

    /**
     * The slot to be rendered after the label.
     */
    suffix?: ReactNode;
  };

export const Button = ({
  children,
  className,
  disabled,
  asChild,
  isPending,
  prefix,
  suffix,
  variant,
  size,
  ...props
}: ButtonProps) => {
  const isChildrenEmpty = (children: ReactNode) => {
    return Children.count(children) === 0;
  };

  const useAsChild = asChild && isValidElement(children);
  const Component = useAsChild ? Slot : "button";

  // Determine if the button has affix only.
  const isAffixOnly = isChildrenEmpty(children) && !(prefix && suffix);

  return (
    <Box focus hover>
      <Component
        className={cx(
          buttonVariants({ variant, size, isAffixOnly, isPending, className })
        )}
        disabled={disabled ?? isPending}
        {...props}
      >
        <Slottable asChild={asChild} child={children}>
          {(child) => (
            <>
              <Slot className={buttonAffixVariants()}>{prefix}</Slot>
              {!isChildrenEmpty(child) && (
                <span className="flex-1 truncate only:text-center">
                  {child}
                </span>
              )}
              <Slot className={buttonAffixVariants()}>{suffix}</Slot>

              {!!isPending && (
                <LoaderIcon className="absolute size-[1.25em] animate-spin" />
              )}
            </>
          )}
        </Slottable>
      </Component>
    </Box>
  );
};
