import { validateLink } from "~/lib/link-validator";
import { inngestLogger } from "~/lib/logger";
import { inngest } from "~/services/inngest";
import { prisma } from "~/services/prisma";

const BATCH_SIZE = 50;
const FUNCTION_ID = "link.checker";

export const linkChecker = inngest.createFunction(
  { id: FUNCTION_ID, concurrency: { limit: 1 } },
  { cron: "0 3 * * 0" }, // Run every Sunday at 3 AM
  async ({ step }) => {
    const functionStartTime = performance.now();

    try {
      inngestLogger.functionStarted(FUNCTION_ID, "cron.link-checker", {});

      const tools = await step.run("fetch-published-tools", async () => {
        const stepStartTime = performance.now();
        inngestLogger.stepStarted("fetch-published-tools", FUNCTION_ID);

        try {
          const result = await prisma.tool.findMany({
            where: { publishedAt: { lte: new Date() } },
            select: { id: true, slug: true, websiteUrl: true, isBroken: true },
          });
          const duration = performance.now() - stepStartTime;
          inngestLogger.stepCompleted(
            "fetch-published-tools",
            FUNCTION_ID,
            undefined,
            duration
          );
          inngestLogger.info(
            `Found ${result.length} published tools to check`,
            {
              functionId: FUNCTION_ID,
              totalTools: result.length,
            }
          );
          return result;
        } catch (error) {
          inngestLogger.stepError(
            "fetch-published-tools",
            FUNCTION_ID,
            undefined,
            error
          );
          throw error;
        }
      });

      // Process tools in batches to avoid overwhelming the system
      const batches = [];
      for (let i = 0; i < tools.length; i += BATCH_SIZE) {
        batches.push(tools.slice(i, i + BATCH_SIZE));
      }

      inngestLogger.info(
        `Processing ${tools.length} tools in ${batches.length} batches`,
        {
          functionId: FUNCTION_ID,
          totalTools: tools.length,
          batchCount: batches.length,
          batchSize: BATCH_SIZE,
        }
      );

      let brokenCount = 0;
      let fixedCount = 0;
      const failedTools: { id: string; slug: string; url: string }[] = [];

      for (const [index, batch] of batches.entries()) {
        const results = await step.run(`check-batch-${index}`, async () => {
          const stepStartTime = performance.now();
          inngestLogger.stepStarted(`check-batch-${index}`, FUNCTION_ID);

          try {
            const checks = await Promise.all(
              batch.map(async (tool) => {
                const result = await validateLink(tool.websiteUrl);
                return {
                  id: tool.id,
                  slug: tool.slug,
                  url: tool.websiteUrl,
                  wasBroken: tool.isBroken,
                  isNowBroken: !result.isValid,
                };
              })
            );

            const duration = performance.now() - stepStartTime;
            inngestLogger.batchProcessed(
              index,
              batch.length,
              (index + 1) * batch.length,
              FUNCTION_ID
            );
            inngestLogger.stepCompleted(
              `check-batch-${index}`,
              FUNCTION_ID,
              undefined,
              duration
            );
            return checks;
          } catch (error) {
            inngestLogger.stepError(
              `check-batch-${index}`,
              FUNCTION_ID,
              undefined,
              error
            );
            throw error;
          }
        });

        await step.run(`update-batch-${index}`, async () => {
          const stepStartTime = performance.now();
          inngestLogger.stepStarted(`update-batch-${index}`, FUNCTION_ID);

          try {
            const updates = results.map((result) => {
              if (result.wasBroken && !result.isNowBroken) {
                fixedCount++;
              } else if (!result.wasBroken && result.isNowBroken) {
                brokenCount++;
                failedTools.push({
                  id: result.id,
                  slug: result.slug,
                  url: result.url,
                });
              } else if (result.isNowBroken) {
                failedTools.push({
                  id: result.id,
                  slug: result.slug,
                  url: result.url,
                });
              }

              return prisma.tool.update({
                where: { id: result.id },
                data: {
                  isBroken: result.isNowBroken,
                  lastCheckedAt: new Date(),
                },
              });
            });

            const result = await Promise.all(updates);
            const duration = performance.now() - stepStartTime;
            inngestLogger.stepCompleted(
              `update-batch-${index}`,
              FUNCTION_ID,
              undefined,
              duration
            );
            return result;
          } catch (error) {
            inngestLogger.stepError(
              `update-batch-${index}`,
              FUNCTION_ID,
              undefined,
              error
            );
            throw error;
          }
        });
      }

      await step.run("disconnect-from-db", async () => {
        const stepStartTime = performance.now();
        inngestLogger.stepStarted("disconnect-from-db", FUNCTION_ID);

        try {
          const result = await prisma.$disconnect();
          const duration = performance.now() - stepStartTime;
          inngestLogger.stepCompleted(
            "disconnect-from-db",
            FUNCTION_ID,
            undefined,
            duration
          );
          return result;
        } catch (error) {
          inngestLogger.stepError(
            "disconnect-from-db",
            FUNCTION_ID,
            undefined,
            error
          );
          throw error;
        }
      });

      const summary = {
        totalChecked: tools.length,
        newlyBroken: brokenCount,
        fixed: fixedCount,
        failedTools,
      };

      if (failedTools.length) {
        inngestLogger.warn("Link checker found broken links", {
          functionId: FUNCTION_ID,
          failedTools,
        });
      }

      inngestLogger.info("Link checker completed", {
        functionId: FUNCTION_ID,
        ...summary,
      });

      const duration = performance.now() - functionStartTime;
      inngestLogger.functionCompleted(
        FUNCTION_ID,
        "cron.link-checker",
        {},
        duration
      );

      return summary;
    } catch (error) {
      const duration = performance.now() - functionStartTime;
      inngestLogger.functionError(
        FUNCTION_ID,
        "cron.link-checker",
        {},
        error,
        duration
      );
      throw error;
    }
  }
);
