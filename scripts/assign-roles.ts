#!/usr/bin/env bun
/**
 * Let AI match existing tools to audience roles (student, lecturer, ...) and
 * write the sample chat questions each role sees on the tool's page.
 *
 * Tools that already have roles are left alone, so admin edits survive; pass
 * --force to regenerate them anyway. Tools with no tagline, description or
 * content (not processed yet) are skipped: run "Process" on them in the admin
 * instead, which assigns roles as part of the pipeline.
 *
 * Usage:
 *   bun run roles:assign --dry-run     # Print suggestions, change nothing
 *   bun run roles:assign               # Assign roles and sample questions
 *   bun run roles:assign --limit 20    # Only the first 20 tools
 *   bun run roles:assign --force       # Also redo tools that have roles
 *   bun run roles:assign --only anki,zotero --force   # Just these slugs
 *
 * Run it after categories:assign: the model uses the categories as a hint.
 * Public pages are cached: the new roles show up once the cache is
 * revalidated (e.g. by saving any tool in the admin).
 */

import { autoAssignToolRoles, suggestToolRoles } from "~/lib/tool-roles";
import { prisma } from "~/services/prisma";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const limitArg = process.argv[process.argv.indexOf("--limit") + 1];
const LIMIT = process.argv.includes("--limit") ? Number(limitArg) : undefined;
const onlyArg = process.argv[process.argv.indexOf("--only") + 1];
const ONLY = process.argv.includes("--only")
  ? onlyArg?.split(",").filter(Boolean)
  : undefined;

/** Parallel model calls; low enough to stay under free-tier rate limits. */
const CONCURRENCY = 3;

const main = async () => {
  if (LIMIT !== undefined && !(Number.isInteger(LIMIT) && LIMIT > 0)) {
    throw new Error(`--limit must be a positive integer, got "${limitArg}"`);
  }

  console.log("🎓 Assign audience roles and sample questions to tools");
  console.log(DRY_RUN ? "   DRY RUN: nothing will be changed\n" : "");

  const tools = await prisma.tool.findMany({
    where: {
      ...(FORCE ? {} : { roles: { isEmpty: true } }),
      ...(ONLY ? { slug: { in: ONLY } } : {}),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      websiteUrl: true,
      tagline: true,
      description: true,
      content: true,
      categories: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: LIMIT,
  });

  console.log(
    `${tools.length} tools ${FORCE ? "to (re)do" : "without roles"}\n`
  );

  const results = {
    assigned: 0,
    filled: 0,
    none: 0,
    skipped: 0,
    unprocessed: 0,
    failed: 0,
  };
  const queue = [...tools];

  const worker = async () => {
    for (let tool = queue.shift(); tool; tool = queue.shift()) {
      if (!(tool.tagline || tool.description || tool.content)) {
        console.log(`  ⏭  ${tool.slug}: not processed yet`);
        results.unprocessed++;
        continue;
      }

      try {
        if (DRY_RUN) {
          const { roles, roleQuestions } = await suggestToolRoles(tool);
          console.log(`  •  ${tool.slug}: ${roles.join(", ") || "(none fits)"}`);
          const first = roles[0] && roleQuestions[roles[0]];
          if (first) {
            console.log(`       ${first.en[0] ?? ""}\n       ${first.vi[0] ?? ""}`);
          }
          results[roles.length ? "assigned" : "none"]++;
          continue;
        }

        const result = await autoAssignToolRoles(tool.id, { force: FORCE });
        results[result.status]++;

        console.log(
          result.roles.length
            ? `  ✓  ${tool.slug}: ${result.roles.join(", ")}`
            : `  –  ${tool.slug}: ${result.status}`
        );
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
  console.log(`   No fitting role: ${results.none}`);
  console.log(`   Not processed yet: ${results.unprocessed}`);
  if (results.skipped || results.filled) {
    console.log(
      `   Got roles meanwhile: ${results.skipped + results.filled} (${results.filled} given missing questions)`
    );
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
