import type { PricingTier } from "@prisma/client";
import { findRelatedTools } from "~/lib/related-tools";
import { hybridSearchToolVectors } from "~/lib/vector-store";
import { prisma } from "~/services/prisma";

type Locale = "en" | "vi";

/** Library lookups must never hold up the answer for long. */
export const LIBRARY_CONTEXT_TIMEOUT_MS = 2000;
const QUERY_MATCH_LIMIT = 6;
const RELATED_TOOL_LIMIT = 4;
const TOOL_CONTENT_EXCERPT_LENGTH = 1500;

export type LibraryTool = {
  name: string;
  pricing: string | null;
  pricingTier: PricingTier | null;
  slug: string;
  tagline: string | null;
};

export type CurrentTool = LibraryTool & {
  categories: string[];
  content: string | null;
  description: string | null;
  websiteUrl: string;
};

export type LibraryContext = {
  currentTool: CurrentTool | null;
  /** Tools from the library the model may recommend. */
  tools: LibraryTool[];
  /** False when the lookup failed or timed out, so the list is unknown rather than empty. */
  available: boolean;
};

const libraryToolSelect = {
  slug: true,
  name: true,
  nameVi: true,
  tagline: true,
  taglineVi: true,
  pricing: true,
  pricingVi: true,
  pricingTier: true,
} as const;

type LibraryToolRow = {
  name: string;
  nameVi: string | null;
  pricing: string | null;
  pricingTier: PricingTier | null;
  pricingVi: string | null;
  slug: string;
  tagline: string | null;
  taglineVi: string | null;
};

const publishedWhere = () => ({ publishedAt: { lte: new Date() } });

const localizeTool = (row: LibraryToolRow, locale: Locale): LibraryTool => {
  const vi = locale === "vi";
  return {
    slug: row.slug,
    name: (vi && row.nameVi) || row.name,
    tagline: (vi && row.taglineVi) || row.tagline,
    pricing: (vi && row.pricingVi) || row.pricing,
    pricingTier: row.pricingTier,
  };
};

export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/** Published tools with these slugs, in the order given. */
const findToolsBySlug = async (
  slugs: string[],
  locale: Locale
): Promise<LibraryTool[]> => {
  if (slugs.length === 0) {
    return [];
  }
  const rows = await prisma.tool.findMany({
    where: { ...publishedWhere(), slug: { in: slugs } },
    select: libraryToolSelect,
  });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((row): row is LibraryToolRow => Boolean(row))
    .map((row) => localizeTool(row, locale));
};

const findToolsForQuery = async (
  query: string,
  locale: Locale,
  excludeSlug?: string
): Promise<LibraryTool[]> => {
  const matches = await hybridSearchToolVectors(query, {
    limit: QUERY_MATCH_LIMIT + 1,
  });
  const slugs = matches
    .map((match) => match.payload.slug)
    .filter((slug) => slug !== excludeSlug)
    .slice(0, QUERY_MATCH_LIMIT);
  // The vector payload can be stale, so names and pricing come from the DB
  return findToolsBySlug(slugs, locale);
};

const findCurrentTool = async (
  slug: string,
  locale: Locale
): Promise<(CurrentTool & { id: string; relatedTools: string[] }) | null> => {
  const row = await prisma.tool.findFirst({
    where: { ...publishedWhere(), slug },
    select: {
      ...libraryToolSelect,
      id: true,
      description: true,
      descriptionVi: true,
      content: true,
      contentVi: true,
      websiteUrl: true,
      relatedTools: true,
      categories: {
        select: { name: true, nameVi: true, label: true, labelVi: true },
      },
    },
  });
  if (!row) {
    return null;
  }

  const vi = locale === "vi";
  const content = (vi && row.contentVi) || row.content;
  return {
    ...localizeTool(row, locale),
    id: row.id,
    relatedTools: row.relatedTools,
    description: (vi && row.descriptionVi) || row.description,
    content: content ? content.slice(0, TOOL_CONTENT_EXCERPT_LENGTH) : null,
    websiteUrl: row.websiteUrl,
    categories: row.categories.map((category) =>
      vi
        ? (category.labelVi ?? category.nameVi ?? category.label ?? category.name)
        : (category.label ?? category.name)
    ),
  };
};

const findToolsRelatedTo = async (
  tool: { id: string; relatedTools: string[]; slug: string },
  locale: Locale
): Promise<LibraryTool[]> => {
  const curated = await findToolsBySlug(
    tool.relatedTools.filter((slug) => slug !== tool.slug),
    locale
  );
  if (curated.length > 0) {
    return curated.slice(0, RELATED_TOOL_LIMIT);
  }
  const similar = await findRelatedTools(tool.id, {
    limit: RELATED_TOOL_LIMIT,
  });
  return similar.map(({ tool: related }) => localizeTool(related, locale));
};

