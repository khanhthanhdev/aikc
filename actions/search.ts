"use server";

import { z } from "zod";
import { createServerAction } from "zsa";
import { getSearchConfig } from "~/config/search";
import { isDev } from "~/env";
import { runWithEmbeddingCache } from "~/lib/embedding-cache";
import { authedProcedure } from "~/lib/safe-actions";
import { CircuitBreaker } from "~/lib/search-strategy";
import { findCachedSearch, storeCachedSearch } from "~/lib/semantic-cache";
import {
  type CategoryVectorMatch,
  hybridSearchToolVectors,
  searchCategoryVectors,
  type ToolVectorMatch,
} from "~/lib/vector-store";
import { type ToolMany, toolManyPayload } from "~/server/tools/payloads";
import { prisma } from "~/services/prisma";

export type SearchMode = "keyword" | "semantic";

const SEARCH_LIMIT = 5;

type SearchableTool = Pick<
  ToolMany,
  | "categories"
  | "content"
  | "contentVi"
  | "description"
  | "descriptionVi"
  | "id"
  | "name"
  | "nameVi"
  | "summary"
  | "summaryVi"
  | "tagline"
  | "taglineVi"
>;

const normalizeSearchText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

const includesQuery = (
  values: Array<string | null | undefined>,
  normalizedQuery: string
): boolean =>
  values
    .filter((value): value is string => Boolean(value))
    .map(normalizeSearchText)
    .some((value) => value.includes(normalizedQuery));

/**
 * Compares two tools for sorting based on text match quality.
 */
function createToolSortComparator(
  normalizedQuery: string,
  qdrantToolIds: Set<string>
) {
  return (a: SearchableTool, b: SearchableTool): number => {
    const scoreA = calculateMatchScore(a, normalizedQuery, qdrantToolIds);
    const scoreB = calculateMatchScore(b, normalizedQuery, qdrantToolIds);

    return scoreB - scoreA;
  };
}

/**
 * Calculates a match score for searchable tool fields against the query.
 */
function calculateMatchScore(
  tool: SearchableTool,
  normalizedQuery: string,
  qdrantToolIds: Set<string>
): number {
  let score = 0;
  const normalizedNames = [tool.name, tool.nameVi]
    .filter((name): name is string => Boolean(name))
    .map(normalizeSearchText);

  // Exact match: highest priority (100 points)
  if (normalizedNames.includes(normalizedQuery)) {
    score += 100;
  }

  // Starts with query: second priority (50 points)
  if (normalizedNames.some((name) => name.startsWith(normalizedQuery))) {
    score += 50;
  }

  // Contains query: third priority (25 points)
  if (normalizedNames.some((name) => name.includes(normalizedQuery))) {
    score += 25;
  }

  if (
    includesQuery(
      [tool.tagline, tool.taglineVi, tool.summary, tool.summaryVi],
      normalizedQuery
    )
  ) {
    score += 20;
  }

  if (
    includesQuery(
      [tool.description, tool.descriptionVi, tool.content, tool.contentVi],
      normalizedQuery
    )
  ) {
    score += 10;
  }

  if (
    tool.categories.some((category) =>
      includesQuery(
        [
          category.slug,
          category.name,
          category.nameVi,
          category.label,
          category.labelVi,
        ],
        normalizedQuery
      )
    )
  ) {
    score += 30;
  }

  // Qdrant is a tie breaker only; semantic-only hits should not outrank text matches.
  if (qdrantToolIds.has(tool.id)) {
    score += 1;
  }

  return score;
}

const hasToolQueryMatch = (
  tool: SearchableTool,
  normalizedQuery: string
): boolean => calculateMatchScore(tool, normalizedQuery, new Set()) > 0;

const adminCircuitBreaker = new CircuitBreaker(
  getSearchConfig("admin").circuitBreaker
);
const publicCircuitBreaker = new CircuitBreaker(
  getSearchConfig("public").circuitBreaker
);

/**
 * Metadata about which search mode was used for each entity type
 */
