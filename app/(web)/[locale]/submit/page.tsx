import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { SubmitForm } from "~/app/(web)/[locale]/submit/form";
import { Intro, IntroDescription, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";

interface PageProps {
  params: Promise<{ locale: string }>;
}

const getMetadata = cache(async (locale: string): Promise<Metadata> => {
  const t = await getTranslations({ locale, namespace: "Submit" });
  const tMeta = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: t("title"),
    description: t("description", { siteName: tMeta("siteName") }),
  };
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const metadata = await getMetadata(locale);

  return parseMetadata({
    alternates: buildAlternates(locale, "/submit"),
    openGraph: { url: buildLocalizedUrl(locale, "/submit") },
    ...metadata,
  });
}

export default async function SubmitPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Submit" });
  const tMeta = await getTranslations({ locale, namespace: "Metadata" });

  return (
    <Wrapper size="sm">
      <Intro>
        <IntroTitle>{t("title")}</IntroTitle>
        <IntroDescription>
          {t("description", { siteName: tMeta("siteName") })}
        </IntroDescription>
      </Intro>

      <SubmitForm />
    </Wrapper>
  );
}
