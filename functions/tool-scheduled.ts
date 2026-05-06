// import { config } from "~/config/index.server";
// import EmailToolScheduled from "~/emails/tool-scheduled";
// import { sendEmails } from "~/lib/email";
import { generateContent } from "~/lib/generate-content";
import { inngestLogger } from "~/lib/logger";
import { uploadFavicon, uploadScreenshot } from "~/lib/media";
import { getSocialsFromUrl } from "~/lib/socials";
import {
  upsertAlternativeVector,
  upsertHybridToolVector,
} from "~/lib/vector-store";
import { inngest } from "~/services/inngest";
import { prisma } from "~/services/prisma";

const FUNCTION_ID = "tool.scheduled";

export const toolScheduled = inngest.createFunction(
  { id: FUNCTION_ID, concurrency: { limit: 2 } },
  { event: "tool.scheduled" },
  async ({ event, step }) => {
    const functionStartTime = performance.now();
    const toolSlug = event.data.slug;

    try {
      inngestLogger.functionStarted(FUNCTION_ID, "tool.scheduled", event.data);

      const tool = await step.run("fetch-tool", async () => {
        const stepStartTime = performance.now();
        inngestLogger.stepStarted("fetch-tool", FUNCTION_ID, toolSlug);

        try {
          const result = await prisma.tool.findUniqueOrThrow({
            where: { slug: event.data.slug },
          });
          const duration = performance.now() - stepStartTime;
          inngestLogger.stepCompleted(
            "fetch-tool",
            FUNCTION_ID,
            toolSlug,
            duration
          );
          return result;
        } catch (error) {
          inngestLogger.stepError("fetch-tool", FUNCTION_ID, toolSlug, error);
          throw error;
        }
      });

      // Run steps in parallel
      await Promise.all([
        step.run("generate-content", async () => {
          const stepStartTime = performance.now();
          inngestLogger.stepStarted("generate-content", FUNCTION_ID, toolSlug);

          try {
            const { tags, ...content } = await generateContent(tool);
            const normalizedTags = (tags ?? []) as string[];

            const result = await prisma.tool.update({
              where: { id: tool.id },
              data: {
                ...content,
                // categories: { set: categories.map(({ id }) => ({ id })) },
                tags: {
                  connectOrCreate: normalizedTags.map((tagSlug) => ({
                    where: { slug: tagSlug },
                    create: { name: tagSlug, slug: tagSlug },
                  })),
                },
              },
            });

            const duration = performance.now() - stepStartTime;
            inngestLogger.stepCompleted(
              "generate-content",
              FUNCTION_ID,
              toolSlug,
              duration
            );
            return result;
          } catch (error) {
            inngestLogger.stepError(
              "generate-content",
              FUNCTION_ID,
              toolSlug,
              error
            );
            throw error;
          }
        }),

        step.run("upload-favicon", async () => {
          const stepStartTime = performance.now();
          inngestLogger.stepStarted("upload-favicon", FUNCTION_ID, toolSlug);

          try {
            const { id, slug, websiteUrl } = tool;
            const faviconUrl = await uploadFavicon(
              websiteUrl,
              `tools/${slug}/favicon`
            );

            const result = await prisma.tool.update({
              where: { id },
              data: { faviconUrl },
            });

            const duration = performance.now() - stepStartTime;
            inngestLogger.stepCompleted(
              "upload-favicon",
              FUNCTION_ID,
              toolSlug,
              duration
            );
            return result;
          } catch (error) {
            inngestLogger.stepError(
              "upload-favicon",
              FUNCTION_ID,
              toolSlug,
              error
            );
            throw error;
          }
        }),

        step.run("upload-screenshot", async () => {
          const stepStartTime = performance.now();
          inngestLogger.stepStarted("upload-screenshot", FUNCTION_ID, toolSlug);

          try {
            const { id, slug, websiteUrl } = tool;
            const screenshotUrl = await uploadScreenshot(
              websiteUrl,
              `tools/${slug}/screenshot`
            );

            const result = await prisma.tool.update({
              where: { id },
              data: { screenshotUrl },
            });

            const duration = performance.now() - stepStartTime;
            inngestLogger.stepCompleted(
              "upload-screenshot",
              FUNCTION_ID,
              toolSlug,
              duration
            );
            return result;
          } catch (error) {
            inngestLogger.stepError(
              "upload-screenshot",
              FUNCTION_ID,
              toolSlug,
              error
            );
            throw error;
          }
        }),

        step.run("get-socials", async () => {
          const stepStartTime = performance.now();
          inngestLogger.stepStarted("get-socials", FUNCTION_ID, toolSlug);

          try {
            const socials = await getSocialsFromUrl(tool.websiteUrl);

            const result = await prisma.tool.update({
              where: { id: tool.id },
              data: {
                xHandle: socials.X?.[0]?.user,
                socials: Object.entries(socials).map(([name, links]) => ({
                  name,
                  url: links[0].url,
                })),
              },
            });

            const duration = performance.now() - stepStartTime;
            inngestLogger.stepCompleted(
              "get-socials",
              FUNCTION_ID,
              toolSlug,
              duration
            );
            return result;
          } catch (error) {
            inngestLogger.stepError(
              "get-socials",
              FUNCTION_ID,
              toolSlug,
              error
            );
            throw error;
          }
        }),
      ]);

      await step.run("sync-tool-vector", async () => {
        const stepStartTime = performance.now();
        inngestLogger.stepStarted("sync-tool-vector", FUNCTION_ID, toolSlug);

        try {
          const latestTool = await prisma.tool.findUniqueOrThrow({
            where: { id: tool.id },
            include: {
              categories: { select: { slug: true, name: true } },
              tags: { select: { slug: true } },
            },
          });

          await upsertHybridToolVector(latestTool);

          const duration = performance.now() - stepStartTime;
          inngestLogger.stepCompleted(
            "sync-tool-vector",
            FUNCTION_ID,
            toolSlug,
            duration
          );
        } catch (error) {
          inngestLogger.stepError(
            "sync-tool-vector",
            FUNCTION_ID,
            toolSlug,
            error
          );
          throw error;
        }
      });

      // Also index as an alternative for related tools recommendations
      await step.run("sync-alternative-vector", async () => {
        const stepStartTime = performance.now();
        inngestLogger.stepStarted(
          "sync-alternative-vector",
          FUNCTION_ID,
          toolSlug
        );

        try {
          const latestTool = await prisma.tool.findUniqueOrThrow({
            where: { id: tool.id },
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
            },
          });

          await upsertAlternativeVector({
            id: latestTool.id,
            slug: latestTool.slug,
            name: latestTool.name,
            description: latestTool.description,
            relatedToolIds: [],
          });

          const duration = performance.now() - stepStartTime;
          inngestLogger.stepCompleted(
            "sync-alternative-vector",
            FUNCTION_ID,
            toolSlug,
            duration
          );
        } catch (error) {
          inngestLogger.stepError(
            "sync-alternative-vector",
            FUNCTION_ID,
            toolSlug,
            error
          );
          throw error;
        }
      });

      // Disconnect from DB
      await step.run("disconnect-from-db", async () => {
        const stepStartTime = performance.now();
        inngestLogger.stepStarted("disconnect-from-db", FUNCTION_ID, toolSlug);

        try {
          const result = await prisma.$disconnect();
          const duration = performance.now() - stepStartTime;
          inngestLogger.stepCompleted(
            "disconnect-from-db",
            FUNCTION_ID,
            toolSlug,
            duration
          );
          return result;
        } catch (error) {
          inngestLogger.stepError(
            "disconnect-from-db",
            FUNCTION_ID,
            toolSlug,
            error
          );
          throw error;
        }
      });

      // Send email
      // DISABLED: Email sending temporarily disabled
      // await step.run("send-email", async () => {
      //   const stepStartTime = performance.now();
      //   inngestLogger.stepStarted("send-email", FUNCTION_ID, toolSlug);

      //   try {
      //     if (!tool.submitterEmail) {
      //       inngestLogger.info("Skipping email - no submitter email", {
      //         functionId: FUNCTION_ID,
      //         toolSlug,
      //       });
      //       return;
      //     }

      //     const to = tool.submitterEmail;
      //     const subject = `Great news! ${tool.name} is scheduled for publication on ${config.site.name}`;

      //     const result = await sendEmails({
      //       to,
      //       subject,
      //       react: EmailToolScheduled({ to, subject, tool }),
      //     });

      //     const duration = performance.now() - stepStartTime;
      //     inngestLogger.stepCompleted(
      //       "send-email",
      //       FUNCTION_ID,
      //       toolSlug,
      //       duration
      //     );
      //     return result;
      //   } catch (error) {
      //     inngestLogger.stepError("send-email", FUNCTION_ID, toolSlug, error);
      //     throw error;
      //   }
      // });

      const duration = performance.now() - functionStartTime;
      inngestLogger.functionCompleted(
        FUNCTION_ID,
        "tool.scheduled",
        event.data,
        duration
      );
    } catch (error) {
      const duration = performance.now() - functionStartTime;
      inngestLogger.functionError(
        FUNCTION_ID,
        "tool.scheduled",
        event.data,
        error,
        duration
      );
      throw error;
    }
  }
);
