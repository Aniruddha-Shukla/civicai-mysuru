import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lint runs as its own CI step (`npm run lint`), so it is not repeated during `next build`.
  eslint: { ignoreDuringBuilds: true },
  webpack(config) {
    // Webpack's persistent-cache "serializing big strings" notices are cache-performance
    // hints, not code warnings; keep build output limited to real problems.
    config.infrastructureLogging = { ...config.infrastructureLogging, level: "error" };
    return config;
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
