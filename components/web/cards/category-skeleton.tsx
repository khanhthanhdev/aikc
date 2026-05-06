import { ArrowRightIcon } from "lucide-react";
import { H5 } from "~/components/common/heading";
import { Skeleton } from "~/components/common/skeleton";
import { Card, CardDescription } from "~/components/web/ui/card";

export const CategorySkeleton = () => {
  return (
    <Card className="items-stretch" hover={false}>
      <div className="flex w-full items-start justify-between gap-3">
        <div className="flex w-full min-w-0 flex-col gap-1">
          <H5 className="!leading-snug flex-1 truncate">
            <Skeleton>&nbsp;</Skeleton>
          </H5>

          <span className="text-foreground/50 text-xs">
            <Skeleton className="w-4/5">&nbsp;</Skeleton>
          </span>
        </div>

        <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-foreground/10">
          <ArrowRightIcon />
        </span>
      </div>

      <CardDescription>
        <Skeleton className="h-5 w-4/5">&nbsp;</Skeleton>
      </CardDescription>
    </Card>
  );
};
