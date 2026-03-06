'use client'; // <-- Esto es lo más importante

import dynamic from 'next/dynamic';

// Aquí sí está permitido el ssr: false porque estamos en un Client Component
const LeafletMap = dynamic(
  () => import('./LeafletMap'), 
  { 
    ssr: false,
    loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-lg" />
  }
);

interface MapWrapperProps {
  gps: { lat: string | null; lon: string | null };
  reportes: any[];
}

export default function MapWrapper({ gps, reportes }: MapWrapperProps) {
  return <LeafletMap gps={gps} reportes={reportes} />;
}