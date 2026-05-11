import { QdrantClient } from "@qdrant/js-client-rest";
import { env, isDev } from "~/env";

const isSecureQdrantUrl = env.QDRANT_URL.startsWith("https://");
const qdrantApiKey = isSecureQdrantUrl ? env.QDRANT_API_KEY : undefined;
const qdrantJsonHeaders: HeadersInit = {
  "Content-Type": "application/json",
  ...(qdrantApiKey ? { "api-key": qdrantApiKey } : {}),
};

export const qdrantClient = new QdrantClient({
  url: env.QDRANT_URL,
  checkCompatibility: false,
  ...(qdrantApiKey ? { apiKey: qdrantApiKey } : {}),
});

export const QDRANT_TOOLS_COLLECTION = "tools";
export const QDRANT_SEMANTIC_CACHE_COLLECTION = "semantic_cache";
export const QDRANT_SEMANTIC_CACHE_SCORE_THRESHOLD = 0.92;
// Hybrid collection with separate name
export const QDRANT_HYBRID_COLLECTION = "tools_hybrid";
// Alternatives and categories collections
export const QDRANT_ALTERNATIVES_COLLECTION = "alternatives_hybrid";
export const QDRANT_CATEGORIES_COLLECTION = "categories_hybrid";
// Dense vector size — driven by the local embedding model
export const QDRANT_DENSE_VECTOR_SIZE = Number(
  env.INFINITY_EMBEDDING_DIMENSIONS
);
export const QDRANT_TOOLS_VECTOR_SIZE = QDRANT_DENSE_VECTOR_SIZE;

let ensureToolsCollectionPromise: Promise<void> | null = null;

/**
 * Ensures the legacy tools collection exists (backward compatibility)
 * @deprecated Use ensureHybridCollection for new implementations
 */
export const ensureToolsCollection = async () => {
  if (!ensureToolsCollectionPromise) {
    ensureToolsCollectionPromise = (async () => {
      const existsResult = await qdrantClient.collectionExists(
        QDRANT_TOOLS_COLLECTION
      );
      const exists =
        typeof existsResult === "boolean" ? existsResult : existsResult?.exists;

      if (!exists) {
        if (isDev) {
          console.log(`Creating tools collection: ${QDRANT_TOOLS_COLLECTION}`);
        }
        await qdrantClient.createCollection(QDRANT_TOOLS_COLLECTION, {
          vectors: {
            size: QDRANT_TOOLS_VECTOR_SIZE,
            distance: "Cosine",
          },
        });
        if (isDev) {
          console.log("Tools collection created successfully");
        }
      }
    })();
  }

  return ensureToolsCollectionPromise;
};

let ensureHybridCollectionPromise: Promise<void> | null = null;

let ensureSemanticCacheCollectionPromise: Promise<void> | null = null;

export const ensureSemanticCacheCollection = async () => {
  if (!ensureSemanticCacheCollectionPromise) {
    ensureSemanticCacheCollectionPromise = (async () => {
      const existsResult = await qdrantClient.collectionExists(
        QDRANT_SEMANTIC_CACHE_COLLECTION
      );
      const exists =
        typeof existsResult === "boolean" ? existsResult : existsResult?.exists;

      if (!exists) {
        if (isDev) {
          console.log(
            `Creating semantic cache collection: ${QDRANT_SEMANTIC_CACHE_COLLECTION}`
          );
        }
        await qdrantClient.createCollection(QDRANT_SEMANTIC_CACHE_COLLECTION, {
          vectors: {
            size: QDRANT_DENSE_VECTOR_SIZE,
            distance: "Cosine",
          },
        });
        if (isDev) {
          console.log("Semantic cache collection created successfully");
        }

        if (isDev) {
          console.log("Creating toolSlug index...");
        }
        await qdrantClient.createPayloadIndex(
          QDRANT_SEMANTIC_CACHE_COLLECTION,
          {
            field_name: "toolSlug",
            field_schema: "keyword",
          }
        );

        if (isDev) {
          console.log("Creating type index...");
        }
        await qdrantClient.createPayloadIndex(
          QDRANT_SEMANTIC_CACHE_COLLECTION,
          {
            field_name: "type",
            field_schema: "keyword",
          }
        );
      }
    })();
  }

  return ensureSemanticCacheCollectionPromise;
};

