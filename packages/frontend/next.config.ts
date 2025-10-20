import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Mock Aztec testing utilities for browser environment
      config.resolve.alias = {
        ...config.resolve.alias,
        '@aztec/foundation/testing': require.resolve('./lib/aztec-test-mock.js'),
      };
    }
    return config;
  },
};

export default nextConfig;
