// app/dashboard/Alumbrado_publico/page.tsx
import { sql } from '@vercel/postgres';
import { obtenerReportePorId } from '@/app/lib/actions';
import FormularioAlumbrado from './pineo';
import PineoA from './pineo';

interface PageProps {
  searchParams: Promise<{ editId?: string }>;
}

async function getReportes() {
  try {
    const { rows } = await sql`
      SELECT id, folio, sector, latitud::float, longitud::float 
      FROM reportes_alumbrado
    `;
    return rows;
  } catch (e) {
    console.error("Error cargando DB:", e);
    return [];
  }
}

export default async function Page({ searchParams }: PageProps) {
  const { editId } = await searchParams;

  const [reportesPrevios, reporteParaEditar] = await Promise.all([
    getReportes(),
    editId ? obtenerReportePorId(editId) : Promise.resolve(null),
  ]);

  return (
    <div className="p-4">
      <PineoA
         key={editId ?? 'nuevo'}  
        reportesIniciales={reportesPrevios}
        reporteParaEditar={reporteParaEditar}
      />
    </div>
  );
}
