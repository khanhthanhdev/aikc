#!/usr/bin/env bun
/**
 * Script to populate related tools for all published tools in the database.
 *
 * This script calculates and persists the 3 most relevant related tools for
 * each published tool using Qdrant vector similarity.
 *
 * Usage:
 *   bun run scripts/populate-related-tools.ts              # Process all tools
 *   bun run scripts/populate-related-tools.ts --dry-run    # Preview without making changes
 *   bun run scripts/populate-related-tools.ts --force      # Overwrite existing related tools
 *   bun run scripts/populate-related-tools.ts --tool=slug  # Process a single tool by slug
 */

import { updateToolRelatedTools } from "~/lib/related-tools";
import { prisma } from "~/services/prisma";
import { ensureHybridCollection } from "~/services/qdrant";

// Parse command line arguments
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const SINGLE_TOOL = process.argv
  .find((arg) => arg.startsWith("--tool="))
  ?.split("=")[1];

// Processing configuration
const BATCH_SIZE = 5; // Process tools in parallel batches
const DELAY_BETWEEN_BATCHES_MS = 100; // Small delay to avoid overwhelming Qdrant

interface ProcessingResult {
  failed: string[];
  processed: number;
  skipped: number;
  total: number;
}

async function processToolRelatedTools(
  toolId: string,
  toolSlug: string,
  hasExisting: boolean
): Promise<"processed" | "skipped" | "failed"> {
  // Skip if tool already has related tools and we're not forcing
  if (hasExisting && !FORCE) {
    return "skipped";
  }

  if (DRY_RUN) {
    console.log(`   [DRY-RUN] Would update related tools for: ${toolSlug}`);
    return "processed";
  }

  try {
    const relatedToolIds = await updateToolRelatedTools(toolId);
    console.log(`   ✅ ${toolSlug}: ${relatedToolIds.length} related tools`);
    return "processed";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ ${toolSlug}: ${message}`);
    return "failed";
  }
}

async function processSingleTool(slug: string): Promise<void> {
  console.log(`\n🔍 Looking up tool: ${slug}`);

  const tool = await prisma.tool.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      relatedTools: true,
      publishedAt: true,
    },
  });

  if (!tool) {
    console.log(`❌ Tool not found: ${slug}`);
    process.exit(1);
  }

  console.log(`📦 Found tool: ${tool.name}`);
  console.log(`   Published: ${tool.publishedAt ? "Yes" : "No"}`);
  console.log(`   Current related tools: ${tool.relatedTools.length}`);

  if (!tool.publishedAt) {
    console.log(
      "\n⚠️  Tool is not published. Related tools will still be calculated."
    );
  }

  const result = await processToolRelatedTools(
    tool.id,
    tool.slug,
    tool.relatedTools.length > 0
  );

  if (result === "processed") {
    // Fetch and display the updated related tools
    const updated = await prisma.tool.findUnique({
      where: { id: tool.id },
      select: {
        relatedTools: true,
      },
    });

    if (updated?.relatedTools.length) {
      console.log("\n📊 Related tool IDs:");

      // Fetch the related tool details
      const relatedDetails = await prisma.tool.findMany({
        where: { id: { in: updated.relatedTools } },
        select: { id: true, name: true, slug: true },
      });

      for (const related of relatedDetails) {
        console.log(`   - ${related.name} (${related.slug})`);
      }
    }
  }
}

async function processAllTools(): Promise<ProcessingResult> {
  // Fetch all published tools
  console.log("\n📊 Fetching published tools...");
  const tools = await prisma.tool.findMany({
    where: { publishedAt: { lte: new Date() } },
    select: {
      id: true,
      slug: true,
      name: true,
      relatedTools: true,
    },
    orderBy: { name: "asc" },
  });

  console.log(`   Found ${tools.length} published tools`);

  const result: ProcessingResult = {
    processed: 0,
    skipped: 0,
    failed: [],
    total: tools.length,
  };

  if (tools.length === 0) {
    console.log("\n⚠️  No tools to process. Exiting.");
    return result;
  }

  // Calculate how many have existing related tools
  const withRelated = tools.filter((t) => t.relatedTools.length > 0);
  console.log(`   ${withRelated.length} tools already have related tools`);

  if (!FORCE && withRelated.length === tools.length) {
    console.log(
      "\n✅ All tools already have related tools. Use --force to reprocess."
    );
    result.skipped = tools.length;
    return result;
  }

  // Process tools
  console.log("\n🔄 Processing tools...");
  console.log(`   ${"=".repeat(48)}`);

  const startTime = Date.now();

  for (let i = 0; i < tools.length; i += BATCH_SIZE) {
    const batch = tools.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (tool) => {
        const status = await processToolRelatedTools(
          tool.id,
          tool.slug,
          tool.relatedTools.length > 0
        );
        return { toolSlug: tool.slug, status };
      })
    );

    for (const { toolSlug, status } of batchResults) {
      switch (status) {
        case "processed":
          result.processed++;
          break;
        case "skipped":
          result.skipped++;
          break;
        case "failed":
          result.failed.push(toolSlug);
          break;
      }
    }

    // Progress update
    const progress = i + batch.length;
    const percent = Math.round((progress / tools.length) * 100);
    const bar =
      "█".repeat(Math.floor(percent / 2)) +
      "░".repeat(50 - Math.floor(percent / 2));
    process.stdout.write(
      `\r   [${bar}] ${percent}% (${progress}/${tools.length})`
    );

    // Small delay between batches
    if (i + BATCH_SIZE < tools.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS)
      );
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n");
  console.log(`   ⏱️  Duration: ${duration}s`);

  return result;
}

async function main() {
  console.log("🚀 Related Tools Population Script");
  console.log("=".repeat(50));

  if (DRY_RUN) {
    console.log("⚠️  DRY-RUN mode: No changes will be made");
  }
  if (FORCE) {
    console.log("⚠️  FORCE mode: Overwriting existing related tools");
  }

  // Ensure Qdrant collection exists
  console.log("\n📦 Checking Qdrant collection...");
  await ensureHybridCollection();
  console.log("   ✅ Qdrant hybrid collection ready");

  // Process single tool or all tools
  if (SINGLE_TOOL) {
    await processSingleTool(SINGLE_TOOL);
  } else {
    const result = await processAllTools();

    // Report results
    console.log("=".repeat(50));
    console.log("📈 Processing Complete!");
    console.log(`   ✅ Processed: ${result.processed}`);
    console.log(`   ⏭️  Skipped: ${result.skipped}`);

    if (result.failed.length > 0) {
      console.log(`   ❌ Failed: ${result.failed.length}`);
      console.log(
        `      Failed tools: ${result.failed.slice(0, 5).join(", ")}${result.failed.length > 5 ? "..." : ""}`
      );
    }
  }

  console.log("\n✨ Done!");
}

// Run the script
main()
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
