import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { CountBadge } from "~/app/(web)/[locale]/(home)/count-badge";
import { ToolListSkeleton } from "~/components/web/tool-list-skeleton";
import { Badge } from "~/components/web/ui/badge";
import { Intro, IntroDescription, IntroTitle } from "~/components/web/ui/intro";
import { Ping } from "~/components/web/ui/ping";
import { HOME_ELEMENT_IDS } from "~/config/home";
import { getAgentHomepageSummary } from "~/lib/homepage-agent-content";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";
import { HeroSearch } from "./hero-search";
import { RoleTools } from "./role-tools";
import { ToolsListing } from "./tools-listing";

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
    alternates: buildAlternates(locale, "/"),
    openGraph: { url: buildLocalizedUrl(locale, "/") },
  });
}

export default async function Home({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    // Tighter than the page's own gap, so the tools sit close under the search
    <div className="flex flex-col gap-10 md:gap-12">
      <Intro className="text-pretty">
        <IntroTitle className="max-w-[47rem]">{t("title")}</IntroTitle>
        <IntroDescription>{t("description")}</IntroDescription>

        <div
          className="flex w-full justify-center"
          id={HOME_ELEMENT_IDS.heroSearch}
        >
          {/* Reads the query from the URL; the fallback keeps its place */}
          <Suspense
            fallback={
              <div className="h-[94px] w-full max-w-2xl">
                <div className="h-[54px] rounded-full border border-foreground/15" />
              </div>
            }
          >
            <HeroSearch />
          </Suspense>
        </div>

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

      {/* Reads the role cookie, so it streams in after the static shell */}
      <Suspense fallback={null}>
        <RoleTools locale={locale} />
      </Suspense>
      <section className="sr-only" aria-label="About AI Knowledge Cloud">
        <p>{getAgentHomepageSummary(locale)}</p>
      </section>

      <section className="scroll-mt-24" id={HOME_ELEMENT_IDS.tools}>
        <Suspense fallback={<ToolListSkeleton />}>
          <ToolsListing searchParams={searchParams} showSearch={false} />
        </Suspense>
      </section>
    </div>
  );
}
