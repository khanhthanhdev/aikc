import Image from "next/image";
import type { HTMLAttributes } from "react";
import { cx } from "~/utils/cva";

type FaviconProps = HTMLAttributes<HTMLDivElement> & {
  src: string | null;
  title?: string | null;
};

export const Favicon = ({ className, src, title, ...props }: FaviconProps) => {
  return (
    <div
      className={cx(
        "flex size-8 shrink-0 items-center justify-center rounded-md",
        className
      )}
      {...props}
    >
      <FaviconImage className="size-full" src={src} title={title} />
    </div>
  );
};

export const FaviconImage = ({
  className,
  src,
  title,
  ...props
}: FaviconProps) => {
  if (!src) {
    return null;
  }

  // Always use unoptimized for external URLs to prevent hydration mismatch
  const isExternal = src.startsWith("http://") || src.startsWith("https://");

  return (
    <Image
      alt={`Favicon of ${title} website`}
      className={cx(
        "aspect-square size-9 rounded-[inherit] object-contain",
        className
      )}
      height={64}
      loading="lazy"
      sizes="64px"
      src={src}
      unoptimized={isExternal}
      width={64}
      {...props}
    />
  );
};
