import { config } from "~/config";
import { getPathname } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";

/**
 * Build a full absolute URL for a locale-aware page path.
 * Uses next-intl's getPathname to resolve localized routes.
 */
export const buildLocalizedUrl = (locale: string, href: string): string => {
  const pathname = getPathname({ locale, href } as never);
  return `${config.site.url}${pathname}`;
};

/**
 * Build alternates metadata (canonical + hreflang) for a page.
 * The current locale is excluded from `languages` to avoid
 * the canonical URL duplicating an hreflang entry.
 */
export const buildAlternates = (locale: string, href: string) => {
  const canonical = buildLocalizedUrl(locale, href);

  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    if (loc === locale) {
      continue;
    }
    const langCode = loc === "en" ? "en-US" : "vi-VN";
    languages[langCode] = buildLocalizedUrl(loc, href);
  }
  languages["x-default"] = buildLocalizedUrl(routing.defaultLocale, href);

  return {
    canonical,
    languages,
  };
};
