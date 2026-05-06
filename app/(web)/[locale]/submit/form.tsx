"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { HTMLAttributes } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { useServerAction } from "zsa-react";
import { submitTool } from "~/actions/submit";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/common/form";
import { Button } from "~/components/web/ui/button";
import { Input } from "~/components/web/ui/input";
import { useRouter } from "~/i18n/navigation";
import { submitToolSchema } from "~/server/schemas";
import { cx } from "~/utils/cva";

export const SubmitForm = ({
  className,
  ...props
}: HTMLAttributes<HTMLFormElement>) => {
  const t = useTranslations("SubmitForm");
  const router = useRouter();

  const form = useForm<z.infer<typeof submitToolSchema>>({
    resolver: zodResolver(submitToolSchema),
    defaultValues: {
      name: "",
      websiteUrl: "",
      submitterName: "",
      submitterEmail: "",
    },
  });

  const { execute, isPending } = useServerAction(submitTool, {
    onSuccess: ({ data }) => {
      form.reset();

      if (data.publishedAt && data.publishedAt <= new Date()) {
        toast.info(
          t("alreadyLive", { name: data.name, host: window.location.host })
        );
        router.push(`/tools/${data.slug}`);
      } else {
        toast.success(t("queued", { name: data.name }));
        router.push(`/submit/${data.slug}?success=true`);
      }
    },

    onError: ({ err }) => {
      if (
        err.message.includes("URL") ||
        err.message.includes("link") ||
        err.message.includes("reach")
      ) {
        form.setError("websiteUrl", {
          type: "manual",
          message: err.message,
        });
      } else if (err.message.toLowerCase().includes("email")) {
        form.setError("submitterEmail", {
          type: "manual",
          message: err.message,
        });
      } else if (err.message.toLowerCase().includes("name")) {
        form.setError("name", {
          type: "manual",
          message: err.message,
        });
      } else {
        toast.error(err.message || t("submitFailed"));
      }
    },
  });

  return (
    <Form {...form}>
      <form
        className={cx("grid w-full gap-5 sm:grid-cols-2", className)}
        noValidate
        onSubmit={form.handleSubmit((data) => execute(data))}
        {...props}
      >
        <FormField
          control={form.control}
          name="submitterName"
          render={({ field }) => (
            <FormItem>
              <FormLabel isRequired>{t("yourName")}</FormLabel>
              <FormControl>
                <Input
                  data-1p-ignore
                  placeholder={t("yourNamePlaceholder")}
                  size="lg"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {t("characterCount", {
                  count: form.watch("submitterName")?.length ?? 0,
                  max: 100,
                })}
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
              <FormLabel isRequired>{t("yourEmail")}</FormLabel>
              <FormControl>
                <Input
                  data-1p-ignore
                  placeholder={t("yourEmailPlaceholder")}
                  size="lg"
                  type="email"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {t("characterCount", {
                  count: form.watch("submitterEmail")?.length ?? 0,
                  max: 255,
                })}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel isRequired>{t("toolName")}</FormLabel>
              <FormControl>
                <Input
                  data-1p-ignore
                  placeholder={t("toolNamePlaceholder")}
                  size="lg"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {t("characterCount", {
                  count: form.watch("name")?.length ?? 0,
                  max: 100,
                })}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="websiteUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel isRequired>{t("websiteUrl")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("websiteUrlPlaceholder")}
                  size="lg"
                  type="url"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {t("characterCount", {
                  count: form.watch("websiteUrl")?.length ?? 0,
                  max: 500,
                })}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="col-span-full">
          <Button
            className="flex min-w-32"
            disabled={isPending}
            isPending={isPending}
            variant="primary"
          >
            {t("submit")}
          </Button>
        </div>
      </form>
    </Form>
  );
};
