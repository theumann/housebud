import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Testing from a phone on the LAN: pointing NEXT_PUBLIC_API_BASE_URL (in
// .env.local) at the PC's address also lets that address load dev assets,
// which Next blocks for any origin other than localhost.
const apiHost = process.env.NEXT_PUBLIC_API_BASE_URL
  ? new URL(process.env.NEXT_PUBLIC_API_BASE_URL).hostname
  : "localhost";

// With matching off (src/lib/features.ts), its pages send people to their
// household instead.
const matchingPages = [
  "/matches",
  "/shortlist",
  "/compatibility",
  "/chatrooms",
];

// www.housebud.app goes to housebud.app: the login token is stored per
// address, so serving both would log people out when they switch.
const wwwRedirect = {
  source: "/:path*",
  has: [{ type: "host" as const, value: "www\\.(?<domain>.+)" }],
  destination: "https://:domain/:path*",
  permanent: true,
};

// On every page: browsers use HTTPS only for the next year (every
// housebud.app subdomain included, so all of them must keep HTTPS), no other
// site may show the app in a frame (clickjacking), no guessing content types,
// and no camera, microphone or location. Not a full Content-Security-Policy
// yet: Next's inline scripts would need nonces.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: apiHost === "localhost" ? [] : [apiHost],
  // Tells Sentry events from staging and production apart; Railway sets it.
  env: { SENTRY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT_NAME ?? "" },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    if (process.env.NEXT_PUBLIC_FEATURE_MATCHING !== "false") {
      return [wwwRedirect];
    }
    return [
      wwwRedirect,
      ...matchingPages.flatMap((page) =>
        [page, `${page}/:path*`].map((source) => ({
          source,
          destination: "/household",
          permanent: false,
        })),
      ),
    ];
  },
};

// With SENTRY_AUTH_TOKEN set (Railway builds), the build uploads source maps
// to Sentry so its stack traces show the real code, then deletes them so
// they aren't served. Without it (local, CI) the build is unchanged.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      telemetry: false,
    })
  : nextConfig;
