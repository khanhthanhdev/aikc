import { inngestLogger } from "~/lib/logger";
import { inngest } from "~/services/inngest";
import { prisma } from "~/services/prisma";

const FUNCTION_ID = "ai-usage.cleanup";

/**
 * How long a logged question is kept. The AiQuery table grows with every
 * request and nothing else prunes it, so without this job it would expand
 * without limit.
 */
const RETENTION_DAYS = 180;

export const aiUsageCleanup = inngest.createFunction(
  { concurrency: { limit: 1 }, id: FUNCTION_ID },
  { cron: "30 3 * * *" }, // Run every day at 3:30 AM
  async ({ step }) => {
    const functionStartTime = performance.now();
    inngestLogger.functionStarted(FUNCTION_ID, "cron.ai-usage-cleanup", {});

    const deleted = await step.run("delete-expired-queries", async () => {
      const cutoff = new Date(
        Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
      );

      const { count } = await prisma.aiQuery.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });

      return count;
    });

    inngestLogger.functionCompleted(
      FUNCTION_ID,
      "cron.ai-usage-cleanup",
      {},
      performance.now() - functionStartTime
    );

    return { deleted, retentionDays: RETENTION_DAYS };
  }
);
