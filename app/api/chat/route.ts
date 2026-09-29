import crypto from "node:crypto";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { cookies } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { USER_ROLES, type UserRole, userRoles } from "~/config/roles";
import { env, isDev } from "~/env";
import { recordAiQuery, trackStreamedTurn } from "~/lib/ai-usage";
import {
  formatLibraryContext,
  getLibraryContext,
  LIBRARY_CONTEXT_TIMEOUT_MS,
  withTimeout,
} from "~/lib/chat-library-context";
import {
  collectStepOutputs,
  getLibrarySearchQuery,
  isCacheableConversation,
} from "~/lib/chat-turn";
import {
  internalServerErrorResponse,
  invalidRequestResponse,
  originNotAllowedResponse,
} from "~/lib/api-error";
import {
  getClientIp,
  isSameOrigin,
  type RateLimitResult,
  rateLimitByAddress,
  rateLimitResponse,
} from "~/lib/rate-limit";
import {
  findCachedAnswer,
  type SemanticCacheEntry,
  storeCachedAnswer,
} from "~/lib/semantic-cache";
import { searchYoutubeVideos } from "~/services/ai-chat-tools";
import {
  googleFlashModel,
  googleFlashModelId,
  googleNoThinkingProviderOptions,
} from "~/services/google";

export const maxDuration = 30;

const MAX_MESSAGE_TEXT_LENGTH = 8000;

const SUGGESTIONS_MARKER = "---SUGGESTIONS---";

// Bump to stop reusing answers cached under older prompts or behaviour
const CACHE_KEY_PREFIX = "chat-v2";

const SESSION_COOKIE = "aikc_chat_sid";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY_SECONDS = 24 * 60 * 60;

// Localized system prompts
const SYSTEM_PROMPTS = {
  en: (
    context: string
  ) => `You are the assistant of AI Knowledge Cloud (AIKC), a library of Work & Study tools.
Your role is to help users discover, understand, and compare the tools in our library.

Guidelines:
- Be concise and helpful.
- You may use general knowledge to explain concepts and how to do things, but tool recommendations and tool facts (pricing, plans) must follow the LIBRARY rules below.
- Never announce or narrate what you are going to do ("I'll search for videos", "Let me find...", "Here are some videos"). Just answer.

Tutorial videos (searchYoutubeVideos tool):
- Call it ONLY when the user asks how to use a tool, for a tutorial or guide, how to get started, or explicitly for videos.
- Do NOT call it for pricing, plans, comparisons, alternatives, tool recommendations, or general questions.
- When the question is a how-to or tutorial question, you MUST call it: first write the helpful text answer (key steps, features or tips), then call the tool once with a short English query like "Notion tutorial for beginners". After the tool call, write only the follow-up questions block — nothing about the videos; they are shown automatically.
${context}

ALWAYS end your text with follow-up questions. Format exactly as:
${SUGGESTIONS_MARKER}
- Question 1
- Question 2
- Question 3
Follow-up question rules:
- Must be short (max 12 words) and phrased as user questions, not offers
- Avoid yes/no phrasing like "Would you like..."; prefer "How do I...", "What is...", "Where can I..."
- Keep them actionable and relevant to the user's intent or the current tool`,

  vi: (
    context: string
  ) => `Bạn là trợ lý của AI Knowledge Cloud (AIKC), thư viện công cụ Học tập & Làm việc.
Vai trò của bạn là giúp người dùng khám phá, hiểu và so sánh các công cụ trong thư viện.

Hướng dẫn:
- Trả lời bằng tiếng Việt, ngắn gọn và hữu ích.
- Có thể dùng kiến thức chung để giải thích khái niệm và cách làm, nhưng việc gợi ý công cụ và thông tin về công cụ (giá, gói) phải tuân theo các quy tắc LIBRARY bên dưới.
- Không bao giờ thông báo hay kể lại việc mình sắp làm ("Tôi sẽ tìm video", "Để tôi tìm...", "Dưới đây là một số video"). Chỉ trả lời.

Video hướng dẫn (công cụ searchYoutubeVideos):
- CHỈ gọi khi người dùng hỏi cách sử dụng một công cụ, xin hướng dẫn, cách bắt đầu, hoặc hỏi rõ về video.
- KHÔNG gọi khi hỏi về giá, gói, so sánh, công cụ thay thế, gợi ý công cụ hay câu hỏi chung.
- Với câu hỏi về cách dùng hoặc hướng dẫn thì BẮT BUỘC gọi: trước tiên viết câu trả lời hữu ích (các bước chính, tính năng hoặc mẹo), sau đó gọi công cụ một lần với truy vấn ngắn bằng tiếng Anh như "Notion tutorial for beginners". Sau lệnh gọi, chỉ viết khối câu hỏi tiếp theo — không viết gì về video; video được hiển thị tự động và bằng tiếng Anh.
${context}

LUÔN kết thúc phần văn bản bằng các câu hỏi tiếp theo. Định dạng chính xác như:
${SUGGESTIONS_MARKER}
- Câu hỏi 1
- Câu hỏi 2
- Câu hỏi 3
Quy tắc câu hỏi tiếp theo:
- Phải ngắn (tối đa 12 từ) và được đặt dưới dạng câu hỏi của người dùng, không phải lời đề nghị
- Tránh cách đặt câu hỏi có/không như "Bạn có muốn..."; ưu tiên "Làm thế nào để...", "Cái gì là...", "Ở đâu có..."
- Giữ chúng hành động và liên quan đến ý định của người dùng hoặc công cụ hiện tại`,
};

