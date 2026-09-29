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
  /** Audience role the answer was tailored to; absent for untailored answers. */
  role?: string | null;
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
  /** Only answers tailored to this role match; without one, only untailored answers do. */
  role?: string;
  /** Only answers for this tool page match; without one, only global answers do. */
  toolSlug?: string;
}

/** Answers are kept for a week so edits to a tool (pricing, description) reach the chat. */
export const CHAT_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
/** Bump to ignore every chat answer cached before a behaviour change. */
export const CHAT_CACHE_VERSION = 2;
// Several near neighbours are fetched so an expired top hit cannot hide a fresh one
const CHAT_CACHE_CANDIDATES = 5;

export const isChatCacheEntryFresh = (
  payload: Pick<SemanticCachePayload, "cacheVersion" | "createdAt">,
  now = Date.now()
): boolean => {
  if (payload.cacheVersion !== CHAT_CACHE_VERSION) {
    return false;
  }
  const createdAt = new Date(payload.createdAt).getTime();
  return Number.isFinite(createdAt) && now - createdAt <= CHAT_CACHE_TTL_MS;
};

/**
 * Exact-match conditions for a chat cache lookup. Role and tool page are
 * matched exactly rather than left to the similarity score: questions that
 * differ only in them ("How much does it cost?") embed almost identically.
 */
export const buildChatCacheFilter = ({
  role,
  toolSlug,
}: Pick<FindCachedAnswerOptions, "role" | "toolSlug">) => ({
  must: [
    { key: "cacheVersion", match: { value: CHAT_CACHE_VERSION } },
    role
      ? { key: "role", match: { value: role } }
      : { is_empty: { key: "role" } },
    toolSlug
      ? { key: "toolSlug", match: { value: toolSlug } }
      : { is_empty: { key: "toolSlug" } },
  ],
});

export const findCachedAnswer = async (
  question: string,
  {
    minScore = QDRANT_SEMANTIC_CACHE_SCORE_THRESHOLD,
    role,
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

  const results = await qdrantClient.search(QDRANT_SEMANTIC_CACHE_COLLECTION, {
    vector,
    limit: CHAT_CACHE_CANDIDATES,
    with_payload: true,
    score_threshold: minScore,
    filter: buildChatCacheFilter({ role, toolSlug }),
  });

  const now = Date.now();
  for (const result of results) {
    const payload = result.payload as SemanticCachePayload | undefined;
    if (!(payload && isChatCacheEntryFresh(payload, now))) {
      continue;
    }

    // An answer that is effectively empty (e.g. only suggestions) is a miss
    const mainContent = extractMainContent(payload.answer);
    const hasToolResults = (payload.toolResults?.length ?? 0) > 0;
    if (!(mainContent || hasToolResults)) {
      continue;
    }

    log.info(`Cache hit (score=${result.score?.toFixed(3) ?? "n/a"})`, {
      question: normalizedQuestion,
      toolSlug: payload.toolSlug ?? null,
    });

    return {
      id: String(result.id ?? ""),
      score: result.score ?? 0,
      payload,
    };
  }

  return null;
};

export const storeCachedAnswer = async (params: {
  question: string;
  answer: string;
  context: ToolVectorMatch[];
  role?: string | null;
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
            cacheVersion: CHAT_CACHE_VERSION,
            context: params.context,
            createdAt: new Date().toISOString(),
            role: params.role ?? null,
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
