import {
  formatCountry,
  formatDevice,
  formatLocale,
  formatNumber,
  formatPercent,
} from "../_lib/format";
import {
  type Dimension,
  getDimension,
  getKpis,
  getTimeseries,
  getTopTools,
} from "../_lib/queries";
import type { AnalyticsRange, Period } from "../_lib/range";
import { DonutChart } from "./donut-chart";
import { KpiChart } from "./kpi-chart";
import { type ReportRow, ReportTable } from "./report-table";

/** Each row's bar, relative to the biggest row in the card. */
const withShares = <T,>(rows: T[], metric: (row: T) => number) => {
  const max = Math.max(1, ...rows.map(metric));
  return rows.map((row) => ({ row, share: metric(row) / max }));
};

export const KpiSection = async ({
  range,
  compare,
}: {
  range: AnalyticsRange;
  compare: boolean;
}) => {
  const [kpis, series] = await Promise.all([
    getKpis(range.current, range.previous),
    getTimeseries(range.current, range.previous),
  ]);

  return (
    <KpiChart
      compare={compare}
      current={kpis.current}
      previous={kpis.previous}
      previousSeries={series.previous}
      series={series.current}
    />
  );
};

/** More than there are countries, so the country report lists all of them. */
const EVERY_VALUE_LIMIT = 300;

const DIMENSION_CARDS: Record<
  Exclude<Dimension, "device">,
  {
    title: string;
    dimension: string;
    label: (value: string | null) => string;
    description?: string;
    /** List every value with its share of users, instead of the top ten with views. */
    everyValue?: boolean;
  }
> = {
  country: {
    title: "Users by country",
    dimension: "Country",
    label: formatCountry,
    everyValue: true,
  },
  browser: {
    title: "Browsers",
    dimension: "Browser",
    label: (value) => value ?? "(not set)",
  },
  os: {
    title: "Operating systems",
    dimension: "OS",
    label: (value) => value ?? "(not set)",
  },
  locale: { title: "Languages", dimension: "Language", label: formatLocale },
};

export const DimensionCard = async ({
  period,
  dimension,
}: {
  period: Period;
  dimension: Exclude<Dimension, "device">;
}) => {
  const {
    title,
    label,
    description,
    everyValue,
    dimension: header,
  } = DIMENSION_CARDS[dimension];
  const rows = await getDimension(
    period,
    dimension,
    everyValue ? EVERY_VALUE_LIMIT : undefined
  );

  return (
    <ReportTable
      columns={everyValue ? ["Users", "% of users"] : ["Users", "Views"]}
      contentClassName={everyValue ? "max-h-96 overflow-y-auto" : undefined}
      description={description}
      dimension={header}
      rows={withShares(rows, ({ users }) => users).map(
        ({ row, share }): ReportRow => ({
          key: row.key ?? "(not set)",
          label: label(row.key),
          share,
          values: [
            formatNumber(row.users),
            everyValue
              ? formatPercent(row.totalUsers ? row.users / row.totalUsers : 0)
              : formatNumber(row.views),
          ],
        })
      )}
      title={title}
    />
  );
};

export const DevicesCard = async ({ period }: { period: Period }) => {
  const rows = await getDimension(period, "device");

  return (
    <DonutChart
      slices={rows.map((row) => ({
        key: row.key ?? "(not set)",
        label: formatDevice(row.key),
        value: row.users,
      }))}
      title="Users by device category"
    />
  );
};

export const ToolsCard = async ({ period }: { period: Period }) => {
  const rows = await getTopTools(period);

  return (
    <ReportTable
      columns={["Views", "Users"]}
      description="Most viewed tool pages. Click a tool to edit it."
      dimension="Tool"
      rows={withShares(rows, ({ views }) => views).map(
        ({ row, share }): ReportRow => ({
          key: row.slug,
          label: row.name,
          href: `/admin/tools/${row.slug}`,
          share,
          values: [formatNumber(row.views), formatNumber(row.users)],
        })
      )}
      title="Top tools"
    />
  );
};
