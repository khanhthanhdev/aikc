import type { Category, Tool } from "@prisma/client";
import { generateObject } from "ai";
import { z } from "zod";
import { logger } from "~/lib/logger";
import {
  acquireBatchModel,
  googleNoThinkingProviderOptions,
} from "~/services/google";
import { prisma } from "~/services/prisma";

// No "server-only" here: scripts/assign-categories.ts runs this under plain bun.

const log = logger.ai;

/** A tool rarely has more than one or two primary purposes. */
const MAX_CATEGORIES = 2;

/** Keeps the prompt small; the first part of the content says what the tool is. */
const MAX_CONTENT_LENGTH = 2000;

type CategorizableTool = Pick<
  Tool,
  "name" | "websiteUrl" | "tagline" | "description" | "content"
>;

type CategoryOption = Pick<Category, "slug" | "name" | "label" | "description">;

/**
 * Ask the model which of the existing categories fit a tool.
 *
 * The answer is constrained to the slugs that exist, so the model can never
 * invent a category, and it may return none when nothing fits.
 *
 * @returns Slugs of the chosen categories, best fit first; possibly empty.
 */
export const suggestToolCategories = async (
  tool: CategorizableTool,
  categories?: CategoryOption[]
): Promise<string[]> => {
  const options =
    categories ??
    (await prisma.category.findMany({
      select: { slug: true, name: true, label: true, description: true },
      orderBy: { name: "asc" },
    }));

  const [first, ...rest] = options.map(({ slug }) => slug);

  if (!first) {
    return [];
  }

  const { object } = await generateObject({
    model: await acquireBatchModel(),
    schema: z.object({
      categories: z
        .array(z.enum([first, ...rest]))
        .describe(
          `Slugs of the categories that fit, best fit first. At most ${MAX_CATEGORIES}. Empty if none fits.`
        ),
    }),
    system: `
      You file Work & Study tools into the categories of a directory website.
      - Choose the category that matches the tool's main purpose. Add a second one only if the tool is just as much about that.
      - Return an empty list if no category fits. Never pick one just to have one.
      - Some categories are editorial lists rather than topics (e.g. "picks", "featured", "recommended", "staff choice"). Editors fill those by hand: never choose them.
    `,
    prompt: `
      Categories (slug: name — description):
      ${options.map(formatCategory).join("\n")}

      Tool:
      name: ${tool.name}
      website: ${tool.websiteUrl}
      tagline: ${tool.tagline ?? ""}
      description: ${tool.description ?? ""}
      content: ${(tool.content ?? "").slice(0, MAX_CONTENT_LENGTH)}
    `,
    temperature: 0,
    experimental_telemetry: { isEnabled: true },
    providerOptions: googleNoThinkingProviderOptions,
  });

  return [...new Set(object.categories)].slice(0, MAX_CATEGORIES);
};

export type AutoAssignResult =
  /** The tool already had categories; nothing was changed. */
  | { status: "skipped"; categories: [] }
  /** The model found no fitting category. */
  | { status: "none"; categories: [] }
  | { status: "assigned"; categories: string[] };

/**
 * File a tool under the categories the model suggests — but only when it has
 * none yet, so a choice an admin already made is never overwritten.
 *
 * Run it after content generation: the model decides from the tagline,
 * description and content, not from the name alone.
 */
export const autoAssignToolCategories = async (
  toolId: string
): Promise<AutoAssignResult> => {
  const tool = await prisma.tool.findUniqueOrThrow({
    where: { id: toolId },
    select: {
      slug: true,
      name: true,
      websiteUrl: true,
      tagline: true,
      description: true,
      content: true,
      _count: { select: { categories: true } },
    },
  });

  if (tool._count.categories > 0) {
    log.info(`Categories kept for ${tool.slug}: already assigned`);
    return { status: "skipped", categories: [] };
  }

  const slugs = await suggestToolCategories(tool);

  if (!slugs.length) {
    log.info(`No fitting category for ${tool.slug}`);
    return { status: "none", categories: [] };
  }

  await prisma.tool.update({
    where: { id: toolId },
    data: { categories: { connect: slugs.map((slug) => ({ slug })) } },
  });

  log.info(`Categories assigned to ${tool.slug}`, { categories: slugs });
  return { status: "assigned", categories: slugs };
};

const formatCategory = ({ slug, name, label, description }: CategoryOption) =>
  `- ${slug}: ${label || name}${description ? ` — ${description}` : ""}`;
