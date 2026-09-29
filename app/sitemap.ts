import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { routing } from "~/i18n/routing";
import { findCategorySlugs } from "~/server/categories/queries";
import { findTagSlugs } from "~/server/tags/queries";
import { findToolSlugs } from "~/server/tools/queries";
import { buildLocalizedUrl } from "~/utils/seo";

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

  const staticPages: Array<{
    href: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { href: "/", changeFrequency: "daily", priority: 1 },
    { href: "/tools", changeFrequency: "daily", priority: 0.9 },
    { href: "/about", changeFrequency: "monthly", priority: 0.5 },
    { href: "/submit", changeFrequency: "monthly", priority: 0.8 },
    { href: "/categories", changeFrequency: "daily", priority: 0.5 },
    { href: "/tags", changeFrequency: "daily", priority: 0.5 },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    // Static pages
    for (const page of staticPages) {
      entries.push({
        url: buildLocalizedUrl(locale, page.href),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      });
    }

    // Tools
    for (const tool of tools) {
      entries.push({
        url: buildLocalizedUrl(locale, `/tools/${tool.slug}`),
        lastModified: tool.updatedAt ?? tool.publishedAt ?? undefined,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    // Categories
    for (const category of categories) {
      entries.push({
        url: buildLocalizedUrl(locale, `/categories/${category.slug}`),
        lastModified: category.updatedAt ?? category.createdAt ?? undefined,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    // Tags
    for (const tag of tags) {
      entries.push({
        url: buildLocalizedUrl(locale, `/tags/${tag.slug}`),
        lastModified: tag.updatedAt ?? tag.createdAt ?? undefined,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  return entries;
}
