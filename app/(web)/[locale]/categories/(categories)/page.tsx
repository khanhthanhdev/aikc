import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cache, Suspense } from "react";
import { CategorySkeleton } from "~/components/web/cards/category-skeleton";
import { Grid } from "~/components/web/ui/grid";
import { Intro, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";
import { CategoriesListing } from "./listing";

interface PageProps {
  params: Promise<{ locale: string }>;
}

const getMetadata = cache(async (locale: string): Promise<Metadata> => {
  const t = await getTranslations({ locale, namespace: "Categories" });
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
    alternates: buildAlternates(locale, "/categories"),
    openGraph: { url: buildLocalizedUrl(locale, "/categories") },
    ...metadata,
  });
}

export default async function Categories({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Categories" });

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
          <CategoriesListing />
        </Suspense>
      </Grid>
    </Wrapper>
  );
}
