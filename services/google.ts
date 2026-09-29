import {
  createGoogleGenerativeAI,
  type GoogleLanguageModelOptions,
} from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { env } from "~/env";

const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY,
});

// When OPENROUTER_API_KEY is set, route all chat models through OpenRouter;
// otherwise fall back to Google Gemini directly.
const openrouter = env.OPENROUTER_API_KEY
  ? createOpenRouter({ apiKey: env.OPENROUTER_API_KEY })
  : null;

export const googleFlashLiteModel = openrouter
  ? openrouter.chat(env.OPENROUTER_FLASH_LITE_MODEL)
  : google(env.GOOGLE_FLASH_LITE_MODEL);
export const googleFlashModel = openrouter
  ? openrouter.chat(env.OPENROUTER_FLASH_MODEL)
  : google(env.GOOGLE_FLASH_MODEL);
export const googleFlashModelId = openrouter
  ? `openrouter:${env.OPENROUTER_FLASH_MODEL}`
  : env.GOOGLE_FLASH_MODEL;

// Only applied by the Google provider; ignored when using OpenRouter.
export const googleNoThinkingProviderOptions = {
  google: {
    thinkingConfig: {
      thinkingLevel: "minimal",
      includeThoughts: false,
    },
  },
} satisfies { google: GoogleLanguageModelOptions };
