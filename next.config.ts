import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb', // Permite hasta 15MB en la petición
    },
  },
};

export default nextConfig;
