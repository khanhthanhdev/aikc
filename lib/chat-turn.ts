import type { SemanticCacheToolResult } from "~/lib/semantic-cache";

type RoleMessage = { role: string };

type StepToolResult = {
  dynamic?: boolean;
  input: unknown;
  output: unknown;
  preliminary?: boolean;
  providerExecuted?: boolean;
  toolCallId: string;
  toolName: string;
};

type ChatStep = {
  text: string;
  toolResults: StepToolResult[];
};

/**
 * Only the opening question of a conversation may be answered from, or saved
 * to, the semantic cache. Follow-ups like "Is it free?" depend on the earlier
 * turns, so another conversation's answer to the same words is wrong for them.
 */
export const isCacheableConversation = (messages: RoleMessage[]): boolean =>
  messages.filter((message) => message.role === "user").length === 1;

const LIBRARY_SEARCH_TURNS = 3;
const LIBRARY_SEARCH_MAX_LENGTH = 500;

/**
 * What to search the library for: the last few questions, newest last, so a
 * follow-up like "any free ones?" still carries the topic it refers to.
 */
export const getLibrarySearchQuery = (userTexts: string[]): string =>
  userTexts
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(-LIBRARY_SEARCH_TURNS)
    .join("\n")
    .slice(-LIBRARY_SEARCH_MAX_LENGTH);

// Matched against the question lowercased and stripped of Vietnamese marks,
// so "Cách dùng", "cach dung" and "CÁCH DÙNG" all count
const TUTORIAL_PATTERNS = [
  /\bcach (dung|su dung|bat dau|cai dat|tao|lam)\b/,
  /\blam (sao|the nao)( de)? (dung|su dung|bat dau|cai dat|tao)\b/,
  /\bhuong dan\b/,
  /\bbat dau (voi|dung|su dung)\b/,
  /\bhow (to|do i|can i|do you|should i) (use|start|get started|set up|setup|install|create|make)\b/,
  /\b(get|getting) started\b/,
  /\b(tutorials?|walkthrough|step by step|videos?)\b/,
];

/**
 * Whether a question asks how to use a tool, for a guide or for videos: the
 * questions that should get tutorial videos even when the model forgets to
 * search for them.
 */
export const isTutorialQuestion = (text: string): boolean => {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d");
  return TUTORIAL_PATTERNS.some((pattern) => pattern.test(normalized));
};

const FALLBACK_VIDEO_QUERY_TURNS = 2;
const FALLBACK_VIDEO_QUERY_MAX_LENGTH = 120;

/**
 * What to search YouTube for when the model skipped the video search: the
 * question itself, with the one before it so a follow-up like "any videos?"
 * keeps its topic, and the name of the tool whose page the chat is on.
 */
export const getFallbackVideoQuery = (
  userTexts: string[],
  toolName?: string
): string => {
  const question = userTexts
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(-FALLBACK_VIDEO_QUERY_TURNS)
    .join(" ");
  const named =
    toolName && !question.toLowerCase().includes(toolName.toLowerCase())
      ? `${toolName} ${question}`
      : question;
  return named.slice(0, FALLBACK_VIDEO_QUERY_MAX_LENGTH);
};

/**
 * Collects the answer text and tool results of every step of a multi-step
 * turn. `result.text` / `result.toolResults` only hold the final step, which
 * after a video search is just the suggestions block.
 */
export const collectStepOutputs = (
  steps: ChatStep[]
): { answer: string; toolResults: SemanticCacheToolResult[] } => ({
  answer: steps
    .map((step) => step.text.trim())
    .filter(Boolean)
    .join("\n\n"),
  toolResults: steps.flatMap((step) =>
    step.toolResults.map(
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
    )
  ),
});
