import type { SearchErrorInfo } from "../search-errors";

export type SearchMode = "keyword" | "semantic";
export type SearchMatchType = SearchMode | "fallback";

export interface SearchTimings {
  hydrateMs?: number;
  keywordMs?: number;
  totalMs?: number;
  vectorMs?: number;
}

export interface SearchResultMetadata {
  circuitBreakerState?: "open" | "half-open" | "closed";
  errors?: SearchErrorInfo[];
  hasFallback: boolean;
  keywordResultCount?: number;
  matchType: SearchMatchType;
  mode: SearchMode;
  qdrantResultCount?: number;
  requestedMode?: SearchMode | "hybrid";
  strategy?: "keyword" | "semantic" | "rrf";
  timings?: SearchTimings;
  usedQdrant: boolean;
}

export interface SearchResult<TItem, TMatch = unknown> {
  items: TItem[];
  matches?: TMatch[];
  metadata: SearchResultMetadata;
  totalCount: number;
}

export const normalizeSearchMode = (mode?: string | null): SearchMode => {
  const normalized = (mode || "").toLowerCase();
  if (normalized === "semantic" || normalized === "hybrid") {
    return "semantic";
  }

  return "keyword";
};
