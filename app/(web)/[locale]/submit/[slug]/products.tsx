import { getTranslations } from "next-intl/server";
import { H5 } from "~/components/common/heading";
import { Stack } from "~/components/common/stack";
import { Badge } from "~/components/web/ui/badge";
import { Card } from "~/components/web/ui/card";
import { config } from "~/config";
import { getQueueMetrics } from "~/lib/products";
import { isToolPublished } from "~/lib/tools";
import type { ToolOne } from "~/server/tools/payloads";
import { countUpcomingTools } from "~/server/tools/queries";

interface SubmitProductsProps {
  locale: string;
  tool: ToolOne;
}

export const SubmitProducts = async ({ tool, locale }: SubmitProductsProps) => {
  const t = await getTranslations({ locale, namespace: "SubmitStatus" });
  const queueLength = await countUpcomingTools({});
  const metrics = getQueueMetrics(queueLength);
  const isPublished = isToolPublished(tool);

  const isVietnamese = locale === "vi";
  const toolName = isVietnamese ? (tool.nameVi ?? tool.name) : tool.name;

  const intro = isPublished
    ? t("queueIntroLive", { name: toolName, siteName: config.site.name })
    : t("queueIntroPending", { name: toolName });

  return (
    <Card className="max-w-2xl gap-4 text-left" hover={false}>
      <Badge className="w-fit">{t("queueStatus")}</Badge>

      <Stack
        className="text-pretty text-base text-foreground/75"
        direction="column"
        size="sm"
      >
        <H5 as="p" className="font-semibold text-base">
          {t("nextStepsTitle")}
        </H5>
        <p>{intro}</p>
        <p className="text-foreground/60 text-sm">
          {t("manualPublishRate", { rate: metrics.postingRate })}
        </p>
      </Stack>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-foreground/10 bg-foreground/[2.5%] p-4">
          <dt className="text-foreground/50 text-xs uppercase tracking-wider">
            {t("toolsAhead")}
          </dt>
          <dd className="font-semibold text-2xl">
            {metrics.queueLength}
            <span className="ml-1 font-normal text-base text-foreground/50">
              {t("inQueue")}
            </span>
          </dd>
        </div>

        <div className="rounded-lg border border-foreground/10 bg-foreground/[2.5%] p-4">
          <dt className="text-foreground/50 text-xs uppercase tracking-wider">
            {t("publishingRate")}
          </dt>
          <dd className="font-semibold text-2xl">
            {metrics.postingRate}
            <span className="ml-1 font-normal text-base text-foreground/50">
              {t("perWeek")}
            </span>
          </dd>
        </div>

        <div className="rounded-lg border border-foreground/10 bg-foreground/[2.5%] p-4">
          <dt className="text-foreground/50 text-xs uppercase tracking-wider">
            {t("estimatedWait")}
          </dt>
          <dd className="font-semibold text-2xl">
            {metrics.weeks === 0 ? "<1" : `~${metrics.weeks}`}
            <span className="ml-1 font-normal text-base text-foreground/50">
              {t(metrics.weeks === 1 ? "week" : "weeks")}
            </span>
          </dd>
          <p className="mt-1 text-foreground/60 text-xs">
            {t("eta", { eta: metrics.eta })}
          </p>
        </div>
      </dl>

      <p className="text-foreground/60 text-sm">
        {t("footerNote", { name: toolName })}
      </p>
    </Card>
  );
};
