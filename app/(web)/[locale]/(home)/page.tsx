import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { CountBadge } from "~/app/(web)/[locale]/(home)/count-badge";
import { ToolListSkeleton } from "~/components/web/tool-list-skeleton";
import { Badge } from "~/components/web/ui/badge";
import { Intro, IntroDescription, IntroTitle } from "~/components/web/ui/intro";
import { Ping } from "~/components/web/ui/ping";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";
import { ToolsListing } from "./tools-listing";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });

  return parseMetadata({
    title: t("title"),
    description: t("description"),
    alternates: buildAlternates(locale, "/"),
    openGraph: { url: buildLocalizedUrl(locale, "/") },
  });
}

export default async function Home({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <>
      <Intro className="mb-[2.5vh] text-pretty">
        <IntroTitle className="max-w-[47rem]">{t("title")}</IntroTitle>
        <IntroDescription>{t("description")}</IntroDescription>

        <Suspense
          fallback={
            <Badge
              className="pointer-events-none order-first min-w-20 animate-pulse"
              prefix={<Ping />}
              size="lg"
            >
              &nbsp;
            </Badge>
          }
        >
          <CountBadge />
        </Suspense>
      </Intro>

      <Suspense fallback={<ToolListSkeleton />}>
        <ToolsListing searchParams={searchParams} />
      </Suspense>
    </>
  );
}
