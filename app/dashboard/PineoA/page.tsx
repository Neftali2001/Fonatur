import { neon } from '@neondatabase/serverless';
import FormularioAlumbrado from './pineo';

async function getReportes() {
  try {
    const connectionString =
      process.env.POSTGRES_URL ??
      process.env.DATABASE_URL ??
      process.env.NEON_DATABASE_URL;

    if (!connectionString) {
      console.error('[PineoA] Variable de entorno de BD no encontrada');
      return [];
    }

    const sql = neon(connectionString);
    const rows = await sql`
      SELECT id, folio, sector, latitud::float, longitud::float
      FROM reportes_alumbrado
    `;
    return rows;
  } catch (error) {
    console.error('[PineoA] Error al obtener reportes:', error);
    return [];
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ editId?: string }>;
}) {
  const { editId } = await searchParams;
  const reportes = await getReportes();

  let reporteParaEditar = null;
  if (editId) {
    try {
      const connectionString =
        process.env.POSTGRES_URL ??
        process.env.DATABASE_URL ??
        process.env.NEON_DATABASE_URL;

      if (connectionString) {
        const sql = neon(connectionString);
        const rows = await sql`
          SELECT * FROM reportes_alumbrado WHERE id::text = ${editId}
        `;
        const row = rows[0];
        if (row) {
          reporteParaEditar = {
            ...row,
            checklist: typeof row.checklist === 'string'
              ? JSON.parse(row.checklist)
              : row.checklist,
            fotos: typeof row.fotos === 'string'
              ? JSON.parse(row.fotos)
              : (row.fotos ?? {}),
          };
        }
      }
    } catch (error) {
      console.error('[PineoA] Error al obtener reporte para editar:', error);
    }
  }

  return (
    <FormularioAlumbrado
      reportesIniciales={reportes as any[]}
      reporteParaEditar={reporteParaEditar}
    />
  );
}




// // app/dashboard/Alumbrado_publico/page.tsx
// import { sql } from '@vercel/postgres';
// import { obtenerReportePorId } from '@/app/lib/actions';
// import FormularioAlumbrado from './pineo';
// import PineoA from './pineo';

// interface PageProps {
//   searchParams: Promise<{ editId?: string }>;
// }

// async function getReportes() {
//   try {
//     const { rows } = await sql`
//       SELECT id, folio, sector, latitud::float, longitud::float 
//       FROM reportes_alumbrado
//     `;
//     return rows;
//   } catch (e) {
//     console.error("Error cargando DB:", e);
//     return [];
//   }
// }

// export default async function Page({ searchParams }: PageProps) {
//   const { editId } = await searchParams;

//   const [reportesPrevios, reporteParaEditar] = await Promise.all([
//     getReportes(),
//     editId ? obtenerReportePorId(editId) : Promise.resolve(null),
//   ]);

//   return (
//     <div className="p-4">
//       <PineoA
//          key={editId ?? 'nuevo'}  
//         reportesIniciales={reportesPrevios}
//         reporteParaEditar={reporteParaEditar}
//       />
//     </div>
//   );
// }
