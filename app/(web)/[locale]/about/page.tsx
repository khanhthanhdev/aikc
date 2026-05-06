import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { Prose } from "~/components/common/prose";
import { Intro, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";

interface PageProps {
  params: Promise<{ locale: string }>;
}

const getMetadata = cache(async (locale: string): Promise<Metadata> => {
  const t = await getTranslations({ locale, namespace: "About" });
  const tHome = await getTranslations({ locale, namespace: "Home" });

  return {
    title: t("title"),
    description: tHome("description"),
  };
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const metadata = await getMetadata(locale);

  return parseMetadata({
    alternates: buildAlternates(locale, "/about"),
    openGraph: { url: buildLocalizedUrl(locale, "/about") },
    ...metadata,
  });
}

const getAboutContent = async (locale: string) => {
  if (locale === "vi") {
    const { default: content } = await import("./content.vi.mdx");
    return content;
  }

  const { default: content } = await import("./content.mdx");
  return content;
};

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  const AboutContent = await getAboutContent(locale);

  return (
    <Wrapper size="sm">
      <Intro alignment="start">
        <IntroTitle>{t("title")}</IntroTitle>
      </Intro>

      <Prose>
        <AboutContent />
      </Prose>
    </Wrapper>
  );
}
