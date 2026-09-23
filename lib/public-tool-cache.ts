import "server-only";

import { revalidateTag } from "next/cache";

const PUBLIC_TOOL_CACHE_TAGS = {
  categories: ["categories", "tools"],
  collections: ["collections", "tools"],
  tags: ["tags", "tools"],
  tools: ["tools"],
} as const;

export type PublicToolCacheScope = keyof typeof PUBLIC_TOOL_CACHE_TAGS;

export const revalidatePublicToolCaches = (scope: PublicToolCacheScope) => {
  for (const tag of PUBLIC_TOOL_CACHE_TAGS[scope]) {
    revalidateTag(tag, "max");
  }
};
