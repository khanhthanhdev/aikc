import crypto from "node:crypto";
import type { Category, Tag, Tool } from "@prisma/client";
import type { Schemas } from "@qdrant/js-client-rest";
import { getSearchConfig } from "~/config/search";
import { isDev } from "~/env";
import { getCachedEmbedding } from "~/lib/embedding-cache";
import { createLogger } from "~/lib/logger";
import { EMBEDDING_MODEL, generateEmbedding } from "~/services/embedding";
import { prisma } from "~/services/prisma";
import {
  ensureAlternativesCollection,
  ensureCategoriesCollection,
  ensureHybridCollection,
  ensureToolsCollection,
  QDRANT_ALTERNATIVES_COLLECTION,
  QDRANT_CATEGORIES_COLLECTION,
  QDRANT_DENSE_VECTOR_SIZE,
  QDRANT_HYBRID_COLLECTION,
  QDRANT_TOOLS_COLLECTION,
  QDRANT_TOOLS_VECTOR_SIZE,
  qdrantClient,
} from "~/services/qdrant";

const log = createLogger("vector-store");
const embeddingCacheConfig = getSearchConfig("public").embeddingCache;

const getQueryEmbedding = async (
  query: string,
  outputDimensionality: number
) => {
  const { vector } = await getCachedEmbedding(
    { query, model: EMBEDDING_MODEL, dimensions: outputDimensionality },
    () =>
      generateEmbedding(query, {
        outputDimensionality,
      }),
    embeddingCacheConfig
  );

  return vector;
};

// ============================================================================
// BM25-based Sparse Embedding (Pure TypeScript, no native deps)
// ============================================================================

/**
 * Simple tokenizer for BM25 sparse vectors
 * Splits text into lowercase words, removes punctuation
 */
const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
};

/**
 * Creates a simple hash for a token to map to a sparse vector index
 * Uses a fixed vocabulary size for consistent indexing
 */
const SPARSE_VOCAB_SIZE = 30_000;
const tokenToIndex = (token: string): number => {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % SPARSE_VOCAB_SIZE;
};

/**
 * Generates BM25-style sparse vector embedding
 * Uses term frequency with simple normalization
 */
const generateSparseEmbedding = (
  text: string
): { indices: number[]; values: number[] } => {
  const tokens = tokenize(text);
  const termFreq = new Map<number, number>();

  // Count term frequencies
  for (const token of tokens) {
    const idx = tokenToIndex(token);
    termFreq.set(idx, (termFreq.get(idx) || 0) + 1);
  }

  // Convert to sparse format with TF normalization
  const docLength = tokens.length;
  const avgDocLength = 100; // Approximate average document length
  const k1 = 1.2; // BM25 parameter
  const b = 0.75; // BM25 parameter

  const indices: number[] = [];
  const values: number[] = [];

  for (const [idx, tf] of termFreq) {
    // BM25-style term frequency saturation
    const normalizedTf =
      (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgDocLength)));
    indices.push(idx);
    values.push(normalizedTf);
  }

  return { indices, values };
};

// Convert string ID to a valid UUID for Qdrant
const toUUID = (id: string): string => {
  const hash = crypto.createHash("md5").update(id).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
};

type ToolWithRelations = Tool & {
  categories: Pick<Category, "slug" | "name">[];
  tags: Pick<Tag, "slug">[];
};

export interface ToolVectorPayload {
  categories: string[];
  content: string | null;
  description: string | null;
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  tags: string[];
  websiteUrl: string;
  [key: string]: unknown;
}

export interface ToolVectorMatch {
  id: string;
  payload: ToolVectorPayload;
  score: number;
}

const serializeToolPayload = (tool: ToolWithRelations): ToolVectorPayload => ({
  id: tool.id,
  slug: tool.slug,
  name: tool.name,
  tagline: tool.tagline ?? null,
  description: tool.description ?? null,
  content: tool.content ?? null,
  websiteUrl: tool.websiteUrl,
  categories: tool.categories?.map((category) => category.slug) ?? [],
  tags: tool.tags?.map((tag) => tag.slug) ?? [],
});

