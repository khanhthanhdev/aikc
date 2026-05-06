import { H5 } from "~/components/common/heading";
import { Skeleton } from "~/components/common/skeleton";

export const TagSkeleton = () => {
  return (
    <div className="group flex min-w-0 items-center gap-4">
      <H5 className="!text-base w-1/3">
        <Skeleton>&nbsp;</Skeleton>
      </H5>

      <Skeleton className="h-0.5 flex-1" />

      <span className="w-1/5 shrink-0 text-foreground/50 text-xs">
        <Skeleton>&nbsp;</Skeleton>
      </span>
    </div>
  );
};
