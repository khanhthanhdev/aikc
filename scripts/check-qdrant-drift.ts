#!/usr/bin/env bun
/**
 * Script to detect drift between Prisma database and Qdrant collections
 *
 * Checks:
 * - Alternatives: Tools in Prisma vs vectors in Qdrant
 * - Categories: Categories in Prisma vs vectors in Qdrant
 *
 * Usage:
 *   bun run scripts/check-qdrant-drift.ts
 */

import crypto from "node:crypto";
import { prisma } from "~/services/prisma";
import {
  ensureAlternativesCollection,
  ensureCategoriesCollection,
  ensureHybridCollection,
  QDRANT_ALTERNATIVES_COLLECTION,
  QDRANT_CATEGORIES_COLLECTION,
  QDRANT_HYBRID_COLLECTION,
  qdrantClient,
} from "~/services/qdrant";

// Convert string ID to a valid UUID for Qdrant
const _toUUID = (id: string): string => {
  const hash = crypto.createHash("md5").update(id).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
};

interface DriftReport {
  collection: string;
  driftPercentage: number;
  extraInQdrant: string[];
  missingInQdrant: string[];
  totalInPrisma: number;
  totalInQdrant: number;
}

async function checkHybridDrift(): Promise<DriftReport> {
  console.log("🔍 Checking hybrid tools drift...");

  await ensureHybridCollection();

  // Get all published tools from Prisma
  const tools = await prisma.tool.findMany({
    where: { publishedAt: { lte: new Date() } },
    select: { id: true, slug: true },
  });

  // Get all points from Qdrant hybrid collection
  const qdrantPoints = await qdrantClient.scroll(QDRANT_HYBRID_COLLECTION, {
    limit: 10_000,
    with_payload: true,
  });

  const prismaIds = new Set(tools.map((t) => t.id));
  const qdrantIds = new Set(
    qdrantPoints.points
      .map((p) => {
        const payload = p.payload as { id?: string } | undefined;
        return payload?.id;
      })
      .filter((id): id is string => Boolean(id))
  );

  // Find missing and extra
  const missingInQdrant = tools
    .filter((t) => !qdrantIds.has(t.id))
    .map((t) => t.slug);
  const extraInQdrant = Array.from(qdrantIds).filter(
    (id) => !prismaIds.has(id)
  );

  const driftPercentage =
    ((missingInQdrant.length + extraInQdrant.length) / tools.length) * 100;

  return {
    collection: "tools_hybrid",
    missingInQdrant,
    extraInQdrant,
    totalInPrisma: tools.length,
    totalInQdrant: qdrantIds.size,
    driftPercentage,
  };
}

async function checkAlternativesDrift(): Promise<DriftReport> {
  console.log("🔍 Checking alternatives drift...");

  await ensureAlternativesCollection();

  // Get all published tools from Prisma (these are potential alternatives)
  const tools = await prisma.tool.findMany({
    where: { publishedAt: { lte: new Date() } },
    select: { id: true, slug: true },
  });

  // Get all points from Qdrant alternatives collection
  const qdrantPoints = await qdrantClient.scroll(
    QDRANT_ALTERNATIVES_COLLECTION,
    {
      limit: 10_000, // Adjust if you have more than 10k alternatives
      with_payload: true,
    }
  );

  const prismaIds = new Set(tools.map((t) => t.id));
  const qdrantIds = new Set(
    qdrantPoints.points
      .map((p) => {
        const payload = p.payload as { id?: string } | undefined;
        return payload?.id;
      })
      .filter((id): id is string => Boolean(id))
  );

  // Find missing and extra
  const missingInQdrant = tools
    .filter((t) => !qdrantIds.has(t.id))
    .map((t) => t.slug);
  const extraInQdrant = Array.from(qdrantIds).filter(
    (id) => !prismaIds.has(id)
  );

  const driftPercentage =
    ((missingInQdrant.length + extraInQdrant.length) / tools.length) * 100;

  return {
    collection: "alternatives",
    missingInQdrant,
    extraInQdrant,
    totalInPrisma: tools.length,
    totalInQdrant: qdrantIds.size,
    driftPercentage,
  };
}

