#!/usr/bin/env bun
/**
 * Clean up the tools flagged as broken, using the current link checker rules.
 *
 * - Links that are really dead: the tool is unpublished (hidden from the site,
 *   kept in the admin as Draft) and removed from Qdrant so chat and search
 *   stop suggesting it. Its broken flag is cleared. Re-publishing it in the
 *   admin indexes it again.
 * - Links that only failed for the checker (bot protection, rate limits,
 *   timeouts): the broken flag is cleared.
 * - URL_FIXES: the website URL is replaced when the new one works.
 * - ALWAYS_UNPUBLISH: unpublished whatever the check says.
 *
 * Usage:
 *   bun run links:fix            # Print the plan, change nothing
 *   bun run links:fix --apply    # Apply the plan
 *
 * Public pages are cached: hidden tools leave them once the cache is
 * revalidated (e.g. by saving any tool in the admin).
 */

import { validateLink } from "~/lib/link-validator";
import { deleteHybridToolVector } from "~/lib/vector-store";
import { prisma } from "~/services/prisma";

const APPLY = process.argv.includes("--apply");
const CONCURRENCY = 5;

/** The listed URL is wrong but the site lives on at another address. */
const URL_FIXES: Record<string, { from: string; to: string }> = {
  "stanford-computer-graphics-laboratory": {
    from: "https://www.graphics.stanford.edu",
    to: "https://graphics.stanford.edu",
  },
};

/** Not usable tools even though their link answers. */
const ALWAYS_UNPUBLISH: Record<string, string> = {
  "imagined-ai": "Domain is for sale",
  altersquare: "Medium blog, not a tool",
  medium: "Medium blog, not a tool",
  "medium-2": "Medium blog post, not a tool",
  "medium-3": "Medium blog post, not a tool",
  "medium-4": "Medium blog post, not a tool",
  "medium-5": "Medium blog post, not a tool",
  "seedance-ai": "Name servers do not answer (SERVFAIL for everyone)",
  // Imported from image CDNs or short links, not product sites.
  "assets-global-website-files-com": "Webflow asset CDN, not a tool",
  "error-handling-module": "Google Play image CDN, not a tool",
  "example-software-2": "YouTube image CDN, not a tool",
  github: "Twitter image CDN, not a tool",
  "invalid-dynamic-link": "Google Forms short link, not a tool",
  "referer-is-not-allowed": "Image CDN, not a tool",
  // Slack workspaces need an invite; they are communities, not tools.
  "camel-ai-2": "Slack workspace, not a tool",
  chatarena: "Slack workspace, not a tool",
  "saga-3": "Slack workspace, not a tool",
};

type Tool = {
  id: string;
  slug: string;
  websiteUrl: string;
  publishedAt: Date | null;
};

type Plan =
  | { action: "unpublish"; tool: Tool; reason: string }
  | { action: "clear-flag"; tool: Tool; reason: string }
  | { action: "fix-url"; tool: Tool; reason: string; to: string }
  | { action: "keep"; tool: Tool; reason: string };

const planFor = async (tool: Tool): Promise<Plan> => {
  const forced = ALWAYS_UNPUBLISH[tool.slug];
  if (forced) {
    return { action: "unpublish", tool, reason: forced };
  }

  const fix = URL_FIXES[tool.slug];
  if (fix && tool.websiteUrl === fix.from) {
    const taken = await prisma.tool.findUnique({
      where: { websiteUrl: fix.to },
      select: { slug: true },
    });
    if (taken) {
      return { action: "keep", tool, reason: `${fix.to} already used by ${taken.slug}` };
    }
    const result = await validateLink(fix.to);
    return result.isValid
      ? { action: "fix-url", tool, reason: `${fix.from} -> ${fix.to}`, to: fix.to }
      : { action: "keep", tool, reason: `New URL fails too: ${result.error}` };
  }

  const result = await validateLink(tool.websiteUrl);
  const reason = result.error ?? `HTTP ${result.statusCode}`;
  return result.isValid
    ? { action: "clear-flag", tool, reason }
    : { action: "unpublish", tool, reason };
};

const apply = async (plan: Plan) => {
  const { tool } = plan;
  const now = new Date();

  switch (plan.action) {
    case "unpublish":
      await prisma.tool.update({
        where: { id: tool.id },
        // The weekly checker skips unpublished tools, so a broken flag left
        // here would never clear; the Draft status already marks them.
        data: { publishedAt: null, isBroken: false, lastCheckedAt: now },
      });
      await deleteHybridToolVector(tool.id);
      return;
    case "clear-flag":
      await prisma.tool.update({
        where: { id: tool.id },
        data: { isBroken: false, lastCheckedAt: now },
      });
      return;
    case "fix-url":
      await prisma.tool.update({
        where: { id: tool.id },
        data: { websiteUrl: plan.to, isBroken: false, lastCheckedAt: now },
      });
      return;
    case "keep":
      return;
  }
};

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

const main = async () => {
  console.log("🔗 Fix broken links");
  console.log(APPLY ? "   APPLYING changes\n" : "   DRY RUN: nothing will be changed\n");

  const tools = await prisma.tool.findMany({
    where: {
      OR: [{ isBroken: true }, { slug: { in: Object.keys(ALWAYS_UNPUBLISH) } }],
    },
    select: { id: true, slug: true, websiteUrl: true, publishedAt: true },
    orderBy: { slug: "asc" },
  });
  console.log(`Checking ${tools.length} tools...\n`);

  const plans = await runPool(tools, planFor);

  for (const action of ["unpublish", "fix-url", "keep", "clear-flag"] as const) {
    const group = plans.filter((plan) => plan.action === action);
    if (group.length === 0) continue;
    console.log(`== ${action} (${group.length})`);
    for (const { tool, reason } of group) {
      const hidden = tool.publishedAt ? "" : " [already unpublished]";
      console.log(`  ${tool.slug}  ${tool.websiteUrl}  ${reason}${hidden}`);
    }
    console.log();
  }

  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to make these changes.");
    return;
  }

  await runPool(plans, apply);
  console.log(`✅ Applied ${plans.length} changes.`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
