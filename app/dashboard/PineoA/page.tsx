// // app/dashboard/PineoA/page.tsx
// import https from 'https';
// import FormularioAlumbrado from './pineo';

// // Mismo helper https nativo que en actions.ts
// function neonQuery(sql: string, params: any[] = []): Promise<any[]> {
//   return new Promise((resolve, reject) => {
//     const connStr =
//       process.env.POSTGRES_URL ??
//       process.env.DATABASE_URL ??
//       process.env.NEON_DATABASE_URL ?? '';

//     if (!connStr) {
//       reject(new Error('Variable de entorno de BD no encontrada'));
//       return;
//     }

//     // Extraer host y password de la connection string
//     // Formato: postgres://user:PASSWORD@host.neon.tech/dbname
//     let url: URL;
//     try {
//       url = new URL(connStr.replace(/^postgres(ql)?:\/\//, 'https://'));
//     } catch {
//       reject(new Error('Connection string inválida'));
//       return;
//     }
//     const host     = url.hostname;
//     const password = decodeURIComponent(url.password);  // Bearer token = password de Neon

//     const body = JSON.stringify({ query: sql, params });

//     const req = https.request({
//       hostname: host,
//       port: 443,
//       path: '/sql',
//       method: 'POST',
//       headers: {
//         'Content-Type':   'application/json',
//         'Authorization':  `Bearer ${password}`,   // ← Bearer, NO Basic
//         'Content-Length': Buffer.byteLength(body),
//       },
//       rejectUnauthorized: false,
//     }, res => {
//       let data = '';
//       res.on('data', c => { data += c; });
//       res.on('end', () => {
//         try {
//           const p = JSON.parse(data);
//           if (res.statusCode && res.statusCode >= 400) {
//             reject(new Error(`HTTP ${res.statusCode}: ${p?.message ?? data.slice(0, 200)}`));
//             return;
//           }
//           resolve(p.rows ?? []);
//         } catch {
//           reject(new Error(`Respuesta inválida: ${data.slice(0, 200)}`));
//         }
//       });
//     });

//     req.on('error', err => reject(err));
//     req.setTimeout(20_000, () => { req.destroy(); reject(new Error('Timeout (20s)')); });
//     req.write(body);
//     req.end();
//   });
// }

// async function getReportes() {
//   try {
//     return await neonQuery(
//       'SELECT id, folio, sector, latitud::float, longitud::float FROM reportes_alumbrado ORDER BY fecha DESC LIMIT 100'
//     );
//   } catch (e) {
//     console.error('[PineoA/page] getReportes:', e);
//     return [];
//   }
// }

// async function getReporteParaEditar(editId: string) {
//   try {
//     const rows = await neonQuery('SELECT * FROM reportes_alumbrado WHERE id::text = $1', [editId]);
//     const row  = rows[0];
//     if (!row) return null;
//     return {
//       ...row,
//       checklist: typeof row.checklist === 'string' ? JSON.parse(row.checklist) : row.checklist,
//       fotos:     typeof row.fotos     === 'string' ? JSON.parse(row.fotos)     : (row.fotos ?? {}),
//     };
//   } catch (e) {
//     console.error('[PineoA/page] getReporteParaEditar:', e);
//     return null;
//   }
// }

// export default async function Page({ searchParams }: { searchParams: Promise<{ editId?: string }> }) {
//   const { editId } = await searchParams;
//   const [reportes, reporteParaEditar] = await Promise.all([
//     getReportes(),
//     editId ? getReporteParaEditar(editId) : Promise.resolve(null),
//   ]);

//   return (
//     <FormularioAlumbrado
//       reportesIniciales={reportes as any[]}
//       reporteParaEditar={reporteParaEditar}
//     />
//   );
// }






// app/dashboard/PineoA/page.tsx
import FormularioAlumbrado from './pineo';

