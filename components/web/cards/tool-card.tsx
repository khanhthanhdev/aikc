"use client";

import { DollarSignIcon, SparkleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { HTMLAttributes } from "react";
import { H4 } from "~/components/common/heading";
import { Stack } from "~/components/common/stack";
import { Badge } from "~/components/web/ui/badge";
import { Card, CardDescription, CardStars } from "~/components/web/ui/card";
import { Favicon } from "~/components/web/ui/favicon";
import { Link } from "~/i18n/navigation";
import type { ToolMany } from "~/server/tools/payloads";

type ToolCardProps = HTMLAttributes<HTMLElement> & {
  tool: ToolMany;
  showBadges?: boolean;
};

export const ToolCard = ({
  tool,
  showBadges = true,
  ...props
}: ToolCardProps) => {
  const t = useTranslations("Tools");
  const locale = useLocale();
  const isVietnamese = locale === "vi";

  // Get localized content with fallback to English
  const name = isVietnamese ? (tool.nameVi ?? tool.name) : tool.name;
  const tagline = isVietnamese
    ? (tool.taglineVi ?? tool.tagline)
    : tool.tagline;
  const description = isVietnamese
    ? (tool.descriptionVi ?? tool.description)
    : tool.description;
  const pricing = isVietnamese
    ? (tool.pricingVi ?? tool.pricing)
    : tool.pricing;

  return (
    <Card asChild isFeatured={tool.isFeatured}>
      <Link href={`/tools/${tool.slug}`} prefetch {...props}>
        <Stack
          className="absolute inset-x-6 top-0 z-10 mx-px -translate-y-1/2"
          size="sm"
        >
          {tool.isFeatured && (
            <Badge
              prefix={<SparkleIcon className="text-yellow-500" />}
              variant="outline"
            >
              {t("featured")}
            </Badge>
          )}
        </Stack>

        {tool.isFeatured && <CardStars className="brightness-125" />}

        <div className="relative z-20 flex w-full items-center justify-between gap-3">
          <H4 as="h3" className="line-clamp-1">
            {name}
          </H4>
          <div className="transition-opacity duration-300 group-hover/card:opacity-0">
            {tool.faviconUrl && <Favicon src={tool.faviconUrl} title={name} />}
          </div>
        </div>

        <div className="grid w-full flex-1 grid-cols-1 grid-rows-1">
          {/* Default State */}
          <div className="col-start-1 row-start-1 flex flex-col gap-4 transition-opacity duration-300 group-hover/card:opacity-0">
            {tagline && (
              <CardDescription className="line-clamp-2">
                {tagline}
              </CardDescription>
            )}

            <Stack className="mt-auto" size="sm">
              {pricing && (
                <Badge
                  prefix={
                    tool.pricingTier === "OPEN_SOURCE" ? null : (
                      <DollarSignIcon className="text-green-500" />
                    )
                  }
                  variant="soft"
                >
                  {pricing}
                </Badge>
              )}

              {/* {showBadges &&
            tool.collections.map(collection => (
              <Badge key={collection.id} variant="outline">
                {collection.name}
              </Badge>
            ))} */}
            </Stack>
          </div>

          {/* Hover State */}
          <div className="pointer-events-none col-start-1 row-start-1 opacity-0 transition-opacity duration-300 group-hover/card:pointer-events-auto group-hover/card:opacity-100">
            <CardDescription className="line-clamp-none text-foreground/80">
              {description || tagline}
            </CardDescription>
          </div>
        </div>
      </Link>
    </Card>
  );
};
