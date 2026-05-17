import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['bcryptjs'],
  output: 'standalone',
  allowedDevOrigins: ['192.168.0.152', '192.168.0.153', 'localhost:3000'],
  experimental: {
    serverActions: {
      allowedOrigins: ['192.168.0.152:3000', '192.168.0.153:3000', 'localhost:3000']
    },
    cpus: 1
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
