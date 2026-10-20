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
  /\bhow (does|do) .{1,40}\bwork\b/,
  /\bhoat dong (nhu the nao|the nao|ra sao)\b/,
];

// What a tool is, what it does or what it offers. Only counts when the
// question is about a particular tool, see isToolOverviewQuestion
const OVERVIEW_PATTERNS = [
  /\bwhat(?: is|'s| are)\b/,
  /\bwhat (can|does|do) .{1,40}\bdo\b/,
  /\btell me (more )?about\b/,
  /\b(features?|overview|explain|explained|introduce|introduction|demo)\b/,
  /\bla gi\b/,
  /\blam (duoc )?(nhung )?gi\b/,
  /\btinh nang\b/,
  /\bgioi thieu\b/,
];

// Pricing, comparisons and recommendations get no videos, even about one tool
const NOT_OVERVIEW_PATTERNS = [
  /\b(price|prices|pricing|cost|costs|free|plans?|subscription)\b/,
  /\b(compare|comparison|difference|vs|versus|alternatives?|best|recommend)\b/,
  /\b(gia|chi phi|mien phi|goi)\b/,
  /\b(so sanh|khac nhau|khac gi|thay the|tot nhat|goi y)\b/,
];

const normalizeQuestion = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d");

const MIN_TOOL_NAME_LENGTH = 3;

const mentionsToolName = (normalized: string, toolName: string): boolean => {
  const name = normalizeQuestion(toolName).trim();
  if (name.length < MIN_TOOL_NAME_LENGTH) {
    return false;
  }
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(
    normalized
  );
};

/**
 * Whether a question asks how to use a tool, for a guide or for videos: the
 * questions that should get tutorial videos even when the model forgets to
 * search for them.
 */
export const isTutorialQuestion = (text: string): boolean => {
  const normalized = normalizeQuestion(text);
  return TUTORIAL_PATTERNS.some((pattern) => pattern.test(normalized));
};

/**
 * Whether a question asks what a particular tool is, what it does or what its
 * features are, so a video can show it instead of the reader going through
 * the whole answer. The tool is the one whose page the chat is on, or a
 * library tool named in the question.
 */
export const isToolOverviewQuestion = (
  text: string,
  {
    currentToolName,
    libraryToolNames = [],
  }: { currentToolName?: string; libraryToolNames?: string[] }
): boolean => {
  const normalized = normalizeQuestion(text);
  if (
    !OVERVIEW_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    NOT_OVERVIEW_PATTERNS.some((pattern) => pattern.test(normalized))
  ) {
    return false;
  }
  return (
    Boolean(currentToolName) ||
    libraryToolNames.some((name) => mentionsToolName(normalized, name))
  );
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
