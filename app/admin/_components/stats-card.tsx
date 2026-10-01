import Link from "next/link";
import { connection } from "next/server";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/admin/ui/card";
import { prisma } from "~/services/prisma";
import { cx } from "~/utils/cva";

export const StatsCard = async () => {
  await connection();

  const [tools, categories, tags, openReports, brokenTools] = await Promise.all(
    [
      prisma.tool.count(),
      prisma.category.count(),
      prisma.tag.count(),
      prisma.report.count({ where: { resolvedAt: null } }),
      prisma.tool.count({ where: { isBroken: true } }),
    ]
  );

  const stats = [
    { label: "Tools", value: tools, href: "/admin/tools" },
    { label: "Categories", value: categories, href: "/admin/categories" },
    { label: "Tags", value: tags, href: "/admin/tags" },
    {
      label: "Open reports",
      value: openReports,
      href: "/admin/reports?status=open",
      alert: openReports > 0,
    },
    {
      label: "Broken links",
      value: brokenTools,
      href: "/admin/tools?isBroken=broken",
      alert: brokenTools > 0,
    },
  ];

  return (
    <>
      {stats.map(({ label, value, href, alert }) => (
        <Link className="group" href={href} key={label}>
          <Card className="h-full transition-colors group-hover:border-foreground/20">
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className={cx("text-3xl", alert && "text-orange-600")}>
                {value.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </>
  );
};
