"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { redirect } from "next/navigation";
import type React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { createTag, updateTag } from "~/app/admin/tags/_lib/actions";
import type { getTagBySlug, getTools } from "~/app/admin/tags/_lib/queries";
import { type TagSchema, tagSchema } from "~/app/admin/tags/_lib/validations";
import { RelationSelector } from "~/components/admin/relation-selector";
import { Button } from "~/components/admin/ui/button";
import { Input } from "~/components/admin/ui/input";
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

type TagFormProps = React.HTMLAttributes<HTMLFormElement> & {
  tag?: Awaited<ReturnType<typeof getTagBySlug>>;
  tools: Awaited<ReturnType<typeof getTools>>;
};

export function TagForm({
  children,
  className,
  tag,
  tools,
  ...props
}: TagFormProps) {
  const form = useForm<TagSchema>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      ...nullsToUndefined(tag),
      tools: tag?.tools.map(({ id }) => id),
    },
  });

  // Create tag
  const { execute: createTagAction, isPending: isCreatingTag } =
    useServerAction(createTag, {
      onSuccess: ({ data }) => {
        toast.success("Tag successfully created");
        redirect(`/admin/tags/${data.slug}`);
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    });

  // Update tag
  const { execute: updateTagAction, isPending: isUpdatingTag } =
    useServerAction(updateTag, {
      onSuccess: ({ data }) => {
        toast.success("Tag successfully updated");
        redirect(`/admin/tags/${data.slug}`);
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    });

  // Translate field to Vietnamese
  const { execute: translateFieldAction, isPending: isTranslating } =
    useServerAction(
      async (field: "name") => {
        if (!tag?.id) {
          throw new Error("Tag ID is required");
        }

        const { translateTagFieldToVietnamese } = await import(
          "~/app/admin/tags/_lib/actions"
        );
        return translateTagFieldToVietnamese({
          id: tag.id,
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
          console.error("[TagForm] Translation error:", err);
          toast.error(err?.message || "Translation failed");
        },
      }
    );

  const onSubmit = form.handleSubmit((data) => {
    tag ? updateTagAction({ id: tag.id, ...data }) : createTagAction(data);
  });

  const isPending = isCreatingTag || isUpdatingTag;

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
          name="nameVi"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Vietnamese Name (Tiếng Việt)</FormLabel>
                <Button
                  className="h-7 text-xs"
                  disabled={isTranslating || !tag?.id}
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

        <FormField
          control={form.control}
          name="tools"
          render={({ field }) => (
            <FormItem className="col-span-full">
              <FormLabel>Tools</FormLabel>
              <RelationSelector
                onChange={field.onChange}
                relations={tools}
                selectedIds={field.value ?? []}
              />
            </FormItem>
          )}
        />

        <div className="col-span-full flex justify-between gap-4">
          <Button asChild variant="outline">
            <Link href="/admin/tags">Cancel</Link>
          </Button>

          <Button disabled={isPending} isPending={isPending}>
            {tag ? "Update tag" : "Create tag"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