const chatTools = {
  searchYoutubeVideos, // YouTube search remains in English
};

// Strict message schema — only accept user/assistant text parts that we
// actually need. Tool/system messages from the client are rejected.
const nonTextMessagePartSchema = z
  .object({
    type: z.string().refine((type) => type !== "text"),
  })
  .passthrough()
  .superRefine((part, ctx) => {
    const text = (part as { text?: unknown }).text;
    if (typeof text === "string" && text.length > MAX_MESSAGE_TEXT_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: MAX_MESSAGE_TEXT_LENGTH,
        origin: "string",
        inclusive: true,
        message: `Text must contain at most ${MAX_MESSAGE_TEXT_LENGTH} character(s)`,
        path: ["text"],
      });
    }
  });

const messagePartSchema = z.union([
  z.object({
    type: z.literal("text"),
    text: z.string().max(MAX_MESSAGE_TEXT_LENGTH),
  }),
  // Allow other part types defined by the AI SDK to pass through, but
  // limit any text fields to a sane maximum.
  nonTextMessagePartSchema,
]);

const messageSchema = z.object({
  id: z.string().max(200).optional(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(messagePartSchema).min(1).max(50),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
  toolSlug: z
    .string()
    .max(120)
    .regex(/^[a-z0-9-]+$/i, "Invalid toolSlug")
    .optional(),
  locale: z.enum(["en", "vi"]).default("en"),
  role: z.enum(userRoles).optional(),
});

// Who the visitor said they are in the role popup, for the system prompt
const ROLE_CONTEXT = {
  en: (role: UserRole) =>
    `- The user describes themselves as: ${USER_ROLES[role].description} Tailor examples, tips and tool recommendations to that kind of work, and prefer tools that suit it.`,
  vi: (role: UserRole) =>
    `- Người dùng cho biết họ thuộc nhóm: ${USER_ROLES[role].description} Hãy điều chỉnh ví dụ, mẹo và gợi ý công cụ cho phù hợp với công việc đó, ưu tiên các công cụ hợp với họ.`,
};

type ChatLimitScope = "minute" | "day" | "session";

// The chat UI reads `error.details.scope`; the text is for API callers
const RATE_LIMIT_MESSAGES: Record<ChatLimitScope, string> = {
  minute: "Too many requests. Please slow down and try again in a minute.",
  day: "Daily chat limit reached for your network. Please try again tomorrow.",
  session: "Daily chat limit reached. Please try again tomorrow.",
};

function getMessageText(message: UIMessage): string {
  for (const part of message.parts) {
    if (part.type === "text") {
      return part.text;
    }
  }
  return "";
}

function getLastUserMessageText(messages: UIMessage[]): string {
  const lastUserMessage = messages.findLast((m) => m.role === "user");
  return lastUserMessage ? getMessageText(lastUserMessage) : "";
}

/** One id per browser, so one visitor cannot use up a shared campus IP's quota. */
async function getChatSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE)?.value;
  if (existing && SESSION_ID_PATTERN.test(existing)) {
    return existing;
  }

  const sessionId = crypto.randomUUID();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    // Not tied to NODE_ENV: a browser drops Secure cookies on a plain-http host
    secure: env.NEXT_PUBLIC_SITE_URL.startsWith("https:"),
    path: "/api/chat",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
  return sessionId;
}

