"use server";

import "server-only";
import { slugify } from "@curiousleaf/utils";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toolSchema } from "~/app/admin/tools/_lib/validations";
import { generateContent } from "~/lib/generate-content";
import { logger } from "~/lib/logger";
import { uploadFavicon, uploadScreenshot } from "~/lib/media";
import { revalidatePublicToolCaches } from "~/lib/public-tool-cache";
import { authedProcedure } from "~/lib/safe-actions";
import { translateToVietnamese } from "~/lib/translate-content";
import {
  deleteHybridToolVector,
  upsertHybridToolVector,
} from "~/lib/vector-store";
import { sendInngestEvent } from "~/services/inngest";
import { prisma } from "~/services/prisma";

const log = logger.action;

const sendToolPublishEvents = async (tool: {
  id: string;
  slug: string;
  publishedAt: Date;
}) => {
  await sendInngestEvent({
    name: "tool.scheduled",
    data: { id: tool.id, slug: tool.slug },
  });

  await sendInngestEvent({
    name: "tool.published",
    data: { id: tool.id, slug: tool.slug },
    id: `tool.published:${tool.id}:${tool.publishedAt.getTime()}`,
    ts: tool.publishedAt.getTime(),
  });
};

export const createTool = authedProcedure
  .createServerAction()
  .input(toolSchema)
  .handler(async ({ input: { categories, collections, tags, ...input } }) => {
    const tool = await prisma.tool.create({
      data: {
        ...input,
        slug: input.slug || slugify(input.name),

        // Relations
        categories: { connect: categories?.map((id: string) => ({ id })) },
        collections: { connect: collections?.map((id: string) => ({ id })) },
        tags: { connect: tags?.map((id: string) => ({ id })) },
      },
      include: {
        categories: { select: { slug: true, name: true } },
        tags: { select: { slug: true } },
      },
    });

    revalidatePath("/admin/tools");
    revalidatePublicToolCaches();

    // Sync to Qdrant vector store
    await upsertHybridToolVector(tool);
    log.info(`Vector synced for new tool: ${tool.slug}`);

    // Send an event to the Inngest pipeline
    if (tool.publishedAt) {
      log.info(`Sending publish events for tool: ${tool.slug}`);
      await sendToolPublishEvents({
        id: tool.id,
        slug: tool.slug,
        publishedAt: tool.publishedAt,
      });
    }

    return tool;
  });

export const updateTool = authedProcedure
  .createServerAction()
  .input(toolSchema.extend({ id: z.string() }))
  .handler(
    async ({ input: { id, categories, collections, tags, ...input } }) => {
      const previous = await prisma.tool.findUniqueOrThrow({
        where: { id },
        select: { publishedAt: true },
      });

      const tool = await prisma.tool.update({
        where: { id },
        data: {
          ...input,

          // Relations
          categories: { set: categories?.map((id: string) => ({ id })) },
          collections: { set: collections?.map((id: string) => ({ id })) },
          tags: { set: tags?.map((id: string) => ({ id })) },
        },
        include: {
          categories: { select: { slug: true, name: true } },
          tags: { select: { slug: true } },
        },
      });

      revalidatePath("/admin/tools");
      revalidatePath(`/admin/tools/${tool.slug}`);
      revalidatePublicToolCaches();

      // Sync to Qdrant vector store
      await upsertHybridToolVector(tool);
      log.info(`Vector synced for updated tool: ${tool.slug}`);

      const publishedAt = tool.publishedAt;

      if (
        publishedAt &&
        previous.publishedAt?.getTime() !== publishedAt.getTime()
      ) {
        log.info(`Sending publish events for tool: ${tool.slug}`);
        await sendToolPublishEvents({
          id: tool.id,
          slug: tool.slug,
          publishedAt,
        });
      }

      return tool;
    }
  );

export const updateTools = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()), data: toolSchema.partial() }))
  .handler(async ({ input: { ids, data } }) => {
    await prisma.tool.updateMany({
      where: { id: { in: ids } },
      data,
    });

    // Fetch updated tools and sync to vector store
    const updatedTools = await prisma.tool.findMany({
      where: { id: { in: ids } },
      include: {
        categories: { select: { slug: true, name: true } },
        tags: { select: { slug: true } },
      },
    });

    // Sync all updated tools to Qdrant
    await Promise.all(updatedTools.map((tool) => upsertHybridToolVector(tool)));
    log.info(`Vector synced for ${updatedTools.length} tools`);

    revalidatePath("/admin/tools");
    revalidatePublicToolCaches();

    if (data.publishedAt) {
      log.info(`Sending publish events for ${updatedTools.length} tool(s)`, {
        slugs: updatedTools.map((tool) => tool.slug),
        publishedAt: data.publishedAt,
      });
      for (const tool of updatedTools) {
        await sendToolPublishEvents({
          id: tool.id,
          slug: tool.slug,
          publishedAt: data.publishedAt,
        });
      }
    }

    return true;
  });

