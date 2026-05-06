"use client";

import * as React from "react";

type QueryParams = Record<string, string | number | null>;

export function useQueryString(searchParams: URLSearchParams) {
  const searchParamsRef = React.useRef(searchParams);
  searchParamsRef.current = searchParams;

  const createQueryString = React.useCallback((params: QueryParams) => {
    const newSearchParams = new URLSearchParams(
      searchParamsRef.current?.toString()
    );

    for (const [key, value] of Object.entries(params)) {
      if (value === null) {
        newSearchParams.delete(key);
      } else {
        newSearchParams.set(key, String(value));
      }
    }

    return newSearchParams.toString();
  }, []);

  return { createQueryString };
}
