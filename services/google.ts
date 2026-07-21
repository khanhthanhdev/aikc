import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "~/env";

const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY,
});

export const googleFlashLiteModel = google(env.GOOGLE_FLASH_LITE_MODEL);
export const googleFlashModel = google(env.GOOGLE_FLASH_MODEL);
export const googleFlashModelId = env.GOOGLE_FLASH_MODEL;