const buildToolDocument = (tool: ToolWithRelations) =>
  [
    tool.name,
    tool.tagline,
    tool.description,
    tool.content,
    tool.tags?.map((tag) => tag.slug).join(", "),
    tool.categories?.map((category) => category.slug).join(", "),
  ]
    .filter(Boolean)
    .join("\n\n");

const buildFilter = (options: {
  category?: string;
}): Schemas["Filter"] | undefined => {
  const must: Schemas["Condition"][] = [];

  if (options.category) {
    must.push({
      key: "categories",
      match: { any: [options.category] },
    } as Schemas["FieldCondition"]);
  }

  if (!must.length) {
    return undefined;
  }

  return { must };
};

export const upsertToolVector = async (tool: ToolWithRelations) => {
  log.debug(`Upserting vector for tool: ${tool.slug}`);
  await ensureToolsCollection();

  const document = buildToolDocument(tool);
  log.debug(`Document length: ${document.length} chars`);

  const vector = await generateEmbedding(document, {
    outputDimensionality: QDRANT_TOOLS_VECTOR_SIZE,
  });
  log.debug(`Generated embedding with ${vector.length} dimensions`);

  try {
    await qdrantClient.upsert(QDRANT_TOOLS_COLLECTION, {
      wait: true,
      points: [
        {
          id: toUUID(tool.id),
          vector, // Default (unnamed) vector
          payload: serializeToolPayload(tool),
        },
      ],
    });
    log.info(`Vector upserted for tool: ${tool.slug}`);
  } catch (error) {
    log.error(`Failed to upsert vector for tool: ${tool.slug}`, { error });
    throw error;
  }
};

export const deleteToolVector = async (toolId: string) => {
  await ensureToolsCollection();

  try {
    await qdrantClient.delete(QDRANT_TOOLS_COLLECTION, {
      points: [toUUID(toolId)],
    });
  } catch (_error) {
    // Gracefully handle if vector doesn't exist
    if (isDev) {
      console.warn(`Vector for tool ${toolId} not found or already deleted`);
    }
  }
};

export interface SemanticSearchOptions {
  category?: string;
  limit?: number;
  offset?: number;
  scoreThreshold?: number;
}

export const searchToolVectors = async (
  query: string,
  {
    limit = 10,
    offset = 0,
    category,
    scoreThreshold,
  }: SemanticSearchOptions = {}
): Promise<ToolVectorMatch[]> => {
  await ensureToolsCollection();

  const vector = await getQueryEmbedding(query, QDRANT_TOOLS_VECTOR_SIZE);

  const filter = buildFilter({ category });
  const results = await qdrantClient.search(QDRANT_TOOLS_COLLECTION, {
    vector,
    filter,
    limit,
    offset,
    with_payload: true,
    score_threshold: scoreThreshold,
  });

  return results
    .map((result) => {
      const payload = result.payload as ToolVectorPayload | undefined;
      if (!payload) {
        return null;
      }

      return {
        id: payload.id ?? String(result.id ?? ""),
        score: result.score ?? 0,
        payload,
      };
    })
    .filter((match): match is ToolVectorMatch => Boolean(match?.payload?.slug));
};

export interface ReindexProgress {
  failed: string[];
  processed: number;
  total: number;
}

export const reindexAllTools = async (
  onProgress?: (progress: ReindexProgress) => void
): Promise<ReindexProgress> => {
  await ensureToolsCollection();

  const tools = await prisma.tool.findMany({
    where: { publishedAt: { lte: new Date() } },
    include: {
      categories: { select: { slug: true, name: true } },
      tags: { select: { slug: true } },
    },
  });

  const progress: ReindexProgress = {
    total: tools.length,
    processed: 0,
    failed: [],
  };

  const BATCH_SIZE = 10;

  for (let i = 0; i < tools.length; i += BATCH_SIZE) {
    const batch = tools.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (tool) => {
        try {
          await upsertToolVector(tool);
          progress.processed++;
        } catch (error) {
          progress.failed.push(tool.slug);
          if (isDev) {
            console.error(`Failed to index tool ${tool.slug}:`, error);
          }
        }
      })
    );

    onProgress?.(progress);
  }

  return progress;
};

