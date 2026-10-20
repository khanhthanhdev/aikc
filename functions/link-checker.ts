import { validateLink } from "~/lib/link-validator";
import { inngestLogger } from "~/lib/logger";
import { revalidatePublicToolCaches } from "~/lib/public-tool-cache";
import { deleteHybridToolVector } from "~/lib/vector-store";
import { inngest } from "~/services/inngest";
import { prisma } from "~/services/prisma";

const BATCH_SIZE = 50;
const FUNCTION_ID = "link.checker";
/** Broken links are checked again after this delay before the tool is hidden. */
const RECHECK_DELAY = "10m";

/**
 * Weekly check of every published tool's website. A link that is broken
 * (see validateLink) on two checks RECHECK_DELAY apart gets its tool
 * unpublished: hidden from the site, kept in the admin as Draft, and removed
 * from Qdrant so chat and search stop suggesting it. Re-publishing it in the
 * admin brings it back.
 */
export const linkChecker = inngest.createFunction(
  { concurrency: { limit: 1 }, id: FUNCTION_ID },
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
            select: { id: true, isBroken: true, slug: true, websiteUrl: true },
            where: { publishedAt: { lte: new Date() } },
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
          batchCount: batches.length,
          batchSize: BATCH_SIZE,
          functionId: FUNCTION_ID,
          totalTools: tools.length,
        }
      );

      let brokenCount = 0;
      let fixedCount = 0;
      const failedTools: { id: string; slug: string; url: string }[] = [];
      // Built outside step.run, which is skipped when Inngest replays.
      const suspects: { id: string; slug: string; url: string }[] = [];

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
                  isNowBroken: !result.isValid,
                  slug: tool.slug,
                  url: tool.websiteUrl,
                  wasBroken: tool.isBroken,
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

        for (const result of results) {
          if (result.isNowBroken) {
            suspects.push({
              id: result.id,
              slug: result.slug,
              url: result.url,
            });
          }
        }

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
                data: {
                  isBroken: result.isNowBroken,
                  lastCheckedAt: new Date(),
                },
                where: { id: result.id },
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

      let unpublished: {
        id: string;
        slug: string;
        url: string;
        reason: string;
      }[] = [];

      if (suspects.length) {
        // A site that is down for a moment should not lose its listing.
        await step.sleep("wait-before-recheck", RECHECK_DELAY);

        const confirmed = await step.run("recheck-broken-links", async () => {
          const checks = await Promise.all(
            suspects.map(async (tool) => {
              const result = await validateLink(tool.url);
              return {
                ...tool,
                isBroken: !result.isValid,
                reason: result.error ?? `HTTP ${result.statusCode}`,
              };
            })
          );
          return checks
            .filter((check) => check.isBroken)
            .map(({ isBroken: _, ...tool }) => tool);
        });

        unpublished = await step.run("unpublish-broken-tools", async () => {
          const stepStartTime = performance.now();
          inngestLogger.stepStarted("unpublish-broken-tools", FUNCTION_ID);

          try {
            const now = new Date();
            const confirmedIds = new Set(confirmed.map((tool) => tool.id));

            // The first failure was a blip: drop the flag set in update-batch.
            await prisma.tool.updateMany({
              data: { isBroken: false, lastCheckedAt: now },
              where: {
                id: {
                  in: suspects
                    .filter((tool) => !confirmedIds.has(tool.id))
                    .map((tool) => tool.id),
                },
              },
            });

            const results = await Promise.all(
              confirmed.map(async (tool) => {
                // Skip tools an admin unpublished meanwhile.
                const { count } = await prisma.tool.updateMany({
                  // The checker skips unpublished tools, so a broken flag
                  // left here would never clear; Draft already marks them.
                  data: {
                    isBroken: false,
                    lastCheckedAt: now,
                    publishedAt: null,
                  },
                  where: { id: tool.id, publishedAt: { not: null } },
                });
                if (!count) {
                  return null;
                }

                try {
                  await deleteHybridToolVector(tool.id);
                } catch (error) {
                  // The tool stays hidden; the vector goes on the next
                  // re-index.
                  inngestLogger.stepError(
                    "unpublish-broken-tools",
                    FUNCTION_ID,
                    tool.slug,
                    error
                  );
                }
                return tool;
              })
            );
            const hidden = results.filter((tool) => tool !== null);

            if (hidden.length) {
              revalidatePublicToolCaches("tools");
            }

            const duration = performance.now() - stepStartTime;
            inngestLogger.stepCompleted(
              "unpublish-broken-tools",
              FUNCTION_ID,
              undefined,
              duration
            );
            return hidden;
          } catch (error) {
            inngestLogger.stepError(
              "unpublish-broken-tools",
              FUNCTION_ID,
              undefined,
              error
            );
            throw error;
          }
        });

        if (unpublished.length) {
          inngestLogger.warn(
            "Link checker unpublished tools with broken links",
            {
              functionId: FUNCTION_ID,
              unpublished,
            }
          );
        }
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
        failedTools,
        fixed: fixedCount,
        newlyBroken: brokenCount,
        totalChecked: tools.length,
        unpublished: unpublished.length,
      };

      if (failedTools.length) {
        inngestLogger.warn("Link checker found broken links", {
          failedTools,
          functionId: FUNCTION_ID,
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
