import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { z } from "zod";
import {
  findCachedAnswer,
  type SemanticCacheEntry,
  type SemanticCacheToolResult,
  storeCachedAnswer,
} from "~/lib/semantic-cache";
import { searchYoutubeVideos } from "~/services/ai-chat-tools";
import { googleFlashModel } from "~/services/google";

export const maxDuration = 30;

// Localized system prompts
const SYSTEM_PROMPTS = {
  en: (
    toolContext: string
  ) => `You are a helpful assistant for a Work & Study tools directory website called AI Knowledge Cloud.
Your role is to help users discover, understand, and compare Work & Study tools.

Guidelines:
- Be concise and helpful
- When mentioning tools, reference them by name
- You have extensive knowledge about productivity and study tools

IMPORTANT - When users ask about tutorials, how to use a tool, getting started, or want video guides:
1. FIRST provide a helpful text response explaining the key steps, features, or tips
2. THEN ALSO call the searchYoutubeVideos tool to show relevant tutorial videos
3. Always do BOTH - users expect written guidance AND video resources together
4. Do NOT add any additional text after the tool call - no commentary about the videos, no disclaimers, no "if you meant X" text. The videos speak for themselves.

- The searchYoutubeVideos tool will search YouTube and return real videos - provide a good search query like "Notion tutorial for beginners" or "Obsidian getting started guide"
- Suggest related tools when appropriate
${toolContext}

ALWAYS end your response with follow-up questions, even when using tools. Format exactly as:
---SUGGESTIONS---
- Question 1
- Question 2
- Question 3
Follow-up question rules:
- Must be short (max 12 words) and phrased as user questions, not offers
- Avoid yes/no phrasing like "Would you like..."; prefer "How do I...", "What is...", "Where can I..."
- Keep them actionable and relevant to the user's intent or the current tool`,

  vi: (
    toolContext: string
  ) => `Bạn là một trợ lý hữu ích cho trang web danh mục công cụ Học tập & Làm việc có tên AI Knowledge Cloud.
Vai trò của bạn là giúp người dùng khám phá, hiểu và so sánh các công cụ Học tập & Làm việc.

Hướng dẫn:
- Ngắn gọn và hữu ích
- Khi đề cập đến công cụ, hãy tham chiếu tên của chúng
- Bạn có kiến thức sâu rộng về các công cụ năng suất và học tập

QUAN TRỌNG - Khi người dùng hỏi về hướng dẫn, cách sử dụng công cụ, bắt đầu, hoặc muốn video hướng dẫn:
1. ĐẦU TIÊN cung cấp phản hồi văn bản hữu ích giải thích các bước chính, tính năng, hoặc mẹo
2. SAU ĐÓ GỌI công cụ searchYoutubeVideos để hiển thị video hướng dẫn liên quan
3. Luôn làm CẢ HAI - người dùng mong đợi hướng dẫn viết VÀ tài nguyên video cùng nhau
4. KHÔNG thêm bất kỳ văn bản nào sau lệnh gọi công cụ - không bình luận về video, không tuyên bố miễn trừ trách nhiệm. Các video tự nói lên điều đó.

- Công cụ searchYoutubeVideos sẽ tìm kiếm YouTube và trả về video thực tế - cung cấp truy vấn tìm kiếm tốt như "Notion tutorial for beginners" hoặc "Obsidian getting started guide" (bằng tiếng Anh)
- Gợi ý các công cụ liên quan khi phù hợp
${toolContext}

LUÔN kết thúc phản hồi của bạn với các câu hỏi tiếp theo, ngay cả khi sử dụng công cụ. Định dạng chính xác như:
---SUGGESTIONS---
- Câu hỏi 1
- Câu hỏi 2
- Câu hỏi 3
Quy tắc câu hỏi tiếp theo:
- Phải ngắn (tối đa 12 từ) và được đặt dưới dạng câu hỏi của người dùng, không phải lời đề nghị
- Tránh cách đặt câu hỏi có/không như "Bạn có muốn..."; ưu tiên "Làm thế nào để...", "Cái gì là...", "Ở đâu có..."
- Giữ chúng hành động và liên quan đến ý định của người dùng hoặc công cụ hiện tại

LƯU Ý: Các video YouTube sẽ hiển thị bằng tiếng Anh để có nhiều nội dung chất lượng cao hơn.`,
};

const chatRequestSchema = z.object({
  messages: z.array(z.any()),
  toolSlug: z.string().optional(),
  locale: z.enum(["en", "vi"]).default("en"), // Add locale to request schema
});

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

function serializeToolResults(
  toolResults: Array<{
    toolCallId: string;
    toolName: string;
    input: unknown;
    output: unknown;
    providerExecuted?: boolean;
    dynamic?: boolean;
    preliminary?: boolean;
  }>
): SemanticCacheToolResult[] {
  return toolResults.map(
    ({
      toolCallId,
      toolName,
      input,
      output,
      providerExecuted,
      dynamic,
      preliminary,
    }) => ({
      toolCallId,
      toolName,
      input,
      output,
      providerExecuted,
      dynamic,
      preliminary,
    })
  );
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
      ? (cached.payload.answer.split("---SUGGESTIONS---")[0]?.trim() ?? "")
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
    const body = await req.json();
    const {
      messages,
      toolSlug,
      locale = "en",
    } = chatRequestSchema.parse(body) as {
      messages: UIMessage[];
      toolSlug?: string;
      locale?: "en" | "vi";
    };

    const query = getLastUserMessageText(messages);
    const cacheKey =
      query && toolSlug
        ? `${toolSlug} :: ${query}`
        : query && !toolSlug
          ? `global :: ${query}`
          : "";

    console.log("[ChatAPI] Request:", { toolSlug, query, locale, cacheKey });

    if (cacheKey) {
      const cached = await findCachedAnswer(cacheKey, { toolSlug });
      if (cached) {
        return createUIMessageStreamResponse({
          stream: createCachedMessageStream(cached),
        });
      }
    }

    // Select system prompt based on locale
    const getSystemPrompt = SYSTEM_PROMPTS[locale] || SYSTEM_PROMPTS.en;
    const toolContext = toolSlug
      ? `- The user is currently viewing the tool page for: ${toolSlug}`
      : "";
    const systemPrompt = getSystemPrompt(toolContext);

    const result = streamText({
      model: googleFlashModel,
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools: {
        searchYoutubeVideos, // YouTube search remains in English
      },
      temperature: 0.3,
      stopWhen: stepCountIs(5),
      experimental_telemetry: { isEnabled: true },
    });

    // Store the completed answer in the semantic cache once streaming finishes
    void (async () => {
      if (!cacheKey) {
        return;
      }
      try {
        const [answer, toolResults] = await Promise.all([
          result.text,
          result.toolResults,
        ]);
        if (!answer.trim() && toolResults.length === 0) {
          return;
        }

        await storeCachedAnswer({
          question: cacheKey,
          answer,
          context: [],
          toolSlug,
          toolResults: serializeToolResults(toolResults),
        });
      } catch (err) {
        console.error("Failed to cache answer:", err);
      }
    })();

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
