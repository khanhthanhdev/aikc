// No "server-only" import: proxy.ts imports this (see lib/admin-access.ts).
import { prisma } from "~/services/prisma";
import { isValidSlug } from "~/utils/slug";

// Same path for both locales (see i18n/routing.ts)
const DETAIL_PAGE = /^\/(en|vi)\/(tools|categories|tags)\/([^/]+)\/?$/;

const FOUND_TTL_MS = 5 * 60 * 1000;
// Short, so a freshly published tool stops 404ing quickly
const MISSING_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 5000;

type DetailKind = "tools" | "categories" | "tags";

const lookups = new Map<string, { exists: boolean; expiresAt: number }>();

const slugExists = async (kind: DetailKind, slug: string) => {
  switch (kind) {
    case "tools":
      // The tool page also 404s for tools that are not published yet
      return Boolean(
        await prisma.tool.findFirst({
          where: { slug, publishedAt: { lte: new Date() } },
          select: { id: true },
        })
      );
    case "categories":
      return Boolean(
        await prisma.category.findUnique({
          where: { slug },
          select: { id: true },
        })
      );
    case "tags":
      return Boolean(
        await prisma.tag.findUnique({ where: { slug }, select: { id: true } })
      );
    default:
      return true;
  }
};

const cachedSlugExists = async (kind: DetailKind, slug: string) => {
  const key = `${kind}:${slug}`;
  const now = Date.now();
  const cached = lookups.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.exists;
  }

  const exists = await slugExists(kind, slug);
  if (lookups.size >= MAX_ENTRIES) {
    lookups.clear();
  }
  lookups.set(key, {
    exists,
    expiresAt: now + (exists ? FOUND_TTL_MS : MISSING_TTL_MS),
  });
  return exists;
};

/**
 * For a tool, category or tag page whose slug does not exist, the locale to
 * render the not-found page in; otherwise null.
 *
 * The pages call notFound() themselves, but their loading.tsx shell has
 * already been flushed with a 200 by then, so crawlers see a soft 404. The
 * proxy answers before anything streams. A failed lookup lets the page decide.
 */
export const findMissingDetailPageLocale = async (
  pathname: string
): Promise<string | null> => {
  const match = pathname.match(DETAIL_PAGE);
  if (!match) {
    return null;
  }
  const [, locale, kind, rawSlug] = match;

  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    return locale;
  }
  if (!isValidSlug(slug)) {
    return locale;
  }

  try {
    return (await cachedSlugExists(kind as DetailKind, slug)) ? null : locale;
  } catch (error) {
    console.warn(
      "[proxy] Slug lookup failed:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
};
