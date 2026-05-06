"use client";

import { useLocale, useTranslations } from "next-intl";
import type { HTMLAttributes } from "react";
import { H5 } from "~/components/common/heading";
import { Link } from "~/i18n/navigation";
import type { TagMany } from "~/server/tags/payloads";
import { cx } from "~/utils/cva";

type TagCardProps = HTMLAttributes<HTMLElement> & {
  tag: TagMany;
};

export const TagCard = ({ className, tag, ...props }: TagCardProps) => {
  const t = useTranslations("Tags");
  const locale = useLocale();
  const name = locale === "vi" ? (tag.nameVi ?? tag.name) : tag.name;

  return (
    <Link
      className={cx(
        "group -my-2 flex min-w-0 items-center gap-4 py-2",
        className
      )}
      href={`/tags/${tag.slug}`}
      {...props}
    >
      <H5 as="h3" className="!text-base truncate group-hover:underline">
        {name}
      </H5>

      <hr className="min-w-2 flex-1 group-hover:opacity-35" />

      <span className="shrink-0 text-foreground/50 text-xs">
        {t("toolCount", { count: tag._count.tools })}
      </span>
    </Link>
  );
};
