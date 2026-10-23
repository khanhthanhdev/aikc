import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/admin/ui/card";
import { formatPercent } from "../_lib/format";

type Slice = { key: string; label: string; value: number };

type DonutChartProps = {
  title: string;
  slices: Slice[];
};

const COLORS = ["#1a73e8", "#12b5cb", "#e8710a", "#9334e6", "#7cb342"];

const RADIUS = 15.9155; // circumference of 100, so dash lengths are percents

/** GA4's device-category donut: share of users per slice. */
export const DonutChart = ({ title, slices }: DonutChartProps) => {
  const total = slices.reduce((sum, { value }) => sum + value, 0);
  let offset = 0;

  return (
    <Card>
      <CardHeader className="pb-3 md:pb-3">
        <CardTitle size="h5">{title}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col items-center gap-4">
        {total ? (
          <>
            <svg
              aria-label={title}
              className="size-36 -rotate-90"
              role="img"
              viewBox="0 0 42 42"
            >
              <circle
                className="stroke-muted"
                cx="21"
                cy="21"
                fill="none"
                r={RADIUS}
                strokeWidth="6"
              />
              {slices.map(({ key, value }, index) => {
                const length = (value / total) * 100;
                const circle = (
                  <circle
                    cx="21"
                    cy="21"
                    fill="none"
                    key={key}
                    r={RADIUS}
                    stroke={COLORS[index % COLORS.length]}
                    strokeDasharray={`${length} ${100 - length}`}
                    strokeDashoffset={-offset}
                    strokeWidth="6"
                  />
                );
                offset += length;
                return circle;
              })}
            </svg>

            <ul className="flex w-full flex-col gap-1.5 text-sm">
              {slices.map(({ key, label, value }, index) => (
                <li className="flex items-center gap-2" key={key}>
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: COLORS[index % COLORS.length] }}
                  />
                  <span className="flex-1">{label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatPercent(value / total)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="py-6 text-center text-muted-foreground text-sm">
            No data for this period.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
