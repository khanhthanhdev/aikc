import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { cache, Suspense } from "react";
import { TagsListing } from "~/app/(web)/[locale]/tags/(tags)/listing";
import { TagSkeleton } from "~/components/web/cards/tag-skeleton";
import { Grid } from "~/components/web/ui/grid";
import { Intro, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

export const revalidate = 31_536_000; // 1 year; future publishing revalidates via scheduled tool.published events.

const getMetadata = cache(async (locale: string): Promise<Metadata> => {
  const t = await getTranslations({ locale, namespace: "Tags" });
  return {
    title: t("title"),
  };
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const metadata = await getMetadata(locale);

  return parseMetadata({
    alternates: buildAlternates(locale, "/tags"),
    openGraph: { url: buildLocalizedUrl(locale, "/tags") },
    ...metadata,
  });
}

export default async function Tags({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Tags" });

  return (
    <Wrapper>
      <Intro>
        <IntroTitle>{t("title")}</IntroTitle>
      </Intro>

      <Grid className="md:gap-8">
        <Suspense
          fallback={[...new Array(24)].map((_, index) => (
            <TagSkeleton key={`tag-skeleton-${index}`} />
          ))}
        >
          <TagsListing searchParams={searchParams} />
        </Suspense>
      </Grid>
    </Wrapper>
  );
}
