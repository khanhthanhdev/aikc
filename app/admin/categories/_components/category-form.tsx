"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { redirect } from "next/navigation";
import type React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import {
  createCategory,
  updateCategory,
} from "~/app/admin/categories/_lib/actions";
import type { getCategoryBySlug } from "~/app/admin/categories/_lib/queries";
import {
  type CategorySchema,
  categorySchema,
} from "~/app/admin/categories/_lib/validations";
import { Button } from "~/components/admin/ui/button";
import { Input } from "~/components/admin/ui/input";
import { Textarea } from "~/components/admin/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/common/form";
import { cx } from "~/utils/cva";
import { nullsToUndefined } from "~/utils/helpers";

type CategoryFormProps = React.HTMLAttributes<HTMLFormElement> & {
  category?: Awaited<ReturnType<typeof getCategoryBySlug>>;
};

export function CategoryForm({
  children,
  className,
  category,
  ...props
}: CategoryFormProps) {
  const form = useForm<CategorySchema>({
    resolver: zodResolver(categorySchema),
    defaultValues: nullsToUndefined(category),
  });

  // Create category
  const { execute: createCategoryAction, isPending: isCreatingCategory } =
    useServerAction(createCategory, {
      onSuccess: ({ data }) => {
        toast.success("Category successfully created");
        redirect(`/admin/categories/${data.slug}`);
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    });

  // Update category
  const { execute: updateCategoryAction, isPending: isUpdatingCategory } =
    useServerAction(updateCategory, {
      onSuccess: ({ data }) => {
        toast.success("Category successfully updated");
        redirect(`/admin/categories/${data.slug}`);
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    });

  // Translate field to Vietnamese
  const { execute: translateFieldAction, isPending: isTranslating } =
    useServerAction(
      async (field: "name" | "label" | "description") => {
        if (!category?.id) {
          throw new Error("Category ID is required");
        }

        const { translateCategoryFieldToVietnamese } = await import(
          "~/app/admin/categories/_lib/actions"
        );
        return translateCategoryFieldToVietnamese({
          id: category.id,
          field,
        });
      },
      {
        onSuccess: ({ data }) => {
          if (data) {
            form.setValue(data.field, data.value);
            toast.success("Translated successfully");
          }
        },
        onError: ({ err }) => {
          if (process.env.NODE_ENV === "development") {
            console.error("[CategoryForm] Translation error:", err);
          }
          toast.error(err?.message || "Translation failed");
        },
      }
    );

  const onSubmit = form.handleSubmit((data) => {
    category
      ? updateCategoryAction({ id: category.id, ...data })
      : createCategoryAction(data);
  });

  const isPending = isCreatingCategory || isUpdatingCategory;

  return (
    <Form {...form}>
      <form
        className={cx(
          "grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2",
          className
        )}
        noValidate
        onSubmit={onSubmit}
        {...props}
      >
        <div className="flex flex-col gap-4 sm:flex-row">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="nameVi"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Vietnamese Name (Tiếng Việt)</FormLabel>
                <Button
                  className="h-7 text-xs"
                  disabled={isTranslating || !category?.id}
                  onClick={() => translateFieldAction("name")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Auto-translate
                </Button>
              </div>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="labelVi"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Vietnamese Label (Tiếng Việt)</FormLabel>
                <Button
                  className="h-7 text-xs"
                  disabled={isTranslating || !category?.id}
                  onClick={() => translateFieldAction("label")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Auto-translate
                </Button>
              </div>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem className="col-span-full">
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="descriptionVi"
          render={({ field }) => (
            <FormItem className="col-span-full">
              <div className="flex items-center justify-between">
                <FormLabel>Vietnamese Description (Tiếng Việt)</FormLabel>
                <Button
                  className="h-7 text-xs"
                  disabled={isTranslating || !category?.id}
                  onClick={() => translateFieldAction("description")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Auto-translate
                </Button>
              </div>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="col-span-full flex justify-between gap-4">
          <Button asChild variant="outline">
            <Link href="/admin/categories">Cancel</Link>
          </Button>

          <Button disabled={isPending} isPending={isPending}>
            {category ? "Update category" : "Create category"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
