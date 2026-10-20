"use client";

import { Slot } from "@radix-ui/react-slot";
import { type AnchorHTMLAttributes, forwardRef } from "react";
import { cx } from "~/utils/cva";

interface ExternalLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean;
}

export const ExternalLink = forwardRef<HTMLAnchorElement, ExternalLinkProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "a";

    return (
      <Comp
        className={cx("", className)}
        ref={ref}
        rel="noopener noreferrer"
        target="_blank"
        {...props}
      />
    );
  }
);

ExternalLink.displayName = "ExternalLink";
