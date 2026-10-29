import type { NextConfig } from "next";

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

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: apiHost === "localhost" ? [] : [apiHost],
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

export default nextConfig;