export const clearToolsCollection = async () => {
  const exists = await qdrantClient.collectionExists(QDRANT_TOOLS_COLLECTION);
  if (exists) {
    await qdrantClient.deleteCollection(QDRANT_TOOLS_COLLECTION);
  }
};

// ============================================================================
// Hybrid Search Implementation (Dense + Sparse with RRF Fusion)
// ============================================================================

/**
 * Upserts a tool with both dense and sparse vectors to the hybrid collection
 */
export const upsertHybridToolVector = async (tool: ToolWithRelations) => {
  log.debug(`Upserting hybrid vector for tool: ${tool.slug}`);
  await ensureHybridCollection();

  const document = buildToolDocument(tool);
  log.debug(`Document length: ${document.length} chars`);

  // Generate dense vector (async) and sparse vector (sync)
  const sparseVector = generateSparseEmbedding(document);
  const denseVector = await generateEmbedding(document, {
    outputDimensionality: QDRANT_DENSE_VECTOR_SIZE,
  });

  log.debug(
    `Generated dense: ${denseVector.length} dims, sparse: ${sparseVector.indices.length} non-zero`
  );

  try {
    await qdrantClient.upsert(QDRANT_HYBRID_COLLECTION, {
      wait: true,
      points: [
        {
          id: toUUID(tool.id),
          vector: {
            dense: denseVector,
            sparse: {
              indices: sparseVector.indices,
              values: sparseVector.values,
            },
          },
          payload: serializeToolPayload(tool),
        },
      ],
    });
    log.info(`Hybrid vector upserted for tool: ${tool.slug}`);
  } catch (error) {
    log.error(`Failed to upsert hybrid vector for tool: ${tool.slug}`, {
      error,
    });
    throw error;
  }
};

/**
 * Deletes a tool from the hybrid collection
 */
export const deleteHybridToolVector = async (toolId: string) => {
  await ensureHybridCollection();

  await qdrantClient.delete(QDRANT_HYBRID_COLLECTION, {
    points: [toUUID(toolId)],
  });
};

export interface HybridSearchOptions {
  category?: string;
  limit?: number;
  offset?: number;
  prefetchLimit?: number;
  scoreThreshold?: number;
}

/**
 * Performs hybrid search using Qdrant's prefetch + RRF fusion API
 * Combines semantic (dense) and keyword (sparse) search for best results
 */
export const hybridSearchToolVectors = async (
  query: string,
  {
    limit = 5,
    offset = 0,
    category,
    prefetchLimit = 20,
    scoreThreshold,
  }: HybridSearchOptions = {}
): Promise<ToolVectorMatch[]> => {
  await ensureHybridCollection();

  // Generate dense query vector (async) and sparse query vector (sync)
  const sparseQuery = generateSparseEmbedding(query);
  const denseQuery = await getQueryEmbedding(query, QDRANT_DENSE_VECTOR_SIZE);

  const filter = buildFilter({ category });

  // Execute hybrid search with RRF fusion
  const results = await qdrantClient.query(QDRANT_HYBRID_COLLECTION, {
    prefetch: [
      {
        query: denseQuery,
        using: "dense",
        limit: prefetchLimit,
        filter,
      },
      {
        query: {
          indices: sparseQuery.indices,
          values: sparseQuery.values,
        },
        using: "sparse",
        limit: prefetchLimit,
        filter,
      },
    ],
    query: {
      fusion: "rrf", // Reciprocal Rank Fusion
    },
    limit,
    offset,
    with_payload: true,
    score_threshold: scoreThreshold,
  });

  return results.points
    .map((result) => {
      const payload = result.payload as ToolVectorPayload | undefined;
      if (!payload) {
        return null;
      }

      return {
        id: payload.id ?? String(result.id ?? ""),
        score: result.score ?? 0,
        payload,
      };
    })
    .filter((match): match is ToolVectorMatch => Boolean(match?.payload?.slug));
};

/**
 * Searches for tools by name using hybrid search
 * Useful for comparison queries where we need specific tools
 */
export const searchToolsByName = async (
  toolNames: string[]
): Promise<ToolVectorMatch[]> => {
  if (toolNames.length === 0) {
    return [];
  }

  const results: ToolVectorMatch[] = [];

  // Search for each tool name in parallel using hybrid search
  const searchResults = await Promise.all(
    toolNames.map((toolName) => hybridSearchToolVectors(toolName, { limit: 1 }))
  );

  for (const matches of searchResults) {
    if (matches.length > 0) {
      results.push(matches[0]);
    }
  }

  return results;
};

