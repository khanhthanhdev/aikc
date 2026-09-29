import assert from "node:assert/strict";
import test from "node:test";
import { toolCardPayload } from "~/server/tools/payloads";
import {
  MAX_SEARCH_PAGE,
  MAX_SEARCH_QUERY_LENGTH,
  MAX_SEARCH_RESULTS_PER_PAGE,
  searchParamsCache,
} from "~/server/tools/search-params";

test("public tool search bounds pagination inputs on both sides", () => {
  assert.deepEqual(
    searchParamsCache.parse({ page: "-8", perPage: "9999" }),
    {
      category: "",
      collection: [],
      mode: "semantic",
      page: 1,
      perPage: MAX_SEARCH_RESULTS_PER_PAGE,
      pricing: "",
      q: null,
      sort: "publishedAt.desc",
      tag: [],
    }
  );

  const upperBound = searchParamsCache.parse({
    page: "999999",
    perPage: "0",
  });
  assert.equal(upperBound.page, MAX_SEARCH_PAGE);
  assert.equal(upperBound.perPage, 1);
});

test("public tool search uses defaults for malformed integers", () => {
  const parsed = searchParamsCache.parse({ page: "2abc", perPage: "1.5" });
  assert.equal(parsed.page, 1);
  assert.equal(parsed.perPage, 14);
});

test("public tool search trims and caps the query before caching", () => {
  const query = `  ${"x".repeat(MAX_SEARCH_QUERY_LENGTH + 20)}  `;
  const parsed = searchParamsCache.parse({ q: query });

  assert.equal(parsed.q?.length, MAX_SEARCH_QUERY_LENGTH);
  assert.equal(parsed.q, "x".repeat(MAX_SEARCH_QUERY_LENGTH));
});

test("tool card payload excludes article-sized fields and relations", () => {
  const payload = toolCardPayload();

  assert.equal(payload.description, true);
  assert.equal(payload.faviconUrl, true);
  assert.equal("content" in payload, false);
  assert.equal("contentVi" in payload, false);
  assert.equal("categories" in payload, false);
  assert.equal("collections" in payload, false);
});
