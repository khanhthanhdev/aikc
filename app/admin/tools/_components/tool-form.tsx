"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, formatDate } from "date-fns";
import { ExternalLinkIcon, PlusIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { useFieldArray, useForm, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { ToolsDeleteDialog } from "~/app/admin/tools/_components/tools-delete-dialog";
import {
  createTool,
  generateToolContentForForm,
  suggestToolRolesForForm,
  updateTool,
} from "~/app/admin/tools/_lib/actions";
import type {
  getCategories,
  getTags,
  getToolBySlug,
} from "~/app/admin/tools/_lib/queries";
import {
  type ToolSchema,
  toolSchema,
} from "~/app/admin/tools/_lib/validations";
import { RelationSelector } from "~/components/admin/relation-selector";
import {
  Button,
  buttonAffixVariants,
  buttonVariants,
} from "~/components/admin/ui/button";
import { Input } from "~/components/admin/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/admin/ui/select";
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
import {
  formatRole,
  isUserRole,
  QUESTIONS_PER_ROLE,
  SUGGESTED_QUESTIONS,
  type UserRole,
  userRoles,
} from "~/config/roles";
import { siteConfig } from "~/config/site";
import { parseRoleQuestions } from "~/lib/role-questions";
import { cx } from "~/utils/cva";
import { nullsToUndefined } from "~/utils/helpers";

type ToolFormProps = React.HTMLAttributes<HTMLFormElement> & {
  tool?: Awaited<ReturnType<typeof getToolBySlug>>;
  categories: Awaited<ReturnType<typeof getCategories>>;
  tags: Awaited<ReturnType<typeof getTags>>;
};

type PublishStatus = "published" | "scheduled" | "draft";

const PUBLISH_STATUSES: { value: PublishStatus; label: string }[] = [
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Draft" },
];

// Status is not stored: it follows publishedAt, as in the tools table
const getPublishStatus = (publishedAt?: Date | null): PublishStatus => {
  if (!publishedAt) return "draft";
  return publishedAt > new Date() ? "scheduled" : "published";
};

/**
 * The publish date a status switch sets: Draft clears it, Published keeps a
 * past date or takes now, Scheduled keeps a future date or takes tomorrow.
 */
const getPublishedAtForStatus = (
  status: PublishStatus,
  current?: Date | null
) => {
  const now = new Date();

  if (status === "draft") return null;
  if (status === "published") return current && current <= now ? current : now;
  return current && current > now ? current : addDays(now, 1);
};

const getDefaultSocials = (socials: unknown): ToolSchema["socials"] => {
  const result = toolSchema.shape.socials.safeParse(socials);
  return result.success ? result.data : undefined;
};

export function ToolForm({
  children,
  className,
  tool,
  categories,
  tags,
  ...props
}: ToolFormProps) {
  const router = useRouter();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const form = useForm<ToolSchema>({
    resolver: zodResolver(toolSchema),
    defaultValues: {
      ...nullsToUndefined(tool),
      categories: tool?.categories?.map(({ id }) => id),
      socials: getDefaultSocials(tool?.socials),
      tags: tool?.tags?.map(({ id }) => id),
      roles: tool?.roles.filter(isUserRole),
      roleQuestions: parseRoleQuestions(tool?.roleQuestions),
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
        notifyFilledRoles(data.filledRoles);
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
        notifyFilledRoles(data.filledRoles);
        // The form stays mounted: show the questions written on save
        if (data.roleQuestions) {
          form.setValue("roleQuestions", data.roleQuestions);
        }
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
          if (process.env.NODE_ENV === "development") {
            console.error("[ToolForm] Translation error:", err);
          }
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
              <div className="flex gap-2">
                <FormControl>
                  <Input placeholder="https://acmeanalytics.com" {...field} />
                </FormControl>
                <OpenUrlButton url={field.value} />
              </div>
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
              <div className="flex gap-2">
                <FormControl>
                  <Input placeholder={siteConfig.url} {...field} />
                </FormControl>
                <OpenUrlButton url={field.value} />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <ContentGenerator tags={tags} toolId={tool?.id} />

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
          render={({ field }) => {
            const status = getPublishStatus(field.value);

            return (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <div className="flex gap-2">
                  <Select
                    onValueChange={(value) =>
                      field.onChange(
                        getPublishedAtForStatus(
                          value as PublishStatus,
                          field.value
                        )
                      )
                    }
                    value={status}
                  >
                    <SelectTrigger className="w-36 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PUBLISH_STATUSES.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {status !== "draft" && (
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
                            : ""
                        }
                      />
                    </FormControl>
                  )}
                </div>
                <FormDescription className="text-muted-foreground text-xs">
                  Draft hides the tool from the site, search and chat.
                </FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
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
              <div className="flex gap-2">
                <FormControl>
                  <Input type="url" {...field} />
                </FormControl>
                <OpenUrlButton url={field.value} />
              </div>
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
              <div className="flex gap-2">
                <FormControl>
                  <Input type="url" {...field} />
                </FormControl>
                <OpenUrlButton url={field.value} />
              </div>
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
                        <FormItem className="flex-grow flex-row">
                          <FormControl>
                            <Input placeholder="URL" {...field} />
                          </FormControl>
                          <OpenUrlButton url={field.value} />
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
          name="roles"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Audience roles</FormLabel>
              <RelationSelector
                onChange={field.onChange}
                relations={userRoles.map((role) => ({
                  id: role,
                  name: formatRole(role),
                }))}
                selectedIds={field.value ?? []}
              />
              <FormDescription className="text-muted-foreground text-xs">
                Who the tool suits, best fit first. Drives the home page picks
                and the role filter.
              </FormDescription>
            </FormItem>
          )}
        />

        <RoleQuestionsFields toolId={tool?.id} />

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

          <div className="flex gap-4">
            {tool && (
              <Button
                disabled={isPending}
                onClick={() => setIsDeleteOpen(true)}
                prefix={<TrashIcon />}
                type="button"
                variant="destructive"
              >
                Delete tool
              </Button>
            )}

            <Button disabled={isPending} isPending={isPending}>
              {tool ? "Update tool" : "Create tool"}
            </Button>
          </div>
        </div>
      </form>

      {tool && (
        <ToolsDeleteDialog
          onOpenChange={setIsDeleteOpen}
          onSuccess={() => {
            setIsDeleteOpen(false);
            router.push("/admin/tools");
          }}
          open={isDeleteOpen}
          showTrigger={false}
          tools={[tool]}
        />
      )}
    </Form>
  );
}

/** Texts the content generator fills, in both languages. */
const GENERATED_FIELDS = [
  "tagline",
  "taglineVi",
  "description",
  "descriptionVi",
  "content",
  "contentVi",
  "pricing",
  "pricingVi",
] as const;

/**
 * Lets AI read the tool's website and fill its texts in both languages, plus
 * the existing tags that fit. The admin reviews the draft and saves the form.
 */
const ContentGenerator = ({
  tags,
  toolId,
}: {
  tags: ToolFormProps["tags"];
  toolId?: string;
}) => {
  const form = useFormContext<ToolSchema>();

  const { execute: generate, isPending } = useServerAction(
    generateToolContentForForm,
    {
      onSuccess: ({ data }) => {
        for (const field of GENERATED_FIELDS) {
          const value = data[field];
          if (value) {
            form.setValue(field, value, { shouldDirty: true });
          }
        }

        // Only tags that already exist: new ones would need creating
        const tagIds = tags
          .filter((tag) => data.tags.includes(tag.slug))
          .map((tag) => tag.id);
        const current = form.getValues("tags") ?? [];
        form.setValue("tags", [...new Set([...current, ...tagIds])], {
          shouldDirty: true,
        });

        toast.success("Content generated. Review, then save.");
      },
      onError: ({ err }) => {
        toast.error(err.message);
      },
    }
  );

  const onGenerate = () => {
    const websiteUrl = form.getValues("websiteUrl");
    if (toolId) {
      generate({ id: toolId, websiteUrl: websiteUrl || undefined });
    }
  };

  return (
    <div className="col-span-full flex items-center justify-between gap-4 rounded-md border p-3">
      <div className="flex flex-col gap-1">
        <p className="font-medium text-sm">Content</p>
        <p className="text-muted-foreground text-xs">
          AI reads the website and writes the tagline, description, content
          and pricing in English and Vietnamese, replacing what is below.
          Nothing is saved until you update the tool.
        </p>
      </div>

      <Button
        className="h-7 shrink-0 text-xs"
        disabled={!toolId || isPending}
        isPending={isPending}
        onClick={onGenerate}
        size="sm"
        type="button"
        variant="outline"
      >
        Generate with AI
      </Button>
    </div>
  );
};

/**
 * Sample chat questions for each selected role, one per line. Visitors with
 * that role see them in the chat on the tool page.
 */
const RoleQuestionsFields = ({ toolId }: { toolId?: string }) => {
  const form = useFormContext<ToolSchema>();
  const roles = form.watch("roles") ?? [];

  const { execute: suggestRoles, isPending } = useServerAction(
    suggestToolRolesForForm,
    {
      onSuccess: ({ data }) => {
        if (!data.roles.length) {
          toast.info("AI found no fitting role for this tool");
          return;
        }

        form.setValue("roles", data.roles, { shouldDirty: true });
        form.setValue("roleQuestions", data.roleQuestions, {
          shouldDirty: true,
        });
        toast.success("Roles and questions generated. Review, then save.");
      },
      onError: ({ err }) => {
        toast.error(err.message);
      },
    }
  );

  return (
    <div className="col-span-full flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-medium text-sm">Sample questions by role</p>
          <p className="text-muted-foreground text-xs">
            One question per line, up to {QUESTIONS_PER_ROLE} per language. The
            chat on the tool page shows {SUGGESTED_QUESTIONS} of them at random
            to visitors with that role. Roles left empty get questions written
            by AI on save.
          </p>
        </div>

        <Button
          className="h-7 shrink-0 text-xs"
          disabled={!toolId || isPending}
          isPending={isPending}
          onClick={() => toolId && suggestRoles({ id: toolId })}
          size="sm"
          type="button"
          variant="outline"
        >
          Generate with AI
        </Button>
      </div>

      {!roles.length && (
        <p className="text-muted-foreground text-xs">
          Pick audience roles first, or let AI suggest them.
        </p>
      )}

      {roles.map((role) => (
        <div
          className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-2"
          key={role}
        >
          <p className="col-span-full font-medium text-sm">
            {formatRole(role)}
          </p>

          {LANGUAGES.map(({ key, label }) => (
            <FormField
              control={form.control}
              key={key}
              name={`roleQuestions.${role}.${key}`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{label}</FormLabel>
                  <FormControl>
                    <Textarea
                      onChange={(e) =>
                        field.onChange(e.target.value.split("\n"))
                      }
                      rows={QUESTIONS_PER_ROLE}
                      value={(field.value ?? []).join("\n")}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/** Opens a URL field's link in a new tab, to check the site from the form. */
const OpenUrlButton = ({ url }: { url?: string | null }) => {
  const href = url?.trim();

  if (!(href && /^https?:\/\//i.test(href))) {
    return (
      <Button
        aria-label="Open link in a new tab"
        disabled
        prefix={<ExternalLinkIcon />}
        size="md"
        type="button"
        variant="outline"
      />
    );
  }

  return (
    <a
      aria-label="Open link in a new tab"
      className={buttonVariants({
        variant: "outline",
        size: "md",
        isAffixOnly: true,
      })}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      title="Open link in a new tab"
    >
      <ExternalLinkIcon className={buttonAffixVariants()} />
    </a>
  );
};

const notifyFilledRoles = (roles?: UserRole[]) => {
  if (roles?.length) {
    toast.info(
      `AI wrote sample questions for: ${roles.map(formatRole).join(", ")}`
    );
  }
};

const LANGUAGES = [
  { key: "en", label: "English" },
  { key: "vi", label: "Vietnamese (Tiếng Việt)" },
] as const;
