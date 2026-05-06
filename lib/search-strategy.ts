import { createLogger } from "~/lib/logger";
import type {
  SearchMode,
  SearchResult,
  SearchResultMetadata,
} from "~/lib/search/types";
import {
  SearchError,
  SearchErrorCode,
  toSearchErrorInfo,
} from "~/lib/search-errors";

export interface SearchExecuteOptions<TContext> {
  context: TContext;
  metadata?: Partial<SearchResultMetadata>;
  mode: SearchMode;
}

export interface SearchStrategy<TItem, TMatch, TContext> {
  canHandle(mode: SearchMode): boolean;
  execute(
    query: string,
    options: SearchExecuteOptions<TContext>
  ): Promise<SearchResult<TItem, TMatch>>;
}

type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  failureThreshold: number;
  halfOpenAfterMs: number;
  successThreshold: number;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private openedAt: number | null = null;
  private readonly logger = createLogger("circuit-breaker");

  constructor(private readonly options: CircuitBreakerOptions) {}

  getState(): CircuitState {
    return this.state;
  }

  private transition(next: CircuitState) {
    if (this.state === next) {
      return;
    }
    this.state = next;
    if (next === "open") {
      this.openedAt = Date.now();
      this.logger.warn("Circuit breaker opened");
    } else if (next === "half-open") {
      this.logger.info("Circuit breaker half-open; allowing limited attempts");
    } else {
      this.logger.info("Circuit breaker closed; Qdrant calls restored");
    }
  }

  canAttempt(): boolean {
    if (this.state === "closed") {
      return true;
    }

    if (this.state === "open") {
      const now = Date.now();
      if (
        this.openedAt &&
        now - this.openedAt >= this.options.halfOpenAfterMs
      ) {
        this.transition("half-open");
        this.failureCount = 0;
        this.successCount = 0;
        return true;
      }
      return false;
    }

    return true; // half-open
  }

  recordFailure() {
    this.failureCount += 1;
    this.successCount = 0;

    if (this.state === "half-open") {
      this.transition("open");
      return;
    }

    if (this.failureCount >= this.options.failureThreshold) {
      this.transition("open");
    }
  }

  recordSuccess() {
    if (this.state === "half-open") {
      this.successCount += 1;
      if (this.successCount >= this.options.successThreshold) {
        this.failureCount = 0;
        this.successCount = 0;
        this.transition("closed");
      }
      return;
    }

    if (this.state === "open") {
      // Unexpected success while open; move to half-open for a controlled retry window.
      this.transition("half-open");
      this.successCount = 1;
      return;
    }

    this.failureCount = 0;
  }
}

interface OrchestratorOptions<TItem, TMatch, TContext> {
  circuitBreaker?: CircuitBreaker;
  fallbackStrategy: SearchStrategy<TItem, TMatch, TContext>;
  logger?: ReturnType<typeof createLogger>;
  strategies: SearchStrategy<TItem, TMatch, TContext>[];
}

export class SearchOrchestrator<TItem, TMatch, TContext> {
  private readonly log: ReturnType<typeof createLogger>;

  constructor(
    private readonly options: OrchestratorOptions<TItem, TMatch, TContext>
  ) {
    this.log = this.options.logger ?? createLogger("search-orchestrator");
  }

  private appendCircuitState(
    metadata: SearchResultMetadata,
    breaker?: CircuitBreaker
  ): SearchResultMetadata {
    if (!breaker) {
      return metadata;
    }
    return { ...metadata, circuitBreakerState: breaker.getState() };
  }

  private async runFallback(
    query: string,
    options: SearchExecuteOptions<TContext>,
    error?: unknown
  ): Promise<SearchResult<TItem, TMatch>> {
    const fallbackMetadata: Partial<SearchResultMetadata> = {
      ...options.metadata,
      mode: "keyword",
      matchType: "fallback",
      usedQdrant: false,
      hasFallback: true,
      errors: [
        ...(options.metadata?.errors ?? []),
        ...(error
          ? [toSearchErrorInfo(error, SearchErrorCode.QDRANT_UNAVAILABLE)]
          : []),
      ].filter(Boolean),
    };

    const result = await this.options.fallbackStrategy.execute(query, {
      ...options,
      mode: "keyword",
      metadata: fallbackMetadata,
    });

    return {
      ...result,
      metadata: this.appendCircuitState(
        result.metadata,
        this.options.circuitBreaker
      ),
    };
  }

  async search(
    mode: SearchMode,
    query: string,
    context: TContext,
    metadata?: Partial<SearchResultMetadata>
  ): Promise<SearchResult<TItem, TMatch>> {
    const strategy =
      this.options.strategies.find((candidate) => candidate.canHandle(mode)) ||
      this.options.fallbackStrategy;

    const breaker = this.options.circuitBreaker;
    const canAttemptSemantic =
      strategy !== this.options.fallbackStrategy
        ? (breaker?.canAttempt() ?? true)
        : true;

    if (!canAttemptSemantic) {
      this.log.warn("Circuit breaker open; skipping primary strategy", {
        mode,
      });
      return this.runFallback(
        query,
        { mode, context, metadata },
        new SearchError(
          SearchErrorCode.QDRANT_UNAVAILABLE,
          "Circuit breaker open",
          {
            retryable: false,
          }
        )
      );
    }

    try {
      const result = await strategy.execute(query, { mode, context, metadata });

      if (strategy !== this.options.fallbackStrategy && !result.items.length) {
        this.log.info("Primary strategy returned no results; falling back", {
          mode,
        });
        breaker?.recordFailure();
        return this.runFallback(query, {
          mode,
          context,
          metadata: {
            ...metadata,
            errors: result.metadata.errors ?? metadata?.errors,
          },
        });
      }

      breaker?.recordSuccess();
      return {
        ...result,
        metadata: this.appendCircuitState(result.metadata, breaker),
      };
    } catch (error) {
      this.log.error("Primary search strategy failed", {
        mode,
        error: error instanceof Error ? error.message : String(error),
      });
      breaker?.recordFailure();
      return this.runFallback(query, { mode, context, metadata }, error);
    }
  }
}
