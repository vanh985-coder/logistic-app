import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@logix/shared'],
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {}),
};

export default nextConfig;
