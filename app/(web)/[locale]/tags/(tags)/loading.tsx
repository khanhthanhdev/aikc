import { Skeleton } from "~/components/common/skeleton";
import { TagSkeleton } from "~/components/web/cards/tag-skeleton";
import { Grid } from "~/components/web/ui/grid";
import { Intro, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";

export default function Loading() {
  return (
    <Wrapper>
      <Intro>
        <IntroTitle>
          <Skeleton className="w-48">&nbsp;</Skeleton>
        </IntroTitle>
      </Intro>

      <Grid className="md:gap-8">
        {[...new Array(24)].map((_, index) => (
          <TagSkeleton key={`tag-skeleton-${index}`} />
        ))}
      </Grid>
    </Wrapper>
  );
}
