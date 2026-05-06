const defaultSiteUrl = "http://localhost:5175";
const defaultSiteEmail = "hello@example.com";

export const siteConfig = {
  // Read public env directly so build-time metadata does not pull in the
  // full server env schema.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl,
  email: process.env.NEXT_PUBLIC_SITE_EMAIL ?? defaultSiteEmail,
  name: "AI Knowledge Cloud",
  tagline: "Find the Perfect Work & Study Tools for You",
  description:
    "Discover the best tools for VinUniversity library and knowledge cloud. The best tool for your study & work to help you build faster and more efficiently.",
  keywords: [
    "knowledge cloud",
    "VinUniversity",
    "library",
    "best tool for students",
    "high quality tools",
    "AI tools",
  ],
};
