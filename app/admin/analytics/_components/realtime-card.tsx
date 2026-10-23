import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "~/components/admin/ui/card";
import { formatCountry, formatNumber } from "../_lib/format";
import { getRealtime } from "../_lib/queries";
import { AutoRefresh } from "./auto-refresh";

const REFRESH_SECONDS = 60;

/** GA4's realtime card: who is on the site in the last 30 minutes. */
export const RealtimeCard = async () => {
  const { users, perMinute, pages, countries } = await getRealtime();
  const max = Math.max(1, ...perMinute);

  return (
    <Card className="flex h-full flex-col">
      <AutoRefresh seconds={REFRESH_SECONDS} />

      <CardHeader className="pb-3 md:pb-3">
        <CardDescription className="flex items-center gap-2 uppercase tracking-wide">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-green-500" />
          </span>
          Users in last 30 minutes
        </CardDescription>
        <div className="font-medium text-4xl tabular-nums">
          {formatNumber(users)}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div>
          <div className="mb-1 text-muted-foreground text-xs uppercase tracking-wide">
            Views per minute
          </div>
          <div className="flex h-16 items-end gap-px">
            {perMinute.map((count, index) => (
              <div
                className="flex-1 rounded-t-sm bg-blue-600"
                // biome-ignore lint/suspicious/noArrayIndexKey: one bar per fixed minute slot
                key={index}
                style={{
                  height: `${(count / max) * 100}%`,
                  minHeight: count ? 2 : 0,
                }}
                title={`${perMinute.length - 1 - index} min ago: ${count} views`}
              />
            ))}
          </div>
        </div>

        <RealtimeList
          heading="Page"
          rows={pages.map(({ key, value }) => ({ key, label: key, value }))}
        />
        <RealtimeList
          heading="Country"
          rows={countries.map(({ key, value }) => ({
            key: key || "unknown",
            label: formatCountry(key || null),
            value,
          }))}
        />
      </CardContent>
    </Card>
  );
};

const RealtimeList = ({
  heading,
  rows,
}: {
  heading: string;
  rows: { key: string; label: string; value: number }[];
}) => (
  <div className="text-sm">
    <div className="flex justify-between border-b pb-1 text-muted-foreground text-xs uppercase tracking-wide">
      <span>{heading}</span>
      <span>Views</span>
    </div>
    {rows.length ? (
      rows.map(({ key, label, value }) => (
        <div
          className="flex justify-between gap-2 border-b py-1.5 last:border-0"
          key={key}
        >
          <span className="truncate">{label}</span>
          <span className="tabular-nums">{formatNumber(value)}</span>
        </div>
      ))
    ) : (
      <div className="py-2 text-muted-foreground">No one right now.</div>
    )}
  </div>
);
