"use client";

import { useTranslations } from "next-intl";
import { Button } from "~/components/web/ui/button";
import { Link } from "~/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <h1 className="font-bold text-6xl">404</h1>
      <h2 className="mt-4 font-semibold text-2xl">{t("title")}</h2>
      <p className="mt-2 text-foreground/70">{t("description")}</p>
      <Button asChild className="mt-6" variant="primary">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </div>
  );
}
