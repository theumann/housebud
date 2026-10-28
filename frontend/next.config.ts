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

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: apiHost === "localhost" ? [] : [apiHost],
  async redirects() {
    if (process.env.NEXT_PUBLIC_FEATURE_MATCHING !== "false") return [];
    return matchingPages.flatMap((page) =>
      [page, `${page}/:path*`].map((source) => ({
        source,
        destination: "/household",
        permanent: false,
      })),
    );
  },
};

export default nextConfig;
