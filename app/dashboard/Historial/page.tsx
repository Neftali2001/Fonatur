import { sql } from '@vercel/postgres';
import { FaTrash, FaEdit, FaMapMarkerAlt, FaSearch } from 'react-icons/fa';
import { eliminarReporte } from '@/app/lib/actions';
import Link from 'next/link';
import BotonActualizar from '@/app/dashboard/Historial/BotonActualizar';

// 1. Interfaces
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

// 2. Funciones y constantes estáticas movidas AFUERA del componente
const rutaPorCategoria: Record<string, string> = {
  'ALUMBRADO PÚBLICO': 'Alumbrado_publico',
  'AREAS VERDES':      'Areas_verdes',
  'BARRIDO VIALIDADES':'Barrido_vialidades',
  'LIMPIEZA URBANA':   'Limpieza_Urbana',
};

const getRuta = (categoria: string) => rutaPorCategoria[categoria] ?? categoria;

const getBadgeStyle = (tipo: string | null) => {
  if (!tipo) return 'bg-gray-50 text-gray-400 border-gray-100 italic';
  switch (tipo.toLowerCase()) {
    case 'urgente': return 'bg-red-100 text-red-700 border-red-200';
    case 'ordinario': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'programable': return 'bg-amber-100 text-amber-700 border-amber-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
};

const formatearFecha = (fechaString: string) => {
  try {
    const d = new Date(fechaString);
    if (isNaN(d.getTime())) return 'Fecha no válida';
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
};

// 3. Componente Principal
export default async function HistorialPage({ searchParams }: HistorialPageProps) {
  const resolvedSearchParams = await searchParams;

  const query = resolvedSearchParams?.query || '';
  const sort = resolvedSearchParams?.sort || 'desc';
  const mantenimiento = resolvedSearchParams?.mantenimiento || '';
  const paginaActual = Number(resolvedSearchParams?.page) || 1;
  const offset = (paginaActual - 1) * ITEMS_POR_PAGINA;
  const searchPattern = `%${query}%`;

  // Consultas a la BD en paralelo para mayor velocidad
  const [conteoResult, result] = await Promise.all([
    sql`
      SELECT COUNT(*) 
      FROM reportes_alumbrado
      WHERE (folio ILIKE ${searchPattern} OR sector ILIKE ${searchPattern} OR tramo ILIKE ${searchPattern})
        AND (${mantenimiento} = '' OR tipo_mantenimiento = ${mantenimiento})
    `,
    sql<ReporteAlumbrado>`
      SELECT * FROM reportes_alumbrado 
      WHERE (folio ILIKE ${searchPattern} OR sector ILIKE ${searchPattern} OR tramo ILIKE ${searchPattern})
        AND (${mantenimiento} = '' OR tipo_mantenimiento = ${mantenimiento})
      ORDER BY 
        CASE WHEN ${sort} = 'asc' THEN fecha END ASC,
        CASE WHEN ${sort} = 'desc' THEN fecha END DESC
      LIMIT ${ITEMS_POR_PAGINA} OFFSET ${offset}
    `
  ]);

  const totalRegistros = Number(conteoResult.rows[0].count);
  const totalPaginas = Math.ceil(totalRegistros / ITEMS_POR_PAGINA);
  const reportes = result.rows;

  return (
    <main className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* --- FORMULARIO DE FILTROS --- */}
      <form method="GET" className="mb-6 bg-white p-4 md:p-6 rounded-xl shadow-md border border-gray-100 flex flex-col lg:flex-row gap-4 items-end">
        {/* ... (Tu formulario se mantiene igual, ya está optimizado) ... */}
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
          {reportes.map((reporte) => {
            // OPTIMIZACIÓN: Pre-bind del Server Action en lugar de arrow function
            const eliminarReporteBind = eliminarReporte.bind(null, reporte.id.toString());
            const badgeClass = getBadgeStyle(reporte.tipo_mantenimiento);
            const fechaFormateada = formatearFecha(reporte.fecha);

            return (
              <div 
                key={reporte.id} 
                className="bg-white rounded-xl shadow-md border border-gray-200 p-4 md:p-0 md:rounded-none md:shadow-none md:border-x-0 md:border-t-0 md:border-b md:border-gray-100 md:grid md:grid-cols-[1.5fr_1fr_2.5fr_0.5fr_1fr] md:gap-4 md:items-center hover:bg-emerald-50/30 transition-colors group relative overflow-hidden"
              >
                {/* Folio y Fecha */}
                <div className="flex justify-between items-start md:px-6 md:py-4 mb-3 md:mb-0 border-b border-gray-100 md:border-none pb-3 md:pb-0">
                  <div>
                    <div className="font-bold text-slate-800 text-base mb-0.5">{reporte.folio}</div>
                    <div className="text-xs text-slate-400">
                      {fechaFormateada}
                    </div>
                  </div>
                  <div className="md:hidden">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${badgeClass}`}>
                      {reporte.tipo_mantenimiento || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Badge Desktop */}
                <div className="hidden md:block md:px-6 md:py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${badgeClass}`}>
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
                      href={`/dashboard/${getRuta(reporte.categoria)}?editId=${reporte.id}`}
                      className="p-2 md:p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <FaEdit size={16} />
                    </Link>

                    <form action={eliminarReporteBind}>
                      <button type="submit" className="p-2 md:p-2.5 text-red-600 bg-red-50 hover:bg-red-100 md:bg-transparent md:hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                        <FaTrash size={16} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
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
// import { FaTrash, FaEdit, FaMapMarkerAlt, FaSearch } from 'react-icons/fa';
// import { eliminarReporte } from '@/app/lib/actions';
// import Link from 'next/link';
// import BotonActualizar from '@/app/dashboard/Historial/BotonActualizar';

// // 1. Definimos la interfaz para los datos de la base de datos
// interface ReporteAlumbrado {
//   id: string;
//   folio: string;
//   fecha: string;
//   tipo_mantenimiento: string | null;
//   sector: string;
//   tramo: string;
//   latitud: string | null;
//   longitud: string | null;
//   categoria: string;
// }

// interface HistorialPageProps {
//   searchParams: Promise<{
//     query?: string;
//     sort?: string;
//     page?: string;
//     mantenimiento?: string;
//   }>;
// }

// const ITEMS_POR_PAGINA = 10;

// export default async function HistorialPage({ searchParams }: HistorialPageProps) {
//   const resolvedSearchParams = await searchParams;

//   const query = resolvedSearchParams?.query || '';
//   const sort = resolvedSearchParams?.sort || 'desc';
//   const mantenimiento = resolvedSearchParams?.mantenimiento || '';
//   const paginaActual = Number(resolvedSearchParams?.page) || 1;
//   const offset = (paginaActual - 1) * ITEMS_POR_PAGINA;
//   const searchPattern = `%${query}%`;

//   // Consultas a la base de datos
//   const conteoResult = await sql`
//     SELECT COUNT(*) 
//     FROM reportes_alumbrado
//     WHERE (folio ILIKE ${searchPattern} OR sector ILIKE ${searchPattern} OR tramo ILIKE ${searchPattern})
//       AND (${mantenimiento} = '' OR tipo_mantenimiento = ${mantenimiento})
//   `;
  
//   const totalRegistros = Number(conteoResult.rows[0].count);
//   const totalPaginas = Math.ceil(totalRegistros / ITEMS_POR_PAGINA);

//   const result = await sql<ReporteAlumbrado>`
//     SELECT * FROM reportes_alumbrado 
//     WHERE (folio ILIKE ${searchPattern} OR sector ILIKE ${searchPattern} OR tramo ILIKE ${searchPattern})
//       AND (${mantenimiento} = '' OR tipo_mantenimiento = ${mantenimiento})
//     ORDER BY 
//       CASE WHEN ${sort} = 'asc' THEN fecha END ASC,
//       CASE WHEN ${sort} = 'desc' THEN fecha END DESC
//     LIMIT ${ITEMS_POR_PAGINA} OFFSET ${offset}
//   `;
//   const reportes = result.rows;

//   const getBadgeStyle = (tipo: string | null) => {
//     if (!tipo) return 'bg-gray-50 text-gray-400 border-gray-100 italic';
//     switch (tipo.toLowerCase()) {
//       case 'urgente': return 'bg-red-100 text-red-700 border-red-200';
//       case 'ordinario': return 'bg-blue-100 text-blue-700 border-blue-200';
//       case 'programable': return 'bg-amber-100 text-amber-700 border-amber-200';
//       default: return 'bg-gray-100 text-gray-600 border-gray-200';
//     }
//   };


//   // Mapeo de categoria (BD) → ruta real de la carpeta
// const rutaPorCategoria: Record<string, string> = {
//   'ALUMBRADO PÚBLICO': 'Alumbrado_publico',
//   'AREAS VERDES':      'Areas_verdes',
//    'BARRIDO VIALIDADES':      'Barrido_vialidades',
//     'LIMPIEZA URBANA':      'Limpieza_Urbana',
//   // agrega aquí las demás categorías que tengas
// };

// // Función helper
// const getRuta = (categoria: string) =>
//   rutaPorCategoria[categoria] ?? categoria;

//   return (
//     <main className="p-4 md:p-6 max-w-7xl mx-auto">
//       {/* --- FORMULARIO DE FILTROS --- */}
//       <form method="GET" className="mb-6 bg-white p-4 md:p-6 rounded-xl shadow-md border border-gray-100 flex flex-col lg:flex-row gap-4 items-end">
//         <div className="w-full flex-1">
//           <label className="text-[11px] uppercase font-bold text-slate-500 mb-1.5 block ml-1">Búsqueda General</label>
//           <div className="relative">
//             <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
//             <input
//               type="text"
//               name="query"
//               defaultValue={query}
//               placeholder="Folio, sector o tramo..."
//               className="w-full pl-10 pr-4 py-3 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition text-sm md:text-base"
//             />
//           </div>
//         </div>

//         <div className="w-full lg:w-48">
//           <label className="text-[11px] uppercase font-bold text-slate-500 mb-1.5 block ml-1">Mantenimiento</label>
//           <select
//             name="mantenimiento"
//             defaultValue={mantenimiento}
//             className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-sm md:text-base"
//           >
//             <option value="">Todos los registros</option>
//             <option value="Urgente">🚨 Urgente</option>
//             <option value="Ordinario">📋 Ordinario</option>
//             <option value="Programable">🗓️ Programable</option>
//           </select>
//         </div>

//         <div className="w-full lg:w-40">
//           <label className="text-[11px] uppercase font-bold text-slate-500 mb-1.5 block ml-1">Orden</label>
//           <select
//             name="sort"
//             defaultValue={sort}
//             className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-sm md:text-base"
//           >
//             <option value="desc">Recientes</option>
//             <option value="asc">Antiguos</option>
//           </select>
//         </div>

//         <button
//           type="submit"
//           className="w-full lg:w-auto px-8 py-3 md:py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-200 mt-2 lg:mt-0"
//         >
//           Aplicar
//         </button>
//         <BotonActualizar />
//       </form>

//       {/* --- LISTA DE RESULTADOS --- */}
//       <div className="bg-transparent md:bg-white rounded-none md:rounded-xl md:shadow-lg md:border md:border-gray-200 flex flex-col gap-4 md:gap-0">
//         <div className="hidden md:grid md:grid-cols-[1.5fr_1fr_2.5fr_0.5fr_1fr] gap-4 px-6 py-4 bg-slate-800 text-white uppercase text-[11px] tracking-wider rounded-t-xl">
//           <div>Folio / Fecha</div>
//           <div className="text-center">Tipo</div>
//           <div>Ubicación (Sector/Tramo)</div>
//           <div className="text-center">GPS</div>
//           <div className="text-right">Acciones</div>
//         </div>

//         <div className="flex flex-col gap-4 md:gap-0">
//           {reportes.map((reporte) => (
//             <div 
//               key={reporte.id} 
//               className="bg-white rounded-xl shadow-md border border-gray-200 p-4 md:p-0 md:rounded-none md:shadow-none md:border-x-0 md:border-t-0 md:border-b md:border-gray-100 md:grid md:grid-cols-[1.5fr_1fr_2.5fr_0.5fr_1fr] md:gap-4 md:items-center hover:bg-emerald-50/30 transition-colors group relative overflow-hidden"
//             >
//               {/* Folio y Fecha */}
//               <div className="flex justify-between items-start md:px-6 md:py-4 mb-3 md:mb-0 border-b border-gray-100 md:border-none pb-3 md:pb-0">
//                 <div>
//                   <div className="font-bold text-slate-800 text-base mb-0.5">{reporte.folio}</div>
//                   <div className="text-xs text-slate-400">
//                     {(() => {
//                       try {
//                         // 1. Convertimos a objeto Date (funciona si es string o Date)
//                         const d = new Date(reporte.fecha);

//                         // 2. Verificamos si la fecha es válida
//                         if (isNaN(d.getTime())) return 'Fecha no válida';

//                         // 3. Formateamos directamente
//                         return d.toLocaleString('es-MX', {
//                           timeZone: 'America/Mexico_City',
//                           day: '2-digit',
//                           month: '2-digit',
//                           year: 'numeric',
//                           hour: '2-digit',
//                           minute: '2-digit',
//                           hour12: true
//                         });
//                       } catch (e) {
//                         return 'Error en fecha';
//                       }
//                     })()}
//                   </div>
//                 </div>
//                 <div className="md:hidden">
//                   <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${getBadgeStyle(reporte.tipo_mantenimiento)}`}>
//                     {reporte.tipo_mantenimiento || 'N/A'}
//                   </span>
//                 </div>
//               </div>

//               {/* Badge Desktop */}
//               <div className="hidden md:block md:px-6 md:py-4 text-center">
//                 <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${getBadgeStyle(reporte.tipo_mantenimiento)}`}>
//                   {reporte.tipo_mantenimiento || 'N/A'}
//                 </span>
//               </div>

//               {/* Ubicación */}
//               <div className="mb-4 md:mb-0 md:px-6 md:py-4">
//                 <div className="text-[10px] uppercase font-bold text-slate-400 md:hidden mb-1">Sector/Tramo</div>
//                 <div className="text-slate-700 font-medium text-sm md:text-base">{reporte.sector}</div>
//                 <div className="text-xs text-slate-500">{reporte.tramo}</div>
//               </div>

//               {/* GPS y Acciones */}
//               <div className="flex justify-between items-center bg-gray-50 md:bg-transparent -mx-4 -mb-4 p-4 md:m-0 md:p-0 md:contents rounded-b-xl md:rounded-none border-t border-gray-100 md:border-none">
//                 <div className="md:px-6 md:py-4 md:text-center flex items-center gap-2">
//                   <span className="text-[10px] uppercase font-bold text-slate-400 md:hidden">GPS: </span>
//                   {reporte.latitud ? (
//                     <a
//                       href={`https://www.google.com/maps?q=${reporte.latitud},${reporte.longitud}`}
//                       target="_blank"
//                       rel="noreferrer"
//                       className="inline-flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
//                     >
//                       <FaMapMarkerAlt size={14} />
//                     </a>
//                   ) : (
//                     <span className="text-gray-400 italic text-xs bg-gray-100 px-2 py-1 rounded-md">Sin GPS</span>
//                   )}
//                 </div>

//                 <div className="flex gap-3 justify-end md:px-6 md:py-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
//                   <Link
//                     // Dinámicamente cambiamos la ruta basada en la categoría
//                     // Ejemplo: si categoria es 'barrido', irá a /dashboard/Barrido?editId=...
//                     href={`/dashboard/${getRuta(reporte.categoria)}?editId=${reporte.id}`}
//                     className="p-2 md:p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
//                     title="Editar"
//                   >
//                     <FaEdit size={16} />
//                   </Link>

//                   <form action={async () => {
//                     'use server';
//                     // Cambia reporte.id por reporte.id.toString()
//                     await eliminarReporte(reporte.id.toString());
//                   }}>
//                     <button type="submit" className="p-2 md:p-2.5 text-red-600 bg-red-50 hover:bg-red-100 md:bg-transparent md:hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
//                       <FaTrash size={16} />
//                     </button>
//                   </form>
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>

//         {/* --- ESTADO VACÍO --- */}
//         {reportes.length === 0 && (
//           <div className="py-20 text-center flex flex-col items-center bg-white md:bg-transparent rounded-xl shadow-sm border border-gray-200 md:border-none">
//             <FaSearch size={30} className="text-slate-300 mb-4" />
//             <p className="text-slate-500 font-medium px-4">No se encontraron reportes.</p>
//             <Link href="/dashboard/Historial" className="text-emerald-600 text-sm mt-2 underline">Limpiar filtros</Link>
//           </div>
//         )}

//         {/* --- PAGINACIÓN --- */}
//         {totalPaginas > 1 && (
//           <div className="px-4 md:px-6 py-4 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 md:mt-0 rounded-xl md:rounded-b-xl border border-gray-200 md:border-none">
//              <p className="text-sm text-slate-500">Página {paginaActual} de {totalPaginas}</p>
//              <div className="flex gap-2 w-full sm:w-auto">
//                 <Link
//                   href={`?query=${query}&sort=${sort}&mantenimiento=${mantenimiento}&page=${paginaActual - 1}`}
//                   className={`flex-1 sm:flex-none text-center px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
//                     paginaActual <= 1 ? 'bg-gray-200 text-gray-400 pointer-events-none' : 'bg-white border text-slate-700 hover:bg-gray-100 shadow-sm'
//                   }`}
//                 >
//                   Anterior
//                 </Link>
//                 <Link
//                   href={`?query=${query}&sort=${sort}&mantenimiento=${mantenimiento}&page=${paginaActual + 1}`}
//                   className={`flex-1 sm:flex-none text-center px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
//                     paginaActual >= totalPaginas ? 'bg-gray-200 text-gray-400 pointer-events-none' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
//                   }`}
//                 >
//                   Siguiente
//                 </Link>
//              </div>
//           </div>
//         )}
//       </div>
//     </main>
//   );
// }
