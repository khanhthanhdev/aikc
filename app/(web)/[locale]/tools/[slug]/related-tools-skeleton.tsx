import { ToolSkeleton } from "~/components/web/cards/tool-skeleton";
import { Listing } from "~/components/web/listing";

interface RelatedToolsSkeletonProps {
  title?: string;
}

export const RelatedToolsSkeleton = ({ title }: RelatedToolsSkeletonProps) => {
  return (
    <Listing title={title}>
      {[...new Array(3)].map((_, index) => (
        <ToolSkeleton key={`related-tool-${index}`} />
      ))}
    </Listing>
  );
};
