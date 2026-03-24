// app/dashboard/Areas_verdes/page.tsx
// import { obtenerReportePorId } from '@/app/lib/actions';
import { obtenerReporteConEvidencias } from '@/app/lib/actions';
import MobiliarioUrbano from './MobiliarioUrbano'; // ← importa el componente que moviste

interface PageProps {
  searchParams: Promise<{ editId?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { editId } = await searchParams;
  // const reporteParaEditar = editId ? await obtenerReportePorId(editId) : null;
    const reporteParaEditar = editId ? await obtenerReporteConEvidencias(editId) : null;


  return (
    <div className="p-4">
      <MobiliarioUrbano
        key={editId ?? 'nuevo'}
        reportesIniciales={[]}
        reporteParaEditar={reporteParaEditar}
      />
    </div>
  );
}
