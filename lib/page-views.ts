import { routing } from "~/i18n/routing";

/** Longest path we persist. Real routes are far shorter; this stops junk. */
export const MAX_PATH_LENGTH = 500;

/**
 * User-Agents that are not people. The tracker only runs in a browser that
 * executes JavaScript, which already keeps most crawlers out; this catches
 * the headless ones and scripted clients. In-app browsers (Zalo, Facebook)
 * are people and must not match.
 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|embedly|curl|wget|python|axios|node-fetch|go-http/i;

export const isBotUserAgent = (userAgent: string | null) =>
  !userAgent || BOT_PATTERN.test(userAgent);

/** First match wins, so in-app and Chromium forks come before Chrome. */
const BROWSERS: [RegExp, string][] = [
  [/zalo/i, "Zalo"],
  [/FBAN|FBAV|FB_IAB/, "Facebook"],
  [/coc_coc_browser/i, "Cốc Cốc"],
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser/, "Samsung Internet"],
  [/Chrome\/|CriOS/, "Chrome"],
  [/Firefox\/|FxiOS/, "Firefox"],
  [/Safari\//, "Safari"],
];

const OPERATING_SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

const firstMatch = (userAgent: string, table: [RegExp, string][]) =>
  table.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;

/** GA4's device category, browser and operating system. */
export const parseUserAgent = (userAgent: string | null) => {
  const ua = userAgent ?? "";

  return {
    device: deviceOf(ua),
    browser: firstMatch(ua, BROWSERS),
    os: firstMatch(ua, OPERATING_SYSTEMS),
  };
};

const deviceOf = (ua: string) => {
  // Android tablets are the Android devices that do not say "Mobile"
  if (/iPad|Tablet/i.test(ua) || (/Android/.test(ua) && !/Mobi/.test(ua))) {
    return "tablet";
  }
  return /Mobi|iPhone|iPod/i.test(ua) ? "mobile" : "desktop";
};

/**
 * Country as Cloudflare puts it on the request, so the site never has to look
 * up an IP itself. "XX" means unknown.
 */
export const locationFromHeaders = (headers: Headers) => {
  const country = headers.get("cf-ipcountry")?.toUpperCase() ?? null;

  return {
    country:
      country && /^[A-Z]{2}$/.test(country) && country !== "XX"
        ? country
        : null,
  };
};

type Locale = (typeof routing.locales)[number];

type LocalizedRoute = {
  internal: string;
  pattern: RegExp;
  params: string[];
};

/**
 * Every localized pathname from `routing.pathnames`, as a regex that maps
 * back to its internal route. Built once: "/ve-chung-toi" → "/about",
 * "/tools/[slug]" → "/tools/chatgpt".
 */
const localizedRoutes: LocalizedRoute[] = Object.entries(
  routing.pathnames ?? {}
).flatMap(([internal, localized]) => {
  const variants =
    typeof localized === "string" ? [localized] : Object.values(localized);

  return [...new Set([internal, ...variants])].map((variant) => {
    const params: string[] = [];
    const source = variant
      .split("/")
      .map((segment) => {
        const param = segment.match(/^\[(.+)\]$/)?.[1];
        if (param) {
          params.push(param);
          return "([^/]+)";
        }
        return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("/");

    return { internal, pattern: new RegExp(`^${source}$`), params };
  });
});

export type NormalizedPath = {
  path: string;
  locale: Locale | null;
  toolSlug: string | null;
};

/**
 * Turn the browser's pathname into the row we store: the locale prefix goes
 * to its own field, Vietnamese segments map back to the internal route so
 * both languages add up on one row, and tool pages carry their slug.
 */
export const normalizePath = (rawPath: string): NormalizedPath => {
  let path = rawPath.split(/[?#]/)[0] || "/";
  let locale: Locale | null = null;

  const [, first] = path.split("/");
  if (routing.locales.includes(first as Locale)) {
    locale = first as Locale;
    path = path.slice(first.length + 1) || "/";
  }

  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  for (const route of localizedRoutes) {
    const match = path.match(route.pattern);
    if (!match) {
      continue;
    }

    const values = Object.fromEntries(
      route.params.map((param, index) => [param, match[index + 1]])
    );
    const internalPath = route.internal.replace(
      /\[(.+?)\]/g,
      (_, param: string) => values[param] ?? param
    );

    return {
      path: internalPath.slice(0, MAX_PATH_LENGTH),
      locale,
      toolSlug:
        route.internal === "/tools/[slug]" ? (values.slug ?? null) : null,
    };
  }

  return { path: path.slice(0, MAX_PATH_LENGTH), locale, toolSlug: null };
};
