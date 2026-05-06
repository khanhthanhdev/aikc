import { ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "~/i18n/navigation";
import { cva, cx, type VariantProps } from "~/utils/cva";

const breadcrumbVariants = cva({
  base: "flex items-center gap-2 text-sm",
});

const breadcrumbListVariants = cva({
  base: "flex flex-wrap items-center gap-1.5 break-words",
});

const breadcrumbItemVariants = cva({
  base: "inline-flex items-center gap-1.5",
});

const breadcrumbLinkVariants = cva({
  base: "text-foreground/65 transition-colors hover:text-foreground",
});

const breadcrumbPageVariants = cva({
  base: "font-medium text-foreground",
});

const breadcrumbSeparatorVariants = cva({
  base: "text-foreground/25",
});

export type BreadcrumbProps = ComponentProps<"nav"> &
  VariantProps<typeof breadcrumbVariants>;

export const Breadcrumb = ({ className, ...props }: BreadcrumbProps) => {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cx(breadcrumbVariants({ className }))}
      {...props}
    />
  );
};

export type BreadcrumbListProps = ComponentProps<"ol"> &
  VariantProps<typeof breadcrumbListVariants>;

export const BreadcrumbList = ({
  className,
  ...props
}: BreadcrumbListProps) => {
  return (
    <ol className={cx(breadcrumbListVariants({ className }))} {...props} />
  );
};

export type BreadcrumbItemProps = ComponentProps<"li"> &
  VariantProps<typeof breadcrumbItemVariants>;

export const BreadcrumbItem = ({
  className,
  ...props
}: BreadcrumbItemProps) => {
  return (
    <li className={cx(breadcrumbItemVariants({ className }))} {...props} />
  );
};

export type BreadcrumbLinkProps = ComponentProps<typeof Link> &
  VariantProps<typeof breadcrumbLinkVariants>;

export const BreadcrumbLink = ({
  className,
  ...props
}: BreadcrumbLinkProps) => {
  return (
    <Link className={cx(breadcrumbLinkVariants({ className }))} {...props} />
  );
};

export type BreadcrumbPageProps = ComponentProps<"span"> &
  VariantProps<typeof breadcrumbPageVariants>;

export const BreadcrumbPage = ({
  className,
  ...props
}: BreadcrumbPageProps) => {
  return (
    <span
      aria-current="page"
      className={cx(breadcrumbPageVariants({ className }))}
      {...props}
    />
  );
};

export interface BreadcrumbSeparatorProps {
  children?: ReactNode;
  className?: string;
}

export const BreadcrumbSeparator = ({
  children,
  className,
}: BreadcrumbSeparatorProps) => {
  return (
    <li
      aria-hidden="true"
      className={cx(breadcrumbSeparatorVariants({ className }))}
      role="presentation"
    >
      {children ?? <ChevronRight className="size-4" />}
    </li>
  );
};
