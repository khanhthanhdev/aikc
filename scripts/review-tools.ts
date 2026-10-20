#!/usr/bin/env bun
/**
 * Export every tool to a CSV for a manual review in Excel: one row per tool,
 * one column per check, and an "Issues" column that sums them up. Read-only.
 *
 * Checks:
 * - Link & status: broken flag, open reports, and with --check-links a fresh
 *   link check of every published tool (takes 10-20 minutes)
 * - Duplicates: same URL, same name, slug-2 style copies, same small domain
 * - Name vs URL: the name appears nowhere in the URL, which often means the
 *   tool was scraped from a page about another product (many are rebrands
 *   or company domains, so this one needs a human look)
 * - Content: missing tagline, description, content, logo, screenshot or
 *   Vietnamese translation
 * - Classification: no category, tag or audience role
 *
 * Usage:
 *   bun run tools:review                      # writes tools-review.csv
 *   bun run tools:review --check-links        # also re-checks every link
 *   bun run tools:review --out /tmp/review.csv
 */

import { writeFileSync } from "node:fs";
import { siteConfig } from "~/config/site";
import { validateLink } from "~/lib/link-validator";
import { prisma } from "~/services/prisma";

const CHECK_LINKS = process.argv.includes("--check-links");
const OUT_INDEX = process.argv.indexOf("--out");
const OUT_PATH =
  OUT_INDEX > -1 ? process.argv[OUT_INDEX + 1] : "tools-review.csv";
const CONCURRENCY = 10;

/**
 * Tools on a domain shared by more than this many are on a platform
 * (github.com, chrome.google.com, ...) rather than copies of one product.
 */
const MAX_SHARED_DOMAIN = 3;

type Tool = Awaited<ReturnType<typeof loadTools>>[number];

const loadTools = () =>
  prisma.tool.findMany({
    orderBy: { name: "asc" },
    select: {
      slug: true,
      name: true,
      nameVi: true,
      websiteUrl: true,
      tagline: true,
      description: true,
      descriptionVi: true,
      content: true,
      faviconUrl: true,
      screenshotUrl: true,
      translationStatusVi: true,
      isBroken: true,
      lastCheckedAt: true,
      publishedAt: true,
      createdAt: true,
      roles: true,
      categories: { select: { name: true } },
      tags: { select: { name: true } },
      reports: { where: { resolvedAt: null }, select: { type: true } },
    },
  });

const toolStatus = (publishedAt: Date | null) => {
  if (!publishedAt) return "draft";
  return publishedAt > new Date() ? "scheduled" : "published";
};

const parseUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return { host, key: `${host}${path}` };
  } catch {
    return { host: url.toLowerCase(), key: url.toLowerCase() };
  }
};

const normalizeName = (name: string) =>
  name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Words too common in tool names to tie a name to a URL. */
const GENERIC_WORDS = new Set([
  "ai",
  "app",
  "and",
  "for",
  "the",
  "with",
  "pro",
  "labs",
  "studio",
  "tool",
  "tools",
]);

/**
 * Whether the name shows up in the URL as a whole, by one of its words, or
 * the domain shows up in the name. Names without Latin letters always pass,
 * since they can't be compared.
 */
const nameMatchesUrl = (name: string, url: string) => {
  const words = name.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const joined = words.join("");
  if (!joined) return true;

  const target = url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[^a-z0-9]/g, "");
  const label = (parseUrl(url).host.split(".").at(-2) ?? "").replace(
    /[^a-z0-9]/g,
    ""
  );

  return (
    target.includes(joined) ||
    words.some(
      (word) =>
        word.length >= 3 && !GENERIC_WORDS.has(word) && target.includes(word)
    ) ||
    (label.length >= 4 && joined.includes(label))
  );
};

