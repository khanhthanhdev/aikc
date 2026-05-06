"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { formatDate } from "date-fns";
import { PlusIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { createTool, updateTool } from "~/app/admin/tools/_lib/actions";
import type {
  getCategories,
  getCollections,
  getTags,
  getToolBySlug,
} from "~/app/admin/tools/_lib/queries";
import {
  type ToolSchema,
  toolSchema,
} from "~/app/admin/tools/_lib/validations";
import { RelationSelector } from "~/components/admin/relation-selector";
import { Button } from "~/components/admin/ui/button";
import { Input } from "~/components/admin/ui/input";
import { Switch } from "~/components/admin/ui/switch";
import { Textarea } from "~/components/admin/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/common/form";
import { siteConfig } from "~/config/site";
import { cx } from "~/utils/cva";
import { nullsToUndefined } from "~/utils/helpers";

type ToolFormProps = React.HTMLAttributes<HTMLFormElement> & {
  tool?: Awaited<ReturnType<typeof getToolBySlug>>;
  collections: Awaited<ReturnType<typeof getCollections>>;
  categories: Awaited<ReturnType<typeof getCategories>>;
  tags: Awaited<ReturnType<typeof getTags>>;
};

export function ToolForm({
  children,
  className,
  tool,
  collections,
  categories,
  tags,
  ...props
}: ToolFormProps) {
  const form = useForm<ToolSchema>({
    resolver: zodResolver(toolSchema),
    defaultValues: {
      ...nullsToUndefined(tool),
      categories: tool?.categories?.map(({ id }) => id),
      collections: tool?.collections?.map(({ id }) => id),
      tags: tool?.tags?.map(({ id }) => id),
    },
  });

  const {
    fields: socialFields,
    append: appendSocial,
    remove: removeSocial,
  } = useFieldArray({ control: form.control, name: "socials" });

  // Create tool
  const { execute: createToolAction, isPending: isCreatingTool } =
    useServerAction(createTool, {
      onSuccess: ({ data }) => {
        toast.success("Tool successfully created");
        redirect(`/admin/tools/${data.slug}`);
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    });

  // Update tool
  const { execute: updateToolAction, isPending: isUpdatingTool } =
    useServerAction(updateTool, {
      onSuccess: ({ data }) => {
        toast.success("Tool successfully updated");
        redirect(`/admin/tools/${data.slug}`);
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    });

  // Translate field to Vietnamese
  const { execute: translateFieldAction, isPending: isTranslating } =
    useServerAction(
      async (
        field: "name" | "tagline" | "description" | "content" | "pricing"
      ) => {
        if (!tool?.id) {
          throw new Error("Tool ID is required");
        }

        const { translateToolFieldToVietnamese } = await import(
          "~/app/admin/tools/_lib/actions"
        );
        return translateToolFieldToVietnamese({ id: tool.id, field });
      },
      {
        onSuccess: ({ data }) => {
          if (data) {
            form.setValue(data.field, data.value);
            toast.success("Translated successfully");
          }
        },
        onError: ({ err }) => {
          console.error("[ToolForm] Translation error:", err);
          toast.error(err?.message || "Translation failed");
        },
      }
    );

  const onSubmit = form.handleSubmit((data) => {
    tool ? updateToolAction({ id: tool.id, ...data }) : createToolAction(data);
  });

  const isPending = isCreatingTool || isUpdatingTool;

  return (
    <Form {...form}>
      <form
        className={cx("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}
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
                <Input placeholder="Acme Analytics" {...field} />
              </FormControl>
              <FormDescription className="text-muted-foreground text-xs">
                {form.watch("name")?.length ?? 0}/100 characters
              </FormDescription>
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
                <Input placeholder="acme-analytics" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="websiteUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website URL</FormLabel>
              <FormControl>
                <Input placeholder="https://acmeanalytics.com" {...field} />
              </FormControl>
              <FormDescription className="text-muted-foreground text-xs">
                {form.watch("websiteUrl")?.length ?? 0}/500 characters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="affiliateUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Affiliate URL</FormLabel>
              <FormControl>
                <Input placeholder={siteConfig.url} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tagline"
          render={({ field }) => (
            <FormItem className="col-span-full">
              <FormLabel>Tagline</FormLabel>
              <FormControl>
                <Input
                  placeholder="How Work & Studys build successful products"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-muted-foreground text-xs">
                {form.watch("tagline")?.length ?? 0}/200 characters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="taglineVi"
          render={({ field }) => (
            <FormItem className="col-span-full">
              <div className="flex items-center justify-between">
                <FormLabel>Vietnamese Tagline (Tiếng Việt)</FormLabel>
                <Button
                  className="h-7 text-xs"
                  disabled={isTranslating || !tool?.id}
                  onClick={() => translateFieldAction("tagline")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Auto-translate
                </Button>
              </div>
              <FormControl>
                <Input
                  placeholder="Công cụ giúp đội ngũ phát triển sản phẩm thành công"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-muted-foreground text-xs">
                {form.watch("taglineVi")?.length ?? 0}/200 characters
              </FormDescription>
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
                <Textarea
                  placeholder="Acme Analytics helps teams ship faster with unified analytics, feature flags, and experiments built for Work & Studys."
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-muted-foreground text-xs">
                {form.watch("description")?.length ?? 0}/500 characters
              </FormDescription>
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
                  disabled={isTranslating || !tool?.id}
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
              <FormDescription className="text-muted-foreground text-xs">
                {form.watch("descriptionVi")?.length ?? 0}/500 characters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem className="col-span-full">
              <FormLabel>Content</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormDescription className="text-muted-foreground text-xs">
                {form.watch("content")?.length ?? 0}/50,000 characters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contentVi"
          render={({ field }) => (
            <FormItem className="col-span-full">
              <div className="flex items-center justify-between">
                <FormLabel>Vietnamese Content (Tiếng Việt)</FormLabel>
                <Button
                  className="h-7 text-xs"
                  disabled={isTranslating || !tool?.id}
                  onClick={() => translateFieldAction("content")}
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
              <FormDescription className="text-muted-foreground text-xs">
                {form.watch("contentVi")?.length ?? 0}/50,000 characters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isFeatured"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Featured</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="publishedAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Published At</FormLabel>
              <FormControl>
                <Input
                  type="datetime-local"
                  {...field}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value ? new Date(e.target.value) : null
                    )
                  }
                  value={
                    field.value
                      ? formatDate(field.value, "yyyy-MM-dd HH:mm")
                      : undefined
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="submitterName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Submitter Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription className="text-muted-foreground text-xs">
                {form.watch("submitterName")?.length ?? 0}/100 characters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="submitterEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Submitter Email</FormLabel>
              <FormControl>
                <Input data-1p-ignore type="email" {...field} />
              </FormControl>
              <FormDescription className="text-muted-foreground text-xs">
                {form.watch("submitterEmail")?.length ?? 0}/255 characters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pricing"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pricing</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pricingVi"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Vietnamese Pricing (Tiếng Việt)</FormLabel>
                <Button
                  className="h-7 text-xs"
                  disabled={isTranslating || !tool?.id}
                  onClick={() => translateFieldAction("pricing")}
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
          name="xHandle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Twitter/X Handle</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="faviconUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Favicon URL</FormLabel>
              <FormControl>
                <Input type="url" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="screenshotUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Screenshot URL</FormLabel>
              <FormControl>
                <Input type="url" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="socials"
          render={() => (
            <FormItem className="col-span-full">
              <FormLabel>Socials</FormLabel>
              <div className="space-y-2">
                {socialFields.map((field, index) => (
                  <div
                    className="flex flex-wrap items-stretch gap-2"
                    key={field.id}
                  >
                    <FormField
                      control={form.control}
                      name={`socials.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormControl>
                            <Input placeholder="Name" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`socials.${index}.url`}
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormControl>
                            <Input placeholder="URL" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Button
                      className="text-red-500"
                      onClick={() => removeSocial(index)}
                      prefix={<TrashIcon />}
                      size="md"
                      type="button"
                      variant="outline"
                    />
                  </div>
                ))}

                <Button
                  onClick={() => appendSocial({ name: "", url: "" })}
                  prefix={<PlusIcon />}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Add Social
                </Button>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="categories"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categories</FormLabel>
              <RelationSelector
                onChange={field.onChange}
                relations={categories}
                selectedIds={field.value ?? []}
              />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="collections"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Collections</FormLabel>
              <RelationSelector
                onChange={field.onChange}
                relations={collections}
                selectedIds={field.value ?? []}
              />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem className="col-span-full">
              <FormLabel>Tags</FormLabel>
              <RelationSelector
                onChange={field.onChange}
                relations={tags.map((tag) => ({ id: tag.id, name: tag.slug }))}
                selectedIds={field.value ?? []}
              />
            </FormItem>
          )}
        />

        <div className="col-span-full flex justify-between gap-4">
          <Button asChild variant="outline">
            <Link href="/admin/tools">Cancel</Link>
          </Button>

          <Button disabled={isPending} isPending={isPending}>
            {tool ? "Update tool" : "Create tool"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
