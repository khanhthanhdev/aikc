import { isDev } from "~/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m", // green
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  reset: "\x1b[0m",
};

const currentLevel: LogLevel = isDev ? "debug" : "info";

const formatDurationMs = (durationMs?: number) =>
  durationMs === undefined ? undefined : Number(durationMs.toFixed(2));

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(
  level: LogLevel,
  context: string,
  message: string,
  data?: unknown
): string {
  const timestamp = new Date().toISOString();
  const color = COLORS[level];
  const reset = COLORS.reset;

  if (isDev) {
    return `${color}[${timestamp}] [${level.toUpperCase()}] [${context}]${reset} ${message}`;
  }

  // JSON format for production (better for log aggregators)
  return JSON.stringify({
    timestamp,
    level,
    context,
    message,
    ...(data ? { data } : {}),
  });
}

function log(
  level: LogLevel,
  context: string,
  message: string,
  data?: unknown
): void {
  if (!shouldLog(level)) {
    return;
  }

  const formatted = formatMessage(level, context, message, data);

  switch (level) {
    case "error":
      console.error(formatted, data !== undefined && isDev ? data : "");
      break;
    case "warn":
      console.warn(formatted, data !== undefined && isDev ? data : "");
      break;
    default:
      console.log(formatted, data !== undefined && isDev ? data : "");
  }
}

export function createLogger(context: string) {
  return {
    debug: (message: string, data?: unknown) =>
      log("debug", context, message, data),
    info: (message: string, data?: unknown) =>
      log("info", context, message, data),
    warn: (message: string, data?: unknown) =>
      log("warn", context, message, data),
    error: (message: string, data?: unknown) =>
      log("error", context, message, data),

    // Helper for timing operations
    time: async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
      const start = performance.now();
      log("debug", context, `${label} started`);

      try {
        const result = await fn();
        const duration = formatDurationMs(performance.now() - start);
        log("info", context, `${label} completed`, { durationMs: duration });
        return result;
      } catch (error) {
        const duration = formatDurationMs(performance.now() - start);
        log("error", context, `${label} failed`, {
          durationMs: duration,
          error,
        });
        throw error;
      }
    },
  };
}

// Pre-configured loggers for common contexts
export const logger = {
  api: createLogger("api"),
  action: createLogger("action"),
  db: createLogger("db"),
  ai: createLogger("ai"),
  media: createLogger("media"),
  inngest: createLogger("inngest"),
};

// Inngest-specific logger helpers
export const inngestLogger = {
  ...logger.inngest,

  // Log event trigger
  eventTriggered: (eventName: string, data: { id?: string; slug?: string }) => {
    logger.inngest.info(`Event triggered: ${eventName}`, {
      event: eventName,
      toolId: data.id,
      toolSlug: data.slug,
    });
  },

  // Log function execution start
  functionStarted: (
    functionId: string,
    eventName: string,
    data: { id?: string; slug?: string }
  ) => {
    logger.inngest.info(`Function started: ${functionId}`, {
      functionId,
      event: eventName,
      toolId: data.id,
      toolSlug: data.slug,
    });
  },

  // Log function execution completion
  functionCompleted: (
    functionId: string,
    eventName: string,
    data: { id?: string; slug?: string },
    durationMs: number
  ) => {
    logger.inngest.info(`Function completed: ${functionId}`, {
      functionId,
      event: eventName,
      toolId: data.id,
      toolSlug: data.slug,
      durationMs: formatDurationMs(durationMs),
    });
  },

  // Log function execution error
  functionError: (
    functionId: string,
    eventName: string,
    data: { id?: string; slug?: string },
    error: unknown,
    durationMs?: number
  ) => {
    const errorData: Record<string, unknown> = {
      functionId,
      event: eventName,
      toolId: data.id,
      toolSlug: data.slug,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    };

    if (durationMs !== undefined) {
      errorData.durationMs = formatDurationMs(durationMs);
    }

    logger.inngest.error(`Function failed: ${functionId}`, errorData);
  },

  // Log step execution
  stepStarted: (stepName: string, functionId: string, toolSlug?: string) => {
    logger.inngest.debug(`Step started: ${stepName}`, {
      step: stepName,
      functionId,
      toolSlug,
    });
  },

  // Log step completion
  stepCompleted: (
    stepName: string,
    functionId: string,
    toolSlug?: string,
    durationMs?: number
  ) => {
    logger.inngest.info(`Step completed: ${stepName}`, {
      step: stepName,
      functionId,
      toolSlug,
      ...(durationMs !== undefined && {
        durationMs: formatDurationMs(durationMs),
      }),
    });
  },

  // Log step error
  stepError: (
    stepName: string,
    functionId: string,
    toolSlug: string | undefined,
    error: unknown
  ) => {
    logger.inngest.error(`Step failed: ${stepName}`, {
      step: stepName,
      functionId,
      toolSlug,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
  },

  // Log waitForEvent result
  waitForEventResult: (
    eventName: string,
    functionId: string,
    toolSlug: string,
    received: boolean,
    timeout?: boolean
  ) => {
    logger.inngest.info(`Wait for event result: ${eventName}`, {
      waitedFor: eventName,
      functionId,
      toolSlug,
      received,
      timeout: timeout ?? false,
    });
  },

  // Log batch processing
  batchProcessed: (
    batchIndex: number,
    batchSize: number,
    totalProcessed: number,
    functionId: string
  ) => {
    logger.inngest.info(`Batch processed: ${batchIndex}`, {
      batchIndex,
      batchSize,
      totalProcessed,
      functionId,
    });
  },
};
