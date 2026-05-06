import type { HTMLAttributes } from "react";
import { cx } from "~/utils/cva";

export const Prose = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement>) => {
  return (
    <div
      className={cx(
        "prose prose-neutral prose-li:mt-2 prose-img:rounded-md prose-pre:rounded-none prose-img:border prose-img:border-neutral-200 prose-pre:font-mono prose-strong:font-medium prose-a:text-foreground prose-lead:text-lg/relaxed prose-strong:text-foreground text-foreground/65 leading-relaxed first:prose-li:mt-0 first:prose-p:mt-0 first:prose-ul:mt-0 last:prose-p:mb-0 last:prose-ul:mb-0 hover:prose-a:text-foreground/80",
        "prose-headings:font-display prose-headings:font-semibold prose-headings:text-foreground prose-headings:tracking-tight",
        "prose-h5:font-medium prose-h6:font-medium prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-2xl prose-h4:text-xl prose-h5:text-base prose-h6:text-sm prose-h5:tracking-micro prose-h6:tracking-normal md:prose-h1:text-4xl md:prose-h2:text-3xl",
        "prose-code:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