/**
 * Reindexes all tools to the hybrid collection
 */
export const reindexAllHybridTools = async (
  onProgress?: (progress: ReindexProgress) => void
): Promise<ReindexProgress> => {
  await ensureHybridCollection();

  const tools = await prisma.tool.findMany({
    where: { publishedAt: { lte: new Date() } },
    include: {
      categories: { select: { slug: true, name: true } },
      tags: { select: { slug: true } },
    },
  });

  const progress: ReindexProgress = {
    total: tools.length,
    processed: 0,
    failed: [],
  };

  const BATCH_SIZE = 5; // Smaller batch due to dual embedding generation

  for (let i = 0; i < tools.length; i += BATCH_SIZE) {
    const batch = tools.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (tool) => {
        try {
          await upsertHybridToolVector(tool);
          progress.processed++;
        } catch (error) {
          progress.failed.push(tool.slug);
          log.error(`Failed to index hybrid tool ${tool.slug}:`, { error });
        }
      })
    );

    onProgress?.(progress);
  }

  return progress;
};

/**
 * Clears the hybrid tools collection
 */
export const clearHybridCollection = async () => {
  const exists = await qdrantClient.collectionExists(QDRANT_HYBRID_COLLECTION);
  if (exists) {
    await qdrantClient.deleteCollection(QDRANT_HYBRID_COLLECTION);
  }
};

// ============================================================================
// Alternatives Vector Store Operations
// ============================================================================

/**
 * Payload type for alternative vectors
 * Alternatives are tools with metadata about related tools
 */
export interface AlternativeVectorPayload {
  description: string | null;
  id: string;
  name: string;
  relatedToolIds: string[]; // IDs of tools this is an alternative to, or tools that are alternatives to this
  slug: string;
  [key: string]: unknown;
}

export interface AlternativeVectorMatch {
  id: string;
  payload: AlternativeVectorPayload;
  score: number;
}

/**
 * Builds a document string from alternative data for embedding
 */
const buildAlternativeDocument = (alternative: {
  name: string;
  description: string | null;
}): string => {
  return [alternative.name, alternative.description]
    .filter(Boolean)
    .join("\n\n");
};

/**
 * Upserts an alternative vector to the alternatives hybrid collection
 * Note: Alternatives are treated as tools with related tool metadata
 */
export const upsertAlternativeVector = async (alternative: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  relatedToolIds?: string[];
}) => {
  log.debug(`Upserting alternative vector: ${alternative.slug}`);
  await ensureAlternativesCollection();

  const document = buildAlternativeDocument(alternative);
  log.debug(`Document length: ${document.length} chars`);

  // Generate dense vector (async) and sparse vector (sync)
  const sparseVector = generateSparseEmbedding(document);
  const denseVector = await generateEmbedding(document, {
    outputDimensionality: QDRANT_DENSE_VECTOR_SIZE,
  });

  log.debug(
    `Generated dense: ${denseVector.length} dims, sparse: ${sparseVector.indices.length} non-zero`
  );

  const payload: AlternativeVectorPayload = {
    id: alternative.id,
    slug: alternative.slug,
    name: alternative.name,
    description: alternative.description,
    relatedToolIds: alternative.relatedToolIds ?? [],
  };

  try {
    await qdrantClient.upsert(QDRANT_ALTERNATIVES_COLLECTION, {
      wait: true,
      points: [
        {
          id: toUUID(alternative.id),
          vector: {
            dense: denseVector,
            sparse: {
              indices: sparseVector.indices,
              values: sparseVector.values,
            },
          },
          payload,
        },
      ],
    });
    log.info(`Alternative vector upserted: ${alternative.slug}`);
  } catch (error) {
    log.error(`Failed to upsert alternative vector: ${alternative.slug}`, {
      error,
    });
    throw error;
  }
};

/**
 * Deletes an alternative vector from the alternatives collection
 */
