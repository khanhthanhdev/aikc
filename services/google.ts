import {
  createGoogleGenerativeAI,
  type GoogleLanguageModelOptions,
} from "@ai-sdk/google";
import { generateObject, generateText } from "ai";
import { env } from "~/env";

const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY,
});

export const GEMMA_26B_MODEL_ID =
  env.GOOGLE_FLASH_LITE_MODEL || "gemma-4-26b-a4b-it";
export const GEMMA_31B_MODEL_ID =
  env.GOOGLE_FLASH_MODEL || "gemma-4-31b-it";

export const gemma26bModel = google(GEMMA_26B_MODEL_ID);
export const gemma31bModel = google(GEMMA_31B_MODEL_ID);

export const googleFlashLiteModel = gemma26bModel;
export const googleFlashModel = gemma31bModel;
export const googleFlashModelId = GEMMA_31B_MODEL_ID;

/**
 * Batch jobs (roles, categories) need a long structured reply per tool. Gemma
 * fails about a third of those: it loops on a word until the token cap cuts
 * the JSON off, or Google's filter returns nothing. Flash-Lite does not.
 */
export const GEMINI_BATCH_MODEL_ID = env.GOOGLE_BATCH_MODEL;
const geminiBatchModel = google(GEMINI_BATCH_MODEL_ID);

export const googleNoThinkingProviderOptions = {
  google: {
    thinkingConfig: {
      thinkingLevel: "minimal",
      includeThoughts: false,
    },
  },
} satisfies { google: GoogleLanguageModelOptions };

type LanguageModel = Parameters<typeof generateText>[0]["model"];

interface ModelSlot {
  id: string;
  model: LanguageModel;
  timestamps: number[];
  lastTime: number;
}

class ModelRateLimiterPool {
  private slots: ModelSlot[];
  private nextIndex = 0;
  private readonly windowMs = 60_000;
  private mutex = Promise.resolve();

  /**
   * @param maxRpm Requests per minute allowed on each model.
   * @param minIntervalMs Spacing between calls to the same model.
   */
  constructor(
    models: { id: string; model: LanguageModel }[],
    private readonly maxRpm: number,
    private readonly minIntervalMs: number
  ) {
    this.slots = models.map(({ id, model }) => ({
      id,
      model,
      timestamps: [],
      lastTime: 0,
    }));
  }

  /**
   * Acquires the next available model slot adhering to each model's RPM limit.
   */
  async acquire(excludeId?: string): Promise<{ model: LanguageModel; id: string }> {
    return new Promise((resolve) => {
      this.mutex = this.mutex.then(async () => {
        const slot = await this.waitForNextSlot(excludeId);
        resolve({ model: slot.model, id: slot.id });
      });
    });
  }

  private async waitForNextSlot(excludeId?: string): Promise<ModelSlot> {
    while (true) {
      const now = Date.now();
      const preferred = this.nextIndex;
      this.nextIndex = (this.nextIndex + 1) % this.slots.length;

      // Every slot, starting from the preferred one
      const candidates = this.slots
        .map((_, offset) => this.slots[(preferred + offset) % this.slots.length])
        .filter((slot) => !excludeId || slot.id !== excludeId);

      const viableCandidates = candidates.length > 0 ? candidates : this.slots;

      let bestSlot: ModelSlot | null = null;
      let minWait = Number.POSITIVE_INFINITY;

      for (const slot of viableCandidates) {
        slot.timestamps = slot.timestamps.filter((t) => now - t < this.windowMs);

        let wait = 0;
        if (slot.timestamps.length >= this.maxRpm) {
          wait = Math.max(wait, slot.timestamps[0] + this.windowMs - now + 50);
        }

        const timeSinceLast = now - slot.lastTime;
        if (timeSinceLast < this.minIntervalMs) {
          wait = Math.max(wait, this.minIntervalMs - timeSinceLast);
        }

        if (wait === 0) {
          bestSlot = slot;
          minWait = 0;
          break;
        }

        if (wait < minWait) {
          minWait = wait;
          bestSlot = slot;
        }
      }

      if (minWait === 0 && bestSlot) {
        const t = Date.now();
        bestSlot.timestamps.push(t);
        bestSlot.lastTime = t;
        return bestSlot;
      }

      await new Promise((r) => setTimeout(r, Math.min(minWait, 1000)));
    }
  }
}

// 20 requests per minute per model = 40 RPM across both models
export const gemmaPool = new ModelRateLimiterPool(
  [
    { id: GEMMA_26B_MODEL_ID, model: gemma26bModel },
    { id: GEMMA_31B_MODEL_ID, model: gemma31bModel },
  ],
  20,
  2_800
);

// 30 RPM on one model; a 1,200-tool roles run at up to 40 RPM hit no 429s
const batchPool = new ModelRateLimiterPool(
  [{ id: GEMINI_BATCH_MODEL_ID, model: geminiBatchModel }],
  30,
  2_000
);

/**
 * A model for one batch call (see GEMINI_BATCH_MODEL_ID), paced so jobs over
 * many tools stay under the Gemini rate limits.
 */
export const acquireBatchModel = async (): Promise<LanguageModel> =>
  (await batchPool.acquire()).model;

/**
 * Executes generateText with automatic Gemma 4 model rotation and rate limiting.
 * Dispatches up to 20 RPM on 26b and 20 RPM on 31b (40 RPM aggregate).
 */
export async function generateTextWithGemma(
  options: any
): Promise<ReturnType<typeof generateText>> {
  if (options.model) {
    return generateText(options);
  }

  const firstSlot = await gemmaPool.acquire();
  try {
    return await generateText({
      ...options,
      model: firstSlot.model,
    });
  } catch (error: any) {
    const isRateLimit =
      error?.status === 429 ||
      error?.message?.includes("RESOURCE_EXHAUSTED") ||
      error?.message?.includes("rate limit") ||
      error?.message?.includes("429");

    if (isRateLimit) {
      console.warn(
        `[GemmaPool] Rate limit hit on ${firstSlot.id}, failing over to alternate model...`
      );
      const fallbackSlot = await gemmaPool.acquire(firstSlot.id);
      return await generateText({
        ...options,
        model: fallbackSlot.model,
      });
    }
    throw error;
  }
}

/**
 * Executes generateObject with automatic Gemma 4 model rotation and rate limiting.
 * Dispatches up to 20 RPM on 26b and 20 RPM on 31b (40 RPM aggregate).
 */
export async function generateObjectWithGemma<T = any>(
  options: any
): Promise<any> {
  if (options.model) {
    return generateObject(options);
  }

  const firstSlot = await gemmaPool.acquire();
  try {
    return await generateObject({
      ...options,
      model: firstSlot.model,
    });
  } catch (error: any) {
    const isRateLimit =
      error?.status === 429 ||
      error?.message?.includes("RESOURCE_EXHAUSTED") ||
      error?.message?.includes("rate limit") ||
      error?.message?.includes("429");

    if (isRateLimit) {
      console.warn(
        `[GemmaPool] Rate limit hit on ${firstSlot.id}, failing over to alternate model...`
      );
      const fallbackSlot = await gemmaPool.acquire(firstSlot.id);
      return await generateObject({
        ...options,
        model: fallbackSlot.model,
      });
    }
    throw error;
  }
}