interface SearchModeMetadata {
  categories: SearchMode;
  collections: SearchMode; // Always keyword (no Qdrant vectors)
  tags: SearchMode; // Always keyword (no Qdrant vectors)
  tools: SearchMode;
}

export interface SearchResults {
  categories: Awaited<ReturnType<typeof prisma.category.findMany>>;
  categoryMatches: CategoryVectorMatch[];
  collections: Awaited<ReturnType<typeof prisma.collection.findMany>>;
  elapsedMs: number;
  matches: ToolVectorMatch[];
  requestedMode: SearchMode;
  searchModes: SearchModeMetadata;
  tags: Awaited<ReturnType<typeof prisma.tag.findMany>>;
  tools: ToolMany[];
}

/**
 * Extended search results for progressive streaming
 */
export interface ProgressiveSearchResults extends SearchResults {
  isWaitingForSemantic: boolean;
  semanticComplete: boolean;
}

/**
 * Stream message types for progressive search
 */
export type ProgressiveSearchMessage =
  | { type: "initial"; data: ProgressiveSearchResults }
  | {
      type: "semantic-update";
      data: Partial<SearchResults> & {
        semanticComplete?: boolean;
        isWaitingForSemantic?: boolean;
      };
    }
  | { type: "complete"; data: SearchResults }
  | { type: "error"; error: string };

interface EntitySearchOptions {
  circuitBreaker: CircuitBreaker;
  filterPublished?: boolean;
  requireToolQueryMatch?: boolean;
  scoreThreshold?: number;
  searchLimit: number;
}