export const deleteAlternativeVector = async (alternativeId: string) => {
  await ensureAlternativesCollection();

  try {
    await qdrantClient.delete(QDRANT_ALTERNATIVES_COLLECTION, {
      points: [toUUID(alternativeId)],
    });
    log.info(`Alternative vector deleted: ${alternativeId}`);
  } catch (_error) {
    // Gracefully handle if vector doesn't exist
    log.warn(
      `Alternative vector ${alternativeId} not found or already deleted`
    );
  }
};

/**
 * Searches for alternatives using hybrid search
 */
export const searchAlternativeVectors = async (
  query: string,
  {
    limit = 10,
    offset = 0,
    scoreThreshold,
  }: { limit?: number; offset?: number; scoreThreshold?: number } = {}
): Promise<AlternativeVectorMatch[]> => {
  await ensureAlternativesCollection();

  // Generate dense query vector (async) and sparse query vector (sync)
  const sparseQuery = generateSparseEmbedding(query);
  const denseQuery = await getQueryEmbedding(query, QDRANT_DENSE_VECTOR_SIZE);

  // Execute hybrid search with RRF fusion
  const results = await qdrantClient.query(QDRANT_ALTERNATIVES_COLLECTION, {
    prefetch: [
      {
        query: denseQuery,
        using: "dense",
        limit: limit * 2, // Prefetch more for RRF
      },
      {
        query: {
          indices: sparseQuery.indices,
          values: sparseQuery.values,
        },
        using: "sparse",
        limit: limit * 2,
      },
    ],
    query: {
      fusion: "rrf", // Reciprocal Rank Fusion
    },
    limit,
    offset,
    with_payload: true,
    score_threshold: scoreThreshold,
  });

  return results.points
    .map((result) => {
      const payload = result.payload as AlternativeVectorPayload | undefined;
      if (!payload) {
        return null;
      }

      return {
        id: payload.id ?? String(result.id ?? ""),
        score: result.score ?? 0,
        payload,
      };
    })
    .filter((match): match is AlternativeVectorMatch =>
      Boolean(match?.payload?.slug)
    );
};

/**
 * Reindexes all alternatives to the alternatives collection
 * Note: This assumes alternatives are stored as tools with related tool metadata
 */
export const reindexAllAlternatives = async (
  onProgress?: (progress: ReindexProgress) => void
): Promise<ReindexProgress> => {
  await ensureAlternativesCollection();

  // For now, we'll index all published tools as potential alternatives
  // In the future, this could be filtered to only tools marked as alternatives
  const tools = await prisma.tool.findMany({
    where: { publishedAt: { lte: new Date() } },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
    },
  });

  const progress: ReindexProgress = {
    total: tools.length,
    processed: 0,
    failed: [],
  };

  const BATCH_SIZE = 5; // Smaller batch due to dual embedding generation

  for (let i = 0; i < tools.length; i += BATCH_SIZE) {
    const batch = tools.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (tool) => {
        try {
          await upsertAlternativeVector({
            id: tool.id,
            slug: tool.slug,
            name: tool.name,
            description: tool.description,
            relatedToolIds: [], // Can be populated later based on business logic
          });
          progress.processed++;
        } catch (error) {
          progress.failed.push(tool.slug);
          log.error(`Failed to index alternative ${tool.slug}:`, { error });
        }
      })
    );

    onProgress?.(progress);
  }

  return progress;
};

// ============================================================================
// Categories Vector Store Operations
// ============================================================================

/**
 * Payload type for category vectors
 */
export interface CategoryVectorPayload {
  description: string | null;
  id: string;
  name: string;
  slug: string;
  [key: string]: unknown;
}

export interface CategoryVectorMatch {
  id: string;
  payload: CategoryVectorPayload;
  score: number;
}

type CategoryWithRelations = Category;

/**
 * Builds a document string from category data for embedding
 */
const buildCategoryDocument = (category: CategoryWithRelations): string => {
  return [category.name, category.label, category.description]
    .filter(Boolean)
    .join("\n\n");
};

/**
 * Serializes category to payload format
 */
const serializeCategoryPayload = (
  category: CategoryWithRelations
): CategoryVectorPayload => ({
  id: category.id,
  slug: category.slug,
  name: category.name,
  description: category.description ?? null,
});