const loadLibraryContext = async ({
  query,
  toolSlug,
  locale,
}: {
  query: string;
  toolSlug?: string;
  locale: Locale;
}): Promise<LibraryContext> => {
  if (!toolSlug) {
    const tools = query ? await findToolsForQuery(query, locale) : [];
    return { currentTool: null, tools, available: true };
  }

  const tool = await findCurrentTool(toolSlug, locale);
  if (!tool) {
    // Unknown or unpublished slug: answer like a general question
    const tools = query ? await findToolsForQuery(query, locale) : [];
    return { currentTool: null, tools, available: true };
  }

  const { id: _id, relatedTools: _relatedTools, ...currentTool } = tool;
  const tools = await findToolsRelatedTo(tool, locale);
  return { currentTool, tools, available: true };
};

/**
 * Tools the chat may talk about: the tool page being viewed and the library
 * tools that best match the question. Never throws — when Qdrant or the DB is
 * slow or down the answer goes ahead without a list.
 */
export const getLibraryContext = async (params: {
  query: string;
  toolSlug?: string;
  locale: Locale;
}): Promise<LibraryContext> => {
  try {
    return await withTimeout(
      loadLibraryContext(params),
      LIBRARY_CONTEXT_TIMEOUT_MS,
      "Library context"
    );
  } catch (error) {
    // console.warn rather than the project logger, which is silent in production
    console.warn("[chat] Library context unavailable:", {
      toolSlug: params.toolSlug ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    return { currentTool: null, tools: [], available: false };
  }
};

export const toolPath = (locale: Locale, slug: string) =>
  `/${locale}/tools/${slug}`;

const formatPricing = (tool: LibraryTool) =>
  [tool.pricingTier, tool.pricing].filter(Boolean).join(" — ") || "unknown";

const formatLibraryTool = (tool: LibraryTool, locale: Locale) =>
  `- [${tool.name}](${toolPath(locale, tool.slug)})${tool.tagline ? ` — ${tool.tagline}` : ""} | Pricing: ${formatPricing(tool)}`;

/**
 * The library section of the system prompt. Kept in English for both locales:
 * it is data plus rules, and the model answers in the user's language anyway.
 */
export const formatLibraryContext = (
  context: LibraryContext,
  locale: Locale,
  toolSlug?: string
): string => {
  const sections: string[] = [];
  const { currentTool, tools } = context;

  if (currentTool) {
    sections.push(
      [
        "CURRENT TOOL (the page the user is viewing — facts from our library database):",
        `- Name: ${currentTool.name}`,
        `- Link: ${toolPath(locale, currentTool.slug)}`,
        currentTool.tagline && `- Tagline: ${currentTool.tagline}`,
        currentTool.description && `- Description: ${currentTool.description}`,
        `- Pricing tier: ${currentTool.pricingTier ?? "unknown"}`,
        `- Pricing details: ${currentTool.pricing ?? "unknown"}`,
        currentTool.categories.length > 0 &&
          `- Categories: ${currentTool.categories.join(", ")}`,
        `- Official website: ${currentTool.websiteUrl}`,
        currentTool.content &&
          `- Page content (excerpt):\n"""\n${currentTool.content}\n"""`,
        "",
        "Rules for the current tool:",
        "- Questions about price, plans or free tiers: answer ONLY from the pricing fields above.",
        `- If a pricing field is "unknown" or does not answer the question, say our library has no pricing details for it and tell the user to check the official website (${currentTool.websiteUrl}). NEVER guess prices or plans.`,
      ]
        .filter((line): line is string => typeof line === "string")
        .join("\n")
    );
  }

  if (!context.available) {
    sections.push(
      [
        toolSlug &&
          `- The user is on the page of the tool "${toolSlug}", but its details could not be loaded. Do not guess its pricing or plans; point them to the official website linked on that page.`,
        "LIBRARY TOOLS: the library list could not be loaded for this question.",
        `- Do not name specific tools as being in our library. Suggest the user browse the library at /${locale}/tools instead.`,
      ]
        .filter(Boolean)
        .join("\n")
    );
  } else if (tools.length > 0) {
    sections.push(
      [
        currentTool
          ? "LIBRARY TOOLS related to the current tool (use these for alternatives or similar tools):"
          : "LIBRARY TOOLS matching the question:",
        ...tools.map((tool) => formatLibraryTool(tool, locale)),
        "",
        "Rules for recommending tools:",
        "- Recommend ONLY tools from this list (or the current tool). Never recommend a tool that is not listed, even if you know it.",
        "- Every time you recommend a listed tool, link it with the exact markdown link given, e.g. [Name](/path).",
        "- Only recommend listed tools that genuinely fit the request; skip the rest.",
        "- If none of them fits, say clearly that our library does not have a suitable tool for that yet.",
      ].join("\n")
    );
  } else {
    sections.push(
      [
        "LIBRARY TOOLS: no tools in our library match this question.",
        "- If the user wants a tool recommendation, say clearly that our library does not have a suitable tool for that yet. Do not recommend tools from outside the library.",
      ].join("\n")
    );
  }

  return sections.join("\n\n");
};
