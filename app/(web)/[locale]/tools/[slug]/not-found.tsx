"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "~/components/web/ui/button";
import { Intro, IntroDescription, IntroTitle } from "~/components/web/ui/intro";
import { useCommandPalette } from "~/contexts/command-palette-context";
import { Link } from "~/i18n/navigation";

export default function ToolNotFound() {
  const t = useTranslations("ToolErrors");
  const palette = useCommandPalette();

  return (
    <Intro>
      <IntroTitle>{t("notFoundTitle")}</IntroTitle>
      <IntroDescription className="max-w-xl">
        {t("notFoundDescription")}
      </IntroDescription>
      <div className="mt-4 flex gap-3">
        <Button onClick={() => palette.open()}>
          <SearchIcon className="mr-2 size-4" />
          {t("searchTools")}
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">{t("browseDirectory")}</Link>
        </Button>
      </div>
    </Intro>
  );
}
