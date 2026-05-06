#!/usr/bin/env bun
/**
 * Script to initialize Qdrant hybrid collection and index all tools
 *
 * Usage:
 *   bun run scripts/setup-qdrant.ts
 *   bun run scripts/setup-qdrant.ts --force  # Recreate collection even if exists
 */

import {
  reindexAllAlternatives,
  reindexAllCategories,
  reindexAllHybridTools,
} from "~/lib/vector-store";
import { prisma } from "~/services/prisma";
import {
  ensureAlternativesCollection,
  ensureCategoriesCollection,
  ensureSemanticCacheCollection,
  QDRANT_ALTERNATIVES_COLLECTION,
  QDRANT_CATEGORIES_COLLECTION,
  QDRANT_DENSE_VECTOR_SIZE,
  QDRANT_HYBRID_COLLECTION,
  QDRANT_SEMANTIC_CACHE_COLLECTION,
  qdrantClient,
} from "~/services/qdrant";

const FORCE_RECREATE = process.argv.includes("--force");

async function createHybridCollection() {
  console.log(`📝 Creating collection "${QDRANT_HYBRID_COLLECTION}"...`);

  // Use REST API directly since JS client doesn't support sparse_vectors config
  try {
    const response = await fetch(
      `${process.env.QDRANT_URL}/collections/${QDRANT_HYBRID_COLLECTION}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vectors: {
            dense: {
              size: QDRANT_DENSE_VECTOR_SIZE,
              distance: "Cosine",
            },
          },
          sparse_vectors: {
            sparse: {
              modifier: "idf",
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ status: { error: response.statusText } }));
      throw new Error(
        `Failed to create collection: ${error.status?.error || response.statusText}`
      );
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(`Qdrant unavailable at ${process.env.QDRANT_URL}`);
    }
    throw error;
  }

  console.log("✅ Collection created with:");
  console.log(
    "   - Dense vectors:",
    QDRANT_DENSE_VECTOR_SIZE,
    "dimensions (Cosine)"
  );
  console.log("   - Sparse vectors: IDF modifier");
}

async function main() {
  console.log("🚀 Qdrant Setup Script");
  console.log("=".repeat(50));

  // Step 1: Check if collection exists
  console.log("\n📦 Checking Qdrant collection...");
  const existsResult = await qdrantClient.collectionExists(
    QDRANT_HYBRID_COLLECTION
  );
  const exists =
    typeof existsResult === "boolean" ? existsResult : existsResult?.exists;

  if (exists && !FORCE_RECREATE) {
    console.log(`✅ Collection "${QDRANT_HYBRID_COLLECTION}" already exists`);

    // Get collection info
    const info = await qdrantClient.getCollection(QDRANT_HYBRID_COLLECTION);
    console.log("   - Points count:", info.points_count);
    console.log("   - Indexed vectors count:", info.indexed_vectors_count);

    const shouldReindex = await askForReindex();
    if (!shouldReindex) {
      console.log("\n👋 Exiting without changes");
      process.exit(0);
    }
  } else if (exists && FORCE_RECREATE) {
    console.log(
      `⚠️  Force recreating collection "${QDRANT_HYBRID_COLLECTION}"...`
    );
    await qdrantClient.deleteCollection(QDRANT_HYBRID_COLLECTION);
    await createHybridCollection();
  } else {
    await createHybridCollection();
  }

  // Step 1b: Ensure semantic cache collection exists
  console.log("\n📦 Ensuring semantic cache collection...");
  await ensureSemanticCacheCollection();
  const semanticInfo = await qdrantClient.getCollection(
    QDRANT_SEMANTIC_CACHE_COLLECTION
  );
  console.log("   - Semantic cache points:", semanticInfo.points_count);

  // Step 1c: Ensure alternatives collection exists
  console.log("\n📦 Ensuring alternatives hybrid collection...");
  await ensureAlternativesCollection();
  const alternativesInfo = await qdrantClient.getCollection(
    QDRANT_ALTERNATIVES_COLLECTION
  );
  console.log("   - Alternatives points:", alternativesInfo.points_count);

  // Step 1d: Ensure categories collection exists
  console.log("\n📦 Ensuring categories hybrid collection...");
  await ensureCategoriesCollection();
  const categoriesInfo = await qdrantClient.getCollection(
    QDRANT_CATEGORIES_COLLECTION
  );
  console.log("   - Categories points:", categoriesInfo.points_count);

  // Step 2: Count tools to index
  console.log("\n📊 Counting published tools...");
  const toolCount = await prisma.tool.count({
    where: { publishedAt: { lte: new Date() } },
  });
  console.log(`   Found ${toolCount} published tools to index`);

  if (toolCount === 0) {
    console.log("\n⚠️  No tools to index. Exiting.");
    process.exit(0);
  }

  // Step 3: Index all tools
  console.log("\n🔄 Indexing tools to hybrid collection...");
  console.log("   This may take a while depending on the number of tools...\n");

  const startTime = Date.now();
  let lastProgressUpdate = 0;

  const result = await reindexAllHybridTools((progress) => {
    const now = Date.now();
    // Update progress every 500ms or when complete
    if (
      now - lastProgressUpdate > 500 ||
      progress.processed === progress.total
    ) {
      const percent = Math.round((progress.processed / progress.total) * 100);
      const bar =
        "█".repeat(Math.floor(percent / 2)) +
        "░".repeat(50 - Math.floor(percent / 2));
      process.stdout.write(
        `\r   [${bar}] ${percent}% (${progress.processed}/${progress.total})`
      );
      lastProgressUpdate = now;
    }
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n");

  // Step 4: Report results
  console.log("=".repeat(50));
  console.log("📈 Indexing Complete!");
  console.log(`   ✅ Processed: ${result.processed}/${result.total}`);
  console.log(`   ⏱️  Duration: ${duration}s`);

  if (result.failed.length > 0) {
    console.log(`   ❌ Failed: ${result.failed.length}`);
    console.log(
      `      Failed tools: ${result.failed.slice(0, 5).join(", ")}${result.failed.length > 5 ? "..." : ""}`
    );
  }

  // Verify final tools state
  const finalInfo = await qdrantClient.getCollection(QDRANT_HYBRID_COLLECTION);
  console.log("\n📦 Final tools collection state:");
  console.log("   - Points:", finalInfo.points_count);
  console.log("   - Status:", finalInfo.status);

  // Step 4: Index alternatives
  console.log("\n🔄 Indexing alternatives collection...");
  const alternativesStartTime = Date.now();
  let alternativesLastProgressUpdate = 0;

  const alternativesResult = await reindexAllAlternatives((progress) => {
    const now = Date.now();
    if (
      now - alternativesLastProgressUpdate > 500 ||
      progress.processed === progress.total
    ) {
      const percent = Math.round((progress.processed / progress.total) * 100);
      const bar =
        "█".repeat(Math.floor(percent / 2)) +
        "░".repeat(50 - Math.floor(percent / 2));
      process.stdout.write(
        `\r   [${bar}] ${percent}% (${progress.processed}/${progress.total})`
      );
      alternativesLastProgressUpdate = now;
    }
  });

  const alternativesDuration = (
    (Date.now() - alternativesStartTime) /
    1000
  ).toFixed(1);
  console.log("\n");
  console.log(
    `   ✅ Alternatives indexed: ${alternativesResult.processed}/${alternativesResult.total}`
  );
  console.log(`   ⏱️  Duration: ${alternativesDuration}s`);

  if (alternativesResult.failed.length > 0) {
    console.log(`   ❌ Failed: ${alternativesResult.failed.length}`);
  }

  // Step 5: Index categories
  console.log("\n🔄 Indexing categories collection...");
  const categoriesStartTime = Date.now();
  let categoriesLastProgressUpdate = 0;

  const categoriesResult = await reindexAllCategories((progress) => {
    const now = Date.now();
    if (
      now - categoriesLastProgressUpdate > 500 ||
      progress.processed === progress.total
    ) {
      const percent = Math.round((progress.processed / progress.total) * 100);
      const bar =
        "█".repeat(Math.floor(percent / 2)) +
        "░".repeat(50 - Math.floor(percent / 2));
      process.stdout.write(
        `\r   [${bar}] ${percent}% (${progress.processed}/${progress.total})`
      );
      categoriesLastProgressUpdate = now;
    }
  });

  const categoriesDuration = (
    (Date.now() - categoriesStartTime) /
    1000
  ).toFixed(1);
  console.log("\n");
  console.log(
    `   ✅ Categories indexed: ${categoriesResult.processed}/${categoriesResult.total}`
  );
  console.log(`   ⏱️  Duration: ${categoriesDuration}s`);

  if (categoriesResult.failed.length > 0) {
    console.log(`   ❌ Failed: ${categoriesResult.failed.length}`);
  }

  // Final summary
  console.log(`\n${"=".repeat(50)}`);
  console.log("📈 Indexing Summary:");
  console.log(
    `   Tools: ${result.processed}/${result.total} (${result.failed.length} failed)`
  );
  console.log(
    `   Alternatives: ${alternativesResult.processed}/${alternativesResult.total} (${alternativesResult.failed.length} failed)`
  );
  console.log(
    `   Categories: ${categoriesResult.processed}/${categoriesResult.total} (${categoriesResult.failed.length} failed)`
  );

  console.log("\n✨ Done!");
}

async function askForReindex(): Promise<boolean> {
  // In non-interactive mode, default to reindexing
  if (!process.stdin.isTTY) {
    return true;
  }

  return new Promise((resolve) => {
    process.stdout.write("\n❓ Do you want to reindex all tools? (y/N): ");

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", (data) => {
      const answer = data.toString().trim().toLowerCase();
      process.stdin.setRawMode(false);
      console.log(answer);
      resolve(answer === "y" || answer === "yes");
    });
  });
}

// Run the script
main()
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    if (error.data) {
      console.error("   Details:", JSON.stringify(error.data));
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
