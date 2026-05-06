import type { Metadata } from "next";
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
import { getCategoryFAQs } from "~/data/category-faqs";
import { buildBreadcrumbSchema, buildFAQPageSchema } from "~/lib/json-ld";
import type { CategoryOne } from "~/server/categories/payloads";
import {
  findCategorySlugs,
  findUniqueCategory,
} from "~/server/categories/queries";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<SearchParams>;
}

export const dynamic = "force-dynamic";

export const generateStaticParams = async () => {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const categories = await findCategorySlugs({});
    return categories.map(({ slug }) => ({ slug }));
  } catch {
    return [];
  }
};

const getMetadata = cache(
  async (
    category: CategoryOne,
    locale: string,
    metadata?: Metadata
  ): Promise<Metadata> => {
    const isVietnamese = locale === "vi";
    const count = category._count.tools;
    const t = await getTranslations({ locale, namespace: "CategoryDetail" });
    const name = isVietnamese
      ? (category.labelVi ?? category.label ?? category.nameVi ?? category.name)
      : category.label || category.name;

    const description = isVietnamese
      ? (category.descriptionVi ?? category.description)
      : category.description;

    return {
      ...metadata,
      title:
        count > 1
          ? t("titleWithCount", { count, name })
          : t("titleWithoutCount", { name }),
      description: t("description", {
        description: description ?? "",
        name,
      }).trim(),
    };
  }
);

export const generateMetadata = async ({
  params,
}: PageProps): Promise<Metadata | undefined> => {
  const { slug, locale } = await params;
  const category = await findUniqueCategory({ where: { slug } });
  const url = `/categories/${slug}`;

  if (!category) {
    return;
  }

  return parseMetadata(
    await getMetadata(category, locale, {
      alternates: buildAlternates(locale, url),
      openGraph: { url: buildLocalizedUrl(locale, url) },
    })
  );
};

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps) {
  const { slug, locale } = await params;
  const category = await findUniqueCategory({ where: { slug } });

  if (!category) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "CategoryDetail" });

  const isVietnamese = locale === "vi";
  const categoryName = isVietnamese
    ? (category.labelVi ?? category.label ?? category.nameVi ?? category.name)
    : category.label || category.name;
  const title = categoryName;
  const { description } = await getMetadata(category, locale);
  const categoryFAQs = getCategoryFAQs(slug);

  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: t("home"), url: "/" },
          { name: t("categories"), url: "/categories" },
          { name: categoryName, url: `/categories/${slug}` },
        ])}
      />
      <JsonLd data={buildFAQPageSchema(categoryFAQs)} />

      <Wrapper className="py-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">{t("home")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/categories">
                {t("categories")}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{categoryName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Wrapper>

      <Wrapper>
        <Intro>
          <IntroTitle>{title}</IntroTitle>
          <IntroDescription>{description}</IntroDescription>
        </Intro>

        <Suspense fallback={<ToolListSkeleton />}>
          <ToolsListing
            placeholder={t("searchPlaceholder", {
              name: title.toString().toLowerCase(),
            })}
            searchParams={searchParams}
            where={{ categories: { some: { slug } } }}
          />
        </Suspense>
      </Wrapper>
    </>
  );
}
