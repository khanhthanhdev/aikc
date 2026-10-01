"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "~/lib/analytics";

/**
 * How long a query and its result count have to stay unchanged before the
 * search counts. Search boxes here update as the visitor types, and "cha",
 * "chat", "chatg" are not three searches.
 */
const SETTLE_MS = 1500;

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

/**
 * Records a `search` event once the query settles, with how many results it
 * found, so searches that come back empty show what the directory is missing.
 *
 * `results` is null while they are still loading. The count often arrives
 * after the query, so either one changing restarts the wait, and each query is
 * recorded once.
 */
export const useTrackSearch = (
  query: string | null | undefined,
  results: number | null,
  source: string
) => {
  const lastTrackedRef = useRef<string | null>(null);

  useEffect(() => {
    const trimmed = query?.trim().toLowerCase().slice(0, MAX_QUERY_LENGTH);

    if (
      !trimmed ||
      trimmed.length < MIN_QUERY_LENGTH ||
      results === null ||
      trimmed === lastTrackedRef.current
    ) {
      return;
    }

    const timer = setTimeout(() => {
      lastTrackedRef.current = trimmed;
      trackEvent("search", { query: trimmed, results, source });
    }, SETTLE_MS);

    return () => clearTimeout(timer);
  }, [query, results, source]);
};
