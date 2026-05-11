import crypto from "node:crypto";
import { createLogger } from "~/lib/logger";
import type { ToolVectorMatch } from "~/lib/vector-store";
import { generateEmbedding } from "~/services/embedding";
import {
  ensureSearchCacheCollection,
  ensureSemanticCacheCollection,
  QDRANT_DENSE_VECTOR_SIZE,
  QDRANT_SEARCH_CACHE_COLLECTION,
  QDRANT_SEMANTIC_CACHE_COLLECTION,
  QDRANT_SEMANTIC_CACHE_SCORE_THRESHOLD,
  qdrantClient,
} from "~/services/qdrant";

const log = createLogger("semantic-cache");

export interface SemanticCachePayload {
  answer?: string;
  cacheVersion?: number;
  context?: ToolVectorMatch[];
  createdAt: string;
  normalizedQuestion: string;
  searchResults?: Record<string, unknown>; // Avoid circular dependency with actions/search.ts
  toolResults?: SemanticCacheToolResult[];
  toolSlug?: string | null;
}

export interface SemanticCacheEntry {
  id: string;
  payload: SemanticCachePayload;
  score: number;
}

export interface SemanticCacheToolResult {
  dynamic?: boolean;
  error?: string;
  input?: unknown;
  output?: unknown;
  preliminary?: boolean;
  providerExecuted?: boolean;
  toolCallId: string;
  toolName: string;
}

const normalizeQuestion = (question: string): string =>
  question.trim().replace(/\s+/g, " ").toLowerCase();

const extractMainContent = (answer: string | undefined): string =>
  (answer ?? "").split("---SUGGESTIONS---")[0]?.trim() ?? "";

interface FindCachedAnswerOptions {
  minScore?: number;
  toolSlug?: string;
}

export const findCachedAnswer = async (
  question: string,
  {
    minScore = QDRANT_SEMANTIC_CACHE_SCORE_THRESHOLD,
    toolSlug,
  }: FindCachedAnswerOptions = {}
): Promise<SemanticCacheEntry | null> => {
  const normalizedQuestion = normalizeQuestion(question);
  if (!normalizedQuestion) {
    return null;
  }

  await ensureSemanticCacheCollection();

  const vector = await generateEmbedding(normalizedQuestion, {
    outputDimensionality: QDRANT_DENSE_VECTOR_SIZE,
  });

  const baseSearch = async (withToolFilter: boolean) =>
    qdrantClient.search(QDRANT_SEMANTIC_CACHE_COLLECTION, {
      vector,
      limit: 1,
      with_payload: true,
      score_threshold: minScore,
      filter:
        withToolFilter && toolSlug
          ? {
              must: [
                {
                  key: "toolSlug",
                  match: { value: toolSlug },
                },
              ],
            }
          : undefined,
    });

  let results = await baseSearch(true);

  // If scoped lookup failed, try a global lookup so we don't drop older cache entries
  if (!results.length && toolSlug) {
    results = await baseSearch(false);
    if (results.length) {
      log.info("Cache fallback hit without tool filter", {
        question: normalizedQuestion,
        toolSlug,
      });
    }
  }

  if (!results.length) {
    return null;
  }

  const result = results[0];
  const payload = result.payload as SemanticCachePayload | undefined;
  const mainContent = extractMainContent(payload?.answer);
  const hasToolResults = (payload?.toolResults?.length ?? 0) > 0;

  // If the cached answer is effectively empty (e.g., only suggestions), treat as a miss
  if (!(payload && (mainContent || hasToolResults))) {
    return null;
  }

  log.info(`Cache hit (score=${result.score?.toFixed(3) ?? "n/a"})`, {
    question: normalizedQuestion,
    toolSlug: payload.toolSlug ?? toolSlug ?? null,
  });

  return {
    id: String(result.id ?? ""),
    score: result.score ?? 0,
    payload,
  };
};

