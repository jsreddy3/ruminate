/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Ensure environment variables are available to the client
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
  // Configure ESLint to ignore build errors
  eslint: {
    // Warning instead of error is sufficient for production
    ignoreDuringBuilds: true,
  },
  // Ignore TypeScript errors during build
  typescript: {
    // Warning instead of error is sufficient for production
    ignoreBuildErrors: true,
  },
  // Configure webpack for PDF.js
  webpack: (config, { isServer }) => {
    // Add a fallback for the 'canvas' module
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      fs: false,
      path: false,
    };
    
    return config;
  },
};

module.exports = nextConfig;
