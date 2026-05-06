import { Box } from "~/components/common/box";
import { ToolSkeleton } from "~/components/web/cards/tool-skeleton";
import { Grid } from "~/components/web/ui/grid";

export const ToolListSkeleton = () => {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <Box className="w-full rounded-lg px-4 py-2.5 text-sm/normal">
        <span>&nbsp;</span>
      </Box>

      <Grid>
        {[...new Array(6)].map((_, index) => (
          <ToolSkeleton key={index} />
        ))}
      </Grid>
    </div>
  );
};
