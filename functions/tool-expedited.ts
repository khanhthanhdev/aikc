import { inngestLogger } from "~/lib/logger";
import { inngest } from "~/services/inngest";
import { prisma } from "~/services/prisma";

const FUNCTION_ID = "tool.expedited";

export const toolExpedited = inngest.createFunction(
  { id: FUNCTION_ID },
  { event: "tool.expedited" },
  async ({ event, step }) => {
    const functionStartTime = performance.now();
    const toolSlug = event.data.slug;

    try {
      inngestLogger.functionStarted(FUNCTION_ID, "tool.expedited", event.data);

      const _tool = await step.run("fetch-tool", async () => {
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

      // Send submission email to user and admin
      // DISABLED: Email sending temporarily disabled
      // await step.run("send-expedited-emails", async () => {
      //   const stepStartTime = performance.now();
      //   inngestLogger.stepStarted(
      //     "send-expedited-emails",
      //     FUNCTION_ID,
      //     toolSlug
      //   );

      //   try {
      //     const adminTo = config.site.email;
      //     const adminSubject = "New Expedited Listing Request";

      //     const emails: EmailParams[] = [
      //       {
      //         to: adminTo,
      //         subject: adminSubject,
      //         react: EmailAdminNewSubmission({
      //           tool,
      //           to: adminTo,
      //           subject: adminSubject,
      //         }),
      //       },
      //     ];

      //     if (tool.submitterEmail) {
      //       const to = tool.submitterEmail;
      //       const subject = `🙌 Thanks for submitting ${tool.name}!`;

      //       emails.push({
      //         to,
      //         subject,
      //         react: EmailSubmissionExpedited({ tool, to, subject }),
      //       });
      //     }

      //     const result = await sendEmails(emails);
      //     const duration = performance.now() - stepStartTime;
      //     inngestLogger.stepCompleted(
      //       "send-expedited-emails",
      //       FUNCTION_ID,
      //       toolSlug,
      //       duration
      //     );
      //     return result;
      //   } catch (error) {
      //     inngestLogger.stepError(
      //       "send-expedited-emails",
      //       FUNCTION_ID,
      //       toolSlug,
      //       error
      //     );
      //     throw error;
      //   }
      // });

      const duration = performance.now() - functionStartTime;
      inngestLogger.functionCompleted(
        FUNCTION_ID,
        "tool.expedited",
        event.data,
        duration
      );
    } catch (error) {
      const duration = performance.now() - functionStartTime;
      inngestLogger.functionError(
        FUNCTION_ID,
        "tool.expedited",
        event.data,
        error,
        duration
      );
      throw error;
    }
  }
);
