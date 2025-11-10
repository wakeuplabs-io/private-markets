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
      // Polyfills for Node.js modules not available in browser
      // Required for Aztec v3.0.0 packages
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        'child_process': false,
        // Keep existing resolve aliases
        ...config.resolve.alias,
      };
    }
    return config;
  },
};

export default nextConfig;
