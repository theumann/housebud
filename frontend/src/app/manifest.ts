import type { MetadataRoute } from "next";

// Makes the app installable ("Install app" on Android, "Add to Home Screen" on
// iPhone): it opens full-screen from its own icon. The PNGs are drawn from
// icon.svg on a light background; the maskable one has extra padding, since
// Android crops icons into its own shape.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HouseBud",
    short_name: "HouseBud",
    description: "Find roommates, then run the household together",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#eafbf5",
    theme_color: "#cbf2e4",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
