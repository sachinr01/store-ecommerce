import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/store',
  assetPrefix: '/store',
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: '/store/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000/store/api'}/:path*`,
        basePath: false,
      },
      {
        // Proxy product images — browser hits /uploads/... → Express static on port 3000
        source: '/uploads/:path*',
        destination: `${(process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000/store/api').replace('/store/api', '')}/uploads/:path*`,
        basePath: false,
      },
    ];
  },
  images: {
    unoptimized: false,
    remotePatterns: [
      { protocol: 'https', hostname: 'icmedianew.gumlet.io' },
      { protocol: 'https', hostname: 'okcredit-blog-images-prod.storage.googleapis.com' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'www.oceancowboy.com' },
      { protocol: 'https', hostname: 'www.claycraftindia.com' },
      { protocol: 'https', hostname: 'topperskit.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'rukminim1.flixcart.com' },
      { protocol: 'https', hostname: 'rukminim2.flixcart.com' },
    ],
    dangerouslyAllowSVG: false,
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
