import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  allowedDevOrigins: ['192.168.68.109'],
  serverExternalPackages: ['pdfjs-dist', '@napi-rs/canvas', 'xlsx'],
  turbopack: {},
};

export default nextConfig;
