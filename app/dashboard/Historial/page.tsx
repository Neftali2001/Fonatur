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
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-emerald-800">Historial de Reportes</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-800 text-white uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Sector / Tramo</th>
              <th className="px-4 py-3 text-center">Ubicación</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {reportes.map((reporte) => (
              <tr key={reporte.id} className="hover:bg-slate-50 transition">
                <td className="px-4 py-3 font-semibold text-slate-700">{reporte.folio}</td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(reporte.fecha).toLocaleDateString('es-MX')}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {reporte.sector} <br/> 
                  <span className="text-xs text-slate-400">{reporte.tramo}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  {reporte.latitud ? (
                    <a 
                      href={`https://www.google.com/maps?q=${reporte.latitud},${reporte.longitud}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-emerald-600 hover:text-emerald-800 flex justify-center"
                    >
                      <FaMapMarkerAlt size={18} />
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">Sin GPS</span>
                  )}
                </td>
                <td className="px-4 py-3 flex justify-center gap-3">
                  {/* Botón de Editar (Te guiaré después con este) */}
                  <button className="text-blue-500 hover:text-blue-700 transition">
                    <FaEdit size={18} />
                  </button>
                  
                  {/* Botón de Eliminar usando un form con Server Action */}
                  <form action={async () => {
                    'use server';
                    await eliminarReporte(reporte.id);
                  }}>
                    <button type="submit" className="text-red-500 hover:text-red-700 transition">
                      <FaTrash size={18} />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            
            {reportes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
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