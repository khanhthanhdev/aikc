import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";

// React requires eval() in development mode for various debugging features
// (e.g. reconstructing call stacks from a different environment).
// React never uses eval() in production, so we keep the strict CSP there.
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  isDev ? "'unsafe-eval'" : "",
  "https://static.cloudflareinsights.com",
]
  .filter(Boolean)
  .join(" ");

const csp = `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://img.youtube.com https://stukit-bucket.s3.us-east-1.amazonaws.com https://*.amazonaws.com; font-src 'self' data:; connect-src 'self' https://stukit-bucket.s3.us-east-1.amazonaws.com https://*.amazonaws.com https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com; object-src 'none';`;

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  // HSTS — defense in depth alongside Cloudflare's HSTS setting.
  // Only emitted; browsers ignore it on plain HTTP, so safe to always send.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  {
    key: "Content-Security-Policy",
    value: csp,
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  output: "standalone",
  poweredByHeader: false,
  // Emit source maps for production client bundles so the browser DevTools
  // (and Lighthouse) can resolve minified first-party code back to source.
  productionBrowserSourceMaps: true,
  experimental: {
    optimizeCss: true,
  },
  skipTrailingSlashRedirect: true,
  pageExtensions: ["md", "mdx", "ts", "tsx"],

  async redirects() {
    return [
      {
        source: "/tools",
        destination: "/",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31_536_000, // 1 year cache
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        hostname: "stukit-bucket.s3.us-east-1.amazonaws.com",
      },
      { hostname: "**.amazonaws.com" },
    ],
  },

  // Cloudflare Pages compatibility
  serverExternalPackages: [
    "@prisma/client",
    "@aws-sdk/client-s3",
    "@qdrant/js-client-rest",
  ],
};

export default createMDX({})(withNextIntl(nextConfig));