/**
 * Ensures the hybrid collection exists with both dense and sparse vector configs
 * Uses named vectors for Qdrant hybrid search with RRF fusion
 */
export const ensureHybridCollection = async () => {
  if (!ensureHybridCollectionPromise) {
    ensureHybridCollectionPromise = (async () => {
      const existsResult = await qdrantClient.collectionExists(
        QDRANT_HYBRID_COLLECTION
      );
      // Qdrant client returns { exists: boolean } object
      const exists =
        typeof existsResult === "boolean" ? existsResult : existsResult?.exists;

      if (!exists) {
        if (isDev) {
          console.log(
            `Creating hybrid collection: ${QDRANT_HYBRID_COLLECTION}`
          );
        }
        // Use REST API directly since JS client doesn't support sparse_vectors config
        try {
          const response = await fetch(
            `${env.QDRANT_URL}/collections/${QDRANT_HYBRID_COLLECTION}`,
            {
              method: "PUT",
              headers: qdrantJsonHeaders,
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
          if (isDev) {
            console.log("Hybrid collection created successfully");
          }
        } catch (error) {
          if (error instanceof TypeError && error.message.includes("fetch")) {
            throw new Error(`Qdrant unavailable at ${env.QDRANT_URL}`);
          }
          throw error;
        }
      }
    })();
  }

  return ensureHybridCollectionPromise;
};

/**
 * Recreates the hybrid collection (useful for schema migrations)
 * WARNING: This will delete all existing data in the collection
 */
export const recreateHybridCollection = async () => {
  const existsResult = await qdrantClient.collectionExists(
    QDRANT_HYBRID_COLLECTION
  );
  const exists =
    typeof existsResult === "boolean" ? existsResult : existsResult?.exists;

  if (exists) {
    await qdrantClient.deleteCollection(QDRANT_HYBRID_COLLECTION);
  }

  // Reset the promise so it creates fresh
  ensureHybridCollectionPromise = null;
  await ensureHybridCollection();
};

// ============================================================================
// Alternatives Collection
// ============================================================================

let ensureAlternativesCollectionPromise: Promise<void> | null = null;

/**
 * Ensures the alternatives hybrid collection exists with both dense and sparse vector configs
 * Uses named vectors for Qdrant hybrid search with RRF fusion
 */
export const ensureAlternativesCollection = async () => {
  if (!ensureAlternativesCollectionPromise) {
    ensureAlternativesCollectionPromise = (async () => {
      const existsResult = await qdrantClient.collectionExists(
        QDRANT_ALTERNATIVES_COLLECTION
      );
      const exists =
        typeof existsResult === "boolean" ? existsResult : existsResult?.exists;

      if (!exists) {
        if (isDev) {
          console.log(
            `Creating alternatives hybrid collection: ${QDRANT_ALTERNATIVES_COLLECTION}`
          );
        }
        // Use REST API directly since JS client doesn't support sparse_vectors config
        try {
          const response = await fetch(
            `${env.QDRANT_URL}/collections/${QDRANT_ALTERNATIVES_COLLECTION}`,
            {
              method: "PUT",
              headers: qdrantJsonHeaders,
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
          if (isDev) {
            console.log("Alternatives hybrid collection created successfully");
          }
        } catch (error) {
          if (error instanceof TypeError && error.message.includes("fetch")) {
            throw new Error(`Qdrant unavailable at ${env.QDRANT_URL}`);
          }
          throw error;
        }
      }
    })();
  }

  return ensureAlternativesCollectionPromise;
};

/**
 * Recreates the alternatives hybrid collection (useful for schema migrations)
 * WARNING: This will delete all existing data in the collection
 */
export const recreateAlternativesCollection = async () => {
  const existsResult = await qdrantClient.collectionExists(
    QDRANT_ALTERNATIVES_COLLECTION
  );
  const exists =
    typeof existsResult === "boolean" ? existsResult : existsResult?.exists;

  if (exists) {
    await qdrantClient.deleteCollection(QDRANT_ALTERNATIVES_COLLECTION);
  }

  // Reset the promise so it creates fresh
  ensureAlternativesCollectionPromise = null;
  await ensureAlternativesCollection();
};

// ============================================================================
// Categories Collection
// ============================================================================

let ensureCategoriesCollectionPromise: Promise<void> | null = null;

/**
 * Ensures the categories hybrid collection exists with both dense and sparse vector configs
 * Uses named vectors for Qdrant hybrid search with RRF fusion
 */
export const ensureCategoriesCollection = async () => {
  if (!ensureCategoriesCollectionPromise) {
    ensureCategoriesCollectionPromise = (async () => {
      const existsResult = await qdrantClient.collectionExists(
        QDRANT_CATEGORIES_COLLECTION
      );
      const exists =
        typeof existsResult === "boolean" ? existsResult : existsResult?.exists;

      if (!exists) {
        if (isDev) {
          console.log(
            `Creating categories hybrid collection: ${QDRANT_CATEGORIES_COLLECTION}`
          );
        }
        // Use REST API directly since JS client doesn't support sparse_vectors config
        try {
          const response = await fetch(
            `${env.QDRANT_URL}/collections/${QDRANT_CATEGORIES_COLLECTION}`,
            {
              method: "PUT",
              headers: qdrantJsonHeaders,
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
          if (isDev) {
            console.log("Categories hybrid collection created successfully");
          }
        } catch (error) {
          if (error instanceof TypeError && error.message.includes("fetch")) {
            throw new Error(`Qdrant unavailable at ${env.QDRANT_URL}`);
          }
          throw error;
        }
      }
    })();
  }

  return ensureCategoriesCollectionPromise;
};

/**
 * Recreates the categories hybrid collection (useful for schema migrations)
 * WARNING: This will delete all existing data in the collection
 */
export const recreateCategoriesCollection = async () => {
  const existsResult = await qdrantClient.collectionExists(
    QDRANT_CATEGORIES_COLLECTION
  );
  const exists =
    typeof existsResult === "boolean" ? existsResult : existsResult?.exists;

  if (exists) {
    await qdrantClient.deleteCollection(QDRANT_CATEGORIES_COLLECTION);
  }

  // Reset the promise so it creates fresh
  ensureCategoriesCollectionPromise = null;
  await ensureCategoriesCollection();
};

// ============================================================================
// Search Cache Collection (In-Memory for Speed)
// ============================================================================

export const QDRANT_SEARCH_CACHE_COLLECTION = "search_cache_memory";

let ensureSearchCacheCollectionPromise: Promise<void> | null = null;

export const ensureSearchCacheCollection = async () => {
  if (!ensureSearchCacheCollectionPromise) {
    ensureSearchCacheCollectionPromise = (async () => {
      const existsResult = await qdrantClient.collectionExists(
        QDRANT_SEARCH_CACHE_COLLECTION
      );
      const exists =
        typeof existsResult === "boolean" ? existsResult : existsResult?.exists;

      if (!exists) {
        if (isDev) {
          console.log(
            `Creating search cache collection: ${QDRANT_SEARCH_CACHE_COLLECTION}`
          );
        }
        await qdrantClient.createCollection(QDRANT_SEARCH_CACHE_COLLECTION, {
          vectors: {
            size: QDRANT_DENSE_VECTOR_SIZE,
            distance: "Cosine",
            on_disk: false, // Forces vectors to stay in RAM for speed
          },
          // We can also configure optimizers to keep segments in RAM,
          // but on_disk: false for vectors is the primary key for "in-memory for faster"
        });
        if (isDev) {
          console.log("Search cache collection created successfully");
        }
      }
    })();
  }

  return ensureSearchCacheCollectionPromise;
};
