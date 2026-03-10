// app/dashboard/Areas_verdes/page.tsx
import { obtenerReportePorId } from '@/app/lib/actions';
import AreasVerdes from './AreasVerdes'; // ← importa el componente que moviste

interface PageProps {
  searchParams: Promise<{ editId?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { editId } = await searchParams;
  const reporteParaEditar = editId ? await obtenerReportePorId(editId) : null;

  return (
    <div className="p-4">
      <AreasVerdes
        key={editId ?? 'nuevo'}
        reportesIniciales={[]}
        reporteParaEditar={reporteParaEditar}
      />
    </div>
  );
}
