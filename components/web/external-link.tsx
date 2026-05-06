"use client";

import { Slot } from "@radix-ui/react-slot";
import { type AnchorHTMLAttributes, forwardRef } from "react";
import { cx } from "~/utils/cva"; // Assuming this utility exists

interface ExternalLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean;
  eventName?: string;
  eventProps?: Record<string, any>;
}

export const ExternalLink = forwardRef<HTMLAnchorElement, ExternalLinkProps>(
  ({ className, asChild = false, eventName, eventProps, ...props }, ref) => {
    const Comp = asChild ? Slot : "a";

    // Placeholder for analytics
    const handleClick = () => {
      if (eventName) {
        console.log("Track event:", eventName, eventProps);
        // TODO: Integrate actual analytics here if found
      }
    };

    return (
      <Comp
        className={cx("", className)}
        onClick={handleClick}
        ref={ref}
        rel="noopener noreferrer"
        target="_blank"
        {...props}
      />
    );
  }
);

ExternalLink.displayName = "ExternalLink";
