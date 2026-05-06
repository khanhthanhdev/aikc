import { generateObject } from "ai";
import { z } from "zod";
import { createLogger } from "~/lib/logger";
import { googleFlashLiteModel } from "~/services/google";

const log = createLogger("fused-query-router");

export const FusedQueryResultSchema = z.object({
  intent: z
    .enum(["recommendation", "comparison", "search"])
    .describe("The classified intent of the user query"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score for the classification"),
  reasoning: z
    .string()
    .describe("Brief explanation of why this intent was chosen"),

  // Comparison-specific fields
  toolNames: z
    .array(z.string())
    .optional()
    .describe("Exact names of tools being compared, if any"),
  comparisonAspects: z
    .array(z.string())
    .optional()
    .describe(
      "Specific aspects the user wants to compare (e.g., pricing, features)"
    ),

  // Recommendation-specific fields
  expandedKeywords: z
    .array(z.string())
    .optional()
    .describe("Expanded search keywords for recommendation-style queries"),

  // Search-specific fields
  specificToolName: z
    .string()
    .optional()
    .describe("Specific tool name if the user is searching for one tool"),
  categories: z
    .array(z.string())
    .optional()
    .describe("Category filters to apply, if mentioned"),
  features: z
    .array(z.string())
    .optional()
    .describe("Specific features requested by the user"),
  pricing: z
    .string()
    .optional()
    .describe("Pricing preference (free, paid, freemium)"),
});

export type FusedQueryResult = z.infer<typeof FusedQueryResultSchema>;
export type QueryIntent = Pick<
  FusedQueryResult,
  "intent" | "confidence" | "reasoning"
>;

/**
 * Fused router that combines:
 * - intent classification
 * - comparison decomposition
 * - recommendation query expansion
 * - search metadata extraction
 *
 * into a single LLM call for lower latency.
 */
export const fusedRouteQuery = async (
  query: string
): Promise<FusedQueryResult> => {
  log.debug(`Fused routing for query: ${query}`);

  const { object } = await generateObject({
    model: googleFlashLiteModel,
    schema: FusedQueryResultSchema,
    temperature: 0,
    system: `You are a fused query router for an AI Work & Study tools directory.
For each user query, you MUST:
- Decide the primary intent: "recommendation", "comparison", or "search".
- Provide a confidence score between 0 and 1.
- Explain your reasoning briefly.

Then, depending on the chosen intent:

1. recommendation:
   - Populate expandedKeywords with 3-8 short keyword phrases that will help search for relevant tools.
   - Do NOT fill toolNames or specificToolName unless the user clearly mentions exact tool names.

2. comparison:
   - Populate toolNames with the exact tool names being compared (at least two when possible).
   - Populate comparisonAspects with any explicit aspects mentioned (e.g. pricing, speed, accuracy).

3. search:
   - If the user mentions a specific tool by name, set specificToolName.
   - If categories, features, or pricing preferences are mentioned, populate those arrays/fields.

Only populate fields that are clearly implied by the query. Leave others undefined.`,
    prompt: `Analyze this user query and return a single fused result:\n\n"${query}"`,
    experimental_telemetry: { isEnabled: true },
  });

  log.info(
    `Fused routing result: intent=${object.intent}, confidence=${object.confidence.toFixed(2)}`
  );

  return object;
};
