import type { MetadataRoute } from "next";
import { routing } from "~/i18n/routing";
import { buildLocalizedUrl } from "~/utils/seo";

const staticPageLastModified = new Date("2026-08-23T00:00:00.000Z");

const staticPages: Array<{
  href: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { href: "/", changeFrequency: "daily", priority: 1 },
  { href: "/tools", changeFrequency: "daily", priority: 0.9 },
  { href: "/about", changeFrequency: "monthly", priority: 0.5 },
  { href: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { href: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { href: "/developers", changeFrequency: "monthly", priority: 0.5 },
  { href: "/submit", changeFrequency: "monthly", priority: 0.8 },
  { href: "/categories", changeFrequency: "daily", priority: 0.5 },
  { href: "/collections", changeFrequency: "daily", priority: 0.5 },
  { href: "/tags", changeFrequency: "daily", priority: 0.5 },
];

export const getStaticSitemapEntries = (): MetadataRoute.Sitemap => {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const page of staticPages) {
      entries.push({
        url: buildLocalizedUrl(locale, page.href),
        lastModified: staticPageLastModified,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      });
    }
  }

  return entries;
};

export const getSitemapFallbackLastModified = (): Date =>
  staticPageLastModified;
