import { config } from "~/config";
import type { OrganizationSchema } from "../types";

export function buildOrganizationSchema(): OrganizationSchema {
  const { site, links } = config;

  const schema: OrganizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${site.url}/#organization`,
    name: site.name,
    alternateName: ["AIKC", "AI Knowledge Cloud"],
    url: site.url,
    description: site.description,
    logo: `${site.url}/icon-512.png`,
    sameAs: [links.github, links.author].filter((link) => link !== "#"),
    contactPoint: {
      "@type": "ContactPoint",
      email: site.email,
      telephone: site.contact.telephone,
      contactType: site.contact.contactType,
      availableLanguage: ["en", "vi"],
    },
    address: {
      "@type": "PostalAddress",
      ...site.contact.address,
    },
  };
  return schema;
}
