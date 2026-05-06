/**
 * Centralized search configuration for Qdrant vector search
 *
 * This module provides default search parameters that can be overridden
 * per-query when needed. Configuration values are environment-appropriate.
 */

export interface SearchConfig {
  /** Circuit breaker configuration for Qdrant calls */
  circuitBreaker: {
    failureThreshold: number;
    halfOpenAfterMs: number;
    successThreshold: number;
  };
  /** HNSW ef_search parameter - higher = more accurate but slower */
  efSearch: number;
  /** Embedding cache configuration */
  embeddingCache: {
    maxEntries: number;
    ttlMs: number;
  };
  /** Maximum number of results to return */
  limit: number;
  /** Prefetch limit for hybrid search (used in RRF fusion) */
  prefetchLimit: number;
  /** Minimum relevance score threshold (0-1) */
  scoreThreshold: number;
  /** Maximum duration (ms) before a search attempt is considered timed out */
  timeoutMs: number;
}

/**
 * Default search configuration for general queries
 */
export const defaultSearchConfig: SearchConfig = {
  limit: 10,
  scoreThreshold: 0.0, // No threshold by default, let Qdrant return all results
  efSearch: 64, // Balanced accuracy vs speed
  prefetchLimit: 20, // Fetch more candidates for RRF fusion
  timeoutMs: 10_000,
  embeddingCache: {
    maxEntries: 1000,
    ttlMs: 60 * 60_000 * 24 * 3, // 3 days
  },
  circuitBreaker: {
    failureThreshold: 5,
    halfOpenAfterMs: 30_000,
    successThreshold: 3,
  },
};

/**
 * Search configuration for admin interface
 * More permissive limits and thresholds for admin searches
 */
export const adminSearchConfig: SearchConfig = {
  limit: 50,
  scoreThreshold: 0.0,
  efSearch: 64,
  prefetchLimit: 50,
  timeoutMs: 10_000,
  embeddingCache: {
    maxEntries: 1000,
    ttlMs: 60 * 60_000 * 24,
  },
  circuitBreaker: {
    failureThreshold: 5,
    halfOpenAfterMs: 30_000,
    successThreshold: 3,
  },
};

/**
 * Search configuration for public search
 * Optimized for speed and relevance
 */
export const publicSearchConfig: SearchConfig = {
  limit: 10,
  scoreThreshold: 0.0,
  efSearch: 64,
  prefetchLimit: 20,
  timeoutMs: 10_000,
  embeddingCache: {
    maxEntries: 1000,
    ttlMs: 60 * 60_000 * 24 * 3,
  },
  circuitBreaker: {
    failureThreshold: 5,
    halfOpenAfterMs: 30_000,
    successThreshold: 3,
  },
};

/**
 * Search configuration for related/recommendation queries
 * Higher limits for recommendation results
 */
export const recommendationConfig: SearchConfig = {
  limit: 20,
  scoreThreshold: 0.3, // Higher threshold for recommendations
  efSearch: 64,
  prefetchLimit: 30,
  timeoutMs: 10_000,
  embeddingCache: {
    maxEntries: 1000,
    ttlMs: 60 * 60_000 * 24,
  },
  circuitBreaker: {
    failureThreshold: 5,
    halfOpenAfterMs: 30_000,
    successThreshold: 3,
  },
};

/**
 * Environment-specific overrides
 * In production, we might want higher ef_search for better accuracy
 */
export const getSearchConfig = (
  type: "default" | "admin" | "public" | "recommendation" = "default"
): SearchConfig => {
  const baseConfig =
    type === "admin"
      ? adminSearchConfig
      : type === "public"
        ? publicSearchConfig
        : type === "recommendation"
          ? recommendationConfig
          : defaultSearchConfig;

  // Environment-specific overrides
  const isProduction = process.env.NODE_ENV === "production";

  return {
    ...baseConfig,
    // In production, use higher ef_search for better accuracy
    efSearch: isProduction ? baseConfig.efSearch * 1.5 : baseConfig.efSearch,
  };
};
