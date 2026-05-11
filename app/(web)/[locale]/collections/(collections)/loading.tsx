import { Skeleton } from "~/components/common/skeleton";
import { CategorySkeleton } from "~/components/web/cards/category-skeleton";
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

      <Grid>
        {[...new Array(6)].map((_, index) => (
          <CategorySkeleton key={`collection-skeleton-${index}`} />
        ))}
      </Grid>
    </Wrapper>
  );
}
