import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@logix/shared'],
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.API_INTERNAL_URL || 'http://localhost:3001'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
