import { cookies } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { env } from "~/env";
import {
  invalidRequestResponse,
  originNotAllowedResponse,
} from "~/lib/api-error";
import {
  isBotUserAgent,
  locationFromHeaders,
  MAX_PATH_LENGTH,
  normalizePath,
  parseUserAgent,
} from "~/lib/page-views";
import {
  getClientIp,
  isSameOrigin,
  rateLimitByAddress,
  rateLimitResponse,
} from "~/lib/rate-limit";
import { prisma } from "~/services/prisma";

const VISITOR_COOKIE = "aikc_vid";
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// GA4 ends a session after 30 minutes without activity
const SESSION_COOKIE = "aikc_sid";
const SESSION_COOKIE_MAX_AGE = 30 * 60;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Per IP; a whole campus can share one address, and every page view sends
// two signals, so keep this generous
const TRACK_RATE_LIMIT_PER_MINUTE = 240;

/** Engagement beyond this is a tab left open, not reading. */
const MAX_ENGAGED_MS = 30 * 60 * 1000;

const optionalText = (max: number) => z.string().max(max).optional();

const trackRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("start"),
    id: z.string().regex(UUID_PATTERN),
    path: z
      .string()
      .startsWith("/")
      .max(MAX_PATH_LENGTH * 2),
  }),
  z.object({
    type: z.literal("end"),
    id: z.string().regex(UUID_PATTERN),
    engagedMs: z.number().int().nonnegative(),
    title: optionalText(300),
  }),
]);

type CookieStore = Awaited<ReturnType<typeof cookies>>;

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  // Not tied to NODE_ENV: a browser drops Secure cookies on a plain-http host
  secure: env.NEXT_PUBLIC_SITE_URL.startsWith("https:"),
  path: "/api/track",
  maxAge,
});

const readId = (cookieStore: CookieStore, name: string) => {
  const value = cookieStore.get(name)?.value;
  return value && UUID_PATTERN.test(value) ? value : null;
};

/**
 * One id per browser, so visitors behind a shared campus IP still count as
 * different people. Two browsers on one computer count twice; that is the
 * price of not fingerprinting anyone. `isNew` is GA4's "new user".
 */
const getVisitor = (cookieStore: CookieStore) => {
  const existing = readId(cookieStore, VISITOR_COOKIE);
  const visitorId = existing ?? crypto.randomUUID();
  cookieStore.set(
    VISITOR_COOKIE,
    visitorId,
    cookieOptions(VISITOR_COOKIE_MAX_AGE)
  );
  return { visitorId, isNew: !existing };
};

/** Each signal pushes the session's expiry 30 minutes out. */
const touchSession = (cookieStore: CookieStore) => {
  const sessionId = readId(cookieStore, SESSION_COOKIE) ?? crypto.randomUUID();
  cookieStore.set(
    SESSION_COOKIE,
    sessionId,
    cookieOptions(SESSION_COOKIE_MAX_AGE)
  );
  return sessionId;
};

/**
 * Records page views from the tracker in the public layout: "start" adds a
 * row, "end" fills in its engagement time and title. Answers 204 whether or
 * not anything was written, so a bot or a database outage never shows up as
 * an error in a visitor's console.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return originNotAllowedResponse();
  }

  const userAgent = req.headers.get("user-agent");
  if (isBotUserAgent(userAgent)) {
    return new Response(null, { status: 204 });
  }

  const limited = rateLimitByAddress(getClientIp(req), {
    scope: "track",
    limit: TRACK_RATE_LIMIT_PER_MINUTE,
    windowSeconds: 60,
  });
  if (!limited.success) {
    return rateLimitResponse(limited);
  }

  // sendBeacon posts a text/plain body, so parse it ourselves
  const parsed = trackRequestSchema.safeParse(
    await req
      .text()
      .then((body) => JSON.parse(body))
      .catch(() => null)
  );
  if (!parsed.success) {
    return invalidRequestResponse(parsed.error.issues);
  }

  const cookieStore = await cookies();
  const event = parsed.data;

  if (event.type === "end") {
    const visitorId = readId(cookieStore, VISITOR_COOKIE);
    if (!visitorId) {
      return new Response(null, { status: 204 });
    }
    touchSession(cookieStore);

    after(async () => {
      try {
        // Matching the visitor too means a browser can only touch its own
        // rows. GREATEST: beacons can arrive out of order.
        await prisma.$executeRaw`
          UPDATE "PageView"
          SET "engagedMs" = GREATEST("engagedMs", ${Math.min(event.engagedMs, MAX_ENGAGED_MS)}),
              "title" = COALESCE(${event.title?.trim() || null}, "title")
          WHERE "id" = ${event.id} AND "visitorId" = ${visitorId}
        `;
      } catch (error) {
        console.warn("[page-views] Failed to update page view", error);
      }
    });

    return new Response(null, { status: 204 });
  }

  const { visitorId, isNew } = getVisitor(cookieStore);
  const sessionId = touchSession(cookieStore);
  const { path, locale, toolSlug } = normalizePath(event.path);

  after(async () => {
    try {
      await prisma.pageView.create({
        data: {
          id: event.id,
          path,
          locale,
          toolSlug,
          visitorId,
          isNewVisitor: isNew,
          sessionId,
          ...locationFromHeaders(req.headers),
          ...parseUserAgent(userAgent),
        },
      });
    } catch (error) {
      // Same reasoning as recordAiQuery: the project logger is silent in
      // production, and a table that quietly stops filling helps nobody.
      // A replayed id lands here too, as a unique violation.
      console.warn("[page-views] Failed to record page view", error);
    }
  });

  return new Response(null, { status: 204 });
}
