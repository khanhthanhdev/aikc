"use server";

import { env } from "~/env";
import { authedProcedure } from "~/lib/safe-actions";
import { prisma } from "~/services/prisma";

export const updateFaviconUrls = authedProcedure
  .createServerAction()
  .handler(async () => {
    const tools = await prisma.tool.findMany();

    for (const tool of tools) {
      await prisma.tool.update({
        where: { id: tool.id },
        data: {
          faviconUrl: tool.faviconUrl?.replace(
            `s3.${env.S3_REGION}.amazonaws.com/${env.S3_BUCKET}`,
            `${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`
          ),
        },
      });
    }
  });
