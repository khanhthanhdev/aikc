"use client";

import type { HTMLAttributes } from "react";
import { Streamdown } from "streamdown";
import { cx } from "~/utils/cva";

type ChatMarkdownProps = HTMLAttributes<HTMLElement> & {
  children: string;
};

export function ChatMarkdown({
  children,
  className,
  ...props
}: ChatMarkdownProps) {
  return (
    <div className={cx("text-sm leading-relaxed", className)} {...props}>
      <Streamdown mode="streaming">{children}</Streamdown>
    </div>
  );
}