// Intenta conectar usando neon serverless con configuración SSL explícita
// que funciona en desarrollo local en Windows
async function getReportes() {
  try {
    // Intentamos con neon serverless primero
    const { neon, neonConfig } = await import('@neondatabase/serverless');

    // En Windows/dev local, deshabilitar el caché de conexión mejora la estabilidad
    neonConfig.fetchConnectionCache = false;

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
      ORDER BY fecha DESC
      LIMIT 100
    `;
    return rows;
  } catch (error) {
    // Si falla neon, intentamos con @vercel/postgres como fallback
    try {
      const { sql } = await import('@vercel/postgres');
      const { rows } = await sql`
        SELECT id, folio, sector, latitud::float, longitud::float
        FROM reportes_alumbrado
        ORDER BY fecha DESC
        LIMIT 100
      `;
      return rows;
    } catch (fallbackError) {
      // Si ambos fallan, loggeamos pero NO rompemos la página
      console.error('[PineoA] Error al obtener reportes (neon):', error);
      console.error('[PineoA] Error al obtener reportes (vercel):', fallbackError);
      return []; // ← retornamos lista vacía en lugar de crashear
    }
  }
}

async function getReporteParaEditar(editId: string) {
  if (!editId) return null;

  try {
    const { neon, neonConfig } = await import('@neondatabase/serverless');
    neonConfig.fetchConnectionCache = false;

    const connectionString =
      process.env.POSTGRES_URL ??
      process.env.DATABASE_URL ??
      process.env.NEON_DATABASE_URL;

    if (!connectionString) return null;

    const sql = neon(connectionString);
    const rows = await sql`
      SELECT * FROM reportes_alumbrado WHERE id::text = ${editId}
    `;

    const row = rows[0];
    if (!row) return null;

    return {
      ...row,
      checklist: typeof row.checklist === 'string'
        ? JSON.parse(row.checklist)
        : row.checklist,
      fotos: typeof row.fotos === 'string'
        ? JSON.parse(row.fotos)
        : (row.fotos ?? {}),
    };
  } catch (error) {
    // Fallback @vercel/postgres
    try {
      const { sql } = await import('@vercel/postgres');
      const { rows } = await sql`
        SELECT * FROM reportes_alumbrado WHERE id::text = ${editId}
      `;
      const row = rows[0];
      if (!row) return null;
      return {
        ...row,
        checklist: typeof row.checklist === 'string'
          ? JSON.parse(row.checklist)
          : row.checklist,
        fotos: typeof row.fotos === 'string'
          ? JSON.parse(row.fotos)
          : (row.fotos ?? {}),
      };
    } catch {
      console.error('[PineoA] Error al obtener reporte para editar:', error);
      return null;
    }
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ editId?: string }>;
}) {
  const { editId } = await searchParams;
  const [reportes, reporteParaEditar] = await Promise.all([
    getReportes(),
    editId ? getReporteParaEditar(editId) : Promise.resolve(null),
  ]);

  return (
    <FormularioAlumbrado
      reportesIniciales={reportes as any[]}
      reporteParaEditar={reporteParaEditar}
    />
  );
}




// import { neon } from '@neondatabase/serverless';
// import FormularioAlumbrado from './pineo';

// async function getReportes() {
//   try {
//     const connectionString =
//       process.env.POSTGRES_URL ??
//       process.env.DATABASE_URL ??
//       process.env.NEON_DATABASE_URL;

//     if (!connectionString) {
//       console.error('[PineoA] Variable de entorno de BD no encontrada');
//       return [];
//     }

//     const sql = neon(connectionString);
//     const rows = await sql`
//       SELECT id, folio, sector, latitud::float, longitud::float
//       FROM reportes_alumbrado
//     `;
//     return rows;
//   } catch (error) {
//     console.error('[PineoA] Error al obtener reportes:', error);
//     return [];
//   }
// }

// export default async function Page({
//   searchParams,
// }: {
//   searchParams: Promise<{ editId?: string }>;
// }) {
//   const { editId } = await searchParams;
//   const reportes = await getReportes();

//   let reporteParaEditar = null;
//   if (editId) {
//     try {
//       const connectionString =
//         process.env.POSTGRES_URL ??
//         process.env.DATABASE_URL ??
//         process.env.NEON_DATABASE_URL;

//       if (connectionString) {
//         const sql = neon(connectionString);
//         const rows = await sql`
//           SELECT * FROM reportes_alumbrado WHERE id::text = ${editId}
//         `;
//         const row = rows[0];
//         if (row) {
//           reporteParaEditar = {
//             ...row,
//             checklist: typeof row.checklist === 'string'
//               ? JSON.parse(row.checklist)
//               : row.checklist,
//             fotos: typeof row.fotos === 'string'
//               ? JSON.parse(row.fotos)
//               : (row.fotos ?? {}),
//           };
//         }
//       }
//     } catch (error) {
//       console.error('[PineoA] Error al obtener reporte para editar:', error);
//     }
//   }

//   return (
//     <FormularioAlumbrado
//       reportesIniciales={reportes as any[]}
//       reporteParaEditar={reporteParaEditar}
//     />
//   );
// }




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
