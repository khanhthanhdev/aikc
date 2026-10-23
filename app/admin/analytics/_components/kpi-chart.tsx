"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useState } from "react";
import { Card } from "~/components/admin/ui/card";
import { cx } from "~/utils/cva";
import {
  formatBucket,
  formatChange,
  formatDecimal,
  formatDuration,
  formatNumber,
  formatPercent,
} from "../_lib/format";
import type { Metrics, TimeseriesPoint } from "../_lib/queries";

type MetricKey = keyof Metrics;

/** The tabs above the chart, in GA4's order. */
const METRICS: {
  key: MetricKey;
  label: string;
  format: (value: number) => string;
  /** True when going down is the good direction. */
  inverse?: boolean;
}[] = [
  { key: "users", label: "Users", format: formatNumber },
  { key: "newUsers", label: "New users", format: formatNumber },
  { key: "sessions", label: "Sessions", format: formatNumber },
  { key: "views", label: "Views", format: formatNumber },
  {
    key: "avgEngagementTime",
    label: "Average engagement time",
    format: formatDuration,
  },
  { key: "viewsPerUser", label: "Views per user", format: formatDecimal },
  { key: "engagementRate", label: "Engagement rate", format: formatPercent },
  {
    key: "bounceRate",
    label: "Bounce rate",
    format: formatPercent,
    inverse: true,
  },
];

type KpiChartProps = {
  current: Metrics;
  previous: Metrics;
  series: TimeseriesPoint[];
  previousSeries: TimeseriesPoint[];
  compare: boolean;
};

const WIDTH = 600;
const HEIGHT = 220;

/** Room for 4 gridlines at round values. */
const niceMax = (value: number) => {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude * 4 >= value) ?? 10;
  return step * magnitude * 4;
};

/** Horizontal position of point `index` out of `count`, in percent. */
const xRatio = (index: number, count: number) =>
  count > 1 ? index / (count - 1) : 0.5;

const linePath = (values: number[], max: number) =>
  values
    .map((value, index) => {
      const x = xRatio(index, values.length) * WIDTH;
      const y = HEIGHT - (value / max) * HEIGHT;
      return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

/**
 * GA4's report-snapshot card: a row of metric tabs with the change against
 * the previous period, and a line chart of the selected metric. The previous
 * period is the dashed line.
 */
export const KpiChart = ({
  current,
  previous,
  series,
  previousSeries,
  compare,
}: KpiChartProps) => {
  const [selected, setSelected] = useState<MetricKey>("users");
  const [hovered, setHovered] = useState<number | null>(null);

  const metric = METRICS.find(({ key }) => key === selected) ?? METRICS[0];
  const values = series.map((point) => point[selected]);
  const previousValues = previousSeries.map((point) => point[selected]);
  const max = niceMax(
    Math.max(...values, ...(compare ? previousValues : []), 0)
  );
  const gridlines = [1, 0.75, 0.5, 0.25, 0];
  const hoveredPoint = hovered === null ? undefined : series[hovered];
  const xPercent = (index: number) => xRatio(index, series.length) * 100;

  const labelIndexes = [
    0,
    Math.floor((series.length - 1) / 2),
    series.length - 1,
  ].filter((index, position, all) => all.indexOf(index) === position);

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 border-b sm:grid-cols-4">
        {METRICS.map(({ key, label, format, inverse }) => {
          const change = compare
            ? formatChange(current[key], previous[key])
            : null;
          const isGood =
            change && change.direction !== "flat"
              ? (change.direction === "up") !== Boolean(inverse)
              : null;

          return (
            <button
              className={cx(
                "flex flex-col gap-1 border-b-2 p-4 text-left transition-colors hover:bg-muted/50",
                key === selected
                  ? "border-blue-600 bg-muted/30"
                  : "border-transparent"
              )}
              key={key}
              onClick={() => setSelected(key)}
              type="button"
            >
              <span className="truncate text-muted-foreground text-xs">
                {label}
              </span>
              <span className="font-medium text-2xl tabular-nums">
                {format(current[key])}
              </span>
              {change && (
                <span
                  className={cx(
                    "flex items-center gap-0.5 text-xs tabular-nums",
                    isGood === true && "text-green-600",
                    isGood === false && "text-red-600",
                    isGood === null && "text-muted-foreground"
                  )}
                >
                  {change.direction === "up" && (
                    <ArrowUpIcon className="size-3" />
                  )}
                  {change.direction === "down" && (
                    <ArrowDownIcon className="size-3" />
                  )}
                  {change.text}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4 pl-12 md:p-6 md:pl-14">
        <div className="relative h-56">
          {gridlines.map((ratio) => (
            <div
              className="absolute inset-x-0 border-t border-dashed"
              key={ratio}
              style={{ top: `${(1 - ratio) * 100}%` }}
            >
              <span className="absolute -top-2 right-full mr-2 text-muted-foreground text-xs tabular-nums">
                {metric.format(max * ratio)}
              </span>
            </div>
          ))}

          <svg
            aria-label={`${metric.label} over time`}
            className="absolute inset-0 size-full overflow-visible"
            preserveAspectRatio="none"
            role="img"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          >
            {compare && (
              <path
                className="text-blue-300"
                d={linePath(previousValues, max)}
                fill="none"
                stroke="currentColor"
                strokeDasharray="4 4"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            )}
            <path
              className="text-blue-600"
              d={linePath(values, max)}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Snaps the crosshair and tooltip to the nearest point */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: mouse-only extra; the tabs above carry every value */}
          {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: same as above */}
          <div
            className="absolute inset-0"
            onMouseLeave={() => setHovered(null)}
            onMouseMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const ratio = (event.clientX - box.left) / box.width;
              setHovered(Math.round(ratio * (series.length - 1)));
            }}
          >
            {hoveredPoint && hovered !== null && (
              <div
                className="pointer-events-none absolute inset-y-0"
                style={{ left: `${xPercent(hovered)}%` }}
              >
                <div className="absolute inset-y-0 border-foreground/30 border-l" />
                <div
                  className={cx(
                    "absolute top-0 z-10 w-max rounded-md border bg-popover px-3 py-2 text-popover-foreground text-xs shadow-md",
                    hovered > series.length / 2 ? "right-0 mr-2" : "left-0 ml-2"
                  )}
                >
                  <div className="mb-1 font-medium">{metric.label}</div>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-blue-600" />
                    {formatBucket(hoveredPoint.bucket)}:{" "}
                    {metric.format(hoveredPoint[selected])}
                  </div>
                  {compare && previousSeries[hovered] && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="size-2 rounded-full bg-blue-300" />
                      {formatBucket(previousSeries[hovered].bucket)}:{" "}
                      {metric.format(previousSeries[hovered][selected])}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="relative mt-2 h-4 text-muted-foreground text-xs">
          {labelIndexes.map((index) => (
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full"
              key={index}
              style={{ left: `${xPercent(index)}%` }}
            >
              {series[index] && formatBucket(series[index].bucket)}
            </span>
          ))}
        </div>

        {compare && (
          <div className="mt-3 flex gap-4 text-muted-foreground text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-blue-600" /> This period
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-blue-300 border-t-2 border-dashed" />{" "}
              Previous period
            </span>
          </div>
        )}
      </div>
    </Card>
  );
};
