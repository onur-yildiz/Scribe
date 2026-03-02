import type { NextConfig } from "next";

const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === "true";

const nextConfig: NextConfig = {
  ...(isPreview && {
    output: "export",
    basePath: "/Scribe",
    images: { unoptimized: true },
  }),
};

export default nextConfig;
