import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cache, Suspense } from "react";
import { CategorySkeleton } from "~/components/web/cards/category-skeleton";
import { Grid } from "~/components/web/ui/grid";
import { Intro, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";
import { CollectionsListing } from "./listing";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export const revalidate = 31_536_000; // 1 year; future publishing revalidates via scheduled tool.published events.

const getMetadata = cache(async (locale: string): Promise<Metadata> => {
  const t = await getTranslations({ locale, namespace: "Collections" });
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
    alternates: buildAlternates(locale, "/collections"),
    openGraph: { url: buildLocalizedUrl(locale, "/collections") },
    ...metadata,
  });
}

export default async function Collections({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Collections" });

  return (
    <Wrapper>
      <Intro>
        <IntroTitle>{t("title")}</IntroTitle>
      </Intro>

      <Grid>
        <Suspense
          fallback={[...new Array(6)].map((_, index) => (
            <CategorySkeleton key={`skeleton-${index}`} />
          ))}
        >
          <CollectionsListing />
        </Suspense>
      </Grid>
    </Wrapper>
  );
}
