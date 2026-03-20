import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Excluir pg del bundler de Next.js/Turbopack
  // pg usa módulos nativos de Node.js (net, tls, crypto) que no se pueden bundlear
  serverExternalPackages: ['pg', 'pg-native'],

  // Si usas imágenes externas (Google Maps tiles, etc.)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.google.com' },
      { protocol: 'https', hostname: '**.googleapis.com' },
    ],
  },
};

export default nextConfig;


// import type { NextConfig } from 'next';

// const nextConfig: NextConfig = {
//   experimental: {
//     serverActions: {
//       bodySizeLimit: '15mb', // Permite hasta 15MB en la petición
//     },
//   },
// };

// export default nextConfig;
