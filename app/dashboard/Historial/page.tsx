import { sql } from '@vercel/postgres';
import { FaTrash, FaEdit, FaMapMarkerAlt } from 'react-icons/fa';
import { eliminarReporte } from '@/app/lib/actions';

export default async function HistorialPage() {
  // Obtenemos los datos de Neon
  const { rows: reportes } = await sql`
    SELECT * FROM reportes_alumbrado 
    ORDER BY fecha DESC
  `;

  return (
    <main className="p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-emerald-800">Historial de Reportes</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Cambiamos la tabla a block en móviles y table en escritorio */}
        <table className="w-full text-sm text-left block md:table">
          
          {/* Ocultamos el encabezado tradicional en móviles */}
          <thead className="hidden md:table-header-group bg-slate-800 text-white uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Sector / Tramo</th>
              <th className="px-4 py-3 text-center">Ubicación</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          
          <tbody className="block md:table-row-group divide-y divide-gray-200">
            {reportes.map((reporte) => (
              /* En móviles, cada fila es un bloque (tarjeta) con algo de padding. En escritorio, es una fila normal */
              <tr key={reporte.id} className="block md:table-row p-4 md:p-0 hover:bg-slate-50 transition">
                
                {/* Columna: Folio */}
                <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-2 md:mb-0">
                  <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Folio</span>
                  <span className="font-semibold text-slate-700">{reporte.folio}</span>
                </td>
                
                {/* Columna: Fecha */}
                <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-2 md:mb-0 text-slate-500">
                  <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Fecha</span>
                  {new Date(reporte.fecha).toLocaleDateString('es-MX')}
                </td>
                
                {/* Columna: Sector/Tramo */}
                <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-2 md:mb-0 text-slate-600 text-right md:text-left">
                  <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Sector</span>
                  <div>
                    {reporte.sector} <br className="hidden md:block"/> 
                    <span className="text-xs text-slate-400">{reporte.tramo}</span>
                  </div>
                </td>
                
                {/* Columna: Ubicación */}
                <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 mb-4 md:mb-0">
                  <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Ubicación</span>
                  <div className="flex md:justify-center">
                    {reporte.latitud ? (
                      <a 
                        href={`https://maps.google.com/?q=${reporte.latitud},${reporte.longitud}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-emerald-600 hover:text-emerald-800 flex items-center gap-2 bg-emerald-50 md:bg-transparent px-3 py-1 md:p-0 rounded-full transition"
                      >
                        <FaMapMarkerAlt size={18} />
                        <span className="md:hidden text-xs font-semibold">Ver Mapa</span>
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full md:bg-transparent">Sin GPS</span>
                    )}
                  </div>
                </td>
                
                {/* Columna: Acciones */}
                <td className="flex md:table-cell justify-between items-center md:px-4 md:py-3 pt-4 border-t border-gray-100 md:border-none">
                  <span className="text-xs font-bold text-slate-400 uppercase md:hidden">Acciones</span>
                  <div className="flex gap-4 justify-end md:justify-center">
                    <button className="text-blue-500 hover:text-blue-700 transition p-2 md:p-0 bg-blue-50 md:bg-transparent rounded-full">
                      <FaEdit size={18} />
                    </button>
                    
                    <form action={async () => {
                      'use server';
                      await eliminarReporte(reporte.id);
                    }}>
                      <button type="submit" className="text-red-500 hover:text-red-700 transition p-2 md:p-0 bg-red-50 md:bg-transparent rounded-full">
                        <FaTrash size={18} />
                      </button>
                    </form>
                  </div>
                </td>
                
              </tr>
            ))}
            
            {reportes.length === 0 && (
              <tr className="block md:table-row">
                <td colSpan={5} className="block md:table-cell px-4 py-8 text-center text-slate-500">
                  Aún no hay reportes guardados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}






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