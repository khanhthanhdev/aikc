import { getRandomElement } from "@curiousleaf/utils";
import type { Prisma } from "@prisma/client";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { ToolCard } from "~/components/web/cards/tool-card";
import { Listing } from "~/components/web/listing";
import { findRelatedTools } from "~/lib/related-tools";
import type { ToolOne } from "~/server/tools/payloads";
import { findTools } from "~/server/tools/queries";
import { prisma } from "~/services/prisma";

// Generate random values outside component to avoid impure function during render
const generateRandomValues = (itemCount: number, take: number) => ({
  skip: Math.max(0, Math.floor(Math.random() * itemCount) - take),
  orderByProperty: getRandomElement(["id", "name"] as const),
  orderByDirection: getRandomElement(["asc", "desc"] as const),
});

export const RelatedTools = async ({
  tool,
  locale,
}: {
  tool: ToolOne;
  locale: string;
}) => {
  await connection();

  const take = 3;
  const isVietnamese = locale === "vi";
  const t = await getTranslations({ locale, namespace: "Tools" });

  // Get localized tool name for the heading
  const toolName = isVietnamese ? (tool.nameVi ?? tool.name) : tool.name;
  const title = t("similarToolsTitle", { name: toolName });

  // Priority 1: Use stored related tool IDs from database
  if (tool.relatedTools && tool.relatedTools.length > 0) {
    const storedRelatedTools = await findTools({
      where: { id: { in: tool.relatedTools } },
      take,
    });

    if (storedRelatedTools.length > 0) {
      return (
        <Listing title={title}>
          {storedRelatedTools.map((relatedTool) => (
            <ToolCard key={relatedTool.id} tool={relatedTool} />
          ))}
        </Listing>
      );
    }
  }

  // Priority 2: Try Qdrant-based recommendation
  const relatedResults = await findRelatedTools(tool.id, {
    limit: take,
    scoreThreshold: 0.0, // No threshold to ensure we get results
    publishedOnly: true,
  });

  if (relatedResults.length > 0) {
    return (
      <Listing title={title}>
        {relatedResults.map(({ tool: relatedTool }) => (
          <ToolCard key={relatedTool.id} tool={relatedTool} />
        ))}
      </Listing>
    );
  }

  // Priority 3: Fallback to category-based random selection
  const where = {
    categories: {
      some: { slug: { in: tool.categories.map(({ slug }) => slug) } },
    },
    NOT: { slug: tool.slug },
  } satisfies Prisma.ToolWhereInput;

  const itemCount = await prisma.tool.count({ where });
  const { skip, orderByProperty, orderByDirection } = generateRandomValues(
    itemCount,
    take
  );

  const tools = await findTools({
    where,
    take,
    skip,
    orderBy: { [orderByProperty]: orderByDirection },
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
