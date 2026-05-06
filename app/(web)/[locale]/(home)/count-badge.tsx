import { formatNumber } from "@curiousleaf/utils";
import { subDays } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import plur from "plur";
import { Badge } from "~/components/web/ui/badge";
import { Ping } from "~/components/web/ui/ping";
import { Link } from "~/i18n/navigation";
import { countTools } from "~/server/tools/queries";

export const CountBadge = async () => {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "Home" });
  const [toolsCount, newToolsCount] = await Promise.all([
    countTools({ where: { publishedAt: { lte: new Date() } } }),
    countTools({
      where: { publishedAt: { lte: new Date(), gte: subDays(new Date(), 7) } },
    }),
  ]);

  return (
    <Badge asChild className="order-first" prefix={<Ping />} size="lg">
      <Link href="/?sort=publishedAt.desc">
        {newToolsCount
          ? t("countNewToolsAdded", {
              count: formatNumber(newToolsCount),
              unit: plur("tool", newToolsCount),
            })
          : t("countToolsCollected", { count: formatNumber(toolsCount) })}
      </Link>
    </Badge>
  );
};
