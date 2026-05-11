"use server";

import "server-only";
import { slugify } from "@curiousleaf/utils";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tagSchema } from "~/app/admin/tags/_lib/validations";
import { revalidatePublicToolCaches } from "~/lib/public-tool-cache";
import { authedProcedure } from "~/lib/safe-actions";
import { translateToVietnamese } from "~/lib/translate-content";
import { prisma } from "~/services/prisma";

export const createTag = authedProcedure
  .createServerAction()
  .input(tagSchema)
  .handler(async ({ input: { tools, ...input } }) => {
    const tag = await prisma.tag.create({
      data: {
        ...input,
        slug: input.slug || slugify(input.name),

        // Relations
        tools: { connect: tools?.map((id: string) => ({ id })) },
      },
    });

    revalidatePath("/admin/tags");
    revalidatePublicToolCaches();

    return tag;
  });

export const updateTag = authedProcedure
  .createServerAction()
  .input(tagSchema.extend({ id: z.string() }))
  .handler(async ({ input: { id, tools, ...input } }) => {
    const tag = await prisma.tag.update({
      where: { id },
      data: {
        ...input,

        // Relations
        tools: { set: tools?.map((id: string) => ({ id })) },
      },
    });

    revalidatePath("/admin/tags");
    revalidatePath(`/admin/tags/${tag.slug}`);
    revalidatePublicToolCaches();

    return tag;
  });

export const updateTags = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()), data: tagSchema.partial() }))
  .handler(async ({ input: { ids, data } }) => {
    await prisma.tag.updateMany({
      where: { id: { in: ids } },
      data,
    });

    revalidatePath("/admin/tags");
    revalidatePublicToolCaches();

    return true;
  });

export const deleteTags = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ input: { ids } }) => {
    await prisma.tag.deleteMany({
      where: { id: { in: ids } },
    });

    revalidatePath("/admin/tags");
    revalidatePublicToolCaches();

    return true;
  });

export const translateTagToVietnamese = authedProcedure
  .createServerAction()
  .input(z.object({ id: z.string() }))
  .handler(async ({ input: { id } }) => {
    const tag = await prisma.tag.findUniqueOrThrow({ where: { id } });

    const translation = await translateToVietnamese({
      name: tag.name,
    });

    const updatedTag = await prisma.tag.update({
      where: { id },
      data: {
        nameVi: translation.nameVi,
        translationStatusVi: "MACHINE",
        translationUpdatedAtVi: new Date(),
      },
    });

    revalidatePath("/admin/tags");
    revalidatePublicToolCaches();

    return updatedTag;
  });

export const batchTranslateTagsToVietnamese = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ input: { ids } }) => {
    const tags = await prisma.tag.findMany({
      where: { id: { in: ids } },
    });

    await Promise.all(
      tags.map(async (tag) => {
        const translation = await translateToVietnamese({
          name: tag.name,
        });

        await prisma.tag.update({
          where: { id: tag.id },
          data: {
            nameVi: translation.nameVi,
            translationStatusVi: "MACHINE",
            translationUpdatedAtVi: new Date(),
          },
        });
      })
    );

    revalidatePath("/admin/tags");
    revalidatePublicToolCaches();

    return true;
  });

export const translateTagFieldToVietnamese = authedProcedure
  .createServerAction()
  .input(
    z.object({
      id: z.string(),
      field: z.enum(["name"]),
    })
  )
  .handler(async ({ input: { id, field } }) => {
    const tag = await prisma.tag.findUniqueOrThrow({ where: { id } });

    const fieldValue = tag[field as keyof typeof tag] as string | null;

    if (!fieldValue) {
      throw new Error(`No ${field} to translate`);
    }

    const translation = await translateToVietnamese({
      [field]: fieldValue,
    });

    const viFieldMap: Record<string, keyof typeof translation> = {
      name: "nameVi",
    };

    const viField = viFieldMap[field];
    const viValue = translation[viField];

    if (!viValue) {
      throw new Error("Translation returned empty value");
    }

    await prisma.tag.update({
      where: { id },
      data: {
        [viField]: viValue,
        translationStatusVi: "MACHINE",
        translationUpdatedAtVi: new Date(),
      },
    });

    revalidatePath("/admin/tags");
    revalidatePath(`/admin/tags/${tag.slug}`);
    revalidatePublicToolCaches();

    return { field: viField, value: viValue };
  });
