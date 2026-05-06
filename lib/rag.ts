import { generateText } from "ai";
import { env } from "~/env";
import { fusedRouteQuery, type QueryIntent } from "~/lib/fused-query-router";
import { createLogger } from "~/lib/logger";
import { findCachedAnswer, storeCachedAnswer } from "~/lib/semantic-cache";
import type { ToolVectorMatch } from "~/lib/vector-store";
import {
  hybridSearchToolVectors,
  searchToolsByName,
  searchToolVectors,
} from "~/lib/vector-store";
import { googleFlashModel } from "~/services/google";

const log = createLogger("rag");

export interface RetrieveToolContextOptions {
  category?: string;
  limit?: number;
  /** Use legacy semantic search instead of hybrid */
  useLegacySearch?: boolean;
}

/**
 * Legacy context retrieval (semantic search only)
 * @deprecated Use retrieveToolContextWithRouting for better results
 */
export const retrieveToolContext = async (
  query: string,
  { limit = 5, category }: RetrieveToolContextOptions = {}
): Promise<ToolVectorMatch[]> => {
  if (!query.trim()) {
    return [];
  }

  return searchToolVectors(query, {
    limit,
    category,
  });
};

export interface AdvancedRetrieveOptions {
  category?: string;
  limit?: number;
}

export interface RetrievalResult {
  context: ToolVectorMatch[];
  intent: QueryIntent;
  processedQuery: string;
}

const isSimpleListQuery = (query: string): boolean => {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) {
    return false;
  }

  const words = normalized.split(" ");
  if (words.length >= 5) {
    return false;
  }

  return words.some((word) => word === "list" || word === "show");
};

/**
 * Advanced context retrieval with query routing and pre-retrieval strategies
 * Routes queries to appropriate retrieval paths based on intent
 */
export const retrieveToolContextWithRouting = async (
  query: string,
  { limit = 5, category }: AdvancedRetrieveOptions = {}
): Promise<RetrievalResult> => {
  if (!query.trim()) {
    return {
      context: [],
      intent: { intent: "search", confidence: 0, reasoning: "Empty query" },
      processedQuery: query,
    };
  }

  // Short-circuit when RAG is disabled via env flag
  if (!env.RAG_ENABLED) {
    log.info("RAG disabled via env; skipping retrieval and router LLM calls");
    return {
      context: [],
      intent: {
        intent: "search",
        confidence: 0,
        reasoning: "RAG is disabled; no retrieval performed.",
      },
      processedQuery: query,
    };
  }

  // Speculative routing "fast-track" for simple list/show queries
  if (isSimpleListQuery(query)) {
    log.info("Using speculative routing fast-track for simple list/show query");
    const context = await hybridSearchToolVectors(query, { limit, category });

    const intent: QueryIntent = {
      intent: "search",
      confidence: 1,
      reasoning:
        'Speculative routing: query is short and contains "list" or "show", skipping router LLM.',
    };

    return {
      context,
      intent,
      processedQuery: query,
    };
  }

  // Step 1: Route and decompose/expand/extract in a single fused call
  const fused = await fusedRouteQuery(query);
  const intent: QueryIntent = {
    intent: fused.intent,
    confidence: fused.confidence,
    reasoning: fused.reasoning,
  };
  log.info(`Fused query routed: ${intent.intent} (${intent.confidence})`);

  let context: ToolVectorMatch[] = [];
  let processedQuery = query;

  // Step 2: Apply pre-retrieval strategy based on intent
  switch (intent.intent) {
    case "recommendation": {
      // Expand query with synonyms and related terms (from fused router)
      if (fused.expandedKeywords && fused.expandedKeywords.length > 0) {
        processedQuery = [query, ...fused.expandedKeywords].join(", ");
      }

      log.debug(`Expanded query: ${processedQuery}`);
      context = await hybridSearchToolVectors(processedQuery, {
        limit,
        category,
      });
      break;
    }

    case "comparison": {
      // Decompose to get specific tool names from fused router
      const toolNames = fused.toolNames ?? [];
      log.debug(`Comparison tools: ${toolNames.join(", ")}`);

      if (!toolNames.length) {
        // Fallback: treat as a generic search if we couldn't extract tool names
        context = await hybridSearchToolVectors(query, { limit, category });
        processedQuery = query;
        break;
      }

      // First try exact name match (parallel inside searchToolsByName)
      context = await searchToolsByName(toolNames);

      // If we didn't find all tools, fall back to hybrid search for each
      if (context.length < toolNames.length) {
        const missingTools = toolNames.filter(
          (name) =>
            !context.some(
              (c) => c.payload.name.toLowerCase() === name.toLowerCase()
            )
        );

        if (missingTools.length > 0) {
          const fallbackResults = await Promise.all(
            missingTools.map((toolName) =>
              hybridSearchToolVectors(toolName, { limit: 1, category })
            )
          );

          for (const results of fallbackResults) {
            context.push(...results);
          }
        }
      }

      processedQuery = toolNames.join(" vs ");
      break;
    }

    case "search": {
      // Extracted metadata from fused router for potential filtering
      const metadata = {
        toolName: fused.specificToolName,
        categories: fused.categories,
        features: fused.features,
        pricing: fused.pricing,
      };
      log.debug(`Search metadata (fused): ${JSON.stringify(metadata)}`);

      // If a specific tool name was mentioned, search for it directly
      if (metadata.toolName) {
        const exactMatch = await searchToolsByName([metadata.toolName]);
        if (exactMatch.length > 0) {
          context = exactMatch;
          break;
        }
      }

      // Otherwise use hybrid search with any extracted category
      const searchCategory = metadata.categories?.[0] ?? category;
      context = await hybridSearchToolVectors(query, {
        limit,
        category: searchCategory,
      });
      break;
    }
  }

  return {
    context,
    intent,
    processedQuery,
  };
};

