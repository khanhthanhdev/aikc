import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ["en", "vi"],

  // Used when no locale matches
  defaultLocale: "en",

  // Always use locale prefix in URLs
  localePrefix: "always",

  // Custom URLs for each locale
  pathnames: {
    "/": "/",
    "/about": { vi: "/ve-chung-toi" },
    "/submit": { vi: "/gui-tool" },
    "/login": { vi: "/dang-nhap" },
    "/categories": { vi: "/danh-muc" },
    "/collections": { vi: "/bo-suu-tap" },
    "/tags": { vi: "/the" },

    // Dynamic routes
    "/tools/[slug]": { vi: "/tools/[slug]" },
    "/categories/[slug]": { vi: "/categories/[slug]" },
    "/collections/[slug]": { vi: "/collections/[slug]" },
    "/tags/[slug]": { vi: "/tags/[slug]" },
    "/submit/[slug]": { vi: "/submit/[slug]" },
  },

  // Cookie configuration for locale persistence
  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  },
});
