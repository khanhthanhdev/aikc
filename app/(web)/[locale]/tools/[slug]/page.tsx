import { DollarSignIcon, HashIcon, SparkleIcon, TagIcon } from "lucide-react";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { RelatedTools } from "~/app/(web)/[locale]/tools/[slug]/related-tools";
import { RelatedToolsSkeleton } from "~/app/(web)/[locale]/tools/[slug]/related-tools-skeleton";
import { ToolLink } from "~/app/(web)/[locale]/tools/[slug]/tool-link";
import { H2, H6 } from "~/components/common/heading";
import { JsonLd } from "~/components/common/json-ld";
import { Markdown } from "~/components/common/markdown";
import { Stack } from "~/components/common/stack";
import { AdCard } from "~/components/web/ads/ad-card";
import { ToolContextSetter } from "~/components/web/ai-chat/tool-context-setter";
import { ReportToolDialog } from "~/components/web/dialogs/report-tool-dialog";
import { Nav } from "~/components/web/nav";
import { ToolStickyHeader } from "~/components/web/tool-sticky-header";
import { Badge } from "~/components/web/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/web/ui/breadcrumb";
import { FaviconImage } from "~/components/web/ui/favicon";
import { Gallery } from "~/components/web/ui/gallery";
import { IntroDescription } from "~/components/web/ui/intro";
import { Tag } from "~/components/web/ui/tag";
import { Wrapper } from "~/components/web/ui/wrapper";
import { Link } from "~/i18n/navigation";
import {
  buildBreadcrumbSchema,
  buildSoftwareApplicationSchema,
} from "~/lib/json-ld";
import {
  findFirstTool,
  findToolSlugs,
  findUniqueTool,
} from "~/server/tools/queries";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
}

// This page composes request-bound APIs (next-intl getLocale in the root
// layout, AdCard DB query, findFirstTool with `new Date()`, RelatedTools that
// uses Math.random()/Qdrant), so it cannot be safely rendered statically.
// Static caching would otherwise throw `DYNAMIC_SERVER_USAGE` at request time.
export const dynamic = "force-dynamic";

export const dynamicParams = true;

const getTool = unstable_cache(
  async (slug: string) => findUniqueTool({ where: { slug } }),
  ["tool-detail"],
  { revalidate: 31_536_000, tags: ["tools"] }
);

export const generateStaticParams = async () => {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const tools = await findToolSlugs({});
    return tools.map(({ slug }) => ({ slug }));
  } catch {
    return [];
  }
};

