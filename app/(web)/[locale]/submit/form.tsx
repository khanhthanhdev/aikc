"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { type HTMLAttributes, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { useServerAction } from "zsa-react";
import { checkSubmitUrl, submitTool } from "~/actions/submit";
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
import {
  SUBMIT_LIMITS,
  submitToolFormSchema,
  submitWebsiteUrlSchema,
} from "~/server/schemas";
import { cx } from "~/utils/cva";

export const SubmitForm = ({
  className,
  ...props
}: HTMLAttributes<HTMLFormElement>) => {
  const t = useTranslations("SubmitForm");
  const router = useRouter();

  const form = useForm<
    z.input<typeof submitToolFormSchema>,
    unknown,
    z.output<typeof submitToolFormSchema>
  >({
    resolver: zodResolver(submitToolFormSchema),
    defaultValues: {
      name: "",
      websiteUrl: "",
      submitterName: "",
      submitterEmail: "",
      hp: "",
    },
  });

  // The last link checked and why it failed, so a blur does not refetch it
  const [urlCheck, setUrlCheck] = useState<{ url: string; error?: string }>();
  const { execute: executeUrlCheck, isPending: isCheckingUrl } =
    useServerAction(checkSubmitUrl);
  const websiteUrl = form.watch("websiteUrl").trim();
  const isUrlReachable = urlCheck?.url === websiteUrl && !urlCheck.error;

  /** Check that the website is up; submit waits on this. */
  const verifyUrl = async (url: string) => {
    let check = urlCheck?.url === url ? urlCheck : undefined;

    if (!check) {
      const [, err] = await executeUrlCheck({ websiteUrl: url });
      const error = err ? err.message || t("submitFailed") : undefined;
      check = { url, error };
      setUrlCheck(check);
    }

    if (check.error) {
      form.setError("websiteUrl", { type: "server", message: check.error });
    }

    return !check.error;
  };

  const { execute, isPending } = useServerAction(submitTool, {
    onSuccess: ({ data }) => {
      form.reset();

      if (!data.slug) {
        return;
      }

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
      const isKnownField = (
        value: string
      ): value is (typeof knownFields)[number] =>
        knownFields.some((knownField) => knownField === value);

      if (field && isKnownField(field)) {
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
        onSubmit={form.handleSubmit(
          async (data) => {
            if (!(data.hp || (await verifyUrl(data.websiteUrl)))) {
              return;
            }
            execute(data);
          },
          // Validation clears a dead link's error; show it with the others
          () => {
            if (urlCheck?.url === websiteUrl && urlCheck.error) {
              form.setError("websiteUrl", {
                type: "server",
                message: urlCheck.error,
              });
            }
          }
        )}
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
                  onBlur={() => {
                    field.onBlur();
                    // Only a well-formed URL is worth a request
                    const url = submitWebsiteUrlSchema.safeParse({
                      websiteUrl: field.value,
                    });
                    if (url.success) {
                      verifyUrl(url.data.websiteUrl);
                    }
                  }}
                />
              </FormControl>
              {isCheckingUrl && (
                <FormDescription>{t("checkingUrl")}</FormDescription>
              )}
              {!isCheckingUrl && isUrlReachable && (
                <FormDescription className="text-green-600 dark:text-green-500">
                  {t("urlReachable")}
                </FormDescription>
              )}
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
            disabled={isPending || isCheckingUrl}
            isPending={isPending || isCheckingUrl}
            variant="primary"
          >
            {t("submit")}
          </Button>
        </div>
      </form>
    </Form>
  );
};