export type RagAnswerOptions = AdvancedRetrieveOptions & {
  temperature?: number;
  /** Use legacy semantic search instead of advanced routing */
  useLegacySearch?: boolean;
};

export interface RagAnswer {
  answer: string;
  cache?: {
    id: string;
    score: number;
    createdAt: string;
  };
  context: ToolVectorMatch[];
  intent?: QueryIntent;
}

/**
 * Legacy answer function (backward compatible)
 * @deprecated Use answerToolQuestionAdvanced for better results
 */
export const answerToolQuestion = async (
  question: string,
  options: RagAnswerOptions = {}
): Promise<RagAnswer> => {
  // Zero-latency semantic cache lookup (legacy path)
  const cached = await findCachedAnswer(question);
  if (cached) {
    log.info("Serving answer from semantic cache (legacy RAG)");
    return {
      answer: cached.payload.answer ?? "",
      context: cached.payload.context ?? [],
      cache: {
        id: cached.id,
        score: cached.score,
        createdAt: cached.payload.createdAt,
      },
    };
  }

  const context = await retrieveToolContext(question, options);

  if (!context.length) {
    return {
      answer:
        "I couldn't find any relevant Work & Study tools for that question yet.",
      context: [],
    };
  }

  const formattedContext = context
    .map((match, index) => {
      const { name, slug, tagline, description, content } = match.payload;
      return `#${index + 1} ${name} (slug: ${slug})\nTagline: ${tagline ?? ""}\nDescription: ${description ?? ""}\nDetails: ${content ?? ""}`;
    })
    .join("\n\n---\n\n");

  const { text } = await generateText({
    model: googleFlashModel,
    temperature: options.temperature ?? 0.2,
    system: `You are a research assistant that answers questions about Work & Study tools.
Use the provided context snippets. Cite the tool slug inline whenever you reference it.
If the context does not contain an answer, say you don't know.`,
    prompt: `Context:\n${formattedContext}\n\nQuestion: ${question}\nAnswer:`,
    experimental_telemetry: { isEnabled: true },
  });

  // Store in semantic cache for future zero-latency retrieval
  void storeCachedAnswer({ question, answer: text, context });

  return {
    answer: text,
    context,
  };
};

/**
 * Advanced RAG answer with query routing and hybrid search
 * Uses the "Route, Transform, Retrieve" architecture
 */
export const answerToolQuestionAdvanced = async (
  question: string,
  options: RagAnswerOptions = {}
): Promise<RagAnswer> => {
  // Zero-latency semantic cache lookup
  const cached = await findCachedAnswer(question);
  if (cached) {
    log.info("Serving answer from semantic cache (advanced RAG)");
    return {
      answer: cached.payload.answer ?? "",
      context: cached.payload.context ?? [],
      cache: {
        id: cached.id,
        score: cached.score,
        createdAt: cached.payload.createdAt,
      },
      intent: {
        intent: "search",
        confidence: 1,
        reasoning:
          "Returned from semantic cache; original answer and context reused without new LLM calls.",
      },
    };
  }

  // Use advanced retrieval with routing
  const { context, intent, processedQuery } =
    await retrieveToolContextWithRouting(question, options);

  if (!context.length) {
    return {
      answer:
        "I couldn't find any relevant Work & Study tools for that question yet.",
      context: [],
      intent,
    };
  }

  // Format context based on intent
  const formattedContext = context
    .map((match, index) => {
      const { name, slug, tagline, description, content, categories, tags } =
        match.payload;
      const categoryStr =
        categories.length > 0 ? `Categories: ${categories.join(", ")}` : "";
      const tagStr = tags.length > 0 ? `Tags: ${tags.join(", ")}` : "";

      return `#${index + 1} ${name} (slug: ${slug})
Tagline: ${tagline ?? "N/A"}
Description: ${description ?? "N/A"}
${categoryStr}
${tagStr}
Details: ${content ?? "N/A"}`;
    })
    .join("\n\n---\n\n");

  // Customize system prompt based on intent
  let systemPrompt: string;
  switch (intent.intent) {
    case "comparison":
      systemPrompt = `You are a research assistant comparing Work & Study tools.
Provide a structured comparison of the tools mentioned.
For each tool, highlight key features, pricing, and use cases.
Create a clear comparison table if appropriate.
Cite tool slugs inline when referencing them.`;
      break;

    case "recommendation":
      systemPrompt = `You are a research assistant recommending Work & Study tools.
Based on the user's needs, suggest the most relevant tools from the context.
Explain why each tool is a good fit for their use case.
Prioritize tools that best match their requirements.
Cite tool slugs inline when referencing them.`;
      break;

    default:
      systemPrompt = `You are a research assistant that answers questions about Work & Study tools.
Use the provided context snippets. Cite the tool slug inline whenever you reference it.
If the context does not contain an answer, say you don't know.`;
  }

  const { text } = await generateText({
    model: googleFlashModel,
    temperature: options.temperature ?? 0.2,
    system: systemPrompt,
    prompt: `Context:\n${formattedContext}\n\nQuestion: ${question}\nAnswer:`,
    experimental_telemetry: { isEnabled: true },
  });

  // Store in semantic cache for future zero-latency retrieval
  void storeCachedAnswer({ question, answer: text, context });

  return {
    answer: text,
    context,
    intent,
  };
};
