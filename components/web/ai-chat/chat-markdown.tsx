"use client";

import NextLink from "next/link";
import type { ComponentProps, HTMLAttributes } from "react";
import { Streamdown } from "streamdown";
import { cx } from "~/utils/cva";
import { useChatContext } from "./chat-context";

type ChatMarkdownProps = HTMLAttributes<HTMLElement> & {
  children: string;
};

const linkClassName = "wrap-anywhere font-medium text-primary underline";
const INCOMPLETE_LINK_HREF = "streamdown:incomplete-link";
// Matches the dialog's `sm:` breakpoint, below which it is full screen
const MOBILE_QUERY = "(max-width: 639px)";

// Links to our own pages (the assistant links library tools as /{locale}/tools/{slug})
// open in place; anything else opens in a new tab
const ChatLink = ({
  href,
  children,
  node: _node,
  ...props
}: ComponentProps<"a"> & { node?: unknown }) => {
  const { setIsOpen } = useChatContext();

  // Streamdown's placeholder for a link whose URL has not streamed in yet
  if (href === INCOMPLETE_LINK_HREF) {
    return <span className={linkClassName}>{children}</span>;
  }

  if (href?.startsWith("/") && !href.startsWith("//")) {
    return (
      <NextLink
        className={linkClassName}
        href={href}
        onClick={() => {
          // The chat covers the whole screen on phones, so get out of the way
          if (window.matchMedia(MOBILE_QUERY).matches) {
            setIsOpen(false);
          }
        }}
      >
        {children}
      </NextLink>
    );
  }

  return (
    <a
      {...props}
      className={linkClassName}
      href={href}
      rel="noopener noreferrer nofollow"
      target="_blank"
    >
      {children}
    </a>
  );
};

const components = { a: ChatLink };

export function ChatMarkdown({
  children,
  className,
  ...props
}: ChatMarkdownProps) {
  return (
    <div className={cx("text-sm leading-relaxed", className)} {...props}>
      <Streamdown components={components} mode="streaming">
        {children}
      </Streamdown>
    </div>
  );
}
