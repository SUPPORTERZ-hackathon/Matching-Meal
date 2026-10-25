import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGIN ? [process.env.DEV_ALLOWED_ORIGIN] : [],
  webpack(config, { dev }) {
    if (dev) config.watchOptions = { ...config.watchOptions, poll: 1000, aggregateTimeout: 300 };
    return config;
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.BACKEND_URL ?? "http://backend:8080"}/api/:path*` }];
  },
};
export default nextConfig;
