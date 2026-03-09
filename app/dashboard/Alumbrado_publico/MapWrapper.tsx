'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Search, Filter } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSector, setSelectedSector] = useState("Todos");

  // 1. Extraer sectores únicos de los datos reales
  const sectores = useMemo(() => {
    const listaSectores = reportes.map(r => r.sector);
    return ["Todos", ...Array.from(new Set(listaSectores))];
  }, [reportes]);

  // 2. Lógica de filtrado combinada (Buscador + Sector)
  const reportesFiltrados = useMemo(() => {
    return reportes.filter(reporte => {
      const coincideSector = selectedSector === "Todos" || reporte.sector === selectedSector;
      const coincideBusqueda = 
        reporte.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reporte.id.toString().includes(searchTerm);
      
      return coincideSector && coincideBusqueda;
    });
  }, [searchTerm, selectedSector, reportes]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Panel de Controles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        
        {/* Buscador por Folio/ID */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar folio o ID..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filtro por Sector */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none"
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
          >
            {sectores.map(sector => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Info de resultados */}
      <div className="px-2">
        <p className="text-xs text-slate-500">
          Mostrando <span className="font-bold text-blue-600">{reportesFiltrados.length}</span> puntos de {reportes.length} disponibles.
        </p>
      </div>

      {/* Mapa con la lista filtrada */}
      <div className="flex-1 min-h-[500px] relative">
        <LeafletMap gps={gps} reportes={reportesFiltrados} />
      </div>
    </div>
  );
}


// 'use client'; 

// import dynamic from 'next/dynamic';

// const LeafletMap = dynamic(
//   () => import('./LeafletMap'), 
//   { 
//     ssr: false,
//     loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-lg" />
//   }
// );

// interface MapWrapperProps {
//   gps: { lat: string | null; lon: string | null };
//   reportes: any[];
// }

// export default function MapWrapper({ gps, reportes }: MapWrapperProps) {
//   return <LeafletMap gps={gps} reportes={reportes} />;
// }