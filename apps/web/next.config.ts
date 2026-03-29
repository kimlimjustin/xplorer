import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'avatars.githubusercontent.com' }],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // MED-W08: Security headers applied to all routes
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
      ],
    },
  ],
  webpack: (config) => {
    const fs = require('fs');
    const clientDir = path.resolve(__dirname, '.client-components');
    const monorepoClientDir = path.resolve(__dirname, '../client/src');
    config.resolve.alias['@client'] = fs.existsSync(clientDir) ? clientDir : monorepoClientDir;

    // The @/ alias inside copied components must resolve to .client-components/
    // (the real components use @/ to reference other Xplorer files)
    if (fs.existsSync(clientDir)) {
      config.resolve.alias['@'] = [clientDir, path.resolve(__dirname, 'src')];
    }

    const mocksDir = path.resolve(clientDir, '__mocks__');
    const webMocksDir = path.resolve(__dirname, 'src/mocks');

    // Mock packages not available in the web context
    config.resolve.alias['react-i18next'] = fs.existsSync(mocksDir)
      ? path.resolve(mocksDir, 'react-i18next.ts')
      : 'react-i18next';
    config.resolve.alias['wouter'] = fs.existsSync(mocksDir)
      ? path.resolve(mocksDir, 'wouter.ts')
      : 'wouter';
    config.resolve.alias['@tauri-apps/api/window'] = path.resolve(webMocksDir, 'tauri-window.ts');
    config.resolve.alias['@tauri-apps/api/core'] = path.resolve(webMocksDir, 'tauri-core.ts');
    config.resolve.alias['@tauri-apps/api/event'] = path.resolve(webMocksDir, 'tauri-core.ts');
    config.resolve.alias['@crabnebula/tauri-plugin-drag'] = path.resolve(
      webMocksDir,
      'tauri-drag.ts',
    );

    return config;
  },
};

export default nextConfig;
