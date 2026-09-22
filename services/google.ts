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

class GemmaRateLimiterPool {
  private slots: ModelSlot[];
  private nextIndex = 0;
  // 20 requests per minute per model = 40 RPM across both models
  private readonly maxRpm = 20;
  private readonly windowMs = 60_000;
  private readonly minIntervalMs = 2_800; // Spacing between calls to same model
  private mutex = Promise.resolve();

  constructor() {
    this.slots = [
      {
        id: GEMMA_26B_MODEL_ID,
        model: gemma26bModel,
        timestamps: [],
        lastTime: 0,
      },
      {
        id: GEMMA_31B_MODEL_ID,
        model: gemma31bModel,
        timestamps: [],
        lastTime: 0,
      },
    ];
  }

  /**
   * Acquires the next available model slot adhering to 20 RPM per model (40 RPM total).
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

      const candidates = [preferred, 1 - preferred]
        .map((idx) => this.slots[idx])
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

export const gemmaPool = new GemmaRateLimiterPool();

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
