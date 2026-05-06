"use client";

import { ArrowRightIcon } from "lucide-react";
import { useLocale } from "next-intl";
import type { ComponentProps } from "react";
import { H5 } from "~/components/common/heading";
import { Card, CardDescription } from "~/components/web/ui/card";
import { Link } from "~/i18n/navigation";
import type { CategoryMany } from "~/server/categories/payloads";
import type { CollectionMany } from "~/server/collections/payloads";

type CategoryCardProps = ComponentProps<typeof Link> & {
  category: CategoryMany | CollectionMany;
};

export const CategoryCard = ({ category, ...props }: CategoryCardProps) => {
  const locale = useLocale();
  const isVietnamese = locale === "vi";
  const englishName =
    "label" in category && category.label ? category.label : category.name;
  const name = isVietnamese
    ? ("labelVi" in category && category.labelVi) ||
      category.nameVi ||
      englishName
    : englishName;
  const description = isVietnamese
    ? (category.descriptionVi ?? category.description)
    : category.description;

  return (
    <Card asChild>
      <Link prefetch {...props}>
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <H5 className="!leading-snug flex-1 truncate">{name}</H5>
            {/*
						<span className="text-xs text-foreground/50">
							{category._count.tools} {plur("tool", category._count.tools)}
						</span>*/}
          </div>

          <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-foreground/10">
            <ArrowRightIcon />
          </span>
        </div>

        <CardDescription>{description}</CardDescription>
      </Link>
    </Card>
  );
};
