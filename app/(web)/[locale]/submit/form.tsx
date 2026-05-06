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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/common/form";
import { Button } from "~/components/web/ui/button";
import { Input } from "~/components/web/ui/input";
import { useRouter } from "~/i18n/navigation";
import { SUBMIT_LIMITS, submitToolSchema } from "~/server/schemas";
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
      hp: "",
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
      // Structured errors from SubmitError include a `field` property
      const errWithField = err as unknown as {
        data?: { field?: string };
        field?: string;
      };
      const field = errWithField.data?.field ?? errWithField.field;
      const knownFields = [
        "name",
        "websiteUrl",
        "submitterName",
        "submitterEmail",
      ] as const;

      if (field && knownFields.includes(field)) {
        form.setError(field, { type: "server", message: err.message });
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
                  maxLength={SUBMIT_LIMITS.submitterName}
                  placeholder={t("yourNamePlaceholder")}
                  size="lg"
                  {...field}
                />
              </FormControl>
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
                  maxLength={SUBMIT_LIMITS.submitterEmail}
                  placeholder={t("yourEmailPlaceholder")}
                  size="lg"
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel isRequired>{t("toolName")}</FormLabel>
              <FormControl>
                <Input
                  data-1p-ignore
                  maxLength={SUBMIT_LIMITS.name}
                  placeholder={t("toolNamePlaceholder")}
                  size="lg"
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
              <FormLabel isRequired>{t("websiteUrl")}</FormLabel>
              <FormControl>
                <Input
                  maxLength={SUBMIT_LIMITS.websiteUrl}
                  placeholder={t("websiteUrlPlaceholder")}
                  size="lg"
                  type="url"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Honeypot — hidden from real users, catches bots */}
        <div
          aria-hidden="true"
          className="absolute -left-[9999px]"
          tabIndex={-1}
        >
          <FormField
            control={form.control}
            name="hp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <FormControl>
                  <Input autoComplete="off" tabIndex={-1} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

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
