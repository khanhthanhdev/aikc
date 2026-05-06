import crypto from "node:crypto";
import type { Schemas } from "@qdrant/js-client-rest";
import { getSearchConfig } from "~/config/search";
import { createLogger } from "~/lib/logger";
import type { ToolVectorMatch, ToolVectorPayload } from "~/lib/vector-store";
import { type ToolMany, toolManyPayload } from "~/server/tools/payloads";
import { prisma } from "~/services/prisma";
import {
  ensureHybridCollection,
  QDRANT_HYBRID_COLLECTION,
  qdrantClient,
} from "~/services/qdrant";

const log = createLogger("related-tools");

// Convert string ID to a valid UUID for Qdrant
const toUUID = (id: string): string => {
  const hash = crypto.createHash("md5").update(id).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
};

export interface FindRelatedToolsOptions {
  /** Filter by category slug */
  category?: string;
  /** Maximum number of related tools to return */
  limit?: number;
  /** Only include published tools (default: true) */
  publishedOnly?: boolean;
  /** Minimum similarity score threshold (0-1) */
  scoreThreshold?: number;
}

export interface RelatedToolResult {
  score: number;
  tool: ToolMany;
}

/**
 * Finds tools related to a given tool using Qdrant's recommendation API
 * Uses the tool's vector to find similar tools based on vector similarity
 */
export const findRelatedTools = async (
  toolId: string,
  options: FindRelatedToolsOptions = {}
): Promise<RelatedToolResult[]> => {
  const config = getSearchConfig("recommendation");
  const {
    limit = config.limit,
    scoreThreshold = config.scoreThreshold,
    category,
    publishedOnly = true,
  } = options;

  log.debug(`Finding related tools for: ${toolId}`, {
    limit,
    scoreThreshold,
    category,
  });
  await ensureHybridCollection();

  // Build filter for category and other constraints
  const filter = buildRecommendationFilter({ category });

  try {
    // Use Qdrant's query API with recommend query type
    // This finds points similar to the given point ID using vector similarity
    const results = await qdrantClient.query(QDRANT_HYBRID_COLLECTION, {
      query: {
        recommend: {
          positive: [toUUID(toolId)],
          negative: [],
        },
      },
      using: "dense", // Use dense vectors for semantic similarity
      filter,
      limit: limit + 1, // Request one extra to exclude the source tool if it appears
      with_payload: true,
      score_threshold: scoreThreshold,
    });

    if (!results?.points) {
      log.warn(`No results returned from related tools query for ${toolId}`);
      return [];
    }

    log.debug(`Found ${results.points.length} raw recommendation results`);

    // Parse results and exclude the source tool
    const matches = results.points
      .map((result) => {
        const payload = result.payload as ToolVectorPayload | undefined;
        if (!payload) {
          return null;
        }

        return {
          id: payload.id ?? String(result.id ?? ""),
          score: result.score ?? 0,
          payload,
        };
      })
      .filter((match): match is ToolVectorMatch => {
        if (!match?.payload?.slug) {
          return false;
        }
        // Exclude the source tool from results
        if (match.id === toolId) {
          return false;
        }
        return true;
      })
      .slice(0, limit);

    if (!matches.length) {
      log.debug("No recommendation matches found");
      return [];
    }

    // Hydrate with full tool data from Prisma
    const toolIds = matches.map((m) => m.id);
    const tools = await prisma.tool.findMany({
      where: {
        id: { in: toolIds },
        ...(publishedOnly ? { publishedAt: { lte: new Date() } } : {}),
      },
      include: toolManyPayload(),
    });

    // Build a map for efficient lookup
    const toolMap = new Map(tools.map((t) => [t.id, t]));

    // Preserve order from recommendation results and attach scores
    const relatedTools: RelatedToolResult[] = matches
      .map((match) => {
        const tool = toolMap.get(match.id);
        if (!tool) {
          return null;
        }
        return { tool, score: match.score };
      })
      .filter((result): result is RelatedToolResult => result !== null);

    log.info(`Found ${relatedTools.length} related tools for ${toolId}`);
    return relatedTools;
  } catch (error: any) {
    // Handle "Not Found" error specifically (occurs when tool is not in Qdrant)
    if (error.status === 404) {
      log.warn(
        `Tool not found in Qdrant (ID: ${toolId}). Skipping related tools.`
      );
      return [];
    }

    log.error(`Failed to find related tools for ${toolId}`, { error });
    // Return empty array on error rather than throwing
    // This allows the UI to gracefully degrade
    return [];
  }
};

/**
 * Finds related tools by tool slug
 * Convenience wrapper that looks up the tool ID first
 */
export const findRelatedToolsBySlug = async (
  slug: string,
  options: FindRelatedToolsOptions = {}
): Promise<RelatedToolResult[]> => {
  const tool = await prisma.tool.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!tool) {
    log.warn(`Tool not found for slug: ${slug}`);
    return [];
  }

  return findRelatedTools(tool.id, options);
};

/**
 * Builds a Qdrant filter for recommendation queries
 */
const buildRecommendationFilter = (options: {
  category?: string;
}): Schemas["Filter"] | undefined => {
  const must: Schemas["Condition"][] = [];

  if (options.category) {
    must.push({
      key: "categories",
      match: { any: [options.category] },
    } as Schemas["FieldCondition"]);
  }

  if (!must.length) {
    return undefined;
  }

  return { must };
};

/**
 * Gets related tools for multiple tools at once
 * Useful for batch operations like generating related tools sections
 */
export const findRelatedToolsBatch = async (
  toolIds: string[],
  options: FindRelatedToolsOptions = {}
): Promise<Map<string, RelatedToolResult[]>> => {
  const results = new Map<string, RelatedToolResult[]>();

  // Process in parallel with a reasonable concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < toolIds.length; i += BATCH_SIZE) {
    const batch = toolIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (toolId) => {
        const related = await findRelatedTools(toolId, options);
        return { toolId, related };
      })
    );

    for (const { toolId, related } of batchResults) {
      results.set(toolId, related);
    }
  }

  return results;
};

/**
 * Calculates and persists related tool IDs for a given tool.
 * This should be called after a tool is submitted or updated.
 */
export const updateToolRelatedTools = async (
  toolId: string
): Promise<string[]> => {
  log.info(`Calculating and persisting related tools for: ${toolId}`);

  const relatedResults = await findRelatedTools(toolId, {
    limit: 3,
    scoreThreshold: 0.0,
    publishedOnly: true,
  });

  const relatedToolIds = relatedResults.map((r) => r.tool.id);

  await prisma.tool.update({
    where: { id: toolId },
    data: { relatedTools: relatedToolIds },
  });

  log.info(`Persisted ${relatedToolIds.length} related tools for: ${toolId}`, {
    relatedToolIds,
  });
  return relatedToolIds;
};
