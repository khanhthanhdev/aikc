"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { formatDate } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";
import type React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { createAd, updateAd } from "~/app/admin/ads/_lib/actions";
import type { getAdById } from "~/app/admin/ads/_lib/queries";
import { type AdSchema, adSchema } from "~/app/admin/ads/_lib/validations";
import { Button } from "~/components/admin/ui/button";
import { Input } from "~/components/admin/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/admin/ui/select";
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
import { ImageUpload } from "./image-upload";

type AdFormProps = React.HTMLAttributes<HTMLFormElement> & {
  ad?: Awaited<ReturnType<typeof getAdById>>;
};

const adTypes = [
  { value: "Banner", label: "Banner" },
  { value: "Similars", label: "Similar Tools" },
  { value: "Tools", label: "Tools List" },
  { value: "ToolPage", label: "Tool Page" },
  { value: "BlogPost", label: "Blog Post" },
  { value: "All", label: "All Placements" },
] as const;

export function AdForm({ children, className, ad, ...props }: AdFormProps) {
  const form = useForm<AdSchema>({
    resolver: zodResolver(adSchema),
    defaultValues: {
      ...nullsToUndefined(ad),
      startsAt: ad?.startsAt ?? new Date(),
      endsAt: ad?.endsAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  });

  const { execute: createAdAction, isPending: isCreatingAd } = useServerAction(
    createAd,
    {
      onSuccess: ({ data }) => {
        toast.success("Ad successfully created");
        redirect(`/admin/ads/${data.id}`);
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    }
  );

  const { execute: updateAdAction, isPending: isUpdatingAd } = useServerAction(
    updateAd,
    {
      onSuccess: () => {
        toast.success("Ad successfully updated");
        redirect("/admin/ads");
      },

      onError: ({ err }) => {
        toast.error(err.message);
      },
    }
  );

  const onSubmit = form.handleSubmit((data) => {
    ad ? updateAdAction({ id: ad.id, ...data }) : createAdAction(data);
  });

  const isPending = isCreatingAd || isUpdatingAd;

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
                <Input placeholder="Acme Pro Tools" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  placeholder="advertiser@example.com"
                  type="email"
                  {...field}
                />
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
                <Input placeholder="https://acmetools.com" {...field} />
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
              <FormLabel>Favicon / Image</FormLabel>
              <FormControl>
                <ImageUpload
                  disabled={isPending}
                  onChange={field.onChange}
                  value={field.value}
                />
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
                <Textarea
                  placeholder="The best tool for developers to build amazing products."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="buttonLabel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Button Label (optional)</FormLabel>
              <FormControl>
                <Input placeholder="Visit Now" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Placement Type</FormLabel>
              <Select defaultValue={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ad placement" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {adTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="stepOrder"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Step Order (Priority)</FormLabel>
              <FormControl>
                <Input placeholder="0" type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="listInjectionIndex"
          render={({ field }) => (
            <FormItem>
              <FormLabel>List Position (Index)</FormLabel>
              <FormControl>
                <Input placeholder="2" type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="startsAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Date</FormLabel>
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
          name="endsAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>End Date</FormLabel>
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

        <div className="col-span-full flex justify-between gap-4">
          <Button asChild variant="outline">
            <Link href="/admin/ads">Cancel</Link>
          </Button>

          <Button disabled={isPending} isPending={isPending}>
            {ad ? "Update ad" : "Create ad"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
