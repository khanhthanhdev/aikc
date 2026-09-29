"use server";

import "server-only";
import { authedProcedure } from "~/lib/safe-actions";
import { prisma } from "~/services/prisma";
import { aiQueryIdSchema } from "./validations";

/** Full answer for the detail dialog; the list query leaves it out. */
export const getAiQueryAnswer = authedProcedure
  .createServerAction()
  .input(aiQueryIdSchema)
  .handler(async ({ input: { id } }) => {
    const query = await prisma.aiQuery.findUnique({
      where: { id },
      select: { answer: true },
    });

    if (!query) {
      throw new Error("This log entry no longer exists");
    }

    return query.answer;
  });
