import { ArrowUpRightIcon, HashIcon } from "lucide-react";
import { RelatedToolsSkeleton } from "~/app/(web)/[locale]/tools/[slug]/related-tools-skeleton";
import { Skeleton } from "~/components/common/skeleton";
import { Stack } from "~/components/common/stack";
import { Button } from "~/components/web/ui/button";
import { Gallery } from "~/components/web/ui/gallery";
import { Tag } from "~/components/web/ui/tag";
import { Wrapper } from "~/components/web/ui/wrapper";

export default function Loading() {
  return (
    <>
      <Wrapper size="sm">
        <div className="flex w-full flex-col items-start gap-y-4">
          <Stack className="relative w-full justify-between" size="lg">
            <Stack size="lg">
              <Skeleton className="size-10 rounded-md" />
              <Skeleton className="h-8 w-48" />
            </Stack>

            <Button
              disabled
              size="md"
              suffix={<ArrowUpRightIcon />}
              variant="primary"
            >
              <Skeleton className="w-20">&nbsp;</Skeleton>
            </Button>
          </Stack>

          <Stack className="w-full" direction="column" size="sm">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-6 w-1/3" />
          </Stack>

          <Stack className="mt-4" size="sm">
            <Skeleton className="ml-1 h-4 w-24" />
            <Skeleton className="ml-1 h-4 w-32" />
          </Stack>
        </div>

        <Gallery images={[""]} />

        <div className="space-y-2">
          {[...new Array(12)].map((_, i) => (
            <Skeleton
              className="h-4"
              key={`line-${i}`}
              style={{ width: `${50 + Math.random() * 50}%` }}
            />
          ))}
        </div>

        <Stack>
          {[...new Array(6)].map((_, i) => (
            <Tag key={`tag-${i}`} prefix={<HashIcon />}>
              <Skeleton className="h-3 w-12" />
            </Tag>
          ))}
        </Stack>
      </Wrapper>

      <RelatedToolsSkeleton />
    </>
  );
}
