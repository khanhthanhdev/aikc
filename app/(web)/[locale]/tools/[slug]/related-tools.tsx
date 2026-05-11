import type { Prisma } from "@prisma/client";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { ToolCard } from "~/components/web/cards/tool-card";
import { Listing } from "~/components/web/listing";
import { findRelatedTools } from "~/lib/related-tools";
import type { ToolOne } from "~/server/tools/payloads";
import { findTools } from "~/server/tools/queries";

interface RelatedToolsInput {
  categorySlugs: string[];
  relatedToolIds: string[];
  slug: string;
  toolId: string;
}

const getRelatedTools = async ({
  categorySlugs,
  relatedToolIds,
  slug,
  toolId,
}: RelatedToolsInput) => {
  "use cache";

  cacheLife("max");
  cacheTag("tools");

  const take = 3;

  // Priority 1: Use stored related tool IDs from database
  if (relatedToolIds.length > 0) {
    const storedRelatedTools = await findTools({
      where: { id: { in: relatedToolIds } },
      take,
    });

    if (storedRelatedTools.length > 0) {
      return storedRelatedTools;
    }
  }

  // Priority 2: Try Qdrant-based recommendation
  const relatedResults = await findRelatedTools(toolId, {
    limit: take,
    scoreThreshold: 0.0, // No threshold to ensure we get results
    publishedOnly: true,
  }).catch(() => []);

  if (relatedResults.length > 0) {
    return relatedResults.map(({ tool: relatedTool }) => relatedTool);
  }

  // Priority 3: Fallback to category-based deterministic selection
  const where = {
    categories: {
      some: { slug: { in: categorySlugs } },
    },
    NOT: { slug },
  } satisfies Prisma.ToolWhereInput;

  return findTools({
    where,
    take,
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }, { name: "asc" }],
  });
};

export const RelatedTools = async ({
  tool,
  locale,
}: {
  tool: ToolOne;
  locale: string;
}) => {
  const isVietnamese = locale === "vi";
  const t = await getTranslations({ locale, namespace: "Tools" });

  // Get localized tool name for the heading
  const toolName = isVietnamese ? (tool.nameVi ?? tool.name) : tool.name;
  const title = t("similarToolsTitle", { name: toolName });

  const tools = await getRelatedTools({
    categorySlugs: tool.categories.map(({ slug }) => slug),
    relatedToolIds: tool.relatedTools ?? [],
    slug: tool.slug,
    toolId: tool.id,
  });

  if (!tools.length) {
    return null;
  }

  return (
    <Listing title={title}>
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </Listing>
  );
};