/**
 * Per-minute (IP), per-day (browser session) and per-day (IP) quotas, read
 * from the environment. Counters live in memory, so they reset whenever the
 * app container restarts. A request refused by one limit is not counted
 * against the limits after it.
 */
function checkChatRateLimits(
  req: Request,
  sessionId: string
): { scope: ChatLimitScope; result: RateLimitResult } | null {
  const ip = getClientIp(req);
  const checks: Array<[ChatLimitScope, () => RateLimitResult]> = [
    [
      "minute",
      () =>
        rateLimitByAddress(ip, {
          scope: "chat:minute",
          limit: env.CHAT_RATE_LIMIT_PER_MINUTE,
          windowSeconds: 60,
        }),
    ],
    [
      "session",
      () =>
        rateLimitByAddress(`session:${sessionId}`, {
          scope: "chat:session-day",
          limit: env.CHAT_RATE_LIMIT_PER_SESSION_PER_DAY,
          windowSeconds: DAY_SECONDS,
        }),
    ],
    [
      "day",
      () =>
        rateLimitByAddress(ip, {
          scope: "chat:day",
          limit: env.CHAT_RATE_LIMIT_PER_DAY,
          windowSeconds: DAY_SECONDS,
        }),
    ],
  ];

  for (const [scope, check] of checks) {
    const result = check();
    if (!result.success) {
      return { scope, result };
    }
  }
  return null;
}

/** A cache outage or slowdown must never fail or stall the chat. */
async function lookupCachedAnswer(
  cacheKey: string,
  options: { role?: UserRole; toolSlug?: string }
): Promise<SemanticCacheEntry | null> {
  try {
    return await withTimeout(
      findCachedAnswer(cacheKey, options),
      LIBRARY_CONTEXT_TIMEOUT_MS,
      "Chat cache lookup"
    );
  } catch (error) {
    console.warn(
      "[chat] Cache lookup skipped:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

function createCachedMessageStream(
  cached: SemanticCacheEntry
): ReadableStream<UIMessageChunk> {
  const messageId = `cached-${cached.id}`;
  const textId = `${messageId}-text`;
  const answerText =
    cached.payload.answer?.trim() ||
    // Fallback to main content without the suggestions block
    (cached.payload.answer
      ? (cached.payload.answer.split(SUGGESTIONS_MARKER)[0]?.trim() ?? "")
      : "");

  return createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({
        type: "start",
        messageId,
        messageMetadata: {
          cacheId: cached.id,
          cacheScore: cached.score,
          cached: true,
          toolSlug: cached.payload.toolSlug ?? null,
        },
      });

      if (answerText) {
        writer.write({ type: "text-start", id: textId });
        writer.write({ type: "text-delta", id: textId, delta: answerText });
        writer.write({ type: "text-end", id: textId });
      }

      for (const [index, toolResult] of (
        cached.payload.toolResults ?? []
      ).entries()) {
        const toolCallId =
          toolResult.toolCallId || `${messageId}-tool-${index}`;
        writer.write({
          type: "tool-input-available",
          toolCallId,
          toolName: toolResult.toolName,
          input: toolResult.input ?? {},
          providerExecuted: toolResult.providerExecuted,
          dynamic: toolResult.dynamic,
        });

        if (toolResult.error) {
          writer.write({
            type: "tool-output-error",
            toolCallId,
            errorText: toolResult.error,
            providerExecuted: toolResult.providerExecuted,
            dynamic: toolResult.dynamic,
          });
          continue;
        }

        if (toolResult.output !== undefined) {
          writer.write({
            type: "tool-output-available",
            toolCallId,
            output: toolResult.output,
            providerExecuted: toolResult.providerExecuted,
            dynamic: toolResult.dynamic,
            preliminary: toolResult.preliminary,
          });
        }
      }

      writer.write({
        type: "finish",
        finishReason: "stop",
        messageMetadata: {
          cacheId: cached.id,
          cacheScore: cached.score,
          cached: true,
          toolSlug: cached.payload.toolSlug ?? null,
        },
      });
    },
  });
}

