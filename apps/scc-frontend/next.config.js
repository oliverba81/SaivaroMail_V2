/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  },
  // transpilePackages aktiviert, damit Next.js das Package transpiliert
  transpilePackages: ['@saivaro/shared'],
  webpack: (config, { isServer }) => {
    // Stelle sicher, dass das shared Package aus Source geladen wird, nicht aus dist
    const sharedPackagePath = path.resolve(__dirname, '../../packages/shared');
    const sharedSrcPath = path.resolve(sharedPackagePath, 'src');
    
    // Stelle sicher, dass das shared Package korrekt behandelt wird
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        http2: false,
        net: false,
        tls: false,
        crypto: false,
        zlib: false,
        stream: false,
        util: false,
        url: false,
        querystring: false,
        buffer: false,
        process: false,
      };
      
      // Stelle sicher, dass axios die Browser-Version verwendet, nicht die Node.js-Version
      config.resolve.alias = {
        ...config.resolve.alias,
        'axios': path.resolve(__dirname, 'node_modules/axios/dist/browser/axios.cjs'),
        // Stelle sicher, dass Next.js die Source-Dateien verwendet, nicht die dist-Dateien
        '@saivaro/shared': sharedSrcPath,
      };
    } else {
      // Auf dem Server: Verwende auch die Source-Dateien
      config.resolve.alias = {
        ...config.resolve.alias,
        '@saivaro/shared': sharedSrcPath,
      };
    }
    
    // Stelle sicher, dass Source-Dateien aus dem Workspace kompiliert werden
    config.resolve.symlinks = true;
    
    return config;
  },
};

module.exports = nextConfig;
