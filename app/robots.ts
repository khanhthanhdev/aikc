import type { MetadataRoute } from "next";
import { config } from "~/config";

export default function Robots(): MetadataRoute.Robots {
  const { url } = config.site;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/en/login", "/vi/dang-nhap"],
    },
    sitemap: `${url}/sitemap.xml`,
  };
}
