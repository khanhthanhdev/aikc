import { Suspense } from "react";
import {
  ScheduledToolsCard,
  ScheduledToolsCardSkeleton,
} from "~/app/admin/_components/scheduled-tools-card";
import { StatsCard } from "~/app/admin/_components/stats-card";
import { Card, CardHeader } from "~/components/admin/ui/card";
import { H4 } from "~/components/common/heading";
import { Skeleton } from "~/components/common/skeleton";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <>
      <H4 as="h1">Dashboard</H4>

      <div className="grid grid-cols-2 gap-4 overflow-clip md:grid-cols-3 lg:grid-cols-4">
        <Suspense
          fallback={Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="w-12 text-3xl">&nbsp;</Skeleton>
              </CardHeader>
            </Card>
          ))}
        >
          <StatsCard />
        </Suspense>

        <Suspense
          fallback={
            <ScheduledToolsCardSkeleton className="col-span-full lg:col-span-2" />
          }
        >
          <ScheduledToolsCard className="col-span-full lg:col-span-2" />
        </Suspense>
      </div>
    </>
  );
}
