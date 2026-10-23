import "server-only";

import { Prisma } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "~/services/prisma";
import type { Period } from "./range";

/**
 * GA4 counts a session as engaged when it lasted 10 seconds or more, or had
 * two or more page views. Bounce rate is the share of sessions that were not.
 */
const ENGAGED_SESSION_MS = 10_000;
const ENGAGED_SESSION_VIEWS = 2;

const REALTIME_MINUTES = 30;

const TOP_LIMIT = 10;

// createdAt is stored as UTC without a zone, hence the double AT TIME ZONE
const LOCAL_CREATED_AT = Prisma.sql`(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')`;

const inPeriod = ({ from, to }: Period) =>
  Prisma.sql`"createdAt" >= ${from} AND "createdAt" <= ${to}`;

const isEngaged = Prisma.sql`(views >= ${ENGAGED_SESSION_VIEWS} OR engaged >= ${ENGAGED_SESSION_MS})`;

export type Totals = {
  users: number;
  newUsers: number;
  sessions: number;
  engagedSessions: number;
  views: number;
  engagedMs: number;
};

const emptyTotals: Totals = {
  users: 0,
  newUsers: 0,
  sessions: 0,
  engagedSessions: 0,
  views: 0,
  engagedMs: 0,
};

/** The metrics GA4's report cards show, derived from raw totals. */
export const deriveMetrics = (totals: Totals) => ({
  users: totals.users,
  newUsers: totals.newUsers,
  sessions: totals.sessions,
  views: totals.views,
  viewsPerUser: totals.users ? totals.views / totals.users : 0,
  /** Seconds, per user, as GA4's "Average engagement time". */
  avgEngagementTime: totals.users ? totals.engagedMs / totals.users / 1000 : 0,
  engagementRate: totals.sessions
    ? totals.engagedSessions / totals.sessions
    : 0,
  bounceRate: totals.sessions
    ? 1 - totals.engagedSessions / totals.sessions
    : 0,
});

export type Metrics = ReturnType<typeof deriveMetrics>;

/**
 * Users count browsers (one cookie each), not people: two browsers on one
 * computer are two users, as in GA4 without sign-in.
 */
async function getTotals(period: Period): Promise<Totals> {
  const [totals] = await prisma.$queryRaw<[Totals]>`
    WITH v AS (
      SELECT * FROM "PageView" WHERE ${inPeriod(period)}
    ), s AS (
      SELECT COUNT(*) AS views, SUM("engagedMs") AS engaged FROM v GROUP BY "sessionId"
    )
    SELECT
      (SELECT COUNT(DISTINCT "visitorId") FROM v)::int AS users,
      (SELECT COUNT(DISTINCT "visitorId") FROM v WHERE "isNewVisitor")::int AS "newUsers",
      (SELECT COUNT(*) FROM s)::int AS sessions,
      (SELECT COUNT(*) FROM s WHERE ${isEngaged})::int AS "engagedSessions",
      (SELECT COUNT(*) FROM v)::int AS views,
      (SELECT COALESCE(SUM("engagedMs"), 0) FROM v)::float8 AS "engagedMs"
  `;
  return totals;
}

export type KpiSummary = { current: Metrics; previous: Metrics };

/** Headline metrics for the period and the one before it. */
export async function getKpis(
  current: Period,
  previous: Period
): Promise<KpiSummary> {
  noStore();

  try {
    const [now, before] = await Promise.all([
      getTotals(current),
      getTotals(previous),
    ]);
    return { current: deriveMetrics(now), previous: deriveMetrics(before) };
  } catch {
    return {
      current: deriveMetrics(emptyTotals),
      previous: deriveMetrics(emptyTotals),
    };
  }
}

export type TimeseriesPoint = Metrics & { bucket: string };

async function getSeries(period: Period): Promise<TimeseriesPoint[]> {
  const format =
    period.granularity === "hour" ? `YYYY-MM-DD"T"HH24` : "YYYY-MM-DD";
  const bucket = Prisma.sql`to_char(${LOCAL_CREATED_AT}, ${format})`;

  const rows = await prisma.$queryRaw<(Totals & { bucket: string })[]>`
    WITH v AS (
      SELECT *, ${bucket} AS bucket FROM "PageView" WHERE ${inPeriod(period)}
    ), s AS (
      SELECT bucket, COUNT(*) AS views, SUM("engagedMs") AS engaged
      FROM v GROUP BY bucket, "sessionId"
    ), per_session AS (
      SELECT bucket,
        COUNT(*)::int AS sessions,
        (COUNT(*) FILTER (WHERE ${isEngaged}))::int AS "engagedSessions"
      FROM s GROUP BY bucket
    )
    SELECT v.bucket,
      COUNT(DISTINCT "visitorId")::int AS users,
      (COUNT(DISTINCT "visitorId") FILTER (WHERE "isNewVisitor"))::int AS "newUsers",
      COUNT(*)::int AS views,
      COALESCE(SUM("engagedMs"), 0)::float8 AS "engagedMs",
      MAX(per_session.sessions) AS sessions,
      MAX(per_session."engagedSessions") AS "engagedSessions"
    FROM v JOIN per_session USING (bucket)
    GROUP BY v.bucket
  `;

  const byBucket = new Map(rows.map((row) => [row.bucket, row]));
  return period.buckets.map((key) => ({
    bucket: key,
    ...deriveMetrics(byBucket.get(key) ?? emptyTotals),
  }));
}

