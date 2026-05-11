import { defineRouting } from "next-intl/routing";

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const localeCookie = {
  name: "NEXT_LOCALE",
  maxAge: LOCALE_COOKIE_MAX_AGE,
  secure: true,
  httpOnly: true,
  sameSite: "lax",
} as const;

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
    "/tools": { vi: "/tools" },
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
  localeCookie,
});
