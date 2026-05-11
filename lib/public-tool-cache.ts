import "server-only";

import { revalidateTag } from "next/cache";

const PUBLIC_TOOL_CACHE_TAGS = [
  "tools",
  "categories",
  "collections",
  "tags",
] as const;

export const revalidatePublicToolCaches = () => {
  for (const tag of PUBLIC_TOOL_CACHE_TAGS) {
    revalidateTag(tag, "max");
  }
};
