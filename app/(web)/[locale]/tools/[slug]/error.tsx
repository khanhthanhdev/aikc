"use client";

import { useTranslations } from "next-intl";
import { Button } from "~/components/web/ui/button";
import { Intro, IntroDescription, IntroTitle } from "~/components/web/ui/intro";
import { Link } from "~/i18n/navigation";

interface ToolErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ToolError({ reset }: ToolErrorProps) {
  const t = useTranslations("ToolErrors");

  return (
    <Intro>
      <IntroTitle>{t("errorTitle")}</IntroTitle>
      <IntroDescription className="max-w-xl">
        {t("errorDescription")}
      </IntroDescription>
      <div className="mt-4 flex gap-3">
        <Button onClick={reset}>{t("tryAgain")}</Button>
        <Button asChild variant="secondary">
          <Link href="/">{t("browseTools")}</Link>
        </Button>
      </div>
    </Intro>
  );
}
