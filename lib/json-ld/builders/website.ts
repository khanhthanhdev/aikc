import { config } from "~/config";
import type { WebSiteSchema } from "../types";

export function buildWebSiteSchema(): WebSiteSchema {
  const { site } = config;

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.url}/#website`,
    name: site.name,
    alternateName: ["AIKC", "AI Knowledge Cloud"],
    url: site.url,
    description: site.description,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${site.url}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    } as any,
  };
}
