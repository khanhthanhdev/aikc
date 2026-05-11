import type { Offer } from "schema-dts";
import { config } from "~/config";
import type { ToolOne } from "~/server/tools/payloads";
import type { SoftwareApplicationSchema } from "../types";

function mapPricingToOffer(pricing: string | null, websiteUrl: string): Offer {
  const normalized = pricing?.toLowerCase().trim();

  switch (normalized) {
    case "free":
    case "open source":
      return {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: websiteUrl,
      };

    case "freemium":
      return {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description: "Free with premium features available",
        url: websiteUrl,
      };

    case "trial":
      return {
        "@type": "Offer",
        priceCurrency: "USD",
        availability: "https://schema.org/LimitedAvailability",
        description: "Free trial available",
        url: websiteUrl,
      };

    case "contact":
      return {
        "@type": "Offer",
        priceCurrency: "USD",
        availability: "https://schema.org/PreOrder",
        url: websiteUrl,
      };

    case "paid":
      return {
        "@type": "Offer",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: websiteUrl,
      };

    default:
      return {
        "@type": "Offer",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: websiteUrl,
      };
  }
}

function determineApplicationType(
  tool: ToolOne
): "SoftwareApplication" | "WebApplication" {
  const hasWebCategory = tool.categories.some((cat) =>
    cat.name.toLowerCase().includes("web")
  );
  return hasWebCategory ? "WebApplication" : "SoftwareApplication";
}

function inferOperatingSystem(tool: ToolOne): string[] {
  const categories = tool.categories.map((c) => c.name.toLowerCase());

  // Check for platform-specific indicators
  if (categories.some((c) => c.includes("web") || c.includes("online"))) {
    return ["Web-based"];
  }
  if (
    categories.some(
      (c) => c.includes("mobile") || c.includes("ios") || c.includes("android")
    )
  ) {
    return ["iOS", "Android"];
  }
  if (
    categories.some(
      (c) => c.includes("desktop") || c.includes("windows") || c.includes("mac")
    )
  ) {
    return ["Windows", "macOS", "Linux"];
  }

  // Default: Most AI tools are web-based
  return ["Web-based"];
}

export function buildSoftwareApplicationSchema(
  tool: ToolOne
): SoftwareApplicationSchema {
  const { site } = config;

  const schema: SoftwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": determineApplicationType(tool),
    name: tool.name,
    url: tool.websiteUrl,
    inLanguage: "en-US",
    publisher: {
      "@type": "Organization",
      name: site.name,
      url: site.url,
    },
  };

  // Add optional fields only if they exist
  if (tool.description) {
    schema.description = tool.description;
  }

  if (tool.screenshotUrl) {
    schema.image = tool.screenshotUrl;
  }

  if (tool.categories.length > 0) {
    schema.applicationCategory = tool.categories[0].name;
  } else {
    schema.applicationCategory = "Productivity";
  }

  // Add operating system
  schema.operatingSystem = inferOperatingSystem(tool);

  if (tool.pricing) {
    schema.offers = mapPricingToOffer(tool.pricing, tool.websiteUrl);
  }

  // unstable_cache serializes Date → string, so handle both types
  if (tool.publishedAt) {
    schema.datePublished = new Date(tool.publishedAt).toISOString();
  }

  if (tool.updatedAt) {
    schema.dateModified = new Date(tool.updatedAt).toISOString();
  }

  return schema;
}
