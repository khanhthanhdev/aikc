import { Skeleton } from "~/components/common/skeleton";
import { Intro, IntroDescription, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";

export default function Loading() {
  return (
    <Wrapper>
      <Intro>
        <IntroTitle>
          <Skeleton className="w-72">&nbsp;</Skeleton>
        </IntroTitle>
        <IntroDescription>
          <Skeleton className="w-full">&nbsp;</Skeleton>
        </IntroDescription>
      </Intro>

      <div className="flex justify-center">
        <div className="grid w-full max-w-sm gap-3">
          {[...new Array(3)].map((_, index) => (
            <Skeleton
              className="h-16 w-full rounded-lg"
              key={`product-${index}`}
            />
          ))}
        </div>
      </div>

      <Intro>
        <IntroTitle size="h3">
          <Skeleton className="mx-auto w-48">&nbsp;</Skeleton>
        </IntroTitle>
        <div className="mx-auto max-w-md space-y-2">
          <Skeleton className="h-4 w-full">&nbsp;</Skeleton>
          <Skeleton className="h-4 w-3/4">&nbsp;</Skeleton>
        </div>
      </Intro>
    </Wrapper>
  );
}
