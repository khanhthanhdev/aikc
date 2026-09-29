#!/usr/bin/env bun
/**
 * Migration script: Updates tool media URLs from legacy AWS S3 to Cloudflare R2
 * and deletes the 2 decommissioned tools ('civitai', 'perplexity-ai').
 *
 * Usage:
 *   bun --env-file=.env.production scripts/migrate-media-to-r2.ts
 *   bun --env-file=.env.production scripts/migrate-media-to-r2.ts --dry-run
 */
import { PrismaClient } from "@prisma/client";

const OLD_S3_ORIGIN = "https://stukit-bucket.s3.us-east-1.amazonaws.com";
const NEW_R2_ORIGIN = "https://assets.aikc.vn";
const TOOLS_TO_DELETE = ["civitai", "perplexity-ai"];

const isDryRun = process.argv.includes("--dry-run");

const prisma = new PrismaClient();

async function main() {
  console.log(`Starting media migration to Cloudflare R2... [DryRun: ${isDryRun}]`);
  console.log(`- Old origin: ${OLD_S3_ORIGIN}`);
  console.log(`- New origin: ${NEW_R2_ORIGIN}\n`);

  // 1. Delete requested tools
  if (TOOLS_TO_DELETE.length > 0) {
    const existingToDelete = await prisma.tool.findMany({
      where: { slug: { in: TOOLS_TO_DELETE } },
      select: { slug: true, name: true },
    });

    console.log(`Found ${existingToDelete.length} tool(s) to remove: ${existingToDelete.map((t) => t.slug).join(", ") || "none"}`);

    if (!isDryRun && existingToDelete.length > 0) {
      const deleteResult = await prisma.tool.deleteMany({
        where: { slug: { in: TOOLS_TO_DELETE } },
      });
      console.log(`✓ Deleted ${deleteResult.count} tool(s) from database.\n`);
    } else if (isDryRun && existingToDelete.length > 0) {
      console.log(`[DryRun] Would delete ${existingToDelete.length} tool(s).\n`);
    }
  }

  // 2. Find all tools with S3 URLs
  const toolsWithS3 = await prisma.tool.findMany({
    where: {
      OR: [
        { faviconUrl: { contains: OLD_S3_ORIGIN } },
        { screenshotUrl: { contains: OLD_S3_ORIGIN } },
      ],
    },
    select: {
      id: true,
      slug: true,
      faviconUrl: true,
      screenshotUrl: true,
    },
  });

  console.log(`Found ${toolsWithS3.length} tool(s) needing URL migration.`);

  if (isDryRun) {
    console.log("[DryRun] Checking all tools against R2 endpoint...");
    let verifiedCount = 0;
    const failedTools: Array<{ slug: string; favStatus: number; screenStatus: number }> = [];

    for (const tool of toolsWithS3) {
      let favUrl = tool.faviconUrl?.replace(OLD_S3_ORIGIN, NEW_R2_ORIGIN);
      let screenUrl = tool.screenshotUrl?.replace(OLD_S3_ORIGIN, NEW_R2_ORIGIN);

      // Handle gemini legacy png -> webp
      if (tool.slug === "gemini" && screenUrl?.endsWith(".png")) {
        screenUrl = screenUrl.replace(".png", ".webp");
      }

      const favStatus = favUrl ? (await fetch(favUrl, { method: "HEAD" })).status : 0;
      const screenStatus = screenUrl ? (await fetch(screenUrl, { method: "HEAD" })).status : 0;

      if (favStatus === 200 && screenStatus === 200) {
        verifiedCount++;
      } else {
        failedTools.push({ slug: tool.slug, favStatus, screenStatus });
      }
    }

    console.log(`[DryRun] Total tools checked: ${toolsWithS3.length}`);
    console.log(`[DryRun] Verified 200 OK on R2: ${verifiedCount}/${toolsWithS3.length}`);
    if (failedTools.length > 0) {
      console.log("[DryRun] Tools with issues:", JSON.stringify(failedTools, null, 2));
    } else {
      console.log("[DryRun] 100% of tool assets exist and are healthy on Cloudflare R2!");
    }
    console.log("\nDry-run complete. Re-run without --dry-run to apply changes.");
    return;
  }

  let updatedCount = 0;
  for (const tool of toolsWithS3) {
    const newFaviconUrl = tool.faviconUrl?.replace(OLD_S3_ORIGIN, NEW_R2_ORIGIN);
    let newScreenshotUrl = tool.screenshotUrl?.replace(OLD_S3_ORIGIN, NEW_R2_ORIGIN);

    if (tool.slug === "gemini" && newScreenshotUrl?.endsWith(".png")) {
      newScreenshotUrl = newScreenshotUrl.replace(".png", ".webp");
    }

    await prisma.tool.update({
      where: { id: tool.id },
      data: {
        faviconUrl: newFaviconUrl,
        screenshotUrl: newScreenshotUrl,
      },
    });
    updatedCount++;
  }

  console.log(`\n✓ Successfully migrated ${updatedCount} tool(s) to R2 (${NEW_R2_ORIGIN}).`);

  // 3. Check Ads table
  const adsWithS3 = await prisma.ad.findMany({
    where: {
      faviconUrl: { contains: OLD_S3_ORIGIN },
    },
    select: { id: true, faviconUrl: true },
  });

  if (adsWithS3.length > 0) {
    for (const ad of adsWithS3) {
      await prisma.ad.update({
        where: { id: ad.id },
        data: {
          faviconUrl: ad.faviconUrl?.replace(OLD_S3_ORIGIN, NEW_R2_ORIGIN),
        },
      });
    }
    console.log(`✓ Migrated ${adsWithS3.length} ad(s) to R2.`);
  }

  // 4. Verify random 3 migrated URLs over HTTP
  console.log("\nVerifying live R2 availability for sample tools...");
  const sampleVerify = await prisma.tool.findMany({
    where: { faviconUrl: { startsWith: NEW_R2_ORIGIN } },
    select: { slug: true, faviconUrl: true, screenshotUrl: true },
    take: 3,
  });

  for (const item of sampleVerify) {
    if (item.faviconUrl) {
      const resFav = await fetch(item.faviconUrl);
      console.log(`  [${resFav.status}] ${item.slug} favicon -> ${item.faviconUrl}`);
    }
    if (item.screenshotUrl) {
      const resScreen = await fetch(item.screenshotUrl);
      console.log(`  [${resScreen.status}] ${item.slug} screenshot -> ${item.screenshotUrl}`);
    }
  }

  console.log("\nMigration completed successfully!");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
