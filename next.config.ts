import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/developer/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
  logging: {
    incomingRequests: { ignore: [/\/auth\/confirm/, /\/auth\/callback/] },
  },
};
export default nextConfig;
