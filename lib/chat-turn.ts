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
