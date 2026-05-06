"use server";

import "server-only";
import { slugify } from "@curiousleaf/utils";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { categorySchema } from "~/app/admin/categories/_lib/validations";
import { authedProcedure } from "~/lib/safe-actions";
import { translateToVietnamese } from "~/lib/translate-content";
import { deleteCategoryVector, upsertCategoryVector } from "~/lib/vector-store";
import { prisma } from "~/services/prisma";

export const createCategory = authedProcedure
  .createServerAction()
  .input(categorySchema)
  .handler(async ({ input }) => {
    const category = await prisma.category.create({
      data: {
        ...input,
        slug: input.slug || slugify(input.name),
      },
    });

    // Index category in Qdrant for semantic search
    try {
      await upsertCategoryVector(category);
    } catch (error) {
      console.error("Failed to index category vector:", error);
      // Don't fail the operation if vector indexing fails
    }

    revalidatePath("/admin/categories");

    return category;
  });

export const updateCategory = authedProcedure
  .createServerAction()
  .input(categorySchema.extend({ id: z.string() }))
  .handler(async ({ input: { id, ...input } }) => {
    const category = await prisma.category.update({
      where: { id },
      data: input,
    });

    // Update category vector in Qdrant
    try {
      await upsertCategoryVector(category);
    } catch (error) {
      console.error("Failed to update category vector:", error);
      // Don't fail the operation if vector indexing fails
    }

    revalidatePath("/admin/categories");
    revalidatePath(`/admin/categories/${category.slug}`);

    return category;
  });

export const updateCategories = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()), data: categorySchema.partial() }))
  .handler(async ({ input: { ids, data } }) => {
    await prisma.category.updateMany({
      where: { id: { in: ids } },
      data,
    });

    // Update category vectors in Qdrant
    try {
      const updatedCategories = await prisma.category.findMany({
        where: { id: { in: ids } },
      });
      await Promise.all(
        updatedCategories.map((category) => upsertCategoryVector(category))
      );
    } catch (error) {
      console.error("Failed to update category vectors:", error);
      // Don't fail the operation if vector indexing fails
    }

    revalidatePath("/admin/categories");

    return true;
  });

export const deleteCategories = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ input: { ids } }) => {
    await prisma.category.deleteMany({
      where: { id: { in: ids } },
    });

    // Delete category vectors from Qdrant
    try {
      await Promise.all(ids.map((id: string) => deleteCategoryVector(id)));
    } catch (error) {
      console.error("Failed to delete category vectors:", error);
      // Don't fail the operation if vector deletion fails
    }

    revalidatePath("/admin/categories");

    return true;
  });

export const translateCategoryToVietnamese = authedProcedure
  .createServerAction()
  .input(z.object({ id: z.string() }))
  .handler(async ({ input: { id } }) => {
    const category = await prisma.category.findUniqueOrThrow({ where: { id } });

    const translation = await translateToVietnamese({
      name: category.name,
      description: category.description,
    });

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        nameVi: translation.nameVi,
        labelVi: translation.taglineVi,
        descriptionVi: translation.descriptionVi,
        translationStatusVi: "MACHINE",
        translationUpdatedAtVi: new Date(),
      },
    });

    revalidatePath("/admin/categories");

    return updatedCategory;
  });

export const batchTranslateCategoriesToVietnamese = authedProcedure
  .createServerAction()
  .input(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ input: { ids } }) => {
    const categories = await prisma.category.findMany({
      where: { id: { in: ids } },
    });

    await Promise.all(
      categories.map(async (category) => {
        const translation = await translateToVietnamese({
          name: category.name,
          description: category.description,
        });

        await prisma.category.update({
          where: { id: category.id },
          data: {
            nameVi: translation.nameVi,
            labelVi: translation.taglineVi,
            descriptionVi: translation.descriptionVi,
            translationStatusVi: "MACHINE",
            translationUpdatedAtVi: new Date(),
          },
        });
      })
    );

    revalidatePath("/admin/categories");

    return true;
  });

export const translateCategoryFieldToVietnamese = authedProcedure
  .createServerAction()
  .input(
    z.object({
      id: z.string(),
      field: z.enum(["name", "label", "description"]),
    })
  )
  .handler(async ({ input: { id, field } }) => {
    const category = await prisma.category.findUniqueOrThrow({ where: { id } });

    const fieldValue = category[field as keyof typeof category] as
      | string
      | null;

    if (!fieldValue) {
      throw new Error(`No ${field} to translate`);
    }

    // Map label to tagline for translation service
    const translationInput: Record<string, string | null | undefined> = {
      name: field === "name" ? category.name : undefined,
      tagline: field === "label" ? category.label : undefined,
      description: field === "description" ? category.description : undefined,
    };

    const translation = await translateToVietnamese(translationInput);

    // Map translation result to appropriate field
    const viFieldMap: Record<
      string,
      { viField: string; value: string | null | undefined }
    > = {
      name: { viField: "nameVi", value: translation.nameVi },
      label: { viField: "labelVi", value: translation.taglineVi },
      description: {
        viField: "descriptionVi",
        value: translation.descriptionVi,
      },
    };

    const { viField, value } = viFieldMap[field];

    if (!value) {
      throw new Error("Translation returned empty value");
    }

    await prisma.category.update({
      where: { id },
      data: {
        [viField]: value,
        translationStatusVi: "MACHINE",
        translationUpdatedAtVi: new Date(),
      },
    });

    revalidatePath("/admin/categories");
    revalidatePath(`/admin/categories/${category.slug}`);

    return { field: viField, value };
  });
