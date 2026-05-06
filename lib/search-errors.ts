export enum SearchErrorCode {
  QDRANT_UNAVAILABLE = "QDRANT_UNAVAILABLE",
  EMBEDDING_FAILED = "EMBEDDING_FAILED",
  TIMEOUT = "TIMEOUT",
  NO_QUERY = "NO_QUERY",
  UNKNOWN = "UNKNOWN",
}

export type SearchErrorContext = Record<string, unknown>;

export interface SearchErrorInfo {
  cause?: string;
  code: SearchErrorCode;
  context?: SearchErrorContext;
  message: string;
  retryable: boolean;
}

interface SearchErrorOptions {
  cause?: unknown;
  context?: SearchErrorContext;
  retryable?: boolean;
}

export class SearchError extends Error {
  code: SearchErrorCode;
  retryable: boolean;
  context?: SearchErrorContext;
  override cause?: unknown;

  constructor(
    code: SearchErrorCode,
    message: string,
    options: SearchErrorOptions = {}
  ) {
    super(message);
    this.name = "SearchError";
    this.code = code;
    this.retryable = options.retryable ?? true;
    this.context = options.context;
    this.cause = options.cause;
  }

  toJSON(): SearchErrorInfo {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      cause: this.cause instanceof Error ? this.cause.message : undefined,
      context: this.context,
    };
  }
}

export const isSearchError = (error: unknown): error is SearchError =>
  error instanceof SearchError;

export const toSearchErrorInfo = (
  error: unknown,
  fallbackCode: SearchErrorCode = SearchErrorCode.UNKNOWN,
  options: { context?: SearchErrorContext; retryable?: boolean } = {}
): SearchErrorInfo => {
  if (error instanceof SearchError) {
    const serialized = error.toJSON();
    return {
      ...serialized,
      context: { ...serialized.context, ...options.context },
      retryable: options.retryable ?? serialized.retryable,
    };
  }

  const message =
    error instanceof Error ? error.message : "Unknown search error";
  const cause =
    error instanceof Error ? (error.stack ?? error.message) : undefined;

  return {
    code: fallbackCode,
    message,
    retryable: options.retryable ?? false,
    cause,
    context: options.context,
  };
};
