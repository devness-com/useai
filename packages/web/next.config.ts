import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@useai/ui', '@useai/shared'],
};

export default nextConfig;