export const deleteTools = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ input: { ids } }) => {
    const tools = await prisma.tool.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true },
    });

    // Delete from Qdrant vector store first
    await Promise.all(tools.map((tool) => deleteHybridToolVector(tool.id)));
    log.info(`Vectors deleted for ${tools.length} tools`);

    await prisma.tool.deleteMany({
      where: { id: { in: ids } },
    });

    revalidatePath("/admin/tools");
    revalidatePublicToolCaches();

    // Send an event to the Inngest pipeline
    log.info(`Sending tool.deleted events for ${tools.length} tool(s)`, {
      slugs: tools.map((t) => t.slug),
    });
    for (const tool of tools) {
      await sendInngestEvent({
        name: "tool.deleted",
        data: { id: tool.id, slug: tool.slug },
      });
    }

    return true;
  });

export const scheduleTools = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()), publishedAt: z.date() }))
  .handler(async ({ input: { ids, publishedAt } }) => {
    const tools = await prisma.tool.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true },
    });

    await prisma.tool.updateMany({
      where: { id: { in: ids } },
      data: { publishedAt },
    });

    revalidatePath("/admin/tools");
    revalidatePublicToolCaches();

    // Send an event to the Inngest pipeline
    log.info(`Sending publish events for ${tools.length} tool(s)`, {
      slugs: tools.map((t) => t.slug),
      publishedAt,
    });
    for (const tool of tools) {
      await sendToolPublishEvents({ ...tool, publishedAt });
    }

    return true;
  });

export const reuploadToolAssets = authedProcedure
  .createServerAction()
  .input(z.object({ id: z.string() }))
  .handler(async ({ input: { id } }) => {
    const tool = await prisma.tool.findUniqueOrThrow({ where: { id } });

    const [faviconUrl, screenshotUrl] = await Promise.all([
      uploadFavicon(tool.websiteUrl, `tools/${tool.slug}/favicon`),
      uploadScreenshot(tool.websiteUrl, `tools/${tool.slug}/screenshot`),
    ]);

    await prisma.tool.update({
      where: { id: tool.id },
      data: { faviconUrl, screenshotUrl },
    });
  });

export const translateToolToVietnamese = authedProcedure
  .createServerAction()
  .input(z.object({ id: z.string() }))
  .handler(async ({ input: { id } }) => {
    const tool = await prisma.tool.findUniqueOrThrow({ where: { id } });

    const translation = await translateToVietnamese({
      name: tool.name,
      tagline: tool.tagline,
      description: tool.description,
      content: tool.content,
      pricing: tool.pricing,
    });

    const updatedTool = await prisma.tool.update({
      where: { id },
      data: {
        ...translation,
        translationStatusVi: "MACHINE",
        translationUpdatedAtVi: new Date(),
      },
    });

    revalidatePath("/admin/tools");
    revalidatePath(`/admin/tools/${tool.slug}`);
    revalidatePublicToolCaches();

    return updatedTool;
  });

export const batchTranslateToVietnamese = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ input: { ids } }) => {
    const tools = await prisma.tool.findMany({
      where: { id: { in: ids } },
    });

    await Promise.all(
      tools.map(async (tool) => {
        const translation = await translateToVietnamese({
          name: tool.name,
          tagline: tool.tagline,
          description: tool.description,
          content: tool.content,
          pricing: tool.pricing,
        });

        await prisma.tool.update({
          where: { id: tool.id },
          data: {
            ...translation,
            translationStatusVi: "MACHINE",
            translationUpdatedAtVi: new Date(),
          },
        });
      })
    );

    revalidatePath("/admin/tools");
    revalidatePublicToolCaches();

    return true;
  });

export const translateToolFieldToVietnamese = authedProcedure
  .createServerAction()
  .input(
    z.object({
      id: z.string(),
      field: z.enum(["name", "tagline", "description", "content", "pricing"]),
    })
  )
  .handler(async ({ input: { id, field } }) => {
    const tool = await prisma.tool.findUniqueOrThrow({ where: { id } });

    const fieldValue = tool[field as keyof typeof tool] as string | null;

    if (!fieldValue) {
      throw new Error(`No ${field} to translate`);
    }

    const translation = await translateToVietnamese({
      [field]: fieldValue,
    });

    const viFieldMap: Record<string, keyof typeof translation> = {
      name: "nameVi",
      tagline: "taglineVi",
      description: "descriptionVi",
      content: "contentVi",
      pricing: "pricingVi",
    };

    const viField = viFieldMap[field];
    const viValue = translation[viField];

    if (!viValue) {
      throw new Error("Translation returned empty value");
    }

    await prisma.tool.update({
      where: { id },
      data: {
        [viField]: viValue,
        translationStatusVi: "MACHINE",
        translationUpdatedAtVi: new Date(),
      },
    });

    revalidatePath("/admin/tools");
    revalidatePath(`/admin/tools/${tool.slug}`);
    revalidatePublicToolCaches();

    return { field: viField, value: viValue };
  });

