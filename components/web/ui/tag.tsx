import { Slot } from "@radix-ui/react-slot";
import { type ComponentProps, isValidElement, type ReactNode } from "react";
import { Slottable } from "~/components/common/slottable";
import { cva, cx, type VariantProps } from "~/utils/cva";

export const tagVariants = cva({
  base: "flex items-center gap-1 text-foreground/65 text-sm hover:text-foreground",
});

export const tagAffixVariants = cva({
  base: "shrink-0 stroke-2 text-foreground/25",
});

export type TagProps = Omit<ComponentProps<"span">, "prefix"> &
  VariantProps<typeof tagVariants> & {
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

export const Tag = ({
  children,
  className,
  asChild,
  prefix,
  suffix,
  ...props
}: TagProps) => {
  const useAsChild = asChild && isValidElement(children);
  const Component = useAsChild ? Slot : "span";

  return (
    <Component className={cx(tagVariants({ className }))} {...props}>
      <Slottable asChild={asChild} child={children}>
        {(child) => (
          <>
            {prefix && <Slot className={cx(tagAffixVariants())}>{prefix}</Slot>}
            {child}
            {suffix && <Slot className={cx(tagAffixVariants())}>{suffix}</Slot>}
          </>
        )}
      </Slottable>
    </Component>
  );
};
