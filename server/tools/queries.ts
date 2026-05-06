import type { Prisma } from "@prisma/client";
import type { SearchParams } from "nuqs/server";
import { cache } from "react";
import { getSearchConfig, type SearchConfig } from "~/config/search";
import { runWithEmbeddingCache } from "~/lib/embedding-cache";
import { createLogger } from "~/lib/logger";
import {
  normalizeSearchMode,
  type SearchMode,
  type SearchResult,
  type SearchResultMetadata,
} from "~/lib/search/types";
import {
  SearchError,
  SearchErrorCode,
  toSearchErrorInfo,
} from "~/lib/search-errors";
import {
  CircuitBreaker,
  type SearchExecuteOptions,
  SearchOrchestrator,
  type SearchStrategy,
} from "~/lib/search-strategy";
import {
  type AlternativeVectorMatch,
  hybridSearchToolVectors,
  searchAlternativeVectors,
  type ToolVectorMatch,
} from "~/lib/vector-store";
import {
  type ToolMany,
  toolManyPayload,
  toolOnePayload,
} from "~/server/tools/payloads";
import { searchParamsCache } from "~/server/tools/search-params";
import { prisma } from "~/services/prisma";

const log = createLogger("tool-search");
interface SortConfig {
  sortBy: keyof Prisma.ToolOrderByWithRelationInput;
  sortOrder: "asc" | "desc";
}

const DEFAULT_SORT: SortConfig = { sortBy: "publishedAt", sortOrder: "desc" };
const allowedSortColumns: ReadonlyArray<
  keyof Prisma.ToolOrderByWithRelationInput
> = ["name", "publishedAt", "createdAt", "updatedAt"];

type ToolSearchResult = SearchResult<ToolMany, ToolVectorMatch>;
type AlternativeSearchResult = SearchResult<ToolMany, AlternativeVectorMatch>;
type ParsedToolSearchParams = Awaited<
  ReturnType<typeof searchParamsCache.parse>
>;

interface ToolSearchContext {
  params: ParsedToolSearchParams;
  prismaArgs: Prisma.ToolFindManyArgs;
  searchConfig: SearchConfig;
}

const defaultMetadata = (
  overrides: Partial<SearchResultMetadata> = {}
): SearchResultMetadata => {
  const errors = overrides.errors?.filter(Boolean);

  return {
    mode: "keyword",
    matchType: "keyword",
    usedQdrant: false,
    hasFallback: false,
    ...overrides,
    errors: errors?.length ? errors : undefined,
  };
};

const parseSort = (sort: string): SortConfig => {
  const [sortBy, sortOrder] = sort.split(".");
  const order = sortOrder === "asc" || sortOrder === "desc" ? sortOrder : null;
  const isValidColumn = allowedSortColumns.includes(
    sortBy as SortConfig["sortBy"]
  );

  if (!(order && isValidColumn)) {
    return DEFAULT_SORT;
  }

  return { sortBy: sortBy as SortConfig["sortBy"], sortOrder: order };
};

