import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Rewrite the `Link` header so alternate-hreflang URLs use the canonical
 * site origin instead of the internal host (e.g. 0.0.0.0:5175).
 *
 * next-intl builds the Link header from the incoming request's Host header,
 * which may leak internal infrastructure addresses.  When
 * NEXT_PUBLIC_SITE_URL is set, we rewrite the origin in every `<…>` URL
 * found in the Link header to match the public domain.
 */
function rewriteLinkHeader(response: NextResponse): void {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return;

  const linkHeader = response.headers.get("Link");
  if (!linkHeader) return;

  let siteOrigin: string;
  try {
    siteOrigin = new URL(siteUrl).origin;
  } catch {
    return; // invalid URL – leave the header untouched
  }

  // Replace every URL origin inside angle brackets with the canonical one.
  // Pattern matches `<scheme://host[:port]/…>` and replaces the origin.
  const rewritten = linkHeader.replace(
    /<(https?:\/\/[^\/]+)(\/[^>]*)>/g,
    (_match, _origin, path) => `<${siteOrigin}${path}>`,
  );

  if (rewritten !== linkHeader) {
    response.headers.set("Link", rewritten);
  }
}

const STATIC_FILES =
  /^\/(en|vi)\/(icon-192\.png|icon-512\.png|favicon\.ico|manifest\.json)$/;

const usesSecureAuthCookies = (req: NextRequest) => {
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

  if (authUrl) {
    return authUrl.startsWith("https://");
  }

  return (
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https"
  );
};

export default async function middleware(req: NextRequest) {
  const { nextUrl } = req;

  // Redirect locale-prefixed static files to the root path
  const staticMatch = nextUrl.pathname.match(STATIC_FILES);
  if (staticMatch) {
    return NextResponse.redirect(new URL(`/${staticMatch[2]}`, nextUrl));
  }

  // Admin routes - protect with auth
  if (nextUrl.pathname.startsWith("/admin")) {
    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      secureCookie: usesSecureAuthCookies(req),
    });
    if (!token) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    return NextResponse.next();
  }

  // Let next-intl handle all other routes without invoking auth middleware
  const response = intlMiddleware(req);
  rewriteLinkHeader(response);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api/ routes
     * 2. /monitoring (Sentry tunnel route)
     * 3. /_next/ (Next.js internals)
     * 4. /_proxy/ (proxies for third-party services)
     * 5. /_static/ (static files inside /public folder)
     * 6. Metadata files: favicon.ico, sitemap.xml, robots.txt, manifest.webmanifest, .well-known
     * biome-ignore format: complex regex pattern for Next.js middleware matcher
     */
    "/((?!api/|monitoring|_next/|_proxy/|_static/|icons/|icon-192\\.png|icon-512\\.png|favicon.ico|manifest.json|sitemap(?:-\\d+)?.xml|robots.txt|manifest.webmanifest|.well-known).*)",
  ],
};