export const storeCachedAnswer = async (params: {
  question: string;
  answer: string;
  context: ToolVectorMatch[];
  toolSlug?: string | null;
  toolResults?: SemanticCacheToolResult[];
}): Promise<void> => {
  const normalizedQuestion = normalizeQuestion(params.question);
  const trimmedAnswer = params.answer.trim();
  const mainContent = extractMainContent(trimmedAnswer);
  if (
    !(normalizedQuestion && (mainContent || (params.toolResults?.length ?? 0)))
  ) {
    return;
  }

  await ensureSemanticCacheCollection();

  const vector = await generateEmbedding(normalizedQuestion, {
    outputDimensionality: QDRANT_DENSE_VECTOR_SIZE,
  });

  try {
    await qdrantClient.upsert(QDRANT_SEMANTIC_CACHE_COLLECTION, {
      wait: false,
      points: [
        {
          id: crypto.randomUUID(),
          vector,
          payload: {
            normalizedQuestion,
            answer: trimmedAnswer,
            context: params.context,
            createdAt: new Date().toISOString(),
            toolSlug: params.toolSlug ?? null,
            toolResults: params.toolResults ?? [],
          } satisfies SemanticCachePayload,
        },
      ],
    });
    log.info("Cached answer", {
      question: normalizedQuestion,
      toolSlug: params.toolSlug ?? null,
    });
  } catch (error) {
    log.error("Failed to cache answer in semantic cache", { error });
  }
};

const SEARCH_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 1 week
const SEARCH_CACHE_VERSION = 2;

const redactCachedToolSubmitterFields = (
  searchResults: Record<string, unknown>
): Record<string, unknown> => {
  const { tools } = searchResults;
  if (!Array.isArray(tools)) {
    return searchResults;
  }

  return {
    ...searchResults,
    tools: tools.map((tool) => {
      if (!(tool && typeof tool === "object") || Array.isArray(tool)) {
        return tool;
      }

      const {
        submitterEmail: _submitterEmail,
        submitterName: _submitterName,
        ...safeTool
      } = tool as Record<string, unknown>;

      return safeTool;
    }),
  };
};

export const findCachedSearch = async (
  question: string,
  minScore = QDRANT_SEMANTIC_CACHE_SCORE_THRESHOLD
): Promise<Record<string, unknown> | null> => {
  const normalizedQuestion = normalizeQuestion(question);
  if (!normalizedQuestion) {
    return null;
  }

  await ensureSearchCacheCollection();

  const vector = await generateEmbedding(normalizedQuestion, {
    outputDimensionality: QDRANT_DENSE_VECTOR_SIZE,
  });

  const results = await qdrantClient.search(QDRANT_SEARCH_CACHE_COLLECTION, {
    vector,
    limit: 1,
    with_payload: true,
    score_threshold: minScore,
  });

  if (!results.length) {
    return null;
  }

  const result = results[0];
  const payload = result.payload as SemanticCachePayload | undefined;
  if (!payload?.searchResults) {
    return null;
  }

  if (
    payload.normalizedQuestion !== normalizedQuestion ||
    payload.cacheVersion !== SEARCH_CACHE_VERSION
  ) {
    return null;
  }

  // Check TTL
  const createdAt = new Date(payload.createdAt).getTime();
  if (Date.now() - createdAt > SEARCH_CACHE_TTL_MS) {
    log.info("Search cache expired", {
      question: normalizedQuestion,
      createdAt: payload.createdAt,
    });
    return null;
  }

  log.info(`Search cache hit (score=${result.score?.toFixed(3) ?? "n/a"})`, {
    question: normalizedQuestion,
  });

  return redactCachedToolSubmitterFields(payload.searchResults);
};

export const storeCachedSearch = async (params: {
  question: string;
  searchResults: Record<string, unknown>;
}): Promise<void> => {
  const normalizedQuestion = normalizeQuestion(params.question);
  if (!normalizedQuestion) {
    return;
  }

  await ensureSearchCacheCollection();

  const vector = await generateEmbedding(normalizedQuestion, {
    outputDimensionality: QDRANT_DENSE_VECTOR_SIZE,
  });

  try {
    const searchResults = redactCachedToolSubmitterFields(params.searchResults);

    await qdrantClient.upsert(QDRANT_SEARCH_CACHE_COLLECTION, {
      wait: false,
      points: [
        {
          id: crypto.randomUUID(),
          vector,
          payload: {
            normalizedQuestion,
            cacheVersion: SEARCH_CACHE_VERSION,
            searchResults,
            createdAt: new Date().toISOString(),
          } satisfies SemanticCachePayload,
        },
      ],
    });
    log.info("Cached search results", { question: normalizedQuestion });
  } catch (error) {
    log.error("Failed to cache search results", { error });
  }
};
