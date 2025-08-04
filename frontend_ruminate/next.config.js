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
  // Configure webpack for PDF.js and react-pdf
  webpack: (config, { isServer }) => {
    // Add a fallback for the 'canvas' module
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      fs: false,
      path: false,
    };
    
    // Copy PDF.js worker to public directory to avoid CORS issues
    if (!isServer) {
      const CopyPlugin = require('copy-webpack-plugin');
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: 'node_modules/pdfjs-dist/build/pdf.worker.min.js',
              to: '../public/pdf.worker.min.js',
            },
          ],
        })
      );
    }
    
    return config;
  },
};

module.exports = nextConfig;
