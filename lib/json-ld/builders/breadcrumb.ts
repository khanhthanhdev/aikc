import { config } from "~/config";
import type { BreadcrumbSchema } from "../types";

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumbSchema(
  items: BreadcrumbItem[]
): BreadcrumbSchema {
  const { site } = config;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${site.url}${item.url}`,
    })),
  };
}
