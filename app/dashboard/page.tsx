// app/dashboard/page.tsx
import { sql } from '@vercel/postgres';
import MapWrapper from '@/app/dashboard/Alumbrado_publico/MapWrapper'; // Importación normal

interface Reporte {
  id: string;
  folio: string;
  sector: string;
  latitud: number;
  longitud: number;
}

async function getReportes(): Promise<Reporte[]> {
  const { rows } = await sql`
    SELECT id, folio, sector, latitud::float, longitud::float 
    FROM reportes_alumbrado
  `;
  return rows as Reporte[];
}

export default async function Page() {
  const reportes = await getReportes();
  const gpsSimulado = { lat: null, lon: null };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Mapa de Gestión</h1>
      <div className="h-[600px] w-full rounded-xl overflow-hidden shadow-md">
        {/* Llamamos al Wrapper, no directamente al mapa */}
        <MapWrapper gps={gpsSimulado} reportes={reportes} />
      </div>
    </div>
  );
}





// // app/dashboard/page.tsx
// import dynamic from 'next/dynamic';
// import { sql } from '@vercel/postgres';

// // 1. Definimos la interfaz aquí también para que el Servidor la conozca
// interface Reporte {
//   id: string;
//   folio: string;
//   sector: string;
//   latitud: number; 
//   longitud: number;
// }

// // Importación dinámica para Leaflet
// const LeafletMap = dynamic(() => import('@/app/dashboard/Alumbrado_publico/LeafletMap'), { 
//   ssr: false 
// });

// async function getReportes(): Promise<Reporte[]> {
//   const { rows } = await sql`
//     SELECT id, folio, sector, 
//            latitud::float, -- Forzamos a que el SQL lo entregue como número
//            longitud::float 
//     FROM reportes_alumbrado
//   `;
  
//   // Usamos "as Reporte[]" para asegurar a TS que los datos coinciden
//   return rows as Reporte[];
// }

// export default async function Page() {
//   const reportes = await getReportes();
  
//   const gpsSimulado = { lat: null, lon: null };

//   return (
//     <div className="h-screen w-full p-4">
//       <div className="h-[600px] w-full rounded-xl border shadow-lg overflow-hidden">
//         {/* Ahora 'reportes' ya tiene el tipo correcto */}
//         <LeafletMap gps={gpsSimulado} reportes={reportes} />
//       </div>
//     </div>
//   );
// }