const createSearchRunner = ({
  circuitBreaker,
  searchLimit,
  filterPublished = false,
  requireToolQueryMatch = false,
  scoreThreshold = 0,
}: EntitySearchOptions) => {
  const publishedFilter = () =>
    filterPublished ? { publishedAt: { lte: new Date() } } : {};

  const searchToolsByMode = async (
    q: string,
    mode: SearchMode
  ): Promise<{
    tools: ToolMany[];
    matches: ToolVectorMatch[];
    usedMode: SearchMode;
  }> => {
    const trimmedQuery = q.trim();
    const publishedWhere = publishedFilter();

    if (mode === "keyword" || !trimmedQuery) {
      const tools = await prisma.tool.findMany({
        where: {
          ...publishedWhere,
          OR: [
            { name: { contains: trimmedQuery, mode: "insensitive" } },
            { nameVi: { contains: trimmedQuery, mode: "insensitive" } },
            { tagline: { contains: trimmedQuery, mode: "insensitive" } },
            { taglineVi: { contains: trimmedQuery, mode: "insensitive" } },
            { description: { contains: trimmedQuery, mode: "insensitive" } },
            { descriptionVi: { contains: trimmedQuery, mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        select: toolManyPayload(),
        take: searchLimit,
      });
      return { tools, matches: [], usedMode: "keyword" };
    }

    // Run Qdrant and keyword searches in parallel for true hybrid search
    const qdrantPromise = (async (): Promise<ToolVectorMatch[]> => {
      if (!circuitBreaker.canAttempt()) {
        if (isDev) {
          console.warn("Search skipped Qdrant due to open circuit breaker");
        }
        return [];
      }

      try {
        const matches = await hybridSearchToolVectors(trimmedQuery, {
          limit: searchLimit * 2, // Fetch more for merging
          prefetchLimit: searchLimit * 4,
          scoreThreshold,
        });

        circuitBreaker.recordSuccess();
        return scoreThreshold > 0
          ? matches.filter((m) => m.score >= scoreThreshold)
          : matches;
      } catch (error) {
        circuitBreaker.recordFailure();
        if (isDev) {
          console.warn(
            "Qdrant tool search failed, will rely on keyword:",
            error
          );
        }
        return [];
      }
    })();

    const keywordPromise = prisma.tool.findMany({
      where: {
        ...publishedWhere,
        OR: [
          { name: { contains: trimmedQuery, mode: "insensitive" } },
          { nameVi: { contains: trimmedQuery, mode: "insensitive" } },
          { tagline: { contains: trimmedQuery, mode: "insensitive" } },
          { taglineVi: { contains: trimmedQuery, mode: "insensitive" } },
          { description: { contains: trimmedQuery, mode: "insensitive" } },
          { descriptionVi: { contains: trimmedQuery, mode: "insensitive" } },
        ],
      },
      orderBy: { name: "asc" },
      select: toolManyPayload(),
      take: searchLimit * 2, // Fetch more for merging
    });

    const [qdrantMatches, keywordTools] = await Promise.all([
      qdrantPromise,
      keywordPromise,
    ]);

    // Hydrate Qdrant results from database
    const qdrantIds = qdrantMatches.map((m) => m.payload.id);
    const qdrantToolsFromDb =
      qdrantIds.length > 0
        ? await prisma.tool.findMany({
            where: { ...publishedWhere, id: { in: qdrantIds } },
            select: toolManyPayload(),
          })
        : [];

    // Build ordered Qdrant results
    const qdrantToolMap = new Map(qdrantToolsFromDb.map((t) => [t.id, t]));
    const orderedQdrant = qdrantMatches
      .map((match) => {
        const tool = qdrantToolMap.get(match.payload.id);
        if (!tool) {
          return null;
        }
        return { tool, match };
      })
      .filter(
        (
          entry
        ): entry is {
          tool: (typeof qdrantToolsFromDb)[number];
          match: ToolVectorMatch;
        } => Boolean(entry)
      );

    const normalizedQuery = normalizeSearchText(trimmedQuery);
    const lexicallyMatchedQdrant = orderedQdrant.filter((entry) =>
      hasToolQueryMatch(entry.tool, normalizedQuery)
    );
    const shouldRequireToolQueryMatch =
      requireToolQueryMatch &&
      (keywordTools.length > 0 || lexicallyMatchedQdrant.length > 0);
    const visibleQdrant = shouldRequireToolQueryMatch
      ? lexicallyMatchedQdrant
      : orderedQdrant;

    // Get IDs already in visible Qdrant results
    const qdrantToolIds = new Set(visibleQdrant.map((entry) => entry.tool.id));

    // Append keyword-only results (not in Qdrant results)
    const keywordOnlyTools = keywordTools.filter(
      (tool) => !qdrantToolIds.has(tool.id)
    );

    // Combine all tools for ranking
    const allToolsUnordered = [
      ...visibleQdrant.map((entry) => entry.tool),
      ...keywordOnlyTools,
    ];

    // Prioritize exact name matches first, then by match quality
    const allTools = allToolsUnordered
      .sort(createToolSortComparator(normalizedQuery, qdrantToolIds))
      .slice(0, searchLimit);

    const allMatches = orderedQdrant
      .filter((entry) => allTools.some((t) => t.id === entry.tool.id))
      .map((entry) => entry.match);

    return {
      tools: allTools,
      matches: allMatches,
      usedMode: qdrantMatches.length > 0 ? "semantic" : "keyword",
    };
  };

  const searchCategoriesByMode = async (
    q: string,
    mode: SearchMode
  ): Promise<{
    categories: Awaited<ReturnType<typeof prisma.category.findMany>>;
    matches: CategoryVectorMatch[];
    usedMode: SearchMode;
  }> => {
    const trimmedQuery = q.trim();

    if (mode === "keyword" || !trimmedQuery) {
      const categories = await prisma.category.findMany({
        where: {
          OR: [
            { name: { contains: trimmedQuery, mode: "insensitive" } },
            { nameVi: { contains: trimmedQuery, mode: "insensitive" } },
            { label: { contains: trimmedQuery, mode: "insensitive" } },
            { labelVi: { contains: trimmedQuery, mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        take: searchLimit,
      });
      return { categories, matches: [], usedMode: "keyword" };
    }

    if (!circuitBreaker.canAttempt()) {
      if (isDev) {
        console.warn(
          "Search skipped Qdrant for categories due to open circuit breaker"
        );
      }
      const categories = await prisma.category.findMany({
        where: {
          OR: [
            { name: { contains: trimmedQuery, mode: "insensitive" } },
            { nameVi: { contains: trimmedQuery, mode: "insensitive" } },
            { label: { contains: trimmedQuery, mode: "insensitive" } },
            { labelVi: { contains: trimmedQuery, mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        take: searchLimit,
      });
      return { categories, matches: [], usedMode: "keyword" };
    }

    try {
      const matches = await searchCategoryVectors(trimmedQuery, {
        limit: searchLimit,
        scoreThreshold,
      });

      const filteredMatches =
        scoreThreshold > 0
          ? matches.filter((m) => m.score >= scoreThreshold)
          : matches;

      if (!filteredMatches.length) {
        const categories = await prisma.category.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { nameVi: { contains: q, mode: "insensitive" } },
              { label: { contains: q, mode: "insensitive" } },
              { labelVi: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { name: "asc" },
          take: searchLimit,
        });
        return { categories, matches: [], usedMode: "keyword" };
      }

      const categoryIds = filteredMatches.map((m) => m.payload.id);
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
      });

      const categoryMap = new Map(categories.map((c) => [c.id, c]));
      const orderedCategories = categoryIds
        .map((id) => categoryMap.get(id))
        .filter(Boolean) as typeof categories;

      circuitBreaker.recordSuccess();
      return {
        categories: orderedCategories,
        matches: filteredMatches,
        usedMode: "semantic",
      };
    } catch (error) {
      if (isDev) {
        console.warn(
          "Qdrant category search failed, falling back to keyword:",
          error
        );
      }
      circuitBreaker.recordFailure();
      const categories = await prisma.category.findMany({
        where: {
          OR: [
            { name: { contains: trimmedQuery, mode: "insensitive" } },
            { nameVi: { contains: trimmedQuery, mode: "insensitive" } },
            { label: { contains: trimmedQuery, mode: "insensitive" } },
            { labelVi: { contains: trimmedQuery, mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        take: searchLimit,
      });
      return { categories, matches: [], usedMode: "keyword" };
    }
  };

  return {
    searchToolsByMode,
    searchCategoriesByMode,
  };
};

const adminSearchRunner = createSearchRunner({
  circuitBreaker: adminCircuitBreaker,
  searchLimit: SEARCH_LIMIT,
});

const publicSearchRunner = createSearchRunner({
  circuitBreaker: publicCircuitBreaker,
  searchLimit: SEARCH_LIMIT,
  filterPublished: true,
  requireToolQueryMatch: true,
  scoreThreshold: getSearchConfig("public").scoreThreshold,
});

const performSearch = async (
  q: string,
  mode: SearchMode,
  runner: ReturnType<typeof createSearchRunner>,
  options: { useSemanticCache?: boolean } = {}
): Promise<SearchResults> => {
  if (options.useSemanticCache && q.trim().length > 2) {
    try {
      const cached = await findCachedSearch(q);
      if (cached) {
        return cached as unknown as SearchResults;
      }
    } catch (error) {
      if (isDev) {
        console.error("Failed to check semantic cache:", error);
      }
    }
  }

  const start = performance.now();

  const [toolsResult, categoriesResult, collections, tags] = await Promise.all([
    runner.searchToolsByMode(q, mode),
    runner.searchCategoriesByMode(q, mode),
    prisma.collection.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { nameVi: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { name: "asc" },
      take: SEARCH_LIMIT,
    }),
    prisma.tag.findMany({
      where: {
        OR: [
          { slug: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { nameVi: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { slug: "asc" },
      take: SEARCH_LIMIT,
    }),
  ]);

  const searchModes: SearchModeMetadata = {
    tools: toolsResult.usedMode,
    categories: categoriesResult.usedMode,
    collections: "keyword",
    tags: "keyword",
  };

  const results = {
    tools: toolsResult.tools,
    categories: categoriesResult.categories,
    collections,
    tags,
    matches: toolsResult.matches,
    categoryMatches: categoriesResult.matches,
    searchModes,
    requestedMode: mode,
    elapsedMs: Math.round(performance.now() - start),
  };

  if (options.useSemanticCache && q.trim().length > 2) {
    // Cache the results asynchronously
    storeCachedSearch({
      question: q,
      searchResults: results,
    }).catch((err) => {
      if (isDev) {
        console.error("Failed to store search cache:", err);
      }
    });
  }

  return results;
};

export const searchItems = authedProcedure
  .createServerAction()
  .input(
    z.object({
      q: z.string(),
      mode: z.enum(["keyword", "semantic"]).optional().default("semantic"),
    })
  )
  .handler(async ({ input: { q, mode } }) =>
    runWithEmbeddingCache(async () => {
      const results = await performSearch(q, mode, adminSearchRunner);

      if (isDev) {
        console.log(
          `Admin search (${mode}): ${results.elapsedMs}ms [tools:${results.searchModes.tools}, categories:${results.searchModes.categories}]`
        );
      }

      return results;
    })
  );

export const searchPaletteItems = createServerAction()
  .input(
    z.object({
      q: z.string(),
      mode: z.enum(["keyword", "semantic"]).optional().default("semantic"),
    })
  )
  .handler(async ({ input: { q, mode } }) =>
    runWithEmbeddingCache(async () =>
      performSearch(q, mode, publicSearchRunner, { useSemanticCache: true })
    )
  );

export const keywordSearchPaletteItems = createServerAction()
  .input(z.object({ q: z.string() }))
  .handler(async ({ input: { q } }) =>
    performSearch(q, "keyword", publicSearchRunner, { useSemanticCache: false })
  );

/**
 * Progressive search that streams results immediately
 */
// biome-ignore lint/suspicious/useAwait: Returns async generator for streaming results
export const progressiveSearchPaletteItems = async ({
  q,
  mode = "semantic",
}: {
  q: string;
  mode?: SearchMode;
}): Promise<AsyncGenerator<ProgressiveSearchMessage, void, unknown>> => {
  async function* generator(): AsyncGenerator<
    ProgressiveSearchMessage,
    void,
    unknown
  > {
    const trimmedQuery = q.trim();

    // Handle empty query
    if (trimmedQuery.length <= 1) {
      yield {
        type: "initial",
        data: {
          tools: [],
          categories: [],
          collections: [],
          tags: [],
          matches: [],
          categoryMatches: [],
          searchModes: {
            tools: "keyword",
            categories: "keyword",
            collections: "keyword",
            tags: "keyword",
          },
          requestedMode: mode,
          elapsedMs: 0,
          semanticComplete: true,
          isWaitingForSemantic: false,
        } as ProgressiveSearchResults,
      };
      return;
    }

    const startTime = performance.now();

    // Step 1: Run keyword search immediately (fast path)
    const keywordSearchPromise = (async () => {
      const [toolsResult, categoriesResult] = await Promise.all([
        publicSearchRunner.searchToolsByMode(trimmedQuery, "keyword"),
        publicSearchRunner.searchCategoriesByMode(trimmedQuery, "keyword"),
      ]);

      return {
        toolsResult,
        categoriesResult,
      };
    })();

    // Step 2: Run semantic search in parallel (slow path)
    const semanticSearchPromise = (async () => {
      try {
        const [toolsResult, categoriesResult] = await Promise.all([
          publicSearchRunner.searchToolsByMode(trimmedQuery, "semantic"),
          publicSearchRunner.searchCategoriesByMode(trimmedQuery, "semantic"),
        ]);

        return {
          toolsResult,
          categoriesResult,
          error: null,
        };
      } catch (error) {
        if (isDev) {
          console.warn("Semantic search failed:", error);
        }
        return {
          toolsResult: null,
          categoriesResult: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    })();

    // Step 3: Yield keyword results immediately
    const keywordResults = await keywordSearchPromise;
    const keywordElapsedTime = Math.round(performance.now() - startTime);

    const collectionsPromise = prisma.collection.findMany({
      where: {
        OR: [
          { name: { contains: trimmedQuery, mode: "insensitive" } },
          { nameVi: { contains: trimmedQuery, mode: "insensitive" } },
        ],
      },
      orderBy: { name: "asc" },
      take: SEARCH_LIMIT,
    });

    const tagsPromise = prisma.tag.findMany({
      where: {
        OR: [
          { slug: { contains: trimmedQuery, mode: "insensitive" } },
          { name: { contains: trimmedQuery, mode: "insensitive" } },
          { nameVi: { contains: trimmedQuery, mode: "insensitive" } },
        ],
      },
      orderBy: { slug: "asc" },
      take: SEARCH_LIMIT,
    });

    const [collections, tags] = await Promise.all([
      collectionsPromise,
      tagsPromise,
    ]);

    const initialResults: ProgressiveSearchResults = {
      tools: keywordResults.toolsResult.tools,
      categories: keywordResults.categoriesResult.categories,
      collections,
      tags,
      matches: keywordResults.toolsResult.matches,
      categoryMatches: keywordResults.categoriesResult.matches,
      searchModes: {
        tools: "keyword",
        categories: "keyword",
        collections: "keyword",
        tags: "keyword",
      },
      requestedMode: mode,
      elapsedMs: keywordElapsedTime,
      semanticComplete: false,
      isWaitingForSemantic: true,
    };

    yield {
      type: "initial",
      data: initialResults,
    } satisfies ProgressiveSearchMessage;

    // Step 4: Wait for semantic results and stream update
    const semanticResults = await semanticSearchPromise;

    if (semanticResults.error) {
      // Semantic failed - yield error but we already showed keyword results
      yield {
        type: "semantic-update",
        data: {
          searchModes: {
            ...initialResults.searchModes,
            tools: "keyword",
            categories: "keyword",
          },
          semanticComplete: true,
          isWaitingForSemantic: false,
        },
      } satisfies ProgressiveSearchMessage;
      return;
    }

    // Merge semantic results with keyword results
    const semanticElapsedTime = Math.round(performance.now() - startTime);

    // Deduplicate tools by ID, keeping semantic order
    const semanticToolIds = new Set(
      semanticResults.toolsResult?.tools.map((t) => t.id) || []
    );
    const mergedTools = [
      ...(semanticResults.toolsResult?.tools || []),
      ...keywordResults.toolsResult.tools.filter(
        (tool) => !semanticToolIds.has(tool.id)
      ),
    ].slice(0, SEARCH_LIMIT);

    // Deduplicate categories by ID
    const semanticCategoryIds = new Set(
      semanticResults.categoriesResult?.categories.map((c) => c.id) || []
    );
    const mergedCategories = [
      ...(semanticResults.categoriesResult?.categories || []),
      ...keywordResults.categoriesResult.categories.filter(
        (category) => !semanticCategoryIds.has(category.id)
      ),
    ].slice(0, SEARCH_LIMIT);

    const finalResults: SearchResults = {
      tools: mergedTools,
      categories: mergedCategories,
      collections: initialResults.collections,
      tags: initialResults.tags,
      matches: semanticResults.toolsResult?.matches || [],
      categoryMatches: semanticResults.categoriesResult?.matches || [],
      searchModes: {
        tools:
          semanticResults.toolsResult?.usedMode ||
          keywordResults.toolsResult.usedMode,
        categories:
          semanticResults.categoriesResult?.usedMode ||
          keywordResults.categoriesResult.usedMode,
        collections: "keyword",
        tags: "keyword",
      },
      requestedMode: mode,
      elapsedMs: semanticElapsedTime,
    };

    yield {
      type: "semantic-update",
      data: {
        tools: mergedTools,
        categories: mergedCategories,
        matches: finalResults.matches,
        categoryMatches: finalResults.categoryMatches,
        searchModes: finalResults.searchModes,
        semanticComplete: true,
        isWaitingForSemantic: false,
      },
    } satisfies ProgressiveSearchMessage;

    yield {
      type: "complete",
      data: finalResults,
    } satisfies ProgressiveSearchMessage;

    // Cache results if enabled
    if (trimmedQuery.length > 2) {
      storeCachedSearch({
        question: q,
        searchResults: finalResults as unknown as Record<string, unknown>,
      }).catch((err) => {
        if (isDev) {
          console.error("Failed to store search cache:", err);
        }
      });
    }
  }

  return generator();
};
