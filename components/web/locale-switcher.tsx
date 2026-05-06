"use client";

import { GlobeIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/web/ui/dropdown-menu";
import { navigationLinkVariants } from "~/components/web/ui/navigation-link";
import { usePathname, useRouter } from "~/i18n/navigation";
import { cx } from "~/utils/cva";

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();

  const switchLocale = (newLocale: string) => {
    router.replace({ pathname, params }, { locale: newLocale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("label")}
        className={cx(navigationLinkVariants(), "gap-1")}
      >
        <GlobeIcon className="size-4" />
        <span className="max-sm:hidden">{locale === "en" ? "EN" : "VI"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => switchLocale("en")}>
          {t("en")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => switchLocale("vi")}>
          {t("vi")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
