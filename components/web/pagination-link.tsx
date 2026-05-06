import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { navigationLinkVariants } from "~/components/web/ui/navigation-link";
import { Link } from "~/i18n/navigation";
import { cva, cx, type VariantProps } from "~/utils/cva";

const affixVariants = cva({
  base: "size-5 duration-150 group-hover:last:translate-x-0.5 group-hover:first:-translate-x-0.5",
});

type PaginationLinkProps = Omit<
  HTMLAttributes<HTMLElement> & ComponentProps<typeof Link>,
  "prefix"
> &
  VariantProps<typeof navigationLinkVariants> & {
    prefix?: ReactNode;
    suffix?: ReactNode;
    isDisabled?: boolean;
  };

export const PaginationLink = ({
  children,
  className,
  prefix,
  suffix,
  isActive,
  isDisabled,
  ...props
}: PaginationLinkProps) => {
  if (isDisabled) {
    return (
      <span
        aria-disabled="true"
        className={cx(
          navigationLinkVariants({
            className: "pointer-events-none opacity-65",
          })
        )}
      >
        <Slot className={affixVariants()}>{prefix}</Slot>
        <span>{children}</span>
        <Slot className={affixVariants()}>{suffix}</Slot>
      </span>
    );
  }

  return (
    <Link
      className={cx(
        isActive && "rounded-sm bg-card-dark",
        navigationLinkVariants({ isActive, className })
      )}
      {...props}
    >
      <Slot className={affixVariants()}>{prefix}</Slot>
      <span>{children}</span>
      <Slot className={affixVariants()}>{suffix}</Slot>
    </Link>
  );
};
