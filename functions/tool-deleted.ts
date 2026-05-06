import { isProd } from "~/env";
import { inngestLogger } from "~/lib/logger";
import { removeS3Directory } from "~/lib/media";
import { deleteAlternativeVector, deleteToolVector } from "~/lib/vector-store";
import { inngest } from "~/services/inngest";

const FUNCTION_ID = "tool.deleted";

export const toolDeleted = inngest.createFunction(
  { id: FUNCTION_ID },
  { event: "tool.deleted" },
  async ({ event, step }) => {
    const functionStartTime = performance.now();
    const toolSlug = event.data.slug;

    try {
      inngestLogger.functionStarted(FUNCTION_ID, "tool.deleted", event.data);

      // Delete from Qdrant vector store
      await step.run("delete-tool-vector", async () => {
        const stepStartTime = performance.now();
        inngestLogger.stepStarted("delete-tool-vector", FUNCTION_ID, toolSlug);

        try {
          await deleteToolVector(event.data.id);
          const duration = performance.now() - stepStartTime;
          inngestLogger.stepCompleted(
            "delete-tool-vector",
            FUNCTION_ID,
            toolSlug,
            duration
          );
        } catch (error) {
          inngestLogger.stepError(
            "delete-tool-vector",
            FUNCTION_ID,
            toolSlug,
            error
          );
          throw error;
        }
      });

      // Delete from alternatives collection
      await step.run("delete-alternative-vector", async () => {
        const stepStartTime = performance.now();
        inngestLogger.stepStarted(
          "delete-alternative-vector",
          FUNCTION_ID,
          toolSlug
        );

        try {
          await deleteAlternativeVector(event.data.id);
          const duration = performance.now() - stepStartTime;
          inngestLogger.stepCompleted(
            "delete-alternative-vector",
            FUNCTION_ID,
            toolSlug,
            duration
          );
        } catch (error) {
          inngestLogger.stepError(
            "delete-alternative-vector",
            FUNCTION_ID,
            toolSlug,
            error
          );
          throw error;
        }
      });

      await step.run("remove-s3-directory", async () => {
        const stepStartTime = performance.now();
        inngestLogger.stepStarted("remove-s3-directory", FUNCTION_ID, toolSlug);

        try {
          const shouldRemove = isProd;
          const result = shouldRemove
            ? await removeS3Directory(`tools/${event.data.slug}`)
            : Promise.resolve();
          const duration = performance.now() - stepStartTime;
          inngestLogger.stepCompleted(
            "remove-s3-directory",
            FUNCTION_ID,
            toolSlug,
            duration
          );
          if (!shouldRemove) {
            inngestLogger.info("S3 cleanup skipped in non-production", {
              functionId: FUNCTION_ID,
              toolSlug,
              isProd,
            });
          }
          return result;
        } catch (error) {
          inngestLogger.stepError(
            "remove-s3-directory",
            FUNCTION_ID,
            toolSlug,
            error
          );
          throw error;
        }
      });

      const duration = performance.now() - functionStartTime;
      inngestLogger.functionCompleted(
        FUNCTION_ID,
        "tool.deleted",
        event.data,
        duration
      );
    } catch (error) {
      const duration = performance.now() - functionStartTime;
      inngestLogger.functionError(
        FUNCTION_ID,
        "tool.deleted",
        event.data,
        error,
        duration
      );
      throw error;
    }
  }
);