/**
 * Upserts a category vector to the categories hybrid collection
 */
export const upsertCategoryVector = async (category: CategoryWithRelations) => {
  log.debug(`Upserting category vector: ${category.slug}`);
  await ensureCategoriesCollection();

  const document = buildCategoryDocument(category);
  log.debug(`Document length: ${document.length} chars`);

  // Generate dense vector (async) and sparse vector (sync)
  const sparseVector = generateSparseEmbedding(document);
  const denseVector = await generateEmbedding(document, {
    outputDimensionality: QDRANT_DENSE_VECTOR_SIZE,
  });

  log.debug(
    `Generated dense: ${denseVector.length} dims, sparse: ${sparseVector.indices.length} non-zero`
  );

  try {
    await qdrantClient.upsert(QDRANT_CATEGORIES_COLLECTION, {
      wait: true,
      points: [
        {
          id: toUUID(category.id),
          vector: {
            dense: denseVector,
            sparse: {
              indices: sparseVector.indices,
              values: sparseVector.values,
            },
          },
          payload: serializeCategoryPayload(category),
        },
      ],
    });
    log.info(`Category vector upserted: ${category.slug}`);
  } catch (error) {
    log.error(`Failed to upsert category vector: ${category.slug}`, { error });
    throw error;
  }
};

/**
 * Deletes a category vector from the categories collection
 */
export const deleteCategoryVector = async (categoryId: string) => {
  await ensureCategoriesCollection();

  try {
    await qdrantClient.delete(QDRANT_CATEGORIES_COLLECTION, {
      points: [toUUID(categoryId)],
    });
    log.info(`Category vector deleted: ${categoryId}`);
  } catch (_error) {
    // Gracefully handle if vector doesn't exist
    log.warn(`Category vector ${categoryId} not found or already deleted`);
  }
};

/**
 * Searches for categories using hybrid search
 */
export const searchCategoryVectors = async (
  query: string,
  {
    limit = 10,
    offset = 0,
    scoreThreshold,
  }: { limit?: number; offset?: number; scoreThreshold?: number } = {}
): Promise<CategoryVectorMatch[]> => {
  await ensureCategoriesCollection();

  // Generate dense query vector (async) and sparse query vector (sync)
  const sparseQuery = generateSparseEmbedding(query);
  const denseQuery = await getQueryEmbedding(query, QDRANT_DENSE_VECTOR_SIZE);

  // Execute hybrid search with RRF fusion
  const results = await qdrantClient.query(QDRANT_CATEGORIES_COLLECTION, {
    prefetch: [
      {
        query: denseQuery,
        using: "dense",
        limit: limit * 2, // Prefetch more for RRF
      },
      {
        query: {
          indices: sparseQuery.indices,
          values: sparseQuery.values,
        },
        using: "sparse",
        limit: limit * 2,
      },
    ],
    query: {
      fusion: "rrf", // Reciprocal Rank Fusion
    },
    limit,
    offset,
    with_payload: true,
    score_threshold: scoreThreshold,
  });

  return results.points
    .map((result) => {
      const payload = result.payload as CategoryVectorPayload | undefined;
      if (!payload) {
        return null;
      }

      return {
        id: payload.id ?? String(result.id ?? ""),
        score: result.score ?? 0,
        payload,
      };
    })
    .filter((match): match is CategoryVectorMatch =>
      Boolean(match?.payload?.slug)
    );
};

/**
 * Reindexes all categories to the categories collection
 */
export const reindexAllCategories = async (
  onProgress?: (progress: ReindexProgress) => void
): Promise<ReindexProgress> => {
  await ensureCategoriesCollection();

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  const progress: ReindexProgress = {
    total: categories.length,
    processed: 0,
    failed: [],
  };

  const BATCH_SIZE = 5; // Smaller batch due to dual embedding generation

  for (let i = 0; i < categories.length; i += BATCH_SIZE) {
    const batch = categories.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (category) => {
        try {
          await upsertCategoryVector(category);
          progress.processed++;
        } catch (error) {
          progress.failed.push(category.slug);
          log.error(`Failed to index category ${category.slug}:`, { error });
        }
      })
    );

    onProgress?.(progress);
  }

  return progress;
};
