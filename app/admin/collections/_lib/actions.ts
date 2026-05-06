"use server";

import "server-only";
import { slugify } from "@curiousleaf/utils";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { collectionSchema } from "~/app/admin/collections/_lib/validations";
import { authedProcedure } from "~/lib/safe-actions";
import { translateToVietnamese } from "~/lib/translate-content";
import { prisma } from "~/services/prisma";

export const createCollection = authedProcedure
  .createServerAction()
  .input(collectionSchema)
  .handler(async ({ input }) => {
    const collection = await prisma.collection.create({
      data: {
        ...input,
        slug: input.slug || slugify(input.name),
      },
    });

    revalidatePath("/admin/collections");

    return collection;
  });

export const updateCollection = authedProcedure
  .createServerAction()
  .input(collectionSchema.extend({ id: z.string() }))
  .handler(async ({ input: { id, ...input } }) => {
    const collection = await prisma.collection.update({
      where: { id },
      data: input,
    });

    revalidatePath("/admin/collections");
    revalidatePath(`/admin/collections/${collection.slug}`);

    return collection;
  });

export const updateCollections = authedProcedure
  .createServerAction()
  .input(
    z.object({ ids: z.array(z.string()), data: collectionSchema.partial() })
  )
  .handler(async ({ input: { ids, data } }) => {
    await prisma.collection.updateMany({
      where: { id: { in: ids } },
      data,
    });

    revalidatePath("/admin/collections");

    return true;
  });

export const deleteCollections = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ input: { ids } }) => {
    await prisma.collection.deleteMany({
      where: { id: { in: ids } },
    });

    revalidatePath("/admin/collections");

    return true;
  });

export const translateCollectionToVietnamese = authedProcedure
  .createServerAction()
  .input(z.object({ id: z.string() }))
  .handler(async ({ input: { id } }) => {
    const collection = await prisma.collection.findUniqueOrThrow({
      where: { id },
    });

    const translation = await translateToVietnamese({
      name: collection.name,
      description: collection.description,
    });

    const updatedCollection = await prisma.collection.update({
      where: { id },
      data: {
        nameVi: translation.nameVi,
        descriptionVi: translation.descriptionVi,
        translationStatusVi: "MACHINE",
        translationUpdatedAtVi: new Date(),
      },
    });

    revalidatePath("/admin/collections");

    return updatedCollection;
  });

export const batchTranslateCollectionsToVietnamese = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ input: { ids } }) => {
    const collections = await prisma.collection.findMany({
      where: { id: { in: ids } },
    });

    await Promise.all(
      collections.map(async (collection) => {
        const translation = await translateToVietnamese({
          name: collection.name,
          description: collection.description,
        });

        await prisma.collection.update({
          where: { id: collection.id },
          data: {
            nameVi: translation.nameVi,
            descriptionVi: translation.descriptionVi,
            translationStatusVi: "MACHINE",
            translationUpdatedAtVi: new Date(),
          },
        });
      })
    );

    revalidatePath("/admin/collections");

    return true;
  });

export const translateCollectionFieldToVietnamese = authedProcedure
  .createServerAction()
  .input(
    z.object({
      id: z.string(),
      field: z.enum(["name", "description"]),
    })
  )
  .handler(async ({ input: { id, field } }) => {
    const collection = await prisma.collection.findUniqueOrThrow({
      where: { id },
    });

    const fieldValue = collection[field as keyof typeof collection] as
      | string
      | null;

    if (!fieldValue) {
      throw new Error(`No ${field} to translate`);
    }

    const translation = await translateToVietnamese({
      [field]: fieldValue,
    });

    const viFieldMap: Record<string, keyof typeof translation> = {
      name: "nameVi",
      description: "descriptionVi",
    };

    const viField = viFieldMap[field];
    const viValue = translation[viField];

    if (!viValue) {
      throw new Error("Translation returned empty value");
    }

    await prisma.collection.update({
      where: { id },
      data: {
        [viField]: viValue,
        translationStatusVi: "MACHINE",
        translationUpdatedAtVi: new Date(),
      },
    });

    revalidatePath("/admin/collections");
    revalidatePath(`/admin/collections/${collection.slug}`);

    return { field: viField, value: viValue };
  });
