import type { NextConfig } from "next";

const isStaticExport = process.env.CAP_STATIC === "1";

const nextConfig: NextConfig = {
  // "standalone" powers the dev/preview server; "export" produces the pure
  // static bundle (out/) consumed by Capacitor for the Android APK.
  output: isStaticExport ? "export" : "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
