import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  shared: {
    PORT: z.coerce.number().default(8000),
    VERCEL_URL: z
      .string()
      .optional()
      .transform((v) => (v ? `https://${v}` : undefined)),
  },

  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app isn't
   * built with invalid env vars.
   */
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
    RAG_ENABLED: z.coerce.boolean().default(true),
    PUBLISH_SUBMITTER_EMAILS: z.coerce.boolean().default(true),
    // Chat quotas, read at runtime so they change with a container restart
    CHAT_RATE_LIMIT_PER_MINUTE: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
    // Per IP; a whole campus can share one address, so keep this generous
    CHAT_RATE_LIMIT_PER_DAY: z.coerce.number().int().positive().default(300),
    // Per browser (cookie), so one visitor cannot use up the shared IP quota
    CHAT_RATE_LIMIT_PER_SESSION_PER_DAY: z.coerce
      .number()
      .int()
      .positive()
      .default(50),
    ALLOWED_EMAILS: z.string().optional(),
    NEXTAUTH_URL: z.string().url().min(1),
    AUTH_SECRET: z.string().min(1),
    AUTH_GOOGLE_ID: z.string().min(1),
    AUTH_GOOGLE_SECRET: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().min(1),
    GEMINI_API_KEY: z.string().min(1),
    GOOGLE_FLASH_LITE_MODEL: z.string().default("gemma-4-26b-a4b-it"),
    GOOGLE_FLASH_MODEL: z.string().default("gemma-4-31b-it"),
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_FLASH_LITE_MODEL: z
      .string()
      .default("google/gemini-2.5-flash-lite"),
    OPENROUTER_FLASH_MODEL: z.string().default("google/gemini-2.5-flash-lite"),
    INFINITY_EMBEDDING_URL: z.string().url().default("http://localhost:7997"),
    INFINITY_EMBEDDING_MODEL: z
      .string()
      .default("sentence-transformers/all-MiniLM-L6-v2"),
    INFINITY_EMBEDDING_DIMENSIONS: z.coerce.number().default(384),
    FIRECRAWL_API_KEY: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    R2_BUCKET: z.string().min(1),
    R2_ENDPOINT: z.string().url().min(1),
    R2_PUBLIC_URL: z.string().url().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    QDRANT_URL: z.string().url().min(1),
    QDRANT_API_KEY: z.string().min(1),
  },

  /**
   * Specify your client-side environment variables schema here.
   * For them to be exposed to the client, prefix them with `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_SITE_URL: z.string().url().min(1),
    NEXT_PUBLIC_SITE_EMAIL: z.string().email().min(1),
  },

  /**
   * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
   */
  experimental__runtimeEnv: {
    PORT: process.env.PORT,
    VERCEL_URL: process.env.VERCEL_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SITE_EMAIL: process.env.NEXT_PUBLIC_SITE_EMAIL,
  },

  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
   * This is especially useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});

export const isProd =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";
export const isDev = !isProd;