/** Groups slugs by a key, keeping only keys more than one tool shares. */
const groupBy = (tools: Tool[], keyOf: (tool: Tool) => string) => {
  const groups = new Map<string, string[]>();
  for (const tool of tools) {
    const key = keyOf(tool);
    groups.set(key, [...(groups.get(key) ?? []), tool.slug]);
  }
  return groups;
};

const othersIn = (groups: Map<string, string[]>, key: string, slug: string) =>
  (groups.get(key) ?? []).filter((other) => other !== slug);

const runPool = async <T, R>(items: T[], worker: (item: T) => Promise<R>) => {
  const results: R[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index]);
      }
    })
  );
  return results;
};

const checkLinks = async (tools: Tool[]) => {
  const results = new Map<string, { broken: boolean; detail: string }>();
  let done = 0;

  await runPool(tools, async (tool) => {
    const result = await validateLink(tool.websiteUrl).catch(
      (error: unknown) => ({
        isValid: true,
        statusCode: undefined,
        error: `check failed: ${error instanceof Error ? error.message : error}`,
      })
    );
    const detail = result.error ?? `HTTP ${result.statusCode}`;
    const label = result.isValid ? (result.error ? "unclear" : "OK") : "BROKEN";
    results.set(tool.slug, {
      broken: !result.isValid,
      detail: `${label}: ${detail}`,
    });

    if (++done % 200 === 0) {
      console.log(`   checked ${done}/${tools.length} links`);
    }
  });

  return results;
};

/**
 * Quotes every cell, and defuses cells Excel would run as a formula, since
 * names and taglines come from public submissions.
 */
