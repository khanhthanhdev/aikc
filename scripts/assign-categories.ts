#!/usr/bin/env bun
/**
 * Let AI file existing tools that have no category yet.
 *
 * Tools that already have at least one category are never touched, so admin
 * choices survive. Tools without a description or content (not processed yet)
 * are skipped: the model would only have the name to go on — run "Process"
 * on them in the admin instead, which assigns categories as part of the
 * pipeline.
 *
 * Usage:
 *   bun run categories:assign --dry-run     # Print suggestions, change nothing
 *   bun run categories:assign               # Assign and re-index in Qdrant
 *   bun run categories:assign --limit 20    # Only the first 20 tools
 *
 * Public pages are cached: new categories show up there once the cache is
 * revalidated (e.g. by saving any tool or category in the admin).
 */

import {
  autoAssignToolCategories,
  suggestToolCategories,
} from "~/lib/categorize-tool";
import { upsertHybridToolVector } from "~/lib/vector-store";
import { prisma } from "~/services/prisma";

const DRY_RUN = process.argv.includes("--dry-run");
const limitArg = process.argv[process.argv.indexOf("--limit") + 1];
const LIMIT = process.argv.includes("--limit") ? Number(limitArg) : undefined;

/** Parallel model calls; low enough to stay under free-tier rate limits. */
const CONCURRENCY = 3;

const main = async () => {
  if (LIMIT !== undefined && !(Number.isInteger(LIMIT) && LIMIT > 0)) {
    throw new Error(`--limit must be a positive integer, got "${limitArg}"`);
  }

  console.log("🏷️  Assign categories to uncategorized tools");
  console.log(DRY_RUN ? "   DRY RUN: nothing will be changed\n" : "");

  const categories = await prisma.category.findMany({
    select: { slug: true, name: true, label: true, description: true },
    orderBy: { name: "asc" },
  });

  if (!categories.length) {
    console.log("No categories exist yet. Create some in the admin first.");
    return;
  }

  const tools = await prisma.tool.findMany({
    where: { categories: { none: {} } },
    select: {
      id: true,
      slug: true,
      name: true,
      websiteUrl: true,
      tagline: true,
      description: true,
      content: true,
    },
    orderBy: { createdAt: "asc" },
    take: LIMIT,
  });

  console.log(
    `${categories.length} categories, ${tools.length} tools without a category\n`
  );

  const results = { assigned: 0, none: 0, skipped: 0, unprocessed: 0, failed: 0 };
  const queue = [...tools];

  const worker = async () => {
    for (let tool = queue.shift(); tool; tool = queue.shift()) {
      if (!(tool.description || tool.content)) {
        console.log(`  ⏭  ${tool.slug}: not processed yet`);
        results.unprocessed++;
        continue;
      }

      try {
        if (DRY_RUN) {
          const slugs = await suggestToolCategories(tool, categories);
          console.log(`  •  ${tool.slug}: ${slugs.join(", ") || "(none fits)"}`);
          results[slugs.length ? "assigned" : "none"]++;
          continue;
        }

        const result = await autoAssignToolCategories(tool.id);
        results[result.status]++;

        if (result.status !== "assigned") {
          console.log(`  –  ${tool.slug}: ${result.status}`);
          continue;
        }

        // Search filters by category, so the vector has to learn about it too
        const latestTool = await prisma.tool.findUniqueOrThrow({
          where: { id: tool.id },
          include: {
            categories: { select: { slug: true, name: true } },
            tags: { select: { slug: true } },
          },
        });
        await upsertHybridToolVector(latestTool);

        console.log(`  ✓  ${tool.slug}: ${result.categories.join(", ")}`);
      } catch (error) {
        results.failed++;
        console.log(
          `  ✗  ${tool.slug}: ${error instanceof Error ? error.message : error}`
        );
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log("\n📊 Summary");
  console.log(`   ${DRY_RUN ? "Would assign" : "Assigned"}: ${results.assigned}`);
  console.log(`   No fitting category: ${results.none}`);
  console.log(`   Not processed yet: ${results.unprocessed}`);
  if (results.skipped) {
    console.log(`   Got a category meanwhile: ${results.skipped}`);
  }
  console.log(`   Failed: ${results.failed}`);

  if (results.failed) {
    process.exitCode = 1;
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
