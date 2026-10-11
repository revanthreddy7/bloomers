import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  logging: {
    incomingRequests: { ignore: [/\/auth\/confirm/, /\/auth\/callback/] },
  },
};
export default nextConfig;
