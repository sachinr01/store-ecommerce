import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/store',
  assetPrefix: '/store',
  async rewrites() {
    return [
      {
        source: '/store/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000/store/api'}/:path*`,
        basePath: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'icmedianew.gumlet.io' },
      { protocol: 'https', hostname: 'okcredit-blog-images-prod.storage.googleapis.com' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'www.oceancowboy.com' },
    ],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/store',
        permanent: true,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;

