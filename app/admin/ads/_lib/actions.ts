"use server";

import "server-only";
import { slugify } from "@curiousleaf/utils";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { adSchema } from "~/app/admin/ads/_lib/validations";
import { uploadToS3Storage } from "~/lib/media";
import { authedProcedure } from "~/lib/safe-actions";
import { prisma } from "~/services/prisma";

/**
 * Regex to extract file extension
 */
const FILE_EXTENSION_REGEX = /\.[^/.]+$/;

export const uploadAdImage = authedProcedure
  .createServerAction()
  .input(z.object({ file: z.instanceof(File) }))
  .handler(async ({ input: { file } }) => {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name.replace(FILE_EXTENSION_REGEX, "");
    const extension = file.name.split(".").pop();
    const key = `ads/${slugify(filename)}-${Date.now()}.${extension}`;

    return await uploadToS3Storage(buffer, key, file.type);
  });

export const createAd = authedProcedure
  .createServerAction()
  .input(adSchema)
  .handler(async ({ input }) => {
    const ad = await prisma.ad.create({
      data: {
        ...input,
        faviconUrl: input.faviconUrl || null,
      },
    });

    revalidatePath("/admin/ads");
    revalidateTag("ads", "max");

    return ad;
  });

export const updateAd = authedProcedure
  .createServerAction()
  .input(adSchema.extend({ id: z.string() }))
  .handler(async ({ input: { id, ...input } }) => {
    const ad = await prisma.ad.update({
      where: { id },
      data: {
        ...input,
        faviconUrl: input.faviconUrl || null,
      },
    });

    revalidatePath("/admin/ads");
    revalidatePath(`/admin/ads/${id}`);
    revalidateTag("ads", "max");

    return ad;
  });

export const deleteAds = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ input: { ids } }) => {
    await prisma.ad.deleteMany({
      where: { id: { in: ids } },
    });

    revalidatePath("/admin/ads");
    revalidateTag("ads", "max");

    return true;
  });
