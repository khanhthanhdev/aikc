import Link from "next/link";
import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/admin/ui/card";
import { cx } from "~/utils/cva";

export type ReportRow = {
  key: string;
  label: ReactNode;
  /** Link the label, e.g. to the tool's admin page. */
  href?: string;
  /** One cell per entry in `columns`. */
  values: string[];
  /** 0–1, drawn as a bar behind the row against the first metric. */
  share: number;
};

type ReportTableProps = {
  title: string;
  description?: string;
  /** Header of the label column, e.g. "Country". */
  dimension: string;
  columns: string[];
  rows: ReportRow[];
  className?: string;
  /** E.g. a max height, for reports that list every value. */
  contentClassName?: string;
};

/** A compact GA4-style report card: one dimension, a few metric columns. */
export const ReportTable = ({
  title,
  description,
  dimension,
  columns,
  rows,
  className,
  contentClassName,
}: ReportTableProps) => (
  <Card className={cx("flex flex-col", className)}>
    <CardHeader className="pb-3 md:pb-3">
      <CardTitle size="h5">{title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>

    <CardContent className={cx("flex-1", contentClassName)}>
      {rows.length ? (
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="pb-2 text-left font-medium">{dimension}</th>
              {columns.map((column) => (
                <th className="w-24 pb-2 text-right font-medium" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr className="border-b last:border-0" key={row.key}>
                <td className="relative py-2 pr-2">
                  <span
                    className="absolute inset-y-1 left-0 rounded-sm bg-blue-600/10"
                    style={{ width: `${Math.min(row.share, 1) * 100}%` }}
                  />
                  <span className="relative block truncate">
                    {row.href ? (
                      <Link className="hover:underline" href={row.href}>
                        {row.label}
                      </Link>
                    ) : (
                      row.label
                    )}
                  </span>
                </td>
                {row.values.map((value, index) => (
                  <td
                    className="py-2 text-right tabular-nums"
                    key={columns[index]}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="py-6 text-center text-muted-foreground text-sm">
          No data for this period.
        </p>
      )}
    </CardContent>
  </Card>
);
