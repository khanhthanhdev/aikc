"use client";

import { Slot } from "@radix-ui/react-slot";
import { type AnchorHTMLAttributes, forwardRef, type MouseEvent } from "react";
import { type AnalyticsEventData, trackEvent } from "~/lib/analytics";
import { cx } from "~/utils/cva";

interface ExternalLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean;
  eventName?: string;
  eventProps?: AnalyticsEventData;
}

export const ExternalLink = forwardRef<HTMLAnchorElement, ExternalLinkProps>(
  (
    { className, asChild = false, eventName, eventProps, onClick, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "a";

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (eventName) {
        trackEvent(eventName, eventProps);
      }

      onClick?.(event);
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
