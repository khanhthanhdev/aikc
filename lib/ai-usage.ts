import crypto from "node:crypto";
import type { AiQueryStatus } from "@prisma/client";
import type { LanguageModelUsage } from "ai";
import { env } from "~/env";
import { createLogger } from "~/lib/logger";
import { getClientIpFromHeaders } from "~/lib/rate-limit";
import { prisma } from "~/services/prisma";

const log = createLogger("ai-usage");

/** Longest question we persist. Anything longer is truncated, not rejected. */
const MAX_QUESTION_LENGTH = 1000;

/** Longest answer we persist. Chat answers are short; this only stops runaways. */
const MAX_ANSWER_LENGTH = 20_000;

/** Provider errors can embed whole request bodies; the first part is enough. */
const MAX_ERROR_LENGTH = 1000;

/**
 * Salted hash of the client IP.
 *
 * We deliberately never store the address itself: the admin log only needs to
 * tell two askers apart, not identify either of them. AUTH_SECRET doubles as
 * the salt so there is no extra required environment variable — rotating it
 * simply starts a new bucket of visitor ids.
 */
function hashVisitor(ip: string): string | null {
  if (!ip || ip === "unknown") {
    return null;
  }

  return crypto
    .createHash("sha256")
    .update(`${env.AUTH_SECRET}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

export type AiQueryRecord = {
  endpoint: "chat" | "rag";
  question: string;
  locale?: string | null;
  toolSlug?: string | null;
  cacheHit?: boolean;
  latencyMs?: number | null;
  status?: AiQueryStatus;
  answer?: string | null;
  error?: unknown;
  model?: string | null;
  usage?: Pick<LanguageModelUsage, "inputTokens" | "outputTokens"> | null;
  headers: Headers;
};

const truncate = (value: string | null | undefined, max: number) =>
  value ? value.slice(0, max) : null;

const errorMessage = (error: unknown) => {
  if (error === undefined || error === null) {
    return null;
  }

  return error instanceof Error ? error.message : String(error);
};

type StreamedTurnOutcome = Pick<
  AiQueryRecord,
  "status" | "answer" | "error" | "model" | "usage"
> & { latencyMs: number };

type UsageLike = Pick<LanguageModelUsage, "inputTokens" | "outputTokens">;

const sumUsage = (steps: ReadonlyArray<{ usage: UsageLike }>): UsageLike =>
  steps.reduce<UsageLike>(
    (total, { usage }) => ({
      inputTokens: (total.inputTokens ?? 0) + (usage.inputTokens ?? 0),
      outputTokens: (total.outputTokens ?? 0) + (usage.outputTokens ?? 0),
    }),
    { inputTokens: undefined, outputTokens: undefined }
  );

/**
 * Follow a `streamText` call to its end so the turn can be logged with its
 * answer, whichever way it ends.
 *
 * Spread `callbacks` into `streamText` and hand the result to `watch`.
 * `outcome` then settles exactly once:
 * - onFinish → OK (or ERROR if a step failed after some output), with usage
 * - onAbort  → ABORTED, with whatever text had streamed so far
 * - no step ever finished (e.g. quota exhausted on the first call) → ERROR;
 *   the SDK skips onFinish in that case, so `watch` catches it instead.
 *
 * The answer is collected from text deltas rather than `result.text`, which
 * only holds the last step and would drop the text before a tool call.
 */
export function trackStreamedTurn({
  startedAt,
  abortSignal,
}: {
  startedAt: number;
  abortSignal?: AbortSignal;
}) {
  let answer = "";
  let streamError: unknown;
  let settle: (outcome: StreamedTurnOutcome) => void = () => {};

  const outcome = new Promise<StreamedTurnOutcome>((resolve) => {
    settle = resolve;
  });

  // A promise settles once, so whichever callback fires first wins.
  const end = (turn: Omit<StreamedTurnOutcome, "latencyMs">) =>
    settle({ ...turn, answer: turn.answer || null, latencyMs: Date.now() - startedAt });

  return {
    outcome,

    callbacks: {
      onChunk: ({ chunk }: { chunk: { type: string; text?: string } }) => {
        if (chunk.type === "text-delta") {
          answer += chunk.text ?? "";
        }
      },

      onError: ({ error }: { error: unknown }) => {
        streamError = error;
        // Replaces the SDK's default onError, which logged to the console.
        console.error("[ai] Stream error", error);
      },

      onFinish: ({
        response,
        totalUsage,
      }: {
        response: { modelId: string };
        totalUsage: UsageLike;
      }) =>
        end({
          answer,
          error: streamError,
          model: response.modelId,
          status: streamError ? "ERROR" : "OK",
          usage: totalUsage,
        }),

      onAbort: ({
        steps,
      }: {
        steps: ReadonlyArray<{ usage: UsageLike; response: { modelId: string } }>;
      }) =>
        end({
          answer,
          model: steps.at(-1)?.response.modelId ?? null,
          status: "ABORTED",
          usage: steps.length ? sumUsage(steps) : null,
        }),
    },

    watch: (result: { steps: PromiseLike<unknown> }) => {
      Promise.resolve(result.steps).catch((error: unknown) =>
        end({
          answer,
          error: streamError ?? error,
          status: abortSignal?.aborted ? "ABORTED" : "ERROR",
        })
      );
    },
  };
}

/**
 * Persist one AI turn once it has finished.
 *
 * Call this from `after()` so it runs once the response has already been sent.
 * It swallows every error on purpose: a logging outage must never turn into a
 * failed answer for the person asking the question.
 */
export async function recordAiQuery({
  endpoint,
  question,
  locale,
  toolSlug,
  cacheHit = false,
  latencyMs,
  status = "OK",
  answer,
  error,
  model,
  usage,
  headers,
}: AiQueryRecord): Promise<void> {
  const trimmed = question.trim();

  if (!trimmed) {
    return;
  }

  try {
    await prisma.aiQuery.create({
      data: {
        answer: truncate(answer, MAX_ANSWER_LENGTH),
        cacheHit,
        endpoint,
        error: truncate(errorMessage(error), MAX_ERROR_LENGTH),
        inputTokens: usage?.inputTokens ?? null,
        latencyMs: latencyMs ?? null,
        locale: locale ?? null,
        model: model ?? null,
        outputTokens: usage?.outputTokens ?? null,
        question: trimmed.slice(0, MAX_QUESTION_LENGTH),
        status,
        toolSlug: toolSlug ?? null,
        visitorId: hashVisitor(getClientIpFromHeaders(headers)),
      },
    });
  } catch (error) {
    log.warn("Failed to record AI query", { endpoint, error });
    // The project logger is silenced outside development, but a logging
    // outage has to be visible in production too — otherwise the table
    // quietly stops filling and nobody notices.
    console.warn("[ai-usage] Failed to record AI query", error);
  }
}