export async function POST(req: Request) {
  try {
    // Reject cross-origin POSTs — this endpoint should only be hit by our
    // own client, never embedded by third-party sites.
    if (!isSameOrigin(req)) {
      return originNotAllowedResponse();
    }

    const sessionId = await getChatSessionId();
    const limited = checkChatRateLimits(req, sessionId);
    if (limited) {
      return rateLimitResponse(
        limited.result,
        RATE_LIMIT_MESSAGES[limited.scope],
        { scope: limited.scope }
      );
    }

    const startedAt = Date.now();
    const parsed = chatRequestSchema.safeParse(
      await req.json().catch(() => null)
    );
    if (!parsed.success) {
      return invalidRequestResponse(parsed.error.issues);
    }
    const {
      messages,
      toolSlug,
      locale = "en",
      role,
    } = parsed.data as {
      messages: UIMessage[];
      toolSlug?: string;
      locale?: "en" | "vi";
      role?: UserRole;
    };

    const query = getLastUserMessageText(messages);
    // Only an opening question is answered from (and saved to) the cache:
    // follow-ups depend on the earlier turns. Answers are tailored to the
    // role, so each role gets its own entry.
    const cacheKey =
      query && isCacheableConversation(messages)
        ? [
            CACHE_KEY_PREFIX,
            googleFlashModelId,
            toolSlug ?? "global",
            role,
            query,
          ]
            .filter(Boolean)
            .join(" :: ")
        : "";

    if (process.env.NODE_ENV === "development") {
      console.log("[ChatAPI] Request:", {
        toolSlug,
        query,
        locale,
        role,
        cacheKey,
      });
    }

    // Runs alongside the cache lookup; simply ignored on a cache hit
    const libraryContextPromise = getLibraryContext({
      query: getLibrarySearchQuery(
        messages
          .filter((message) => message.role === "user")
          .map(getMessageText)
      ),
      toolSlug,
      locale,
    });

    if (cacheKey) {
      const cached = await lookupCachedAnswer(cacheKey, { role, toolSlug });
      if (cached) {
        after(() =>
          recordAiQuery({
            endpoint: "chat",
            question: query,
            locale,
            toolSlug,
            cacheHit: true,
            latencyMs: Date.now() - startedAt,
            answer: cached.payload.answer,
            headers: req.headers,
          })
        );

        return createUIMessageStreamResponse({
          stream: createCachedMessageStream(cached),
        });
      }
    }

    const libraryContext = await libraryContextPromise;

    // Select system prompt based on locale
    const getSystemPrompt = SYSTEM_PROMPTS[locale] || SYSTEM_PROMPTS.en;
    const promptContext = [
      role && (ROLE_CONTEXT[locale] ?? ROLE_CONTEXT.en)(role),
      formatLibraryContext(libraryContext, locale, toolSlug),
    ]
      .filter(Boolean)
      .join("\n\n");
    const systemPrompt = getSystemPrompt(`\n${promptContext}`);

    // Logged once the answer has finished streaming (or failed / was cut off)
    const turn = trackStreamedTurn({ startedAt, abortSignal: req.signal });

    after(async () =>
      recordAiQuery({
        endpoint: "chat",
        question: query,
        locale,
        toolSlug,
        cacheHit: false,
        ...(await turn.outcome),
        headers: req.headers,
      })
    );

    const result = streamText({
      model: googleFlashModel,
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      providerOptions: googleNoThinkingProviderOptions,
      tools: chatTools,
      temperature: 0.3,
      // Answers are short; without a cap OpenRouter reserves credit for the
      // model's full 65k-token maximum on every request
      maxOutputTokens: 2000,
      // Text + video search, then the suggestions; a third step is slack
      stopWhen: stepCountIs(3),
      experimental_telemetry: { isEnabled: true },
      // Stop generating (and paying for) an answer nobody is reading anymore
      abortSignal: req.signal,
      ...turn.callbacks,
    });
    turn.watch(result);

    // Store the completed answer in the semantic cache once streaming finishes
    void (async () => {
      if (!cacheKey) {
        return;
      }
      try {
        // Every step: after a video search the last one holds only suggestions
        const { answer, toolResults } = collectStepOutputs(await result.steps);
        if (!answer && toolResults.length === 0) {
          return;
        }
        // A failed or timed-out video search would be replayed without videos all week
        const videoSearchFailed = toolResults.some(
          ({ toolName, output }) =>
            toolName === "searchYoutubeVideos" &&
            !(Array.isArray(output) && output.length > 0)
        );
        if (videoSearchFailed) {
          return;
        }

        await storeCachedAnswer({
          question: cacheKey,
          answer,
          context: [],
          role,
          toolSlug,
          toolResults,
        });
      } catch (err) {
        if (isDev) {
          console.error("Failed to cache answer:", err);
        }
      }
    })();

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return invalidRequestResponse();
    }

    console.error("[chat] API error:", error);
    return internalServerErrorResponse();
  }
}
