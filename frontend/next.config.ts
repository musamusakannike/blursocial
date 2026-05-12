import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Allow ngrok and other tunnel domains
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
};

export default nextConfig;
