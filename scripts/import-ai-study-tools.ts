#!/usr/bin/env bun
/**
 * Script to import AI study tools from data file (like user submissions)
 * Tools will be saved to the queue and wait for admin to process them
 *
 * Usage:
 *   bun run scripts/import-ai-study-tools.ts
 *   bun run scripts/import-ai-study-tools.ts --skip-validation  # Skip link validation
 *   bun run scripts/import-ai-study-tools.ts --dry-run  # Don't create tools, just validate
 */

import { slugify } from "@curiousleaf/utils";
import { aiStudyTools } from "~/data/ai-study-tools";
import { validateLink } from "~/lib/link-validator";
import { prisma } from "~/services/prisma";

const SKIP_VALIDATION = process.argv.includes("--skip-validation");
const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Generates a unique slug by adding a numeric suffix if needed
 */
const generateUniqueSlug = async (baseName: string): Promise<string> => {
  const baseSlug = slugify(baseName);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    // Check if slug exists
    if (!(await prisma.tool.findUnique({ where: { slug } }))) {
      return slug;
    }

    // Add/increment suffix and try again
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
};

/**
 * Submit a single tool (same logic as submitTool action)
 */
const submitTool = async (toolData: (typeof aiStudyTools)[0]) => {
  // Validate that the link is reachable
  if (!SKIP_VALIDATION) {
    const linkValidation = await validateLink(toolData.websiteUrl);
    if (!linkValidation.isValid) {
      throw new Error(
        linkValidation.error === "URL points to private/internal network"
          ? "Invalid URL: cannot submit internal/private network addresses"
          : `We couldn't reach this link: ${linkValidation.error}`
      );
    }
  }

  // Check if the tool already exists
  const existingTool = await prisma.tool.findFirst({
    where: { websiteUrl: toolData.websiteUrl },
  });

  // If the tool exists, return it
  if (existingTool) {
    return { tool: existingTool, isNew: false };
  }

  if (DRY_RUN) {
    const slug = await generateUniqueSlug(toolData.name);
    return {
      tool: { id: "dry-run", slug, name: toolData.name } as any,
      isNew: true,
    };
  }

  // Generate a unique slug
  const slug = await generateUniqueSlug(toolData.name);

  // Save the tool to the database
  // Tool is saved to queue - admin will trigger pipeline via "Process" action
  const tool = await prisma.tool.create({
    data: { ...toolData, slug },
  });

  return { tool, isNew: true };
};

async function main() {
  console.log("🚀 AI Study Tools Import Script");
  console.log("=".repeat(50));
  console.log(`📊 Found ${aiStudyTools.length} tools to import`);
  console.log(
    `🔧 Mode: ${DRY_RUN ? "DRY RUN" : "IMPORT (waiting for admin to process)"}`
  );
  console.log(`🔗 Link validation: ${SKIP_VALIDATION ? "SKIPPED" : "ENABLED"}`);
  console.log("");

  const results = {
    total: aiStudyTools.length,
    created: 0,
    existing: 0,
    failed: 0,
  };

  const failedTools: Array<{ name: string; error: string }> = [];

  for (let i = 0; i < aiStudyTools.length; i++) {
    const toolData = aiStudyTools[i];
    const progress = `[${i + 1}/${aiStudyTools.length}]`;

    try {
      console.log(`${progress} Processing: ${toolData.name}`);
      console.log(`  URL: ${toolData.websiteUrl}`);

      const { tool, isNew } = await submitTool(toolData);

      if (isNew) {
        console.log(`  ✓ Tool created: ${tool.slug}`);
        console.log(
          `  📋 Tool saved to queue - admin will process via "Process" action`
        );
        results.created++;
      } else {
        console.log(`  ⚠️  Tool already exists: ${tool.slug}`);
        results.existing++;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Failed: ${errorMessage}`);
      results.failed++;
      failedTools.push({ name: toolData.name, error: errorMessage });
    }

    console.log("");
  }

  // Summary
  console.log("=".repeat(50));
  console.log("📈 Import Summary");
  console.log(`   Total: ${results.total}`);
  console.log(`   ✅ Created: ${results.created}`);
  console.log(`   ⚠️  Existing: ${results.existing}`);
  console.log(`   ❌ Failed: ${results.failed}`);

  if (failedTools.length > 0) {
    console.log("\n❌ Failed Tools:");
    failedTools.forEach(({ name, error }) => {
      console.log(`   - ${name}: ${error}`);
    });
  }

  if (DRY_RUN) {
    console.log("\n⚠️  DRY RUN MODE: No tools were actually created");
  } else if (results.created > 0) {
    console.log("\n💡 Next Steps:");
    console.log("   1. Go to admin panel");
    console.log("   2. Select the newly created tools");
    console.log("   3. Click 'Process' to trigger the pipeline");
  }

  console.log("\n✨ Done!");
}

// Run the script
main()
  .catch((error) => {
    console.error(
      "\n❌ Fatal Error:",
      error instanceof Error ? error.message : error
    );
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
