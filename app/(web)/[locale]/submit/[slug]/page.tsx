import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs";
import { createSearchParamsCache, parseAsBoolean } from "nuqs/server";
import { cache } from "react";
import { SubmitProducts } from "~/app/(web)/[locale]/submit/[slug]/products";
import { Prose } from "~/components/common/prose";
import { Intro, IntroDescription, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";
import { config } from "~/config";
import { isToolPublished } from "~/lib/tools";
import type { ToolOne } from "~/server/tools/payloads";
import { findToolSlugs, findUniqueTool } from "~/server/tools/queries";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<SearchParams>;
}

export const dynamic = "force-dynamic";

const searchParamsCache = createSearchParamsCache({
  success: parseAsBoolean.withDefault(false),
});

const getTool = cache(
  async ({ slug, success }: { slug: string; success: boolean }) => {
    return findUniqueTool({
      where: {
        slug,
        publishedAt: undefined,
        isFeatured: success ? undefined : false,
      },
    });
  }
);

const getMetadata = cache(
  async (
    tool: ToolOne,
    success: boolean,
    locale: string,
    metadata?: Metadata
  ): Promise<Metadata> => {
    const isVietnamese = locale === "vi";
    const t = await getTranslations({ locale, namespace: "SubmitStatus" });
    const toolName = isVietnamese ? (tool.nameVi ?? tool.name) : tool.name;

    if (success) {
      return {
        ...metadata,
        title: t("successTitle", { name: toolName }),
        description: t("successDescription", { name: toolName }),
      };
    }

    if (isToolPublished(tool)) {
      return {
        ...metadata,
        title: t("alreadyLiveTitle", { name: toolName }),
        description: t("alreadyLiveDescription", { name: toolName }),
      };
    }

    return {
      ...metadata,
      title: t("statusTitle", { name: toolName }),
      description: t("statusDescription"),
    };
  }
);

export const generateStaticParams = async () => {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const tools = await findToolSlugs({ where: { publishedAt: undefined } });
    return tools.map(({ slug }) => ({ slug }));
  } catch {
    return [];
  }
};

export const generateMetadata = async ({
  params,
  searchParams,
}: PageProps): Promise<Metadata> => {
  const { slug, locale } = await params;
  const { success } = searchParamsCache.parse(await searchParams);

  const tool = await getTool({ slug, success });
  const url = `/submit/${slug}`;

  if (!tool) {
    return {};
  }

  return parseMetadata(
    await getMetadata(tool, success, locale, {
      alternates: buildAlternates(locale, url),
      openGraph: { url: buildLocalizedUrl(locale, url) },
    })
  );
};

export default async function SubmitPackages({
  params,
  searchParams,
}: PageProps) {
  const { slug, locale } = await params;
  const { success } = searchParamsCache.parse(await searchParams);

  const tool = await getTool({ slug, success });

  if (!tool) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "SubmitStatus" });

  const { title, description } = await getMetadata(tool, success, locale);

  return (
    <Wrapper>
      <Intro>
        <IntroTitle>{title?.toString()}</IntroTitle>
        <IntroDescription>{description}</IntroDescription>
      </Intro>

      {/* {success && (
        <Image
          src={`${config.media.staticHost}/3d-heart.webp`}
          alt=""
          className="max-w-64 w-2/3 h-auto mx-auto"
          width={256}
          height={228}
        />
      )} */}

      <div className="flex justify-center">
        <SubmitProducts locale={locale} tool={tool} />
      </div>

      <Intro>
        <IntroTitle size="h3">{t("haveQuestions")}</IntroTitle>

        <Prose>
          <p>
            {t("contactDescription")}{" "}
            <Link href={`mailto:${config.site.email}`}>
              {config.site.email}
            </Link>
            .
          </p>
        </Prose>
      </Intro>
    </Wrapper>
  );
}
