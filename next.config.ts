import path from "node:path";
import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs";
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
  "https://js.sentry-cdn.com",
  "https://browser.sentry-cdn.com",
  "https://static.cloudflareinsights.com",
]
  .filter(Boolean)
  .join(" ");

const csp = `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://img.youtube.com https://stukit-bucket.s3.us-east-1.amazonaws.com https://*.amazonaws.com; font-src 'self' data:; connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io wss://*.sentry.io https://stukit-bucket.s3.us-east-1.amazonaws.com https://*.amazonaws.com https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com; object-src 'none';`;

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

  // Strip Next.js' built-in `polyfill-module` from client bundles.
  // Every polyfill it ships (Array.from, Array.prototype.at/flat/flatMap,
  // Object.fromEntries, Object.hasOwn, String.prototype.trimStart/trimEnd,
  // Symbol.prototype.description, Promise.prototype.finally) is natively
  // supported by all browsers in our `browserslist` (Chrome 105+, Firefox
  // 104+, Safari 15.4+, Edge 105+). Replacing it with an empty module saves
  // ~14 KiB of legacy JS flagged by Lighthouse.
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "next/dist/build/polyfills/polyfill-module": path.resolve(
          __dirname,
          "lib/empty-polyfill-module.js"
        ),
      };
    }
    return config;
  },
};

export default withSentryConfig(createMDX({})(withNextIntl(nextConfig)), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Source map upload auth token
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload wider set of client source files for better stack trace resolution
  widenClientFileUpload: true,

  // Keep source maps in the build output so they're publicly served alongside
  // chunks (Lighthouse / DevTools can resolve minified first-party code).
  sourcemaps: {
    deleteSourcemapsAfterUpload: false,
  },

  // Create a proxy API route to bypass ad-blockers
  tunnelRoute: "/monitoring",

  // Suppress non-CI output
  silent: !process.env.CI,
});
