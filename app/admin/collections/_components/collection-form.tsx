"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { redirect } from "next/navigation";
import type React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import {
  createCollection,
  updateCollection,
} from "~/app/admin/collections/_lib/actions";
import type { getCollectionBySlug } from "~/app/admin/collections/_lib/queries";
import {
  type CollectionSchema,
  collectionSchema,
} from "~/app/admin/collections/_lib/validations";
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

type CollectionFormProps = React.HTMLAttributes<HTMLFormElement> & {
  collection?: Awaited<ReturnType<typeof getCollectionBySlug>>;
};

export function CollectionForm({
  children,
  className,
  collection,
  ...props
}: CollectionFormProps) {
  const form = useForm<CollectionSchema>({
    resolver: zodResolver(collectionSchema),
    defaultValues: nullsToUndefined(collection),
  });

  // Create collection
  const { execute: createCollectionAction, isPending: isCreatingCollection } =
    useServerAction(createCollection, {
      onSuccess: ({ data }) => {
        toast.success("Collection successfully created");
        redirect(`/admin/collections/${data.slug}`);
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    });

  // Update collection
  const { execute: updateCollectionAction, isPending: isUpdatingCollection } =
    useServerAction(updateCollection, {
      onSuccess: ({ data }) => {
        toast.success("Collection successfully updated");
        redirect(`/admin/collections/${data.slug}`);
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    });

  // Translate field to Vietnamese
  const { execute: translateFieldAction, isPending: isTranslating } =
    useServerAction(
      async (field: "name" | "description") => {
        if (!collection?.id) {
          throw new Error("Collection ID is required");
        }

        const { translateCollectionFieldToVietnamese } = await import(
          "~/app/admin/collections/_lib/actions"
        );
        return translateCollectionFieldToVietnamese({
          id: collection.id,
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
          console.error("[CollectionForm] Translation error:", err);
          toast.error(err?.message || "Translation failed");
        },
      }
    );

  const onSubmit = form.handleSubmit((data) => {
    collection
      ? updateCollectionAction({ id: collection.id, ...data })
      : createCollectionAction(data);
  });

  const isPending = isCreatingCollection || isUpdatingCollection;

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
                  disabled={isTranslating || !collection?.id}
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
                  disabled={isTranslating || !collection?.id}
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
            <Link href="/admin/collections">Cancel</Link>
          </Button>

          <Button disabled={isPending} isPending={isPending}>
            {collection ? "Update collection" : "Create collection"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
