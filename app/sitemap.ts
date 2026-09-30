import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { routing } from "~/i18n/routing";
import { findCategorySlugs } from "~/server/categories/queries";
import { findTagSlugs } from "~/server/tags/queries";
import { findToolSlugs } from "~/server/tools/queries";
import {
  getSitemapFallbackLastModified,
  getStaticSitemapEntries,
} from "~/lib/sitemap";
import { buildLocalizedUrl } from "~/utils/seo";

export const dynamic = "force-dynamic";

const getSitemapData = async () => {
  "use cache";

  cacheLife("hours");
  cacheTag("tools", "categories", "tags");

  return await Promise.all([
    findToolSlugs({}),
    findCategorySlugs({}),
    findTagSlugs({}),
  ]);
};

export default async function Sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tools, categories, tags] = await getSitemapData();
  const entries = getStaticSitemapEntries();

  for (const locale of routing.locales) {
    for (const tool of tools) {
      entries.push({
        url: buildLocalizedUrl(locale, `/tools/${tool.slug}`),
        lastModified:
          tool.updatedAt ??
          tool.publishedAt ??
          getSitemapFallbackLastModified(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    for (const category of categories) {
      entries.push({
        url: buildLocalizedUrl(locale, `/categories/${category.slug}`),
        lastModified:
          category.updatedAt ??
          category.createdAt ??
          getSitemapFallbackLastModified(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    for (const tag of tags) {
      entries.push({
        url: buildLocalizedUrl(locale, `/tags/${tag.slug}`),
        lastModified:
          tag.updatedAt ?? tag.createdAt ?? getSitemapFallbackLastModified(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  return entries;
}
