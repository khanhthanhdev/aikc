"use client";

import { cva } from "cva";
import type { ComponentProps } from "react";
import { Link, usePathname } from "~/i18n/navigation";
import { cx } from "~/utils/cva";

export const navigationLinkVariants = cva({
  base: [
    "group -m-0.5 flex cursor-pointer items-center gap-2 p-0.5 text-sm disabled:opacity-50",
  ],
  variants: {
    isActive: {
      false: "text-foreground/80 hover:text-foreground",
      true: "text-foreground",
    },
  },
  defaultVariants: {
    isActive: false,
  },
});

const extractPathname = (
  href: ComponentProps<typeof Link>["href"] | string | undefined
) => {
  if (!href) {
    return "";
  }

  if (typeof href === "string") {
    return href.split("?")[0];
  }

  if (typeof href === "object") {
    const pathname = "pathname" in href ? href.pathname : undefined;
    return typeof pathname === "string" ? pathname : "";
  }

  return String(href);
};

const isItemActive = (href: string, pathname: string) => {
  if (href && href !== "/") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return false;
};

export const NavigationLink = ({
  className,
  ...props
}: ComponentProps<"a"> & ComponentProps<typeof Link>) => {
  const pathname = usePathname();
  const hrefPathname = extractPathname(props.href);
  const isActive = isItemActive(hrefPathname, pathname);
  const isExternal =
    hrefPathname.startsWith("http://") ||
    hrefPathname.startsWith("https://") ||
    hrefPathname.startsWith("mailto:") ||
    hrefPathname.startsWith("tel:");
  const Comp = isExternal ? "a" : Link;

  return (
    <Comp
      className={cx(navigationLinkVariants({ isActive, className }))}
      {...props}
    />
  );
};
