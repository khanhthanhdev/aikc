import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TrustPage } from "~/components/web/trust-page";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact" });

  return parseMetadata({
    title: t("title"),
    alternates: buildAlternates(locale, "/contact"),
    openGraph: { url: buildLocalizedUrl(locale, "/contact") },
  });
}

export default async function ContactPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact" });

  return <TrustPage locale={locale} page="contact" title={t("title")} />;
}
