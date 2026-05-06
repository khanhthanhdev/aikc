"use client";

import Image from "next/image";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ExternalLink } from "~/components/web/external-link";
import { Badge } from "~/components/web/ui/badge";
import { Button } from "~/components/web/ui/button";
import { cx } from "~/utils/cva";

interface AdBannerDisplayProps {
  ad: {
    name: string;
    description: string | null;
    websiteUrl: string;
    buttonLabel: string | null;
    faviconUrl: string | null;
    type: string;
  };
  className?: string;
}

export const AdBannerDisplay = ({ ad, className }: AdBannerDisplayProps) => {
  const t = useTranslations("Ads");
  const [isVisible, setIsVisible] = useState(true);

  const pathname = usePathname();
  const isToolPage = pathname?.includes("/tools/");

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (isToolPage) {
        // On tool pages, only show when at the very top (or close to it)
        setIsVisible(currentScrollY <= 50);
      } else {
        // Default behavior: Hide when scrolling down, show when scrolling up
        if (currentScrollY > lastScrollY && currentScrollY > 50) {
          setIsVisible(false);
        } else if (currentScrollY < lastScrollY || currentScrollY < 50) {
          setIsVisible(true);
        }
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial state
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isToolPage]);

  return (
    <div
      className={cx(
        "origin-top transition-all duration-300 ease-in-out",
        isVisible
          ? "max-h-24 translate-y-0 text-amber-950 opacity-100 dark:text-amber-100"
          : "pointer-events-none max-h-0 -translate-y-4 opacity-0"
      )}
    >
      <ExternalLink
        className={cx(
          "group/banner flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 pl-4",
          "border border-amber-100 bg-amber-50",
          "dark:border-amber-900/50 dark:bg-amber-950/30",
          "transition-colors hover:border-amber-200 dark:hover:border-amber-800",
          className
        )}
        eventName="click_ad"
        eventProps={{ url: ad.websiteUrl, type: ad.type }}
        href={ad.websiteUrl}
      >
        <div className="mr-4 flex min-w-0 flex-1 items-center">
          <Badge
            className="mr-4 h-5 shrink-0 border-zinc-200 bg-white px-1.5 py-0 font-medium text-[10px] text-zinc-500 uppercase tracking-wide dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
            variant="outline"
          >
            {t("sponsored")}
          </Badge>

          <div className="flex min-w-0 items-center gap-3">
            {ad.faviconUrl && (
              <Image
                alt={ad.name}
                className="size-5 shrink-0 select-none rounded-sm object-contain"
                height={20}
                sizes="20px"
                src={ad.faviconUrl}
                width={20}
              />
            )}
            <div className="truncate text-sm">
              <span className="font-semibold text-amber-950 dark:text-amber-100">
                {ad.name}
              </span>
              <span className="mx-2 text-amber-300 dark:text-amber-800">•</span>
              <span className="font-normal text-amber-900/80 dark:text-amber-200/80">
                {ad.description}
              </span>
            </div>
          </div>
        </div>

        <Button
          asChild
          className="h-8 shrink-0 border border-amber-100 bg-white px-4 font-medium text-amber-950 text-xs shadow-sm hover:bg-white/90 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
          size="sm"
          variant="secondary"
        >
          <span>{ad.buttonLabel ?? t("learnMore")}</span>
        </Button>
      </ExternalLink>
    </div>
  );
};
