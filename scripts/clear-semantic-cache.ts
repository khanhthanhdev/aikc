#!/usr/bin/env bun
import {
  ensureSemanticCacheCollection,
  QDRANT_SEMANTIC_CACHE_COLLECTION,
  qdrantClient,
} from "~/services/qdrant";

async function main() {
  console.log(
    `🗑️  Clearing semantic cache collection: ${QDRANT_SEMANTIC_CACHE_COLLECTION}`
  );

  try {
    const existsResult = await qdrantClient.collectionExists(
      QDRANT_SEMANTIC_CACHE_COLLECTION
    );
    const exists =
      typeof existsResult === "boolean" ? existsResult : existsResult?.exists;

    if (exists) {
      await qdrantClient.deleteCollection(QDRANT_SEMANTIC_CACHE_COLLECTION);
      console.log("✅ Collection deleted");
    } else {
      console.log("ℹ️  Collection does not exist");
    }

    console.log("🔄 Recreating collection...");
    await ensureSemanticCacheCollection();
    console.log("✅ Semantic cache cleared and recreated successfully");
  } catch (error) {
    console.error("❌ Error clearing semantic cache:", error);
    process.exit(1);
  }
}

main();
