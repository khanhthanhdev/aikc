import { createSearchParamsCache, parseAsInteger } from "nuqs/server";

export const searchParams = {
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(96),
};

export const searchParamsCache = createSearchParamsCache(searchParams);
