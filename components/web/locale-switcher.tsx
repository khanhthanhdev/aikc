"use client";

import { GlobeIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { navigationLinkVariants } from "~/components/web/ui/navigation-link";
import { usePathname, useRouter } from "~/i18n/navigation";
import { cx } from "~/utils/cva";

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();

  // Only two locales, so one click flips to the other
  const nextLocale = locale === "vi" ? "en" : "vi";

  return (
    <button
      aria-label={`${t("label")}: ${t(nextLocale)}`}
      className={cx(navigationLinkVariants(), "gap-1")}
      onClick={() => router.replace({ pathname, params }, { locale: nextLocale })}
      title={t(nextLocale)}
      type="button"
    >
      <GlobeIcon className="size-4" />
      <span className="max-sm:hidden">{locale === "vi" ? "VN" : "EN"}</span>
    </button>
  );
}