const buildPricingWhere = (
  pricing: string | null | undefined
): Prisma.ToolWhereInput | undefined => {
  const normalized = pricing?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === "free") {
    return {
      AND: [
        {
          OR: [
            { pricing: { contains: "free", mode: "insensitive" } },
            { pricingVi: { contains: "free", mode: "insensitive" } },
            { pricingVi: { contains: "miễn phí", mode: "insensitive" } },
            { pricing: { contains: "open source", mode: "insensitive" } },
            { pricingVi: { contains: "mã nguồn mở", mode: "insensitive" } },
          ],
        },
      ],
      NOT: [
        { pricing: { contains: "freemium", mode: "insensitive" } },
        { pricingVi: { contains: "freemium", mode: "insensitive" } },
      ],
    };
  }

  if (normalized === "freemium") {
    return {
      OR: [
        { pricing: { contains: "freemium", mode: "insensitive" } },
        { pricingVi: { contains: "freemium", mode: "insensitive" } },
        { pricing: { contains: "free tier", mode: "insensitive" } },
        { pricing: { contains: "free plan", mode: "insensitive" } },
        { pricing: { contains: "free trial", mode: "insensitive" } },
        { pricing: { contains: "free + paid", mode: "insensitive" } },
        { pricing: { contains: "free / paid", mode: "insensitive" } },
        { pricing: { contains: "free and paid", mode: "insensitive" } },
      ],
    };
  }

  if (normalized === "paid") {
    return {
      AND: [
        {
          OR: [{ pricing: { not: null } }, { pricingVi: { not: null } }],
        },
        {
          OR: [{ pricing: { not: "" } }, { pricingVi: { not: "" } }],
        },
      ],
      NOT: [
        { pricing: { contains: "free", mode: "insensitive" } },
        { pricingVi: { contains: "free", mode: "insensitive" } },
        { pricingVi: { contains: "miễn phí", mode: "insensitive" } },
        { pricing: { contains: "freemium", mode: "insensitive" } },
        { pricingVi: { contains: "freemium", mode: "insensitive" } },
        { pricing: { contains: "open source", mode: "insensitive" } },
        { pricingVi: { contains: "mã nguồn mở", mode: "insensitive" } },
      ],
    };
  }

  return undefined;
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => Error
) => {
  if (timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

const keywordSearch = async (
  context: ToolSearchContext,
  metadataOverrides: Partial<SearchResultMetadata> = {}
): Promise<ToolSearchResult> => {
  const { params, prismaArgs } = context;
  const { q, category, pricing, page, sort, perPage } = params;
  const { where, include: _include, select: _select, ...args } = prismaArgs;
  const skip = (page - 1) * perPage;
  const take = perPage;
  const { sortBy, sortOrder } = parseSort(sort);

  const pricingWhere = buildPricingWhere(pricing);
  const filters: Prisma.ToolWhereInput[] = [];

  if (category) {
    filters.push({ categories: { some: { slug: category } } });
  }

  if (q) {
    filters.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { nameVi: { contains: q, mode: "insensitive" } },
        { tagline: { contains: q, mode: "insensitive" } },
        { taglineVi: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { descriptionVi: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (pricingWhere) {
    filters.push(pricingWhere);
  }

  const whereQuery: Prisma.ToolWhereInput = filters.length
    ? { AND: filters }
    : {};

  const startedAt = Date.now();

  const [tools, totalCount] = await prisma.$transaction([
    prisma.tool.findMany({
      ...args,
      orderBy: { [sortBy]: sortOrder },
      where: { publishedAt: { lte: new Date() }, ...whereQuery, ...where },
      select: toolManyPayload(),
      take,
      skip,
    }),

    prisma.tool.count({
      where: { publishedAt: { lte: new Date() }, ...whereQuery, ...where },
    }),
  ]);

  const metadata = defaultMetadata({
    ...metadataOverrides,
    mode: "keyword",
    keywordResultCount: totalCount,
    timings: {
      totalMs: Date.now() - startedAt,
      ...metadataOverrides.timings,
    },
  });

  return {
    items: tools,
    totalCount,
    matches: [],
    metadata,
  };
};

// Strategy implementations consumed by the search orchestrator (keyword + semantic modes)
class ToolKeywordSearchStrategy
  implements SearchStrategy<ToolMany, ToolVectorMatch, ToolSearchContext>
{
  canHandle(mode: SearchMode) {
    return mode === "keyword";
  }

  async execute(
    _query: string,
    { context, metadata, mode }: SearchExecuteOptions<ToolSearchContext>
  ): Promise<ToolSearchResult> {
    const mergedMetadata: Partial<SearchResultMetadata> = {
      requestedMode: metadata?.requestedMode ?? mode,
      ...metadata,
      mode: "keyword",
      matchType:
        metadata?.matchType ?? (metadata?.hasFallback ? "fallback" : "keyword"),
      usedQdrant: false,
    };

    return keywordSearch(context, mergedMetadata);
  }
}

class ToolSemanticSearchStrategy
  implements SearchStrategy<ToolMany, ToolVectorMatch, ToolSearchContext>
{
  canHandle(mode: SearchMode) {
    return mode === "semantic";
  }

  async execute(
    query: string,
    { context, metadata, mode }: SearchExecuteOptions<ToolSearchContext>
  ): Promise<ToolSearchResult> {
    const { params, prismaArgs, searchConfig } = context;
    const { q, category, pricing, perPage, page } = params;
    const requestedMode = metadata?.requestedMode ?? mode;
    const startedAt = Date.now();
    const errors: SearchResultMetadata["errors"] = metadata?.errors
      ? [...metadata.errors]
      : [];

    let matches: ToolVectorMatch[] = [];
    let usedQdrant = false;
    let vectorMs: number | undefined;
    let keywordMs: number | undefined;
    let hydrateMs: number | undefined;

    const offset = (page - 1) * perPage;
    const categoryFilter: Prisma.ToolWhereInput | undefined = category
      ? { categories: { some: { slug: category } } }
      : undefined;
    const pricingWhere = buildPricingWhere(pricing);
    const { where, include: _include, select: _select, ...args } = prismaArgs;

    // Run Qdrant and keyword searches in parallel
    const qdrantPromise = (async () => {
      try {
        const vectorStart = Date.now();
        const semanticResults = await withTimeout(
          hybridSearchToolVectors(query, {
            category: category || undefined,
            limit: perPage * 2, // Fetch more to allow merging
            offset: 0, // Always start from 0 for merging
            prefetchLimit: searchConfig.prefetchLimit,
            scoreThreshold: searchConfig.scoreThreshold,
          }),
          searchConfig.timeoutMs,
          () =>
            new SearchError(SearchErrorCode.TIMEOUT, "Search timed out", {
              context: { query },
              retryable: false,
            })
        );
        vectorMs = Date.now() - vectorStart;
        usedQdrant = true;

        if (searchConfig.scoreThreshold > 0) {
          return semanticResults.filter(
            (match) => match.score >= searchConfig.scoreThreshold
          );
        }
        return semanticResults;
      } catch (error) {
        log.warn("Qdrant search failed, will rely on keyword results", {
          query,
          error: error instanceof Error ? error.message : String(error),
        });
        errors.push(
          toSearchErrorInfo(error, SearchErrorCode.QDRANT_UNAVAILABLE, {
            context: { query },
          })
        );
        return [];
      }
    })();

    const keywordPromise = (async () => {
      const keywordStart = Date.now();
      const filters: Prisma.ToolWhereInput[] = [];

      if (categoryFilter) {
        filters.push(categoryFilter);
      }

      if (q) {
        filters.push({
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { nameVi: { contains: q, mode: "insensitive" } },
            { tagline: { contains: q, mode: "insensitive" } },
            { taglineVi: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { descriptionVi: { contains: q, mode: "insensitive" } },
          ],
        });
      }

      if (pricingWhere) {
        filters.push(pricingWhere);
      }

      const whereQuery: Prisma.ToolWhereInput = filters.length
        ? { AND: filters }
        : {};

      const keywordTools = await prisma.tool.findMany({
        // cacheStrategy: { ttl: 86400, tags: ["tools_list"] },
        ...args,
        where: {
          publishedAt: { lte: new Date() },
          ...whereQuery,
          ...where,
        },
        select: toolManyPayload(),
        take: perPage * 2, // Fetch more to allow merging
      });
      keywordMs = Date.now() - keywordStart;
      return keywordTools;
    })();

    const [qdrantResults, keywordTools] = await Promise.all([
      qdrantPromise,
      keywordPromise,
    ]);
    matches = qdrantResults;

    // Hydrate Qdrant results from database
    const hydrateStartedAt = Date.now();
    const qdrantIds = matches.map((match) => match.payload.id);
    const hydrateFilters: Prisma.ToolWhereInput[] = [];

    if (categoryFilter) {
      hydrateFilters.push(categoryFilter);
    }

    if (pricingWhere) {
      hydrateFilters.push(pricingWhere);
    }

    const hydrateWhere: Prisma.ToolWhereInput = hydrateFilters.length
      ? { AND: hydrateFilters }
      : {};
    const qdrantToolsFromDb =
      qdrantIds.length > 0
        ? await prisma.tool.findMany({
            // cacheStrategy: { ttl: 86400, tags: ["tools_list"] },
            ...args,
            where: {
              id: { in: qdrantIds },
              publishedAt: { lte: new Date() },
              ...hydrateWhere,
              ...where,
            },
            select: toolManyPayload(),
          })
        : [];
    hydrateMs = Date.now() - hydrateStartedAt;

    // Build ordered Qdrant results
    const qdrantToolMap = new Map(
      qdrantToolsFromDb.map((tool) => [tool.id, tool])
    );
    const orderedQdrant = matches
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

    // Get IDs already in Qdrant results
    const qdrantToolIds = new Set(orderedQdrant.map((entry) => entry.tool.id));

    // Append keyword-only results (not in Qdrant results)
    const keywordOnlyTools = keywordTools.filter(
      (tool) => !qdrantToolIds.has(tool.id)
    );

    // Combine all tools for ranking
    const allToolsUnordered = [
      ...orderedQdrant.map((entry) => entry.tool),
      ...keywordOnlyTools,
    ];

    // Prioritize exact name matches first, then by whether from Qdrant (score-based), then keyword
    const queryLower = query.toLowerCase();
    const allTools = allToolsUnordered.sort((a, b) => {
      const aNames = [a.name, a.nameVi]
        .filter((name): name is string => Boolean(name))
        .map((name) => name.toLowerCase());
      const bNames = [b.name, b.nameVi]
        .filter((name): name is string => Boolean(name))
        .map((name) => name.toLowerCase());

      // Exact match gets highest priority
      const aExact = aNames.includes(queryLower);
      const bExact = bNames.includes(queryLower);
      if (aExact && !bExact) {
        return -1;
      }
      if (!aExact && bExact) {
        return 1;
      }

      // Name starts with query gets second priority
      const aStarts = aNames.some((name) => name.startsWith(queryLower));
      const bStarts = bNames.some((name) => name.startsWith(queryLower));
      if (aStarts && !bStarts) {
        return -1;
      }
      if (!aStarts && bStarts) {
        return 1;
      }

      // Name contains query gets third priority
      const aContains = aNames.some((name) => name.includes(queryLower));
      const bContains = bNames.some((name) => name.includes(queryLower));
      if (aContains && !bContains) {
        return -1;
      }
      if (!aContains && bContains) {
        return 1;
      }

      // Keep Qdrant order for remaining (already sorted by score)
      const aInQdrant = qdrantToolIds.has(a.id);
      const bInQdrant = qdrantToolIds.has(b.id);
      if (aInQdrant && !bInQdrant) {
        return -1;
      }
      if (!aInQdrant && bInQdrant) {
        return 1;
      }

      return 0;
    });

    // Apply pagination to merged results
    const paginatedTools = allTools.slice(offset, offset + perPage);
    const paginatedMatches = orderedQdrant
      .filter((entry) => paginatedTools.some((t) => t.id === entry.tool.id))
      .map((entry) => entry.match);

    const metadataResult = defaultMetadata({
      ...metadata,
      mode: "semantic",
      requestedMode,
      matchType: "semantic",
      usedQdrant,
      qdrantResultCount: matches.length,
      keywordResultCount: keywordTools.length,
      hasFallback: metadata?.hasFallback ?? false,
      errors: errors.length ? errors : undefined,
      strategy: "rrf",
      timings: {
        totalMs: Date.now() - startedAt,
        vectorMs,
        keywordMs,
        hydrateMs,
      },
    });

    return {
      items: paginatedTools,
      totalCount: allTools.length,
      matches: paginatedMatches,
      metadata: metadataResult,
    };
  }
}

const toolCircuitBreaker = new CircuitBreaker(
  getSearchConfig("public").circuitBreaker
);
const keywordStrategy = new ToolKeywordSearchStrategy();
const semanticStrategy = new ToolSemanticSearchStrategy();

const toolSearchOrchestrator = new SearchOrchestrator<
  ToolMany,
  ToolVectorMatch,
  ToolSearchContext
>({
  strategies: [semanticStrategy, keywordStrategy],
  fallbackStrategy: keywordStrategy,
  circuitBreaker: toolCircuitBreaker,
  logger: log,
});

const buildToolContext = (
  params: ParsedToolSearchParams,
  prismaArgs: Prisma.ToolFindManyArgs
): ToolSearchContext => ({
  params,
  prismaArgs,
  searchConfig: getSearchConfig("public"),
});

const runToolSearch = async (
  parsedParams: ParsedToolSearchParams,
  prismaArgs: Prisma.ToolFindManyArgs,
  requestedMode?: SearchResultMetadata["requestedMode"]
): Promise<ToolSearchResult> => {
  const searchMode = normalizeSearchMode(parsedParams.mode);
  const query = parsedParams.q?.trim() ?? "";
  const metadata: Partial<SearchResultMetadata> = {
    requestedMode:
      requestedMode ??
      (parsedParams.mode as SearchResultMetadata["requestedMode"]),
  };
  const context = buildToolContext(parsedParams, prismaArgs);

  if (!query) {
    const keywordResult = await keywordStrategy.execute(query, {
      mode: "keyword",
      context,
      metadata: {
        ...metadata,
        matchType: searchMode === "keyword" ? "keyword" : "fallback",
        hasFallback: searchMode !== "keyword",
      },
    });

    return {
      ...keywordResult,
      metadata: {
        ...keywordResult.metadata,
        requestedMode: metadata.requestedMode,
        hasFallback: searchMode !== "keyword",
        matchType: searchMode === "keyword" ? "keyword" : "fallback",
        circuitBreakerState: toolCircuitBreaker.getState(),
      },
    };
  }

  return toolSearchOrchestrator.search(searchMode, query, context, metadata);
};

/**
 * Unified tool search entry point.
 * Routes keyword vs semantic modes through the search orchestrator with circuit breaker + fallback metadata.
 */
export const searchTools = async (
  searchParams: SearchParams,
  args: Prisma.ToolFindManyArgs = {}
): Promise<ToolSearchResult> =>
  runWithEmbeddingCache(() =>
    runToolSearch(searchParamsCache.parse(searchParams), args)
  );

/** @deprecated Use searchTools with mode="semantic" */
export const searchToolsHybrid = (
  searchParams: SearchParams,
  args: Prisma.ToolFindManyArgs = {}
): Promise<ToolSearchResult> =>
  runWithEmbeddingCache(() =>
    runToolSearch(
      { ...searchParamsCache.parse(searchParams), mode: "semantic" },
      args,
      "hybrid"
    )
  );

/** @deprecated Use searchTools with mode="semantic" */
export const searchToolsCombined = (
  searchParams: SearchParams,
  args: Prisma.ToolFindManyArgs = {}
): Promise<ToolSearchResult> => searchTools(searchParams, args);

/** @deprecated Use searchTools with explicit mode */
export const searchToolsUnified = (
  searchParams: SearchParams,
  args: Prisma.ToolFindManyArgs = {}
): Promise<ToolSearchResult> => searchTools(searchParams, args);

export const findTools = cache(
  async ({
    where,
    include: _include,
    select: _select,
    ...args
  }: Prisma.ToolFindManyArgs) => {
    return prisma.tool.findMany({
      ...args,
      where: { publishedAt: { lte: new Date() }, ...where },
      select: toolManyPayload(),
    });
  }
);

export const findToolSlugs = cache(
  async ({ where, orderBy, ...args }: Prisma.ToolFindManyArgs) => {
    return prisma.tool.findMany({
      ...args,
      orderBy: { name: "asc", ...orderBy },
      where: { publishedAt: { lte: new Date() }, ...where },
      select: { slug: true, updatedAt: true, publishedAt: true },
    });
  }
);

export const countTools = cache(
  async ({ where, ...args }: Prisma.ToolCountArgs) => {
    return prisma.tool.count({
      ...args,
      where: { publishedAt: { lte: new Date() }, ...where },
    });
  }
);

export const countUpcomingTools = cache(
  async ({ where, ...args }: Prisma.ToolCountArgs) => {
    return prisma.tool.count({
      ...args,
      where: {
        OR: [{ publishedAt: { gt: new Date() } }, { publishedAt: null }],
        ...where,
      },
    });
  }
);

export const findUniqueTool = cache(
  async ({
    where,
    include: _include,
    select: _select,
    ...args
  }: Prisma.ToolFindUniqueArgs) => {
    const hasExplicitPublishedAt = Object.hasOwn(where ?? {}, "publishedAt");

    return prisma.tool.findUnique({
      ...args,
      where: {
        publishedAt: hasExplicitPublishedAt ? undefined : { lte: new Date() },
        ...where,
      },
      select: toolOnePayload(),
    });
  }
);

export const findFirstTool = cache(
  async ({
    where,
    include: _include,
    select,
    ...args
  }: Prisma.ToolFindFirstArgs) => {
    return prisma.tool.findFirst({
      ...args,
      where: { publishedAt: { lte: new Date() }, ...where },
      select: select ?? toolManyPayload(),
    });
  }
);

/**
 * Unified alternative search entry point.
 * Runs semantic (Qdrant hybrid) search with circuit-breaker gating and falls back to Prisma keyword search.
 */
export const searchAlternatives = async (
  query: string,
  options: { limit?: number; offset?: number } = {}
): Promise<AlternativeSearchResult> =>
  runWithEmbeddingCache(async () => {
    const searchConfig = getSearchConfig("public");
    const { limit = searchConfig.limit, offset = 0 } = options;
    const trimmedQuery = query.trim();
    const requestedMode: SearchResultMetadata["requestedMode"] = "semantic";
    const startedAt = Date.now();
    const errors: SearchResultMetadata["errors"] = [];

    if (!trimmedQuery) {
      const tools = await prisma.tool.findMany({
        where: { publishedAt: { lte: new Date() } },
        select: toolManyPayload(),
        take: limit,
        skip: offset,
        orderBy: { name: "asc" },
      });

      const totalCount = await prisma.tool.count({
        where: { publishedAt: { lte: new Date() } },
      });

      return {
        items: tools,
        totalCount,
        matches: [],
        metadata: defaultMetadata({
          mode: "keyword",
          requestedMode: "keyword",
          keywordResultCount: totalCount,
          circuitBreakerState: toolCircuitBreaker.getState(),
          timings: { totalMs: Date.now() - startedAt },
        }),
      };
    }

    const canAttempt = toolCircuitBreaker.canAttempt();
    let matches: AlternativeVectorMatch[] = [];
    let usedQdrant = false;
    let vectorMs: number | undefined;

    if (canAttempt) {
      try {
        const vectorStart = Date.now();
        matches = await withTimeout(
          searchAlternativeVectors(trimmedQuery, {
            limit,
            offset,
            scoreThreshold: searchConfig.scoreThreshold,
          }),
          searchConfig.timeoutMs,
          () =>
            new SearchError(SearchErrorCode.TIMEOUT, "Search timed out", {
              context: { query: trimmedQuery },
              retryable: false,
            })
        );
        vectorMs = Date.now() - vectorStart;
        usedQdrant = true;

        if (searchConfig.scoreThreshold > 0) {
          matches = matches.filter(
            (m) => m.score >= searchConfig.scoreThreshold
          );
        }

        toolCircuitBreaker.recordSuccess();
      } catch (error) {
        toolCircuitBreaker.recordFailure();
        errors.push(
          toSearchErrorInfo(error, SearchErrorCode.QDRANT_UNAVAILABLE, {
            context: { query: trimmedQuery },
          })
        );
        usedQdrant = false;
      }
    } else {
      errors.push(
        new SearchError(
          SearchErrorCode.QDRANT_UNAVAILABLE,
          "Circuit breaker open",
          {
            retryable: false,
            context: { query: trimmedQuery },
          }
        ).toJSON()
      );
    }

    const keywordFallback = async (): Promise<AlternativeSearchResult> => {
      const keywordStart = Date.now();
      const keywordTools = await prisma.tool.findMany({
        where: {
          publishedAt: { lte: new Date() },
          OR: [
            { name: { contains: trimmedQuery, mode: "insensitive" } },
            { description: { contains: trimmedQuery, mode: "insensitive" } },
          ],
        },
        select: toolManyPayload(),
        take: limit,
        skip: offset,
        orderBy: { name: "asc" },
      });
      const keywordMs = Date.now() - keywordStart;

      const keywordCount = await prisma.tool.count({
        where: {
          publishedAt: { lte: new Date() },
          OR: [
            { name: { contains: trimmedQuery, mode: "insensitive" } },
            { description: { contains: trimmedQuery, mode: "insensitive" } },
          ],
        },
      });

      return {
        items: keywordTools,
        totalCount: keywordCount,
        matches: [],
        metadata: defaultMetadata({
          mode: "keyword",
          requestedMode,
          matchType: "fallback",
          usedQdrant,
          keywordResultCount: keywordCount,
          hasFallback: true,
          errors: errors.length ? errors : undefined,
          circuitBreakerState: toolCircuitBreaker.getState(),
          timings: { totalMs: Date.now() - startedAt, keywordMs },
        }),
      };
    };

    if (!matches.length) {
      log.warn("Alternative search falling back to keyword results", {
        query: trimmedQuery,
        circuitBreaker: toolCircuitBreaker.getState(),
      });
      return keywordFallback();
    }

    const toolIds = matches.map((m) => m.payload.id);
    const hydrateStart = Date.now();
    const tools = await prisma.tool.findMany({
      where: {
        id: { in: toolIds },
        publishedAt: { lte: new Date() },
      },
      select: toolManyPayload(),
    });
    const hydrateMs = Date.now() - hydrateStart;

    const toolMap = new Map(tools.map((t) => [t.id, t]));
    const orderedTools = toolIds
      .map((id) => toolMap.get(id))
      .filter(Boolean) as typeof tools;

    return {
      items: orderedTools,
      totalCount: orderedTools.length,
      matches,
      metadata: defaultMetadata({
        mode: "semantic",
        requestedMode,
        matchType: "semantic",
        usedQdrant: true,
        qdrantResultCount: matches.length,
        hasFallback: false,
        errors: errors.length ? errors : undefined,
        circuitBreakerState: toolCircuitBreaker.getState(),
        timings: { totalMs: Date.now() - startedAt, vectorMs, hydrateMs },
      }),
    };
  });
