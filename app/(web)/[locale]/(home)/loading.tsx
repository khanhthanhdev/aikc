import { Skeleton } from "~/components/common/skeleton";
import { ToolListSkeleton } from "~/components/web/tool-list-skeleton";
import { Badge } from "~/components/web/ui/badge";
import { Intro, IntroDescription, IntroTitle } from "~/components/web/ui/intro";
import { Ping } from "~/components/web/ui/ping";

export default function Loading() {
  return (
    <>
      <Intro className="mb-[2.5vh] text-pretty">
        <IntroTitle className="max-w-[47rem]">
          <Skeleton className="w-full">&nbsp;</Skeleton>
        </IntroTitle>
        <IntroDescription>
          <Skeleton className="w-full">&nbsp;</Skeleton>
        </IntroDescription>

        <Badge
          className="pointer-events-none order-first min-w-20 animate-pulse"
          prefix={<Ping />}
          size="lg"
        >
          &nbsp;
        </Badge>
      </Intro>

      <ToolListSkeleton />
    </>
  );
}
