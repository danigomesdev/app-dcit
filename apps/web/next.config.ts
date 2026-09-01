import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next's dev server 403s cross-origin requests to _next/static chunks by
  // default, which silently breaks React hydration (and every onClick) when
  // testing from a LAN IP instead of localhost — this is why client-side
  // interactivity looked broken during live testing on 192.168.1.23.
  allowedDevOrigins: ["192.168.1.23"],
};

export default nextConfig;
