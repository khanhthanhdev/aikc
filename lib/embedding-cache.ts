import { AsyncLocalStorage } from "node:async_hooks";
import { createLogger } from "~/lib/logger";

export interface EmbeddingCacheConfig {
  maxEntries: number;
  ttlMs: number;
}

export interface EmbeddingCacheKeyInput {
  dimensions?: number;
  model?: string;
  query: string;
}

export interface EmbeddingCacheResult {
  cacheKey: string;
  fromCache: boolean;
  source: "request" | "global";
  vector: number[];
}

const log = createLogger("embedding-cache");

const requestStore = new AsyncLocalStorage<Map<string, Promise<number[]>>>();
const lruCache = new Map<
  string,
  { value: number[]; expiresAt: number; createdAt: number }
>();

const normalizeQuery = (query: string): string =>
  query.trim().replace(/\s+/g, " ").toLowerCase();

const buildCacheKey = ({
  query,
  model,
  dimensions,
}: EmbeddingCacheKeyInput): string => {
  const normalizedQuery = normalizeQuery(query);
  const modelPart = model ?? "default";
  const dimensionPart = dimensions ?? "full";
  return `${normalizedQuery}::${modelPart}::${dimensionPart}`;
};

const enforceCapacity = (maxEntries: number) => {
  while (lruCache.size > maxEntries) {
    const oldestKey = lruCache.keys().next().value;
    if (!oldestKey) {
      return;
    }
    lruCache.delete(oldestKey);
    log.debug("Evicted embedding cache entry", { cacheKey: oldestKey });
  }
};

export const runWithEmbeddingCache = <T>(fn: () => Promise<T>) => {
  if (requestStore.getStore()) {
    return fn();
  }

  return requestStore.run(new Map(), fn);
};

export const getCachedEmbedding = async (
  keyInput: EmbeddingCacheKeyInput,
  loader: () => Promise<number[]>,
  config: EmbeddingCacheConfig
): Promise<EmbeddingCacheResult> => {
  const cacheKey = buildCacheKey(keyInput);
  const now = Date.now();

  const requestCache = requestStore.getStore();
  const requestHit = requestCache?.get(cacheKey);
  if (requestHit) {
    log.debug("Embedding cache hit (request)", {
      cacheKey,
      size: lruCache.size,
    });
    const vector = await requestHit;
    return { vector, cacheKey, fromCache: true, source: "request" };
  }

  const existing = lruCache.get(cacheKey);
  if (existing) {
    if (existing.expiresAt > now) {
      lruCache.delete(cacheKey);
      lruCache.set(cacheKey, existing); // refresh LRU order
      log.info("Embedding cache hit", { cacheKey, size: lruCache.size });
      return {
        vector: existing.value,
        cacheKey,
        fromCache: true,
        source: "global",
      };
    }

    lruCache.delete(cacheKey);
  }

  const loadPromise = loader();
  if (requestCache) {
    requestCache.set(cacheKey, loadPromise);
  }

  try {
    const vector = await loadPromise;
    lruCache.set(cacheKey, {
      value: vector,
      expiresAt: now + config.ttlMs,
      createdAt: now,
    });
    enforceCapacity(config.maxEntries);
    log.info("Embedding cache miss", { cacheKey, size: lruCache.size });
    return { vector, cacheKey, fromCache: false, source: "global" };
  } finally {
    requestCache?.delete(cacheKey);
  }
};

export const getEmbeddingCacheStats = () => ({
  size: lruCache.size,
  entries: lruCache.size,
});
