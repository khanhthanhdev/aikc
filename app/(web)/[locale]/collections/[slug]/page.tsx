import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { cache, Suspense } from "react";
import { ToolsListing } from "~/app/(web)/[locale]/(home)/tools-listing";
import { JsonLd } from "~/components/common/json-ld";
import { ToolListSkeleton } from "~/components/web/tool-list-skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/web/ui/breadcrumb";
import { Intro, IntroDescription, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";
import { buildBreadcrumbSchema } from "~/lib/json-ld";
import type { CollectionOne } from "~/server/collections/payloads";
import {
  findCollectionSlugs,
  findUniqueCollection,
} from "~/server/collections/queries";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<SearchParams>;
}

const getCollection = async (slug: string) => {
  "use cache";

  cacheLife("max");
  cacheTag("collections", "tools");

  return findUniqueCollection({ where: { slug } });
};

export const generateStaticParams = async () => {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const collections = await findCollectionSlugs({});
    return collections.map(({ slug }) => ({ slug }));
  } catch {
    return [];
  }
};

const getMetadata = cache(
  async (
    collection: CollectionOne,
    locale: string,
    metadata?: Metadata
  ): Promise<Metadata> => {
    const isVietnamese = locale === "vi";
    const t = await getTranslations({ locale, namespace: "CollectionDetail" });
    const name = isVietnamese
      ? (collection.nameVi ?? collection.name)
      : collection.name;
    const description = isVietnamese
      ? (collection.descriptionVi ?? collection.description)
      : collection.description;

    return {
      ...metadata,
      title: t("title", { name }),
      description,
    };
  }
);

export const generateMetadata = async ({
  params,
}: PageProps): Promise<Metadata | undefined> => {
  const { slug, locale } = await params;
  const collection = await getCollection(slug);
  const url = `/collections/${slug}`;

  if (!collection) {
    return;
  }

  return parseMetadata(
    await getMetadata(collection, locale, {
      alternates: buildAlternates(locale, url),
      openGraph: { url: buildLocalizedUrl(locale, url) },
    })
  );
};

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps) {
  const { slug, locale } = await params;
  const collection = await getCollection(slug);

  if (!collection) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "CollectionDetail" });

  const isVietnamese = locale === "vi";
  const collectionName = isVietnamese
    ? (collection.nameVi ?? collection.name)
    : collection.name;
  const { title, description } = await getMetadata(collection, locale);

  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: t("home"), url: "/" },
          { name: t("collections"), url: "/collections" },
          { name: collectionName, url: `/collections/${slug}` },
        ])}
      />

      <Wrapper className="py-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">{t("home")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/collections">
                {t("collections")}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{collectionName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Wrapper>

      <Wrapper>
        <Intro>
          <IntroTitle>{title?.toString()}</IntroTitle>
          <IntroDescription>{description}</IntroDescription>
        </Intro>

        <Suspense fallback={<ToolListSkeleton />}>
          <ToolsListing
            placeholder={t("searchPlaceholder", {
              name: collectionName.toLowerCase(),
            })}
            searchParams={searchParams}
            where={{ collections: { some: { slug } } }}
          />
        </Suspense>
      </Wrapper>
    </>
  );
}
