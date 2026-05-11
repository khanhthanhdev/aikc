import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { cache, Suspense } from "react";
import { ToolsListing } from "~/app/(web)/[locale]/(home)/tools-listing";
import { JsonLd } from "~/components/common/json-ld";
import { ToolListSkeleton } from "~/components/web/tool-list-skeleton";
import { Intro, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";
import { buildBreadcrumbSchema } from "~/lib/json-ld";
import type { TagOne } from "~/server/tags/payloads";
import { findTagSlugs, findUniqueTag } from "~/server/tags/queries";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<SearchParams>;
}

const getTag = async (slug: string) => {
  "use cache";

  cacheLife("max");
  cacheTag("tags", "tools");

  return findUniqueTag({ where: { slug } });
};

export const generateStaticParams = async () => {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const tags = await findTagSlugs({});
    return tags.map(({ slug }) => ({ slug }));
  } catch {
    return [];
  }
};

const getMetadata = cache(
  async (
    tag: TagOne,
    locale: string,
    metadata?: Metadata
  ): Promise<Metadata> => {
    const isVietnamese = locale === "vi";
    const t = await getTranslations({ locale, namespace: "TagDetail" });
    const name = isVietnamese ? (tag.nameVi ?? tag.name) : tag.name;

    return {
      ...metadata,
      title: t("title", { name }),
    };
  }
);

export const generateMetadata = async ({
  params,
}: PageProps): Promise<Metadata | undefined> => {
  const { slug, locale } = await params;
  const tag = await getTag(slug);
  const url = `/tags/${slug}`;

  if (!tag) {
    return;
  }

  return parseMetadata(
    await getMetadata(tag, locale, {
      alternates: buildAlternates(locale, url),
      openGraph: { url: buildLocalizedUrl(locale, url) },
    })
  );
};

export default async function TagPage({ params, searchParams }: PageProps) {
  const { slug, locale } = await params;
  const tag = await getTag(slug);

  if (!tag) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "TagDetail" });

  const isVietnamese = locale === "vi";
  const tagName = isVietnamese ? (tag.nameVi ?? tag.name) : tag.name;
  const { title } = await getMetadata(tag, locale);

  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: t("home"), url: "/" },
          { name: t("tags"), url: "/tags" },
          { name: tagName, url: `/tags/${slug}` },
        ])}
      />

      <Wrapper>
        <Intro>
          <IntroTitle>{title?.toString()}</IntroTitle>
        </Intro>

        <Suspense fallback={<ToolListSkeleton />}>
          <ToolsListing
            placeholder={t("searchPlaceholder", { name: tagName })}
            searchParams={searchParams}
            where={{ tags: { some: { slug } } }}
          />
        </Suspense>
      </Wrapper>
    </>
  );
}
