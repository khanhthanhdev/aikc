import { Skeleton } from "~/components/common/skeleton";
import { Wrapper } from "~/components/web/ui/wrapper";

export default function Loading() {
  return (
    <Wrapper size="sm">
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </Wrapper>
  );
}