export type Timeseries = {
  current: TimeseriesPoint[];
  /** Same length as `current`, matched by position for the dashed line. */
  previous: TimeseriesPoint[];
  granularity: Period["granularity"];
};

export async function getTimeseries(
  current: Period,
  previous: Period
): Promise<Timeseries> {
  noStore();

  const empty = (period: Period) =>
    period.buckets.map((bucket) => ({ bucket, ...deriveMetrics(emptyTotals) }));

  try {
    const [now, before] = await Promise.all([
      getSeries(current),
      getSeries(previous),
    ]);
    return { current: now, previous: before, granularity: current.granularity };
  } catch {
    return {
      current: empty(current),
      previous: empty(previous),
      granularity: current.granularity,
    };
  }
}

export type Realtime = {
  users: number;
  /** Views per minute, oldest first; the last entry is the current minute. */
  perMinute: number[];
  pages: { key: string; label: string; value: number }[];
  countries: { key: string; label: string; value: number }[];
};

const countBy = <T>(rows: T[], keyOf: (row: T) => string | null) => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row) ?? "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, value]) => ({ key, label: key, value }));
};

/**
 * The last 30 minutes, like GA4's realtime card. A visit counts from the page
 * it opened, so someone reading one page for over 30 minutes drops out.
 */
export async function getRealtime(): Promise<Realtime> {
  noStore();

  const now = Date.now();
  const since = new Date(now - REALTIME_MINUTES * 60_000);

  try {
    const rows = await prisma.pageView.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, visitorId: true, path: true, country: true },
      take: 20_000,
    });

    const perMinute = Array.from({ length: REALTIME_MINUTES }, () => 0);
    for (const { createdAt } of rows) {
      const minutesAgo = Math.floor((now - createdAt.getTime()) / 60_000);
      const index = REALTIME_MINUTES - 1 - minutesAgo;
      if (index >= 0 && index < REALTIME_MINUTES) {
        perMinute[index] += 1;
      }
    }

    return {
      users: new Set(rows.map(({ visitorId }) => visitorId)).size,
      perMinute,
      pages: countBy(rows, ({ path }) => path),
      countries: countBy(rows, ({ country }) => country),
    };
  } catch {
    return {
      users: 0,
      perMinute: Array.from({ length: REALTIME_MINUTES }, () => 0),
      pages: [],
      countries: [],
    };
  }
}

export type DimensionRow = {
  key: string | null;
  users: number;
  views: number;
  /** Users in the whole period, counted once even if they show up in several rows. */
  totalUsers: number;
};

/** Columns a dimension report may group by. Never interpolate anything else. */
const DIMENSIONS = {
  country: Prisma.raw(`"country"`),
  device: Prisma.raw(`"device"`),
  browser: Prisma.raw(`"browser"`),
  os: Prisma.raw(`"os"`),
  locale: Prisma.raw(`"locale"`),
};

export type Dimension = keyof typeof DIMENSIONS;

/** Users and views per value of one dimension, most users first. */
export async function getDimension(
  period: Period,
  dimension: Dimension,
  limit = TOP_LIMIT
): Promise<DimensionRow[]> {
  noStore();

  const column = DIMENSIONS[dimension];

  try {
    return await prisma.$queryRaw<DimensionRow[]>`
      SELECT ${column} AS key,
        COUNT(DISTINCT "visitorId")::int AS users,
        COUNT(*)::int AS views,
        (SELECT COUNT(DISTINCT "visitorId") FROM "PageView" WHERE ${inPeriod(period)})::int AS "totalUsers"
      FROM "PageView"
      WHERE ${inPeriod(period)}
      GROUP BY ${column}
      ORDER BY users DESC, views DESC
      LIMIT ${limit}
    `;
  } catch {
    return [];
  }
}

export type ToolRow = {
  slug: string;
  name: string;
  views: number;
  users: number;
};

/** Most viewed tool pages, with names; a deleted tool keeps its slug. */
export async function getTopTools(period: Period): Promise<ToolRow[]> {
  noStore();

  try {
    const rows = await prisma.$queryRaw<
      { slug: string; views: number; users: number }[]
    >`
      SELECT "toolSlug" AS slug,
        COUNT(*)::int AS views,
        COUNT(DISTINCT "visitorId")::int AS users
      FROM "PageView"
      WHERE ${inPeriod(period)} AND "toolSlug" IS NOT NULL
      GROUP BY "toolSlug"
      ORDER BY views DESC
      LIMIT ${TOP_LIMIT}
    `;

    const names = new Map(
      (
        await prisma.tool.findMany({
          where: { slug: { in: rows.map(({ slug }) => slug) } },
          select: { slug: true, name: true },
        })
      ).map(({ slug, name }) => [slug, name])
    );

    return rows.map((row) => ({
      ...row,
      name: names.get(row.slug) ?? row.slug,
    }));
  } catch {
    return [];
  }
}
