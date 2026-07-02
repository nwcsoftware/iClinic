import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the Expo app (mobile and web preview, served from a different origin)
  // to call the API routes. Browsers enforce CORS; native apps don't.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
