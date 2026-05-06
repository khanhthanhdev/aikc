"use client";

import { ReportType } from "@prisma/client";
import { FlagIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { reportTool } from "~/actions/report";
import { Button } from "~/components/web/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/web/ui/dialog";
import { Textarea } from "~/components/web/ui/textarea";

interface ReportToolDialogProps {
  toolId: string;
  toolName: string;
}

export const ReportToolDialog = ({
  toolId,
  toolName,
}: ReportToolDialogProps) => {
  const t = useTranslations("Report");
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<ReportType>(ReportType.BROKEN_LINK);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const { execute, isPending } = useServerAction(reportTool, {
    onSuccess: () => {
      toast.success(t("success"));
      setIsOpen(false);
      setType(ReportType.BROKEN_LINK);
      setMessage("");
      setEmail("");
    },
    onError: ({ err }) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error(t("emailRequired"));
      return;
    }
    execute({ toolId, type, message, userEmail: email });
  };
  const reportTypeLabels: Record<ReportType, string> = {
    [ReportType.BROKEN_LINK]: t("types.brokenLink"),
    [ReportType.WRONG_CATEGORY]: t("types.wrongCategory"),
    [ReportType.OUTDATED]: t("types.outdated"),
    [ReportType.OTHER]: t("types.other"),
  };

  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogTrigger asChild>
        <Button
          aria-label={t("button")}
          prefix={<FlagIcon />}
          size="md"
          variant="secondary"
        >
          {t("button")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("title", { name: toolName })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          {/* Report Type Radio Group */}
          <fieldset className="grid gap-2">
            {Object.values(ReportType).map((reportType) => (
              <label
                className="flex cursor-pointer items-center gap-2 text-sm"
                key={reportType}
              >
                <input
                  checked={type === reportType}
                  className="size-4 accent-foreground"
                  name="reportType"
                  onChange={() => setType(reportType)}
                  type="radio"
                  value={reportType}
                />
                <span className="text-foreground">
                  {reportTypeLabels[reportType]}
                </span>
              </label>
            ))}
          </fieldset>

          {/* Email Input */}
          <div className="grid gap-1.5">
            <label
              className="font-medium text-foreground text-sm"
              htmlFor="email"
            >
              {t("yourEmail")}
            </label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              required
              type="email"
              value={email}
            />
          </div>

          {/* Message Textarea */}
          <div className="grid gap-1.5">
            <label
              className="font-medium text-foreground text-sm"
              htmlFor="message"
            >
              {t("messageLabel")}{" "}
              <span className="font-normal text-muted-foreground">
                ({t("optional")})
              </span>
            </label>
            <Textarea
              className="min-h-20 resize-none"
              id="message"
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePlaceholder")}
              value={message}
            />
          </div>

          <DialogFooter>
            <Button
              onClick={() => setIsOpen(false)}
              type="button"
              variant="secondary"
            >
              {t("cancel")}
            </Button>

            <Button className="min-w-24" isPending={isPending} type="submit">
              {t("send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
