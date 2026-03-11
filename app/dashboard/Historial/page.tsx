import { sql } from '@vercel/postgres';
import { FaTrash, FaEdit, FaMapMarkerAlt, FaSearch } from 'react-icons/fa';
import { eliminarReporte } from '@/app/lib/actions';
import Link from 'next/link';
import BotonActualizar from '@/app/dashboard/Historial/BotonActualizar';

// 1. Definimos la interfaz para los datos de la base de datos
interface ReporteAlumbrado {
  id: string;
  folio: string;
  fecha: string;
  tipo_mantenimiento: string | null;
  sector: string;
  tramo: string;
  latitud: string | null;
  longitud: string | null;
  categoria: string;
}

interface HistorialPageProps {
  searchParams: Promise<{
    query?: string;
    sort?: string;
    page?: string;
    mantenimiento?: string;
  }>;
}

const ITEMS_POR_PAGINA = 10;

export default async function HistorialPage({ searchParams }: HistorialPageProps) {
  const resolvedSearchParams = await searchParams;

  const query = resolvedSearchParams?.query || '';
  const sort = resolvedSearchParams?.sort || 'desc';
  const mantenimiento = resolvedSearchParams?.mantenimiento || '';
  const paginaActual = Number(resolvedSearchParams?.page) || 1;
  const offset = (paginaActual - 1) * ITEMS_POR_PAGINA;
  const searchPattern = `%${query}%`;

  // Consultas a la base de datos
  const conteoResult = await sql`
    SELECT COUNT(*) 
    FROM reportes_alumbrado
    WHERE (folio ILIKE ${searchPattern} OR sector ILIKE ${searchPattern} OR tramo ILIKE ${searchPattern})
      AND (${mantenimiento} = '' OR tipo_mantenimiento = ${mantenimiento})
  `;
  
  const totalRegistros = Number(conteoResult.rows[0].count);
  const totalPaginas = Math.ceil(totalRegistros / ITEMS_POR_PAGINA);

  const result = await sql<ReporteAlumbrado>`
    SELECT * FROM reportes_alumbrado 
    WHERE (folio ILIKE ${searchPattern} OR sector ILIKE ${searchPattern} OR tramo ILIKE ${searchPattern})
      AND (${mantenimiento} = '' OR tipo_mantenimiento = ${mantenimiento})
    ORDER BY 
      CASE WHEN ${sort} = 'asc' THEN fecha END ASC,
      CASE WHEN ${sort} = 'desc' THEN fecha END DESC
    LIMIT ${ITEMS_POR_PAGINA} OFFSET ${offset}
  `;
  const reportes = result.rows;

  const getBadgeStyle = (tipo: string | null) => {
    if (!tipo) return 'bg-gray-50 text-gray-400 border-gray-100 italic';
    switch (tipo.toLowerCase()) {
      case 'urgente': return 'bg-red-100 text-red-700 border-red-200';
      case 'ordinario': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'programable': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };


  // Mapeo de categoria (BD) → ruta real de la carpeta
const rutaPorCategoria: Record<string, string> = {
  'ALUMBRADO PÚBLICO': 'Alumbrado_publico',
  'AREAS VERDES':      'Areas_verdes',
   'BARRIDO VIALIDADES':      'Barrido_vialidades',
    'LIMPIEZA URBANA':      'Limpieza_Urbana',
  // agrega aquí las demás categorías que tengas
};

// Función helper
const getRuta = (categoria: string) =>
  rutaPorCategoria[categoria] ?? categoria;

  return (
    <main className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* --- FORMULARIO DE FILTROS --- */}
      <form method="GET" className="mb-6 bg-white p-4 md:p-6 rounded-xl shadow-md border border-gray-100 flex flex-col lg:flex-row gap-4 items-end">
        <div className="w-full flex-1">
          <label className="text-[11px] uppercase font-bold text-slate-500 mb-1.5 block ml-1">Búsqueda General</label>
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              name="query"
              defaultValue={query}
              placeholder="Folio, sector o tramo..."
              className="w-full pl-10 pr-4 py-3 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition text-sm md:text-base"
            />
          </div>
        </div>

        <div className="w-full lg:w-48">
          <label className="text-[11px] uppercase font-bold text-slate-500 mb-1.5 block ml-1">Mantenimiento</label>
          <select
            name="mantenimiento"
            defaultValue={mantenimiento}
            className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-sm md:text-base"
          >
            <option value="">Todos los registros</option>
            <option value="Urgente">🚨 Urgente</option>
            <option value="Ordinario">📋 Ordinario</option>
            <option value="Programable">🗓️ Programable</option>
          </select>
        </div>

        <div className="w-full lg:w-40">
          <label className="text-[11px] uppercase font-bold text-slate-500 mb-1.5 block ml-1">Orden</label>
          <select
            name="sort"
            defaultValue={sort}
            className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-sm md:text-base"
          >
            <option value="desc">Recientes</option>
            <option value="asc">Antiguos</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full lg:w-auto px-8 py-3 md:py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-200 mt-2 lg:mt-0"
        >
          Aplicar
        </button>
        <BotonActualizar />
      </form>

      {/* --- LISTA DE RESULTADOS --- */}
      <div className="bg-transparent md:bg-white rounded-none md:rounded-xl md:shadow-lg md:border md:border-gray-200 flex flex-col gap-4 md:gap-0">
        <div className="hidden md:grid md:grid-cols-[1.5fr_1fr_2.5fr_0.5fr_1fr] gap-4 px-6 py-4 bg-slate-800 text-white uppercase text-[11px] tracking-wider rounded-t-xl">
          <div>Folio / Fecha</div>
          <div className="text-center">Tipo</div>
          <div>Ubicación (Sector/Tramo)</div>
          <div className="text-center">GPS</div>
          <div className="text-right">Acciones</div>
        </div>

        <div className="flex flex-col gap-4 md:gap-0">
          {reportes.map((reporte) => (
            <div 
              key={reporte.id} 
              className="bg-white rounded-xl shadow-md border border-gray-200 p-4 md:p-0 md:rounded-none md:shadow-none md:border-x-0 md:border-t-0 md:border-b md:border-gray-100 md:grid md:grid-cols-[1.5fr_1fr_2.5fr_0.5fr_1fr] md:gap-4 md:items-center hover:bg-emerald-50/30 transition-colors group relative overflow-hidden"
            >
              {/* Folio y Fecha */}
              <div className="flex justify-between items-start md:px-6 md:py-4 mb-3 md:mb-0 border-b border-gray-100 md:border-none pb-3 md:pb-0">
                <div>
                  <div className="font-bold text-slate-800 text-base mb-0.5">{reporte.folio}</div>
                  <div className="text-xs text-slate-400">
                    {(() => {
                      try {
                        // 1. Convertimos a objeto Date (funciona si es string o Date)
                        const d = new Date(reporte.fecha);

                        // 2. Verificamos si la fecha es válida
                        if (isNaN(d.getTime())) return 'Fecha no válida';

                        // 3. Formateamos directamente
                        return d.toLocaleString('es-MX', {
                          timeZone: 'America/Mexico_City',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        });
                      } catch (e) {
                        return 'Error en fecha';
                      }
                    })()}
                  </div>
                </div>
                <div className="md:hidden">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${getBadgeStyle(reporte.tipo_mantenimiento)}`}>
                    {reporte.tipo_mantenimiento || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Badge Desktop */}
              <div className="hidden md:block md:px-6 md:py-4 text-center">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${getBadgeStyle(reporte.tipo_mantenimiento)}`}>
                  {reporte.tipo_mantenimiento || 'N/A'}
                </span>
              </div>

              {/* Ubicación */}
              <div className="mb-4 md:mb-0 md:px-6 md:py-4">
                <div className="text-[10px] uppercase font-bold text-slate-400 md:hidden mb-1">Sector/Tramo</div>
                <div className="text-slate-700 font-medium text-sm md:text-base">{reporte.sector}</div>
                <div className="text-xs text-slate-500">{reporte.tramo}</div>
              </div>

              {/* GPS y Acciones */}
              <div className="flex justify-between items-center bg-gray-50 md:bg-transparent -mx-4 -mb-4 p-4 md:m-0 md:p-0 md:contents rounded-b-xl md:rounded-none border-t border-gray-100 md:border-none">
                <div className="md:px-6 md:py-4 md:text-center flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 md:hidden">GPS: </span>
                  {reporte.latitud ? (
                    <a
                      href={`https://www.google.com/maps?q=${reporte.latitud},${reporte.longitud}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                    >
                      <FaMapMarkerAlt size={14} />
                    </a>
                  ) : (
                    <span className="text-gray-400 italic text-xs bg-gray-100 px-2 py-1 rounded-md">Sin GPS</span>
                  )}
                </div>

                <div className="flex gap-3 justify-end md:px-6 md:py-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <Link
                    // Dinámicamente cambiamos la ruta basada en la categoría
                    // Ejemplo: si categoria es 'barrido', irá a /dashboard/Barrido?editId=...
                    href={`/dashboard/${getRuta(reporte.categoria)}?editId=${reporte.id}`}
                    className="p-2 md:p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <FaEdit size={16} />
                  </Link>

                  <form action={async () => {
                    'use server';
                    // Cambia reporte.id por reporte.id.toString()
                    await eliminarReporte(reporte.id.toString());
                  }}>
                    <button type="submit" className="p-2 md:p-2.5 text-red-600 bg-red-50 hover:bg-red-100 md:bg-transparent md:hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                      <FaTrash size={16} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* --- ESTADO VACÍO --- */}
        {reportes.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center bg-white md:bg-transparent rounded-xl shadow-sm border border-gray-200 md:border-none">
            <FaSearch size={30} className="text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium px-4">No se encontraron reportes.</p>
            <Link href="/dashboard/Historial" className="text-emerald-600 text-sm mt-2 underline">Limpiar filtros</Link>
          </div>
        )}

        {/* --- PAGINACIÓN --- */}
        {totalPaginas > 1 && (
          <div className="px-4 md:px-6 py-4 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 md:mt-0 rounded-xl md:rounded-b-xl border border-gray-200 md:border-none">
             <p className="text-sm text-slate-500">Página {paginaActual} de {totalPaginas}</p>
             <div className="flex gap-2 w-full sm:w-auto">
                <Link
                  href={`?query=${query}&sort=${sort}&mantenimiento=${mantenimiento}&page=${paginaActual - 1}`}
                  className={`flex-1 sm:flex-none text-center px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                    paginaActual <= 1 ? 'bg-gray-200 text-gray-400 pointer-events-none' : 'bg-white border text-slate-700 hover:bg-gray-100 shadow-sm'
                  }`}
                >
                  Anterior
                </Link>
                <Link
                  href={`?query=${query}&sort=${sort}&mantenimiento=${mantenimiento}&page=${paginaActual + 1}`}
                  className={`flex-1 sm:flex-none text-center px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                    paginaActual >= totalPaginas ? 'bg-gray-200 text-gray-400 pointer-events-none' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                  }`}
                >
                  Siguiente
                </Link>
             </div>
          </div>
        )}
      </div>
    </main>
  );
}


// import { sql } from '@vercel/postgres';
// import { FaTrash, FaEdit, FaMapMarkerAlt, FaSearch, FaTools } from 'react-icons/fa';
// import { eliminarReporte } from '@/app/lib/actions';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';

// interface HistorialPageProps {
// searchParams: Promise<{
//   query?: string;
//   sort?: string;
//   page?: string;
//   mantenimiento?: string;
// }>;
// }

// const ITEMS_POR_PAGINA = 10;

// export default async function HistorialPage({ searchParams }: HistorialPageProps) {
// const resolvedSearchParams = await searchParams;

// const query = resolvedSearchParams?.query || '';
// const sort = resolvedSearchParams?.sort || 'desc';
// const mantenimiento = resolvedSearchParams?.mantenimiento || '';
// const paginaActual = Number(resolvedSearchParams?.page) || 1;
// const offset = (paginaActual - 1) * ITEMS_POR_PAGINA;
// const searchPattern = `%${query}%`;

// const filterMantenimiento = mantenimiento ? mantenimiento : '%';


// const conteoResult = await sql`
//   SELECT COUNT(*) 
//   FROM reportes_alumbrado
//   WHERE (folio ILIKE ${searchPattern} OR sector ILIKE ${searchPattern} OR tramo ILIKE ${searchPattern})
//     AND (${mantenimiento} = '' OR tipo_mantenimiento = ${mantenimiento})
// `;

// const totalRegistros = Number(conteoResult.rows[0].count);
// const totalPaginas = Math.ceil(totalRegistros / ITEMS_POR_PAGINA);

// const result = await sql`
//   SELECT * FROM reportes_alumbrado 
//   WHERE (folio ILIKE ${searchPattern} OR sector ILIKE ${searchPattern} OR tramo ILIKE ${searchPattern})
//     AND (${mantenimiento} = '' OR tipo_mantenimiento = ${mantenimiento})
//   ORDER BY 
//     CASE WHEN ${sort} = 'asc' THEN fecha END ASC,
//     CASE WHEN ${sort} = 'desc' THEN fecha END DESC
//   LIMIT ${ITEMS_POR_PAGINA} OFFSET ${offset}
// `;
// const reportes = result.rows;

// const getBadgeStyle = (tipo: string | null) => {
//   if (!tipo) return 'bg-gray-50 text-gray-400 border-gray-100 italic';
//   switch (tipo.toLowerCase()) {
//     case 'urgente': return 'bg-red-100 text-red-700 border-red-200';
//     case 'ordinario': return 'bg-blue-100 text-blue-700 border-blue-200';
//     case 'programable': return 'bg-amber-100 text-amber-700 border-amber-200';
//     default: return 'bg-gray-100 text-gray-600 border-gray-200';
//   }
// };

// return (
//   <main className="p-4 md:p-6 max-w-7xl mx-auto">
//     {/* --- FORMULARIO DE FILTROS --- */}
//     <form method="GET" className="mb-6 bg-white p-4 md:p-6 rounded-xl shadow-md border border-gray-100 flex flex-col lg:flex-row gap-4 items-end">
//       <div className="w-full flex-1">
//         <label className="text-[11px] uppercase font-bold text-slate-500 mb-1.5 block ml-1">Búsqueda General</label>
//         <div className="relative">
//           <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
//           <input
//             type="text"
//             name="query"
//             defaultValue={query}
//             placeholder="Folio, sector o tramo..."
//             className="w-full pl-10 pr-4 py-3 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition text-sm md:text-base"
//           />
//         </div>
//       </div>

//       <div className="w-full lg:w-48">
//         <label className="text-[11px] uppercase font-bold text-slate-500 mb-1.5 block ml-1">Mantenimiento</label>
//         <select
//           name="mantenimiento"
//           defaultValue={mantenimiento}
//           className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-sm md:text-base"
//         >
//           <option value="">Todos los registros</option>
//           <option value="Urgente">🚨 Urgente</option>
//           <option value="Ordinario">📋 Ordinario</option>
//           <option value="Programable">🗓️ Programable</option>
//         </select>
//       </div>

//       <div className="w-full lg:w-40">
//         <label className="text-[11px] uppercase font-bold text-slate-500 mb-1.5 block ml-1">Orden</label>
//         <select
//           name="sort"
//           defaultValue={sort}
//           className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-sm md:text-base"
//         >
//           <option value="desc">Recientes</option>
//           <option value="asc">Antiguos</option>
//         </select>
//       </div>

//       <button
//         type="submit"
//         className="w-full lg:w-auto px-8 py-3 md:py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-200 mt-2 lg:mt-0"
//       >
//         Aplicar
//       </button>
//     </form>

//     {/* --- LISTA DE RESULTADOS (RESPONSIVE) --- */}
//     <div className="bg-transparent md:bg-white rounded-none md:rounded-xl md:shadow-lg md:border md:border-gray-200 flex flex-col gap-4 md:gap-0">
      
//       {/* Encabezado visible solo en Desktop (Grid) */}
//       <div className="hidden md:grid md:grid-cols-[1.5fr_1fr_2.5fr_0.5fr_1fr] gap-4 px-6 py-4 bg-slate-800 text-white uppercase text-[11px] tracking-wider rounded-t-xl">
//         <div>Folio / Fecha</div>
//         <div className="text-center">Tipo</div>
//         <div>Ubicación (Sector/Tramo)</div>
//         <div className="text-center">GPS</div>
//         <div className="text-right">Acciones</div>
//       </div>

//       {/* Contenedor de las filas/tarjetas */}
//       <div className="flex flex-col gap-4 md:gap-0">
//         {reportes.map((reporte) => (
//           <div 
//             key={reporte.id} 
//             className="bg-white rounded-xl shadow-md border border-gray-200 p-4 md:p-0 md:rounded-none md:shadow-none md:border-x-0 md:border-t-0 md:border-b md:border-gray-100 md:grid md:grid-cols-[1.5fr_1fr_2.5fr_0.5fr_1fr] md:gap-4 md:items-center hover:bg-emerald-50/30 transition-colors group relative overflow-hidden"
//           >
            
//             {/* 1. Folio y Fecha + Badge en Móvil */}
//             <div className="flex justify-between items-start md:px-6 md:py-4 mb-3 md:mb-0 border-b border-gray-100 md:border-none pb-3 md:pb-0">
//               <div>
//                 <div className="font-bold text-slate-800 text-base mb-0.5">{reporte.folio}</div>
//                 <div className="text-xs text-slate-400">
//                   {new Date(reporte.fecha + 'Z').toLocaleString('es-MX', {
//                     timeZone: 'America/Mexico_City',
//                     day: '2-digit', month: '2-digit', year: 'numeric',
//                     hour: '2-digit', minute: '2-digit', hour12: true
//                   })}
//                 </div>
//               </div>
//               {/* Badge visible SOLO en celular (arriba a la derecha) */}
//               <div className="md:hidden">
//                 <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${getBadgeStyle(reporte.tipo_mantenimiento)}`}>
//                   {reporte.tipo_mantenimiento || 'N/A'}
//                 </span>
//               </div>
//             </div>

//             {/* 2. Badge visible SOLO en Desktop */}
//             <div className="hidden md:block md:px-6 md:py-4 text-center">
//               <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${getBadgeStyle(reporte.tipo_mantenimiento)}`}>
//                 {reporte.tipo_mantenimiento || 'N/A'}
//               </span>
//             </div>

//             {/* 3. Sector / Tramo */}
//             <div className="mb-4 md:mb-0 md:px-6 md:py-4">
//               <div className="text-[10px] uppercase font-bold text-slate-400 md:hidden mb-1">Sector/Tramo</div>
//               <div className="text-slate-700 font-medium text-sm md:text-base">{reporte.sector}</div>
//               <div className="text-xs text-slate-500">{reporte.tramo}</div>
//             </div>

//             {/* 4. Contenedor Inferior Móvil (GPS + Acciones) */}
//             <div className="flex justify-between items-center bg-gray-50 md:bg-transparent -mx-4 -mb-4 p-4 md:m-0 md:p-0 md:contents rounded-b-xl md:rounded-none border-t border-gray-100 md:border-none">
              
//               {/* GPS */}
//               <div className="md:px-6 md:py-4 md:text-center flex items-center gap-2">
//                 <span className="text-[10px] uppercase font-bold text-slate-400 md:hidden">GPS: </span>
//                 {reporte.latitud ? (
//                   <a
//                     href={`https://www.google.com/maps?q=${reporte.latitud},${reporte.longitud}`}
//                     target="_blank"
//                     rel="noreferrer"
//                     className="inline-flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
//                     title="Ver en Google Maps"
//                   >
//                     <FaMapMarkerAlt size={14} className="md:text-base" />
//                   </a>
//                 ) : (
//                   <span className="text-gray-400 italic text-xs bg-gray-100 px-2 py-1 rounded-md">Sin GPS</span>
//                 )}
//               </div>

//               {/* Acciones (Siempre visibles en móvil, hover en desktop) */}
//               <div className="flex gap-3 justify-end md:px-6 md:py-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
//                 <button className="p-2 md:p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 md:bg-transparent md:hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
//                   <FaEdit size={16} />
//                 </button>

//                 <form action={async () => {
//                   'use server';
//                   await eliminarReporte(reporte.id);
//                 }}>
//                   <button type="submit" className="p-2 md:p-2.5 text-red-600 bg-red-50 hover:bg-red-100 md:bg-transparent md:hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
//                     <FaTrash size={16} />
//                   </button>
//                 </form>
//               </div>
//             </div>

//           </div>
//         ))}
//       </div>

//       {/* --- ESTADO VACÍO --- */}
//       {reportes.length === 0 && (
//         <div className="py-20 text-center flex flex-col items-center bg-white md:bg-transparent rounded-xl md:rounded-none shadow-sm md:shadow-none border border-gray-200 md:border-none">
//           <div className="bg-slate-100 p-4 rounded-full mb-4">
//             <FaSearch size={30} className="text-slate-300" />
//           </div>
//           <p className="text-slate-500 font-medium px-4">No se encontraron reportes con estos criterios.</p>
//           <Link href="/dashboard/Historial" className="text-emerald-600 text-sm mt-2 underline font-medium">Limpiar filtros</Link>
//         </div>
//       )}

//       {/* --- PAGINACIÓN --- */}
//       {totalPaginas > 1 && (
//         <div className="px-4 md:px-6 py-4 bg-slate-50 md:rounded-b-xl border border-gray-200 md:border-t-0 md:border-x-0 md:border-b-0 flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 md:mt-0 rounded-xl shadow-sm md:shadow-none">
//             <p className="text-sm text-slate-500 font-medium">Página <span className="text-slate-800">{paginaActual}</span> de <span className="text-slate-800">{totalPaginas}</span></p>
//             <div className="flex gap-2 w-full sm:w-auto">
//               <Link
//                 href={`?query=${query}&sort=${sort}&mantenimiento=${mantenimiento}&page=${paginaActual - 1}`}
//                 className={`flex-1 sm:flex-none text-center px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
//                   paginaActual <= 1 ? 'bg-gray-200 text-gray-400 pointer-events-none' : 'bg-white border text-slate-700 hover:bg-gray-100 shadow-sm'
//                 }`}
//               >
//                 Anterior
//               </Link>
//               <Link
//                 href={`?query=${query}&sort=${sort}&mantenimiento=${mantenimiento}&page=${paginaActual + 1}`}
//                 className={`flex-1 sm:flex-none text-center px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
//                   paginaActual >= totalPaginas ? 'bg-gray-200 text-gray-400 pointer-events-none' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-100'
//                 }`}
//               >
//                 Siguiente
//               </Link>
//             </div>
//         </div>
//       )}
//     </div>
//   </main>
// );
// }




// import { sql } from '@vercel/postgres';
// import { FaTrash, FaEdit, FaMapMarkerAlt, FaSearch } from 'react-icons/fa';
// import { eliminarReporte } from '@/app/lib/actions';
// import Link from 'next/link';

// interface HistorialPageProps {
//   searchParams: Promise<{
//     query?: string;
//     sort?: string;
//     page?: string;
//   }>;
// }

// const ITEMS_POR_PAGINA = 10;

// export default async function HistorialPage({ searchParams }: HistorialPageProps) {
//   const resolvedSearchParams = await searchParams;

//   const query = resolvedSearchParams?.query || '';
//   const sort = resolvedSearchParams?.sort || 'desc';
//   const paginaActual = Number(resolvedSearchParams?.page) || 1;
//   const offset = (paginaActual - 1) * ITEMS_POR_PAGINA;
//   const searchPattern = `%${query}%`;

//   const conteoResult = await sql`
//     SELECT COUNT(*) 
//     FROM reportes_alumbrado
//     WHERE folio ILIKE ${searchPattern} 
//        OR sector ILIKE ${searchPattern} 
//        OR tramo ILIKE ${searchPattern}
//   `;
//   const totalRegistros = Number(conteoResult.rows[0].count);
//   const totalPaginas = Math.ceil(totalRegistros / ITEMS_POR_PAGINA);

//   let reportes;
//   if (sort === 'asc') {
//     const result = await sql`
//       SELECT * FROM reportes_alumbrado 
//       WHERE folio ILIKE ${searchPattern} 
//          OR sector ILIKE ${searchPattern} 
//          OR tramo ILIKE ${searchPattern}
//       ORDER BY fecha ASC
//       LIMIT ${ITEMS_POR_PAGINA} OFFSET ${offset}
//     `;
//     reportes = result.rows;
//   } else {
//     const result = await sql`
//       SELECT * FROM reportes_alumbrado 
//       WHERE folio ILIKE ${searchPattern} 
//          OR sector ILIKE ${searchPattern} 
//          OR tramo ILIKE ${searchPattern}
//       ORDER BY fecha DESC
//       LIMIT ${ITEMS_POR_PAGINA} OFFSET ${offset}
//     `;
//     reportes = result.rows;
//   }

//   return (
//     <main className="p-4 md:p-6 max-w-7xl mx-auto">
//       <h1 className="text-2xl font-bold mb-6 text-emerald-800">Historial de Reportes</h1>

//       <form method="GET" className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-3 md:items-center">
//         <div className="flex-1 relative">
//           <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
//           <input
//             type="text"
//             name="query"
//             defaultValue={query}
//             placeholder="Buscar por folio, sector o tramo..."
//             className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
//           />
//         </div>

//         <select
//           name="sort"
//           defaultValue={sort}
//           className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white transition"
//         >
//           <option value="desc">Más recientes</option>
//           <option value="asc">Más antiguos</option>
//         </select>

//         <button
//           type="submit"
//           className="w-full md:w-auto px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition"
//         >
//           Filtrar
//         </button>
//       </form>

//       <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
//         <table className="w-full text-sm text-left block md:table">
//           <thead className="hidden md:table-header-group bg-slate-800 text-white uppercase text-xs">
//             <tr>
//               <th className="px-4 py-3">Folio</th>
//               <th className="px-4 py-3">Fecha y Hora</th>
//               <th className="px-4 py-3">Sector / Tramo</th>
//               <th className="px-4 py-3 text-center">Ubicación</th>
//               <th className="px-4 py-3 text-center">Acciones</th>
//             </tr>
//           </thead>

//           <tbody className="block md:table-row-group divide-y divide-gray-200">
//             {reportes.map((reporte) => (
//               <tr key={reporte.id} className="block md:table-row p-4 md:p-0 hover:bg-slate-50 transition">

//                 {/* Folio */}
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-2 md:mb-0">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Folio</span>
//                   <span className="font-semibold text-slate-700">{reporte.folio}</span>
//                 </td>

//                 {/* Fecha y Hora — convertida de UTC a hora México */}
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-2 md:mb-0 text-slate-500">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Fecha y Hora</span>

//                   <span className="text-right md:text-left">
//                     {new Date(reporte.fecha + 'Z').toLocaleDateString('es-MX', {
//                       timeZone: 'America/Mexico_City',
//                       day: '2-digit',
//                       month: '2-digit',
//                       year: 'numeric',
//                     })}
//                     <br className="hidden md:block" />
//                     <span className="text-xs font-medium text-slate-400">
//                       {new Date(reporte.fecha + 'Z').toLocaleTimeString('es-MX', {
//                         timeZone: 'America/Mexico_City',
//                         hour: '2-digit',
//                         minute: '2-digit',
//                         hour12: true,
//                       })}
//                     </span>
//                   </span>
//                 </td>

//                 {/* Sector / Tramo */}
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-2 md:mb-0 text-slate-600 text-right md:text-left">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Sector</span>
//                   <div>
//                     {reporte.sector}
//                     <br className="hidden md:block" />
//                     <span className="text-xs text-slate-400">{reporte.tramo}</span>
//                   </div>
//                 </td>

//                 {/* Ubicación — URL sin $ extra */}
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-4 md:mb-0">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Ubicación</span>
//                   <div className="flex md:justify-center">
//                     {reporte.latitud ? (
//                       <a
//                         href={`https://maps.google.com/?q=${reporte.latitud},${reporte.longitud}`}
//                         target="_blank"
//                         rel="noreferrer"
//                         className="text-emerald-600 hover:text-emerald-800 flex items-center gap-2 bg-emerald-50 md:bg-transparent px-3 py-1 md:p-0 rounded-full transition"
//                       >
//                         <FaMapMarkerAlt size={18} />
//                         <span className="md:hidden text-xs font-semibold">Ver Mapa</span>
//                       </a>
//                     ) : (
//                       <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full md:bg-transparent">Sin GPS</span>
//                     )}
//                   </div>
//                 </td>

//                 {/* Acciones */}
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 pt-4 border-t border-gray-100 md:border-none">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Acciones</span>
//                   <div className="flex gap-4 justify-end md:justify-center">
//                     <button className="text-blue-500 hover:text-blue-700 transition p-2 md:p-0 bg-blue-50 md:bg-transparent rounded-full">
//                       <FaEdit size={18} />
//                     </button>

//                     <form action={async () => {
//                       'use server';
//                       await eliminarReporte(reporte.id);
//                     }}>
//                       <button type="submit" className="text-red-500 hover:text-red-700 transition p-2 md:p-0 bg-red-50 md:bg-transparent rounded-full">
//                         <FaTrash size={18} />
//                       </button>
//                     </form>
//                   </div>
//                 </td>

//               </tr>
//             ))}

//             {reportes.length === 0 && (
//               <tr className="block md:table-row">
//                 <td colSpan={5} className="block md:table-cell px-4 py-8 text-center text-slate-500">
//                   No se encontraron reportes con esos filtros.
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>

//         {totalPaginas > 1 && (
//           <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-4 py-3 bg-gray-50 border-t border-gray-200">
//             <span className="text-sm text-gray-600">
//               Mostrando {reportes.length > 0 ? offset + 1 : 0} a {Math.min(offset + ITEMS_POR_PAGINA, totalRegistros)} de{' '}
//               <span className="font-semibold">{totalRegistros}</span> resultados
//             </span>

//             <div className="flex gap-2">
//               <Link
//                 href={`?query=${query}&sort=${sort}&page=${paginaActual - 1}`}
//                 className={`px-4 py-2 border rounded-lg text-sm font-medium transition ${
//                   paginaActual <= 1
//                     ? 'border-gray-200 text-gray-400 pointer-events-none'
//                     : 'border-gray-300 text-gray-700 hover:bg-gray-100'
//                 }`}
//               >
//                 Anterior
//               </Link>

//               <Link
//                 href={`?query=${query}&sort=${sort}&page=${paginaActual + 1}`}
//                 className={`px-4 py-2 border rounded-lg text-sm font-medium transition ${
//                   paginaActual >= totalPaginas
//                     ? 'border-gray-200 text-gray-400 pointer-events-none'
//                     : 'border-gray-300 text-gray-700 hover:bg-gray-100'
//                 }`}
//               >
//                 Siguiente
//               </Link>
//             </div>
//           </div>
//         )}
//       </div>
//     </main>
//   );
// }


// import { sql } from '@vercel/postgres';
// import { FaTrash, FaEdit, FaMapMarkerAlt, FaSearch } from 'react-icons/fa';
// import { eliminarReporte } from '@/app/lib/actions';
// import Link from 'next/link';

// // 1. Tipamos los parámetros que recibe la página para evitar el error de TypeScript
// interface HistorialPageProps {
//   searchParams: Promise<{
//     query?: string;
//     sort?: string;
//     page?: string;
//   }>;
// }

// const ITEMS_POR_PAGINA = 10;

// export default async function HistorialPage({ searchParams }: HistorialPageProps) {
//   const resolvedSearchParams = await searchParams;


//   // Ahora sí puedes extraer los valores de resolvedSearchParams
//   const query = resolvedSearchParams?.query || '';
//   const sort = resolvedSearchParams?.sort || 'desc';
//   const paginaActual = Number(resolvedSearchParams?.page) || 1;

// // ... El resto del código (Consultas SQL, cálculos de offset, etc.)
//   const offset = (paginaActual - 1) * ITEMS_POR_PAGINA;
//   const searchPattern = `%${query}%`;

//   // 3. Obtenemos el total de registros para calcular el total de páginas
//   const conteoResult = await sql`
//     SELECT COUNT(*) 
//     FROM reportes_alumbrado
//     WHERE folio ILIKE ${searchPattern} 
//        OR sector ILIKE ${searchPattern} 
//        OR tramo ILIKE ${searchPattern}
//   `;
//   const totalRegistros = Number(conteoResult.rows[0].count);
//   const totalPaginas = Math.ceil(totalRegistros / ITEMS_POR_PAGINA);

//   // 4. Obtenemos solo los reportes de la página actual usando LIMIT y OFFSET
//   let reportes;
//   if (sort === 'asc') {
//     const result = await sql`
//       SELECT * FROM reportes_alumbrado 
//       WHERE folio ILIKE ${searchPattern} 
//          OR sector ILIKE ${searchPattern} 
//          OR tramo ILIKE ${searchPattern}
//       ORDER BY fecha ASC
//       LIMIT ${ITEMS_POR_PAGINA} OFFSET ${offset}
//     `;
//     reportes = result.rows;
//   } else {
//     const result = await sql`
//       SELECT * FROM reportes_alumbrado 
//       WHERE folio ILIKE ${searchPattern} 
//          OR sector ILIKE ${searchPattern} 
//          OR tramo ILIKE ${searchPattern}
//       ORDER BY fecha DESC
//       LIMIT ${ITEMS_POR_PAGINA} OFFSET ${offset}
//     `;
//     reportes = result.rows;
//   }

//   return (
//     <main className="p-4 md:p-6 max-w-7xl mx-auto">
//       <h1 className="text-2xl font-bold mb-6 text-emerald-800">Historial de Reportes</h1>
      
//       {/* SECCIÓN DE FILTROS Y BÚSQUEDA */}
//       <form method="GET" className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-3 md:items-center">
//         <div className="flex-1 relative">
//           <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
//           <input 
//             type="text" 
//             name="query" 
//             defaultValue={query}
//             placeholder="Buscar por folio, sector o tramo..." 
//             className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
//           />
//         </div>

//         <select 
//           name="sort" 
//           defaultValue={sort}
//           className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white transition"
//         >
//           <option value="desc">Más recientes</option>
//           <option value="asc">Más antiguos</option>
//         </select>

//         <button 
//           type="submit" 
//           className="w-full md:w-auto px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition"
//         >
//           Filtrar
//         </button>
//       </form>

//       {/* TABLA DE RESULTADOS */}
//       <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
//         <table className="w-full text-sm text-left block md:table">
//           <thead className="hidden md:table-header-group bg-slate-800 text-white uppercase text-xs">
//             <tr>
//               <th className="px-4 py-3">Folio</th>
//               <th className="px-4 py-3">Fecha y Hora</th>
//               <th className="px-4 py-3">Sector / Tramo</th>
//               <th className="px-4 py-3 text-center">Ubicación</th>
//               <th className="px-4 py-3 text-center">Acciones</th>
//             </tr>
//           </thead>
          
//           <tbody className="block md:table-row-group divide-y divide-gray-200">
//             {reportes.map((reporte) => (
//               <tr key={reporte.id} className="block md:table-row p-4 md:p-0 hover:bg-slate-50 transition">
                
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-2 md:mb-0">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Folio</span>
//                   <span className="font-semibold text-slate-700">{reporte.folio}</span>
//                 </td>
                
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-2 md:mb-0 text-slate-500">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Fecha y Hora</span>
//                   <span className="text-right md:text-left">
//                     {new Date(reporte.fecha).toLocaleDateString('es-MX')} <br className="hidden md:block"/>
//                     <span className="text-xs font-medium text-slate-400">
//                       {new Date(reporte.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
//                     </span>
//                   </span>
//                 </td>
                
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-2 md:mb-0 text-slate-600 text-right md:text-left">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Sector</span>
//                   <div>
//                     {reporte.sector} <br className="hidden md:block"/> 
//                     <span className="text-xs text-slate-400">{reporte.tramo}</span>
//                   </div>
//                 </td>
                
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-4 md:mb-0">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Ubicación</span>
//                   <div className="flex md:justify-center">
//                     {reporte.latitud ? (
//                       <a 
//                         href={`https://maps.google.com/?q=$${reporte.latitud},${reporte.longitud}`} 
//                         target="_blank" 
//                         rel="noreferrer"
//                         className="text-emerald-600 hover:text-emerald-800 flex items-center gap-2 bg-emerald-50 md:bg-transparent px-3 py-1 md:p-0 rounded-full transition"
//                       >
//                         <FaMapMarkerAlt size={18} />
//                         <span className="md:hidden text-xs font-semibold">Ver Mapa</span>
//                       </a>
//                     ) : (
//                       <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full md:bg-transparent">Sin GPS</span>
//                     )}
//                   </div>
//                 </td>
                
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 pt-4 border-t border-gray-100 md:border-none">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Acciones</span>
//                   <div className="flex gap-4 justify-end md:justify-center">
//                     <button className="text-blue-500 hover:text-blue-700 transition p-2 md:p-0 bg-blue-50 md:bg-transparent rounded-full">
//                       <FaEdit size={18} />
//                     </button>
                    
//                     <form action={async () => {
//                       'use server';
//                       await eliminarReporte(reporte.id);
//                     }}>
//                       <button type="submit" className="text-red-500 hover:text-red-700 transition p-2 md:p-0 bg-red-50 md:bg-transparent rounded-full">
//                         <FaTrash size={18} />
//                       </button>
//                     </form>
//                   </div>
//                 </td>
                
//               </tr>
//             ))}
            
//             {reportes.length === 0 && (
//               <tr className="block md:table-row">
//                 <td colSpan={5} className="block md:table-cell px-4 py-8 text-center text-slate-500">
//                   No se encontraron reportes con esos filtros.
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>

//         {/* 5. CONTROLES DE PAGINACIÓN */}
//         {totalPaginas > 1 && (
//           <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-4 py-3 bg-gray-50 border-t border-gray-200">
//             <span className="text-sm text-gray-600">
//               Mostrando {reportes.length > 0 ? offset + 1 : 0} a {Math.min(offset + ITEMS_POR_PAGINA, totalRegistros)} de <span className="font-semibold">{totalRegistros}</span> resultados
//             </span>
            
//             <div className="flex gap-2">
//               <Link 
//                 href={`?query=${query}&sort=${sort}&page=${paginaActual - 1}`}
//                 className={`px-4 py-2 border rounded-lg text-sm font-medium transition ${
//                   paginaActual <= 1 
//                     ? 'border-gray-200 text-gray-400 pointer-events-none' 
//                     : 'border-gray-300 text-gray-700 hover:bg-gray-100'
//                 }`}
//               >
//                 Anterior
//               </Link>
              
//               <Link 
//                 href={`?query=${query}&sort=${sort}&page=${paginaActual + 1}`}
//                 className={`px-4 py-2 border rounded-lg text-sm font-medium transition ${
//                   paginaActual >= totalPaginas 
//                     ? 'border-gray-200 text-gray-400 pointer-events-none' 
//                     : 'border-gray-300 text-gray-700 hover:bg-gray-100'
//                 }`}
//               >
//                 Siguiente
//               </Link>
//             </div>
//           </div>
//         )}
//       </div>
//     </main>
//   );
// }


// import { sql } from '@vercel/postgres';
// import { FaTrash, FaEdit, FaMapMarkerAlt } from 'react-icons/fa';
// import { eliminarReporte } from '@/app/lib/actions';

// export default async function HistorialPage() {
//   // Obtenemos los datos de Neon
//   const { rows: reportes } = await sql`
//     SELECT * FROM reportes_alumbrado 
//     ORDER BY fecha DESC
//   `;

//   return (
//     <main className="p-4 md:p-6 max-w-7xl mx-auto">
//       <h1 className="text-2xl font-bold mb-6 text-emerald-800">Historial de Reportes</h1>
      
//       <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
//         {/* Cambiamos la tabla a block en móviles y table en escritorio */}
//         <table className="w-full text-sm text-left block md:table">
          
//           {/* Ocultamos el encabezado tradicional en móviles */}
//           <thead className="hidden md:table-header-group bg-slate-800 text-white uppercase text-xs">
//             <tr>
//               <th className="px-4 py-3">Folio</th>
//               <th className="px-4 py-3">Fecha</th>
//               <th className="px-4 py-3">Sector / Tramo</th>
//               <th className="px-4 py-3 text-center">Ubicación</th>
//               <th className="px-4 py-3 text-center">Acciones</th>
//             </tr>
//           </thead>
          
//           <tbody className="block md:table-row-group divide-y divide-gray-200">
//             {reportes.map((reporte) => (
//               /* En móviles, cada fila es un bloque (tarjeta) con algo de padding. En escritorio, es una fila normal */
//               <tr key={reporte.id} className="block md:table-row p-4 md:p-0 hover:bg-slate-50 transition">
                
//                 {/* Columna: Folio */}
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-2 md:mb-0">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Folio</span>
//                   <span className="font-semibold text-slate-700">{reporte.folio}</span>
//                 </td>
                
//                 {/* Columna: Fecha */}
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-2 md:mb-0 text-slate-500">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Fecha</span>
//                   {new Date(reporte.fecha).toLocaleDateString('es-MX')}
//                 </td>
                
//                 {/* Columna: Sector/Tramo */}
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-2 md:mb-0 text-slate-600 text-right md:text-left">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Sector</span>
//                   <div>
//                     {reporte.sector} <br className="hidden md:block"/> 
//                     <span className="text-xs text-slate-400">{reporte.tramo}</span>
//                   </div>
//                 </td>
                
//                 {/* Columna: Ubicación */}
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-4 md:mb-0">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Ubicación</span>
//                   <div className="flex md:justify-center">
//                     {reporte.latitud ? (
//                       <a 
//                         href={`https://maps.google.com/?q=${reporte.latitud},${reporte.longitud}`} 
//                         target="_blank" 
//                         rel="noreferrer"
//                         className="text-emerald-600 hover:text-emerald-800 flex items-center gap-2 bg-emerald-50 md:bg-transparent px-3 py-1 md:p-0 rounded-full transition"
//                       >
//                         <FaMapMarkerAlt size={18} />
//                         <span className="md:hidden text-xs font-semibold">Ver Mapa</span>
//                       </a>
//                     ) : (
//                       <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full md:bg-transparent">Sin GPS</span>
//                     )}
//                   </div>
//                 </td>
                
//                 {/* Columna: Acciones */}
//                 <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 pt-4 border-t border-gray-100 md:border-none">
//                   <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Acciones</span>
//                   <div className="flex gap-4 justify-end md:justify-center">
//                     <button className="text-blue-500 hover:text-blue-700 transition p-2 md:p-0 bg-blue-50 md:bg-transparent rounded-full">
//                       <FaEdit size={18} />
//                     </button>
                    
//                     <form action={async () => {
//                       'use server';
//                       await eliminarReporte(reporte.id);
//                     }}>
//                       <button type="submit" className="text-red-500 hover:text-red-700 transition p-2 md:p-0 bg-red-50 md:bg-transparent rounded-full">
//                         <FaTrash size={18} />
//                       </button>
//                     </form>
//                   </div>
//                 </td>
                
//               </tr>
//             ))}
            
//             {reportes.length === 0 && (
//               <tr className="block md:table-row">
//                 <td colSpan={5} className="block md:table-cell px-4 py-8 text-center text-slate-500">
//                   Aún no hay reportes guardados.
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       </div>
//     </main>
//   );
// }






// import { sql } from '@vercel/postgres';
// import { FaTrash, FaEdit, FaMapMarkerAlt } from 'react-icons/fa';
// import { eliminarReporte } from '@/app/lib/actions';

// export default async function HistorialPage() {
//   // Obtenemos los datos de Neon
//   const { rows: reportes } = await sql`
//     SELECT * FROM reportes_alumbrado 
//     ORDER BY fecha DESC
//   `;

//   return (
//     <main className="p-6">
//       <h1 className="text-2xl font-bold mb-6 text-emerald-800">Historial de Reportes</h1>
      
//       <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
//         <table className="w-full text-sm text-left">
//           <thead className="bg-slate-800 text-white uppercase text-xs">
//             <tr>
//               <th className="px-4 py-3">Folio</th>
//               <th className="px-4 py-3">Fecha</th>
//               <th className="px-4 py-3">Sector / Tramo</th>
//               <th className="px-4 py-3 text-center">Ubicación</th>
//               <th className="px-4 py-3 text-center">Acciones</th>
//             </tr>
//           </thead>
//           <tbody className="divide-y divide-gray-200">
//             {reportes.map((reporte) => (
//               <tr key={reporte.id} className="hover:bg-slate-50 transition">
//                 <td className="px-4 py-3 font-semibold text-slate-700">{reporte.folio}</td>
//                 <td className="px-4 py-3 text-slate-500">
//                   {new Date(reporte.fecha).toLocaleDateString('es-MX')}
//                 </td>
//                 <td className="px-4 py-3 text-slate-600">
//                   {reporte.sector} <br/> 
//                   <span className="text-xs text-slate-400">{reporte.tramo}</span>
//                 </td>
//                 <td className="px-4 py-3 text-center">
//                   {reporte.latitud ? (
//                     <a 
//                       href={`https://www.google.com/maps?q=${reporte.latitud},${reporte.longitud}`} 
//                       target="_blank" 
//                       rel="noreferrer"
//                       className="text-emerald-600 hover:text-emerald-800 flex justify-center"
//                     >
//                       <FaMapMarkerAlt size={18} />
//                     </a>
//                   ) : (
//                     <span className="text-xs text-gray-400">Sin GPS</span>
//                   )}
//                 </td>
//                 <td className="px-4 py-3 flex justify-center gap-3">
//                   {/* Botón de Editar (Te guiaré después con este) */}
//                   <button className="text-blue-500 hover:text-blue-700 transition">
//                     <FaEdit size={18} />
//                   </button>
                  
//                   {/* Botón de Eliminar usando un form con Server Action */}
//                   <form action={async () => {
//                     'use server';
//                     await eliminarReporte(reporte.id);
//                   }}>
//                     <button type="submit" className="text-red-500 hover:text-red-700 transition">
//                       <FaTrash size={18} />
//                     </button>
//                   </form>
//                 </td>
//               </tr>
//             ))}
            
//             {reportes.length === 0 && (
//               <tr>
//                 <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
//                   Aún no hay reportes guardados.
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       </div>
//     </main>
//   );
// }