const toCsvCell = (value: string | number) => {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

const COLUMNS = [
  "Status",
  "Issues",
  "Issue count",
  "Name",
  "Name (VI)",
  "Slug",
  "Website",
  "Admin",
  "Live link check",
  "Flagged broken",
  "Last checked",
  "Open reports",
  "Same URL as",
  "Same name as",
  "Copy of",
  "Same domain as",
  "Description length",
  "Missing content",
  "Vietnamese",
  "Categories",
  "Tags",
  "Roles",
  "Created",
  "Published",
] as const;

const main = async () => {
  console.log("🔎 Review tools");
  const tools = await loadTools();
  console.log(`   ${tools.length} tools loaded`);

  const byUrl = groupBy(tools, (tool) => parseUrl(tool.websiteUrl).key);
  const byName = groupBy(tools, (tool) => normalizeName(tool.name));
  const byHost = groupBy(tools, (tool) => parseUrl(tool.websiteUrl).host);
  const slugs = new Set(tools.map((tool) => tool.slug));

  const published = tools.filter(
    (tool) => toolStatus(tool.publishedAt) === "published"
  );
  let liveChecks = new Map<string, { broken: boolean; detail: string }>();
  if (CHECK_LINKS) {
    console.log(`   checking ${published.length} published links...`);
    liveChecks = await checkLinks(published);
  }

  const issueCounts = new Map<string, number>();

  const rows = tools.map((tool) => {
    const status = toolStatus(tool.publishedAt);
    const { host, key } = parseUrl(tool.websiteUrl);
    const sameUrl = othersIn(byUrl, key, tool.slug);
    const sameName = othersIn(byName, normalizeName(tool.name), tool.slug);
    const baseSlug = tool.slug.match(/^(.+)-\d+$/)?.[1];
    const copyOf = baseSlug && slugs.has(baseSlug) ? baseSlug : "";
    const hostGroup = byHost.get(host) ?? [];
    const sameDomain =
      hostGroup.length <= MAX_SHARED_DOMAIN
        ? othersIn(byHost, host, tool.slug)
        : [];
    const liveCheck = liveChecks.get(tool.slug);
    const descriptionLength = tool.description?.trim().length ?? 0;

    const missing = [
      !tool.tagline?.trim() && "tagline",
      descriptionLength === 0 && "description",
      !tool.content?.trim() && "content",
      !tool.faviconUrl && "logo",
      !tool.screenshotUrl && "screenshot",
    ].filter((item): item is string => Boolean(item));

    const missingVi =
      tool.translationStatusVi === "MISSING" || !tool.descriptionVi?.trim();

    const issues = [
      liveCheck?.broken && "Broken link",
      tool.isBroken && "Flagged broken",
      tool.reports.length > 0 && "Open report",
      sameUrl.length > 0 && "Duplicate URL",
      sameName.length > 0 && "Duplicate name",
      copyOf && "Slug copy",
      sameDomain.length > 0 && "Same domain",
      !nameMatchesUrl(tool.name, tool.websiteUrl) && "Name not in URL",
      missing.length > 0 && "Missing content",
      missingVi && "No Vietnamese",
      tool.categories.length === 0 && "No category",
      tool.tags.length === 0 && "No tag",
      tool.roles.length === 0 && "No role",
    ].filter((issue): issue is string => Boolean(issue));

    if (status === "published") {
      for (const issue of issues) {
        issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
      }
    }

    const reportTypes = tool.reports.map((report) => report.type);

    const row: Record<(typeof COLUMNS)[number], string | number> = {
      Status: status,
      Issues: issues.join("; "),
      "Issue count": issues.length,
      Name: tool.name,
      "Name (VI)": tool.nameVi ?? "",
      Slug: tool.slug,
      Website: tool.websiteUrl,
      Admin: `${siteConfig.url}/admin/tools/${tool.slug}`,
      "Live link check":
        liveCheck?.detail ?? (status === "published" ? "not run" : ""),
      "Flagged broken": tool.isBroken ? "yes" : "",
      "Last checked": tool.lastCheckedAt?.toISOString().slice(0, 10) ?? "",
      "Open reports": reportTypes.length
        ? `${reportTypes.length} (${reportTypes.join(", ")})`
        : "",
      "Same URL as": sameUrl.join(", "),
      "Same name as": sameName.join(", "),
      "Copy of": copyOf,
      "Same domain as": sameDomain.join(", "),
      "Description length": descriptionLength,
      "Missing content": missing.join(", "),
      Vietnamese: tool.translationStatusVi,
      Categories: tool.categories.map((category) => category.name).join(", "),
      Tags: tool.tags.map((tag) => tag.name).join(", "),
      Roles: tool.roles.join(", "),
      Created: tool.createdAt.toISOString().slice(0, 10),
      Published: tool.publishedAt?.toISOString().slice(0, 10) ?? "",
    };
    return { status, issueCount: issues.length, row };
  });

  // Published tools first, the ones with most issues on top
  const statusOrder = { published: 0, scheduled: 1, draft: 2 } as const;
  rows.sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      b.issueCount - a.issueCount
  );

  const lines = [
    COLUMNS.map(toCsvCell).join(","),
    ...rows.map(({ row }) =>
      COLUMNS.map((column) => toCsvCell(row[column])).join(",")
    ),
  ];
  // The BOM makes Excel read the file as UTF-8, so Vietnamese shows correctly
  writeFileSync(OUT_PATH, `﻿${lines.join("\r\n")}\r\n`);

  const statusCounts = rows.reduce<Record<string, number>>(
    (counts, { status }) => {
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    },
    {}
  );
  const clean = rows.filter(
    (row) => row.status === "published" && row.issueCount === 0
  );

  console.log(
    `\n📊 ${Object.entries(statusCounts)
      .map(([status, count]) => `${count} ${status}`)
      .join(", ")}`
  );
  console.log(`   ${clean.length} published tools have no issue\n`);
  console.log("Issues among published tools:");
  for (const [issue, count] of [...issueCounts].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(count).padStart(5)}  ${issue}`);
  }
  if (!CHECK_LINKS) {
    console.log("\n   (links not re-checked: add --check-links)");
  }
  console.log(`\n✅ Wrote ${rows.length} rows to ${OUT_PATH}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