const processToolPipeline = async (toolId: string) => {
  log.info(`Starting tool pipeline for ID: ${toolId}`);
  const tool = await prisma.tool.findUniqueOrThrow({ where: { id: toolId } });
  log.info(`Processing tool: ${tool.name}`, {
    slug: tool.slug,
    url: tool.websiteUrl,
  });

  try {
    // Run content generation, screenshot, and favicon uploads in parallel
    await Promise.all([
      (async () => {
        log.debug(`[${tool.slug}] Starting content generation`);
        const { tags, ...content } = await generateContent(tool);
        const normalizedTags = (tags ?? []) as string[];
        log.debug(`[${tool.slug}] Content generated, updating database`);

        await prisma.tool.update({
          where: { id: tool.id },
          data: {
            ...content,
            tags: {
              connectOrCreate: normalizedTags.map((tagSlug) => ({
                where: { slug: tagSlug },
                create: { name: tagSlug, slug: tagSlug },
              })),
            },
          },
        });
        log.info(`[${tool.slug}] Content saved successfully`);
      })(),

      (async () => {
        log.debug(`[${tool.slug}] Starting screenshot upload`);
        const screenshotUrl = await uploadScreenshot(
          tool.websiteUrl,
          `tools/${tool.slug}/screenshot`
        );
        await prisma.tool.update({
          where: { id: tool.id },
          data: { screenshotUrl },
        });
        log.info(`[${tool.slug}] Screenshot uploaded: ${screenshotUrl}`);
      })(),

      (async () => {
        log.debug(`[${tool.slug}] Starting favicon upload`);
        const faviconUrl = await uploadFavicon(
          tool.websiteUrl,
          `tools/${tool.slug}/favicon`
        );
        await prisma.tool.update({
          where: { id: tool.id },
          data: { faviconUrl },
        });
        log.info(`[${tool.slug}] Favicon uploaded: ${faviconUrl}`);
      })(),
    ]);

    // Translate to Vietnamese
    log.debug(`[${tool.slug}] Starting Vietnamese translation`);
    const updatedTool = await prisma.tool.findUniqueOrThrow({
      where: { id: tool.id },
    });

    if (
      updatedTool.nameVi &&
      updatedTool.descriptionVi &&
      updatedTool.contentVi
    ) {
      log.info(
        `[${tool.slug}] Translation skipped - already has Vietnamese fields`
      );
    } else {
      const { translateToVietnamese } = await import("~/lib/translate-content");

      const translation = await translateToVietnamese({
        name: updatedTool.name,
        tagline: updatedTool.tagline,
        description: updatedTool.description,
        content: updatedTool.content,
        pricing: updatedTool.pricing,
      });

      await prisma.tool.update({
        where: { id: tool.id },
        data: {
          ...translation,
          translationStatusVi: "MACHINE",
          translationUpdatedAtVi: new Date(),
        },
      });
      log.info(`[${tool.slug}] Vietnamese translation saved`);
    }

    // Sync to Qdrant vector store
    log.debug(`[${tool.slug}] Syncing to vector store`);
    const latestTool = await prisma.tool.findUniqueOrThrow({
      where: { id: tool.id },
      include: {
        categories: { select: { slug: true, name: true } },
        tags: { select: { slug: true } },
      },
    });

    await upsertHybridToolVector(latestTool);
    log.info(`[${tool.slug}] Pipeline completed successfully`);
  } catch (error) {
    log.error(`[${tool.slug}] Pipeline failed`, { error });
    throw error;
  }
};

export const processTools = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ input: { ids } }) => {
    log.info("Process tools requested", { count: ids.length, ids });

    const tools = await prisma.tool.findMany({
      where: { id: { in: ids } },
      select: { slug: true, id: true },
    });

    log.info(`Found ${tools.length} tools to process`, {
      slugs: tools.map((t) => t.slug),
    });

    if (process.env.NODE_ENV === "production") {
      log.info("Running in production mode - sending to Inngest", {
        toolCount: tools.length,
        slugs: tools.map((t) => t.slug),
      });
      for (const tool of tools) {
        await sendInngestEvent({
          name: "tool.submitted",
          data: { id: tool.id, slug: tool.slug },
        });
        log.debug(`Sent tool.submitted event for: ${tool.slug}`);
      }
    } else {
      log.info("Running in development mode - executing directly");
      await Promise.all(tools.map((t) => processToolPipeline(t.id)));
    }

    revalidatePath("/admin/tools");
    revalidatePublicToolCaches();
    log.info("Process tools completed");
    return true;
  });