async function checkCategoriesDrift(): Promise<DriftReport> {
  console.log("🔍 Checking categories drift...");

  await ensureCategoriesCollection();

  // Get all categories from Prisma
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true },
  });

  // Get all points from Qdrant categories collection
  const qdrantPoints = await qdrantClient.scroll(QDRANT_CATEGORIES_COLLECTION, {
    limit: 10_000, // Adjust if you have more than 10k categories
    with_payload: true,
  });

  const prismaIds = new Set(categories.map((c) => c.id));
  const qdrantIds = new Set(
    qdrantPoints.points
      .map((p) => {
        const payload = p.payload as { id?: string } | undefined;
        return payload?.id;
      })
      .filter((id): id is string => Boolean(id))
  );

  // Find missing and extra
  const missingInQdrant = categories
    .filter((c) => !qdrantIds.has(c.id))
    .map((c) => c.slug);
  const extraInQdrant = Array.from(qdrantIds).filter(
    (id) => !prismaIds.has(id)
  );

  const driftPercentage =
    ((missingInQdrant.length + extraInQdrant.length) / categories.length) * 100;

  return {
    collection: "categories",
    missingInQdrant,
    extraInQdrant,
    totalInPrisma: categories.length,
    totalInQdrant: qdrantIds.size,
    driftPercentage,
  };
}

function printReport(report: DriftReport) {
  console.log(
    `\n📊 ${report.collection.toUpperCase()} Collection Drift Report`
  );
  console.log("=".repeat(50));
  console.log(`Total in Prisma: ${report.totalInPrisma}`);
  console.log(`Total in Qdrant: ${report.totalInQdrant}`);
  console.log(`Drift: ${report.driftPercentage.toFixed(2)}%`);

  if (report.missingInQdrant.length > 0) {
    console.log(`\n❌ Missing in Qdrant (${report.missingInQdrant.length}):`);
    report.missingInQdrant.slice(0, 10).forEach((slug) => {
      console.log(`   - ${slug}`);
    });
    if (report.missingInQdrant.length > 10) {
      console.log(`   ... and ${report.missingInQdrant.length - 10} more`);
    }
  }

  if (report.extraInQdrant.length > 0) {
    console.log(`\n⚠️  Extra in Qdrant (${report.extraInQdrant.length}):`);
    report.extraInQdrant.slice(0, 10).forEach((id) => {
      console.log(`   - ${id}`);
    });
    if (report.extraInQdrant.length > 10) {
      console.log(`   ... and ${report.extraInQdrant.length - 10} more`);
    }
  }

  if (
    report.missingInQdrant.length === 0 &&
    report.extraInQdrant.length === 0
  ) {
    console.log("\n✅ No drift detected! Collections are in sync.");
  }
}

async function main() {
  console.log("🔍 Qdrant Drift Detection");
  console.log("=".repeat(50));

  try {
    const [alternativesReport, categoriesReport, hybridReport] =
      await Promise.all([
        checkAlternativesDrift(),
        checkCategoriesDrift(),
        checkHybridDrift(),
      ]);

    printReport(hybridReport);
    printReport(alternativesReport);
    printReport(categoriesReport);

    // Exit with error code if there's significant drift
    const hasDrift =
      alternativesReport.missingInQdrant.length > 0 ||
      alternativesReport.extraInQdrant.length > 0 ||
      categoriesReport.missingInQdrant.length > 0 ||
      categoriesReport.extraInQdrant.length > 0 ||
      hybridReport.missingInQdrant.length > 0 ||
      hybridReport.extraInQdrant.length > 0;

    if (hasDrift) {
      console.log("\n⚠️  Drift detected. Consider running reindexing:");
      console.log("   - Reindex hybrid: Use reindexAllHybridTools()");
      console.log("   - Reindex alternatives: Use reindexAllAlternatives()");
      console.log("   - Reindex categories: Use reindexAllCategories()");
      process.exit(1);
    } else {
      console.log("\n✅ All collections are in sync!");
      process.exit(0);
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
