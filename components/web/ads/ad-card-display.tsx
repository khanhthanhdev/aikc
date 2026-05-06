import type { Ad } from "@prisma/client";
import { ArrowUpRightIcon } from "lucide-react";
import Image from "next/image";
import type { ComponentProps } from "react";
import { H4 } from "~/components/common/heading";
import { Skeleton } from "~/components/common/skeleton";
import { Badge } from "~/components/web/ui/badge";
import { Button } from "~/components/web/ui/button";
import {
  Card,
  CardDescription,
  type CardProps,
} from "~/components/web/ui/card";
import { Favicon } from "~/components/web/ui/favicon";
import type { config } from "~/config";
import { cx } from "~/utils/cva";

export type AdCardDisplayProps = CardProps & {
  ad: Ad | typeof config.ads.defaultAd;
  rel?: string;
};

export const AdCardDisplay = ({
  className,
  ad,
  rel,
  ...props
}: AdCardDisplayProps) => {
  const isDefault = !ad.websiteUrl.startsWith("http");

  return (
    <Card
      asChild
      className={cx(
        "group/button relative overflow-visible border-zinc-200 bg-white shadow-sm transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700",
        className
      )}
      {...props}
    >
      <a
        href={ad.websiteUrl}
        rel={rel ?? (isDefault ? undefined : "noopener noreferrer sponsored")}
        target={isDefault ? "_self" : "_blank"}
      >
        {/* Background Pattern */}
        {!isDefault && ad.faviconUrl && (
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-lg">
            <Image
              alt=""
              className="absolute -right-16 -bottom-24 size-80 -rotate-12 select-none object-contain opacity-[0.04] dark:opacity-[0.06]"
              height={300}
              priority
              sizes="320px"
              src={ad.faviconUrl}
              width={300}
            />
          </div>
        )}

        {!isDefault && (
          <div className="absolute -top-3 left-4 z-10">
            <Badge
              className="border-amber-200 bg-amber-100 text-amber-800 ring-4 ring-white dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-zinc-900"
              variant="soft"
            >
              Ad
            </Badge>
          </div>
        )}

        <div className="relative z-20 flex w-full items-center gap-3">
          {ad.faviconUrl && (
            <Favicon className="size-8" src={ad.faviconUrl} title={ad.name} />
          )}
          <H4 as="strong" className="truncate">
            {ad.name}
          </H4>
        </div>

        <CardDescription className="relative z-10 mb-auto line-clamp-3 leading-relaxed">
          {ad.description}
        </CardDescription>

        <Button
          asChild
          className="pointer-events-none relative z-10 mt-auto w-full"
          suffix={<ArrowUpRightIcon />}
          variant="primary"
        >
          <span>{ad.buttonLabel ?? `Visit ${ad.name}`}</span>
        </Button>
      </a>
    </Card>
  );
};

export const AdCardSkeleton = ({ className }: ComponentProps<typeof Card>) => {
  return (
    <Card
      className={cx("select-none items-stretch overflow-visible", className)}
    >
      <div className="absolute -top-3 left-4 z-10">
        <Badge
          className="bg-background ring-4 ring-white dark:ring-zinc-900"
          variant="outline"
        >
          Ad
        </Badge>
      </div>

      <div className="relative z-20 flex w-full items-center gap-3">
        <Favicon
          className="size-8 animate-pulse opacity-50"
          src="/favicon.png"
        />
        <H4 as="strong" className="w-2/3">
          <Skeleton>&nbsp;</Skeleton>
        </H4>
      </div>

      <CardDescription className="mt-2 mb-auto flex flex-col gap-1.5">
        <Skeleton className="h-4 w-full">&nbsp;</Skeleton>
        <Skeleton className="h-4 w-full">&nbsp;</Skeleton>
        <Skeleton className="h-4 w-2/3">&nbsp;</Skeleton>
      </CardDescription>

      <Button
        asChild
        className="pointer-events-none mt-4 w-full"
        suffix={<ArrowUpRightIcon />}
        variant="primary"
      >
        <span>&nbsp;</span>
      </Button>
    </Card>
  );
};
