import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.mango-prod.siammakro.cloud",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
