import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { Card, CardHeader } from "~/components/admin/ui/card";
import { H4 } from "~/components/common/heading";
import { Skeleton } from "~/components/common/skeleton";
import { toAdminDay } from "~/utils/admin-dates";
import { DateControls } from "./_components/date-controls";
import { RealtimeCard } from "./_components/realtime-card";
import {
  DevicesCard,
  DimensionCard,
  KpiSection,
  ToolsCard,
} from "./_components/report-cards";
import { resolveRange } from "./_lib/range";
import { searchParamsSchema } from "./_lib/validations";

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export const metadata: Metadata = {
  title: "Analytics",
};

const CardSkeleton = ({ className }: { className?: string }) => (
  <Card className={className}>
    <CardHeader>
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-40 w-full" />
    </CardHeader>
  </Card>
);

/** Laid out like GA4's "Reports snapshot". */
export default async function AnalyticsPage({ searchParams }: PageProps) {
  const search = searchParamsSchema.parse(await searchParams);
  const range = resolveRange(search);
  const { current } = range;

  // Remount the cards (and show their skeletons) when the dates change
  const rangeKey = `${current.from.toISOString()}-${current.to.toISOString()}-${search.compare}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <H4 as="h1">Reports snapshot</H4>
          <p className="text-muted-foreground text-sm">
            Users are counted per browser, as in Google Analytics without
            sign-in.
          </p>
        </div>
        <DateControls
          firstDay={toAdminDay(current.from)}
          lastDay={toAdminDay(current.to)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense
            fallback={<CardSkeleton className="h-96" />}
            key={`kpi-${rangeKey}`}
          >
            <KpiSection compare={search.compare} range={range} />
          </Suspense>
        </div>

        <Suspense fallback={<CardSkeleton className="h-96" />}>
          <RealtimeCard />
        </Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-2" key={`top-${rangeKey}`}>
        <Suspense fallback={<CardSkeleton />}>
          <ToolsCard period={current} />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <DimensionCard dimension="country" period={current} />
        </Suspense>
      </div>

      <div
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        key={`tech-${rangeKey}`}
      >
        <Suspense fallback={<CardSkeleton />}>
          <DevicesCard period={current} />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <DimensionCard dimension="browser" period={current} />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <DimensionCard dimension="os" period={current} />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <DimensionCard dimension="locale" period={current} />
        </Suspense>
      </div>
    </div>
  );
}
