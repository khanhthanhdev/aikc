import { Skeleton } from "~/components/common/skeleton";
import { Intro, IntroDescription, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";

export default function Loading() {
  return (
    <Wrapper>
      <Intro>
        <IntroTitle>
          <Skeleton className="w-56">&nbsp;</Skeleton>
        </IntroTitle>
        <IntroDescription>
          <Skeleton className="w-full">&nbsp;</Skeleton>
        </IntroDescription>
      </Intro>

      <div className="grid gap-4">
        {[...new Array(6)].map((_, index) => (
          <Skeleton className="h-11 w-full" key={`submit-field-${index}`} />
        ))}
      </div>
    </Wrapper>
  );
}
