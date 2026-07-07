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
  allowedDevOrigins: ['192.168.68.109', '192.168.68.112'],
  serverExternalPackages: ['pdfjs-dist', '@napi-rs/canvas', 'xlsx'],
  // Se till att mail-AI:ns kunskapsmapp bundlas med i serverless-deployen.
  outputFileTracingIncludes: {
    '/api/inmail': ['./src/lib/inmail/knowledge/**/*'],
    '/api/inmail/reply': ['./src/lib/inmail/knowledge/**/*'],
  },
  turbopack: {},
};

export default nextConfig;