export const generateMetadata = async ({
  params,
}: PageProps): Promise<Metadata | undefined> => {
  const { slug, locale } = await params;
  const tool = await getTool(slug);
  const url = `/tools/${slug}`;

  if (!tool) {
    return;
  }

  const isVietnamese = locale === "vi";
  const name = isVietnamese ? (tool.nameVi ?? tool.name) : tool.name;
  const tagline = isVietnamese
    ? (tool.taglineVi ?? tool.tagline)
    : tool.tagline;
  const description = isVietnamese
    ? (tool.descriptionVi ?? tool.description)
    : tool.description;

  const title = `${name}${tagline ? `: ${tagline}` : ""}`;

  return parseMetadata({
    title,
    description,
    alternates: buildAlternates(locale, url),
    openGraph: { url: buildLocalizedUrl(locale, url) },
  });
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: page composition intentionally combines localized metadata, SEO, and conditional sections in one route entrypoint
export default async function ToolPage({ params }: PageProps) {
  const { slug, locale } = await params;
  const toolPromise = getTool(slug);
  const translationsPromise = getTranslations({ locale, namespace: "Tools" });
  const tool = await toolPromise;

  if (!tool) {
    notFound();
  }

  const isVietnamese = locale === "vi";
  const name = isVietnamese ? (tool.nameVi ?? tool.name) : tool.name;
  const tagline = isVietnamese
    ? (tool.taglineVi ?? tool.tagline)
    : tool.tagline;
  const description = isVietnamese
    ? (tool.descriptionVi ?? tool.description)
    : tool.description;
  const content = isVietnamese
    ? (tool.contentVi ?? tool.content)
    : tool.content;
  const pricing = isVietnamese
    ? (tool.pricingVi ?? tool.pricing)
    : tool.pricing;
  const t = await translationsPromise;
  const getCategoryName = (category: (typeof tool.categories)[number]) =>
    isVietnamese
      ? (category.labelVi ?? category.label ?? category.nameVi ?? category.name)
      : (category.label ?? category.name);
  const getCollectionName = (collection: (typeof tool.collections)[number]) =>
    isVietnamese ? (collection.nameVi ?? collection.name) : collection.name;
  const getTagName = (tag: (typeof tool.tags)[number]) =>
    isVietnamese ? (tag.nameVi ?? tag.name) : tag.name;
  const primaryCategoryName = tool.categories[0]
    ? getCategoryName(tool.categories[0])
    : null;

  const [previous, next] = await Promise.all([
    findFirstTool({
      where: { id: { lt: tool.id } },
      select: { slug: true },
      orderBy: { id: "desc" },
    }),

    findFirstTool({
      where: { id: { gt: tool.id } },
      select: { slug: true },
      orderBy: { id: "asc" },
    }),
  ]);

  const _socials = z
    .array(z.object({ url: z.string(), name: z.string() }))
    .nullable()
    .safeParse(tool.socials);

  return (
    <>
      {/* JSON-LD Structured Data */}
      <JsonLd data={buildSoftwareApplicationSchema(tool)} />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: t("home"), url: "/" },
          { name: t("tools"), url: "/" },
          ...(tool.categories[0] && primaryCategoryName
            ? [
                {
                  name: primaryCategoryName,
                  url: `/categories/${tool.categories[0].slug}`,
                },
              ]
            : []),
          { name, url: `/tools/${tool.slug}` },
        ])}
      />

      <ToolStickyHeader tool={tool} toolName={name} toolTagline={tagline} />
      <ToolContextSetter name={name} slug={tool.slug} />

      <Wrapper className="py-4" size="lg">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">{t("home")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/">{t("tools")}</BreadcrumbLink>
            </BreadcrumbItem>
            {tool.categories[0] && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href={`/categories/${tool.categories[0].slug}`}
                  >
                    {getCategoryName(tool.categories[0])}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Wrapper>

      <Wrapper size="lg">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="flex flex-col gap-8 lg:col-span-2">
            <div className="flex w-full flex-col items-start gap-y-4">
              <Stack className="relative w-full justify-between" size="lg">
                <Stack size="lg">
                  {tool.faviconUrl && (
                    <FaviconImage
                      className="size-10 rounded-md"
                      src={tool.faviconUrl}
                      title={name}
                    />
                  )}

                  <H2 as="h1" className="!leading-snug -my-1.5">
                    {name}
                  </H2>
                </Stack>

                <Stack className="items-stretch" size="sm">
                  <ReportToolDialog toolId={tool.id} toolName={name} />
                  <ToolLink size="md" tool={tool} variant="primary" />
                </Stack>
              </Stack>

              <IntroDescription>{description}</IntroDescription>

              <Stack className="mt-4 empty:contents">
                {tool.isFeatured && (
                  <Badge
                    prefix={<SparkleIcon className="text-yellow-500" />}
                    variant="outline"
                  >
                    {t("featured")}
                  </Badge>
                )}

                {tool.collections.map((collection) => (
                  <Badge asChild key={collection.id} variant="outline">
                    <Link href={`/collections/${collection.slug}`}>
                      {getCollectionName(collection)}
                    </Link>
                  </Badge>
                ))}

                {pricing && (
                  <Badge
                    prefix={<DollarSignIcon className="text-green-500" />}
                    variant="ghost"
                  >
                    {pricing}
                  </Badge>
                )}
              </Stack>

              {/* {!!socials.data?.length && (
            <Stack size="sm">
              {socials.data.map(({ url, name }) => (
                <Button key={url} size="md" variant="secondary" suffix={<EllipsisIcon />}>
                  More
                </Button>
              ))}
            </Stack>
          )} */}
            </div>

            {tool.screenshotUrl && (
              <Gallery
                images={[
                  {
                    url: tool.screenshotUrl,
                    alt: `Screenshot of ${name} website`,
                  },
                ]}
                priority
              />
            )}

            {content && <Markdown>{content}</Markdown>}

            {!!tool.categories.length && (
              <Stack direction="column">
                <H6 as="h3">{t("categoriesSection")}</H6>

                <Stack>
                  {tool.categories.map((category) => (
                    <Tag
                      asChild
                      key={category.id}
                      prefix={<TagIcon className="mr-0.5" />}
                    >
                      <Link href={`/categories/${category.slug}`}>
                        {getCategoryName(category)}
                        <span className="text-foreground/50">
                          ({category._count.tools})
                        </span>
                      </Link>
                    </Tag>
                  ))}
                </Stack>
              </Stack>
            )}

            {!!tool.tags.length && (
              <Stack direction="column" id="tool-tags-section">
                <H6 as="h3">{t("tagsSection")}</H6>

                <Stack>
                  {tool.tags.map((tag) => (
                    <Tag asChild key={tag.id} prefix={<HashIcon />}>
                      <Link href={`/tags/${tag.slug}`}>{getTagName(tag)}</Link>
                    </Tag>
                  ))}
                </Stack>
              </Stack>
            )}

            <Nav
              className="sticky bottom-4 z-30 mx-auto"
              next={next?.slug}
              previous={previous?.slug}
              tool={tool}
              toolName={name}
            />

            {/* <p className="text-foreground/50 text-sm">
          Last updated: {formatDistanceToNowStrict(tool.updatedAt, { addSuffix: true })}
        </p> */}
          </div>

          <div className="space-y-6">
            <div className="sticky top-24">
              <AdCard type="ToolPage" />
            </div>
          </div>
        </div>
      </Wrapper>

      <div id="related-tools-section">
        <Suspense
          fallback={<RelatedToolsSkeleton title={t("similarToolsLoading")} />}
        >
          <RelatedTools locale={locale} tool={tool} />
        </Suspense>
      </div>
    </>
  );
}
