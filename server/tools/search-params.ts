import {
  createParser,
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsString,
} from "nuqs/server";
import { normalizeSearchMode, type SearchMode } from "~/lib/search/types";

export type { SearchMode };

export const MAX_SEARCH_PAGE = 200;
export const MAX_SEARCH_QUERY_LENGTH = 200;
export const MAX_SEARCH_RESULTS_PER_PAGE = 48;

const createBoundedIntegerParser = (minimum: number, maximum: number) =>
  createParser({
    parse: (value) => {
      const parsed = Number(value);
      if (!Number.isInteger(parsed)) {
        return null;
      }
      return Math.min(maximum, Math.max(minimum, parsed));
    },
    serialize: String,
  });

const boundedQueryParser = createParser({
  parse: (value) => value.trim().slice(0, MAX_SEARCH_QUERY_LENGTH),
  serialize: (value) => value.trim().slice(0, MAX_SEARCH_QUERY_LENGTH),
});

export const searchParams = {
  q: boundedQueryParser,
  category: parseAsString.withDefault(""),
  pricing: parseAsString.withDefault(""),
  page: createBoundedIntegerParser(1, MAX_SEARCH_PAGE).withDefault(1),
  sort: parseAsString.withDefault("publishedAt.desc"),
  perPage: createBoundedIntegerParser(
    1,
    MAX_SEARCH_RESULTS_PER_PAGE
  ).withDefault(14),
  mode: parseAsString.withDefault("semantic"),
  tag: parseAsArrayOf(parseAsString).withDefault([]),
  collection: parseAsArrayOf(parseAsString).withDefault([]),
};

export const searchParamsCache = createSearchParamsCache(searchParams);

export type FilterSchema = Awaited<ReturnType<typeof searchParamsCache.parse>>;

export const resolveSearchMode = (mode?: string | null): SearchMode =>
  normalizeSearchMode(mode);
