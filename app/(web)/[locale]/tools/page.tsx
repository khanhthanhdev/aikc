import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { ToolListSkeleton } from "~/components/web/tool-list-skeleton";
import { Intro, IntroDescription, IntroTitle } from "~/components/web/ui/intro";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";
import { ToolsListing } from "../(home)/tools-listing";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });

  return parseMetadata({
    title: t("title"),
    description: t("description"),
    alternates: buildAlternates(locale, "/tools"),
    openGraph: { url: buildLocalizedUrl(locale, "/tools") },
  });
}

export default async function ToolsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <>
      <Intro className="mb-[2.5vh] text-pretty">
        <IntroTitle className="max-w-[47rem]">{t("title")}</IntroTitle>
        <IntroDescription>{t("description")}</IntroDescription>
      </Intro>

      <Suspense fallback={<ToolListSkeleton />}>
        <ToolsListing searchParams={searchParams} />
      </Suspense>
    </>
  );
}
