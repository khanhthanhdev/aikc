import { config } from "~/config";
import type { OrganizationSchema } from "../types";

export function buildOrganizationSchema(): OrganizationSchema {
  const { site, links } = config;

  const schema: OrganizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    alternateName: "AI Knowledge Cloud",
    url: site.url,
    description: site.description,
    logo: `${site.url}/icon-512.png`,
    sameAs: [links.github, links.author].filter((link) => link !== "#"),
  };

  if (site.email && site.email !== "hello@example.com") {
    (schema as any).email = site.email;
  }

  return schema;
}
