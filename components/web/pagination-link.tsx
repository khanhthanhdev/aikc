import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { Link } from "~/i18n/navigation";
import { cva, cx, type VariantProps } from "~/utils/cva";

export const paginationLinkVariants = cva({
  base: "group inline-flex h-10 items-center justify-center gap-1.5 rounded-lg font-medium text-sm transition-colors",
  variants: {
    variant: {
      /** Previous and next: outlined, with a label. */
      step: "border border-foreground/15 px-3 hover:border-foreground/30 hover:bg-foreground/5 sm:px-4",
      /** A page number: a square that fills in for the current page. */
      page: "min-w-10 px-2",
    },
    isActive: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    {
      variant: "page",
      isActive: false,
      className: "text-foreground/80 hover:bg-foreground/5 hover:text-foreground",
    },
    {
      variant: "page",
      isActive: true,
      className: "bg-foreground text-background",
    },
  ],
  defaultVariants: {
    variant: "page",
    isActive: false,
  },
});

const affixVariants = cva({
  base: "size-4 duration-150 group-hover:last:translate-x-0.5 group-hover:first:-translate-x-0.5",
});

type PaginationLinkProps = Omit<
  HTMLAttributes<HTMLElement> & ComponentProps<typeof Link>,
  "prefix"
> &
  VariantProps<typeof paginationLinkVariants> & {
    prefix?: ReactNode;
    suffix?: ReactNode;
    isDisabled?: boolean;
  };

export const PaginationLink = ({
  children,
  className,
  prefix,
  suffix,
  variant,
  isActive,
  isDisabled,
  ...props
}: PaginationLinkProps) => {
  const content = (
    <>
      {prefix && <Slot className={affixVariants()}>{prefix}</Slot>}
      <span>{children}</span>
      {suffix && <Slot className={affixVariants()}>{suffix}</Slot>}
    </>
  );

  if (isDisabled) {
    return (
      <span
        aria-disabled="true"
        className={cx(
          paginationLinkVariants({ variant, className }),
          "pointer-events-none opacity-40"
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={paginationLinkVariants({ variant, isActive, className })}
      // Stay where the reader is; the pagination scrolls to the list itself
      scroll={false}
      {...props}
    >
      {content}
    </Link>
  );
};
