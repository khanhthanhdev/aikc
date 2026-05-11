// import { config } from "~/config/index.server";
// import EmailToolPublished from "~/emails/tool-published";
// import { sendEmails } from "~/lib/email";
import { inngestLogger } from "~/lib/logger";
import { revalidatePublicToolCaches } from "~/lib/public-tool-cache";
import { inngest } from "~/services/inngest";
import { prisma } from "~/services/prisma";

const FUNCTION_ID = "tool.published";

export const toolPublished = inngest.createFunction(
  { id: FUNCTION_ID },
  { event: "tool.published" },
  async ({ event, step }) => {
    const functionStartTime = performance.now();
    const toolSlug = event.data.slug;

    try {
      inngestLogger.functionStarted(FUNCTION_ID, "tool.published", event.data);

      const tool = await step.run("fetch-tool", async () => {
        const stepStartTime = performance.now();
        inngestLogger.stepStarted("fetch-tool", FUNCTION_ID, toolSlug);

        try {
          const result = await prisma.tool.findUnique({
            where: { id: event.data.id },
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

      await step.run("revalidate-public-tool-caches", () => {
        revalidatePublicToolCaches();
      });

      if (!tool) {
        inngestLogger.info("Skipping publish handling for missing tool", {
          functionId: FUNCTION_ID,
          toolSlug,
          toolId: event.data.id,
        });
      }

      // Email sending temporarily disabled
      // const shouldSendPublishEmail =
      //   config.submissions.sendPublishEmail && !!tool.submitterEmail;

      // if (shouldSendPublishEmail) {
      //   await step.run("send-publish-email", async () => {
      //     const stepStartTime = performance.now();
      //     inngestLogger.stepStarted(
      //       "send-publish-email",
      //       FUNCTION_ID,
      //       toolSlug
      //     );

      //     try {
      //       const to = tool.submitterEmail as string;
      //       const subject = `Your tool ${tool.name} is live on ${config.site.name}`;

      //       const result = await sendEmails({
      //         to,
      //         subject,
      //         react: EmailToolPublished({ tool, to, subject }),
      //       });

      //       const duration = performance.now() - stepStartTime;
      //       inngestLogger.stepCompleted(
      //         "send-publish-email",
      //         FUNCTION_ID,
      //         toolSlug,
      //         duration
      //       );
      //       return result;
      //     } catch (error) {
      //       inngestLogger.stepError(
      //         "send-publish-email",
      //         FUNCTION_ID,
      //         toolSlug,
      //         error
      //       );
      //       throw error;
      //     }
      //   });
      // } else {
      //   inngestLogger.info("Skipping publish email", {
      //     functionId: FUNCTION_ID,
      //     toolSlug,
      //     toolId: tool.id,
      //     hasSubmitterEmail: !!tool.submitterEmail,
      //     sendPublishEmail: config.submissions.sendPublishEmail,
      //   });
      // }

      const duration = performance.now() - functionStartTime;
      inngestLogger.functionCompleted(
        FUNCTION_ID,
        "tool.published",
        event.data,
        duration
      );
    } catch (error) {
      const duration = performance.now() - functionStartTime;
      inngestLogger.functionError(
        FUNCTION_ID,
        "tool.published",
        event.data,
        error,
        duration
      );
      throw error;
    }
  }
);
