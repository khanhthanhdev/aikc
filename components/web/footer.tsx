"use client";

import { AtSignIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { HTMLAttributes } from "react";
import { H6 } from "~/components/common/heading";
import { Icon } from "~/components/common/icon";
import { Logo } from "~/components/common/logo";
import { Stack } from "~/components/common/stack";
import { NavigationLink } from "~/components/web/ui/navigation-link";
import { Tooltip, TooltipProvider } from "~/components/web/ui/tooltip";
import { config } from "~/config";
import { cx } from "~/utils/cva";

export const Footer = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement>) => {
  const t = useTranslations("Footer");

  return (
    <footer className={cx("flex flex-col gap-y-8", className)} {...props}>
      <div
        className={cx(
          "grid grid-cols-3 gap-x-4 gap-y-8 md:grid-cols-[repeat(16,minmax(0,1fr))] md:gap-x-6",
          className
        )}
        {...props}
      >
        <div className="col-span-full flex flex-col items-start gap-4 md:col-span-6 md:gap-6">
          <Stack className="text-sm/normal" direction="column">
            <Logo />

            <p className="max-w-60 text-pretty text-foreground/75">
              {config.site.tagline}
            </p>
          </Stack>

          <Stack className="text-sm/normal">
            <TooltipProvider delayDuration={500} disableHoverableContent>
              <Tooltip tooltip={t("contactUs")}>
                <NavigationLink
                  aria-label={t("contactUs")}
                  href={`mailto:${config.site.email}`}
                  rel="nofollow noreferrer"
                  target="_blank"
                >
                  <AtSignIcon className="size-[1.44em]" />
                </NavigationLink>
              </Tooltip>

              <Tooltip tooltip={t("followTwitter")}>
                <NavigationLink
                  aria-label={t("followTwitter")}
                  href={config.links.twitter}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                >
                  <Icon
                    aria-label="X icon"
                    className="size-[1.44em]"
                    name="brand-x"
                  />
                </NavigationLink>
              </Tooltip>

              <Tooltip tooltip={t("viewSource")}>
                <NavigationLink
                  aria-label={t("viewSource")}
                  href={config.links.github}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                >
                  <Icon
                    aria-label="GitHub icon"
                    className="size-[1.44em]"
                    name="brand-github"
                  />
                </NavigationLink>
              </Tooltip>
            </TooltipProvider>
          </Stack>
        </div>

        <Stack className="flex-col items-start gap-x-4 text-sm/normal md:col-span-3 md:col-start-8">
          <H6 as="strong">{t("quickLinks")}</H6>

          <NavigationLink href="/submit">{t("addListing")}</NavigationLink>
          <NavigationLink href="/about">{t("aboutUs")}</NavigationLink>
          <NavigationLink href={`mailto:${config.site.email}`}>
            {t("contact")}
          </NavigationLink>
        </Stack>

        <Stack className="flex-col items-start gap-x-4 text-sm/normal md:col-span-3">
          <H6 as="strong">{t("browse")}</H6>

          <NavigationLink href="/categories">{t("categories")}</NavigationLink>
          <NavigationLink href="/collections">
            {t("collections")}
          </NavigationLink>
          <NavigationLink href="/tags">{t("tags")}</NavigationLink>
        </Stack>
      </div>

      <div className="flex w-full flex-row flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <NavigationLink
          className="text-xs"
          href={config.links.author}
          rel="noopener noreferrer nofollow"
          target="_blank"
        >
          {t("madeBy")}
        </NavigationLink>

        <p className="text-foreground/65 text-xs">{t("affiliateDisclosure")}</p>
      </div>

      {children}
    </footer>
  );
};
