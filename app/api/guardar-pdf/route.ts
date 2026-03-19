// app/api/guardar-pdf/route.ts
import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

const MAX_B64_BYTES = 4 * 1024 * 1024; // 4 MB en base64

export async function POST(req: NextRequest) {
  console.log('[guardar-pdf] ▶ POST recibido');

  try {
    const { ids, pdfBase64 } = await req.json() as { ids: string[]; pdfBase64: string };

    console.log('[guardar-pdf] ids:', ids);
    console.log('[guardar-pdf] pdf size MB:', (pdfBase64?.length / 1024 / 1024).toFixed(2));

    if (!ids?.length || !pdfBase64) {
      return NextResponse.json({ error: 'Faltan ids o pdfBase64' }, { status: 400 });
    }

    // PDF demasiado grande — se descargó OK pero no se guarda en BD
    if (pdfBase64.length > MAX_B64_BYTES) {
      console.warn(`[guardar-pdf] PDF ${(pdfBase64.length / 1024 / 1024).toFixed(1)} MB > límite 4MB — omitiendo guardado`);
      return NextResponse.json({
        ok: false,
        motivo: 'pdf_demasiado_grande',
        tamano_mb: (pdfBase64.length / 1024 / 1024).toFixed(1),
      });
    }

    // Conexión directa con @neondatabase/serverless
    const connectionString =
      process.env.POSTGRES_URL ??
      process.env.DATABASE_URL ??
      process.env.NEON_DATABASE_URL;

    if (!connectionString) {
      console.error('[guardar-pdf] Variable de entorno de BD no encontrada');
      return NextResponse.json({ error: 'Sin conexión a BD' }, { status: 500 });
    }

    const sql = neon(connectionString);
    let actualizados = 0;

    for (const id of ids) {
      const res = await sql`
        UPDATE reportes_alumbrado
        SET pdf_base64 = ${pdfBase64}
        WHERE id = ${id}
        RETURNING id
      `;
      actualizados += res.length;
      console.log(`[guardar-pdf] id=${id} rowCount=${res.length}`);
    }

    console.log('[guardar-pdf] ✅ actualizados:', actualizados);
    revalidatePath('/dashboard/Historial');
    return NextResponse.json({ ok: true, actualizados });

  } catch (err) {
    console.error('[guardar-pdf] 💥', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}




// // app/api/guardar-pdf/route.ts
// import { sql } from '@vercel/postgres';
// import { NextRequest, NextResponse } from 'next/server';
// import { revalidatePath } from 'next/cache';

// export async function POST(req: NextRequest) {
//   console.log('[guardar-pdf] ▶ POST recibido');

//   try {
//     const body = await req.json() as { ids: string[]; pdfBase64: string };
//     const { ids, pdfBase64 } = body;

//     console.log('[guardar-pdf] ids recibidos:', ids);
//     console.log('[guardar-pdf] pdfBase64 length:', pdfBase64?.length ?? 'undefined');
//     console.log('[guardar-pdf] pdfBase64 inicio:', pdfBase64?.slice(0, 50));

//     if (!ids?.length) {
//       console.warn('[guardar-pdf] ❌ ids vacío o ausente');
//       return NextResponse.json({ error: 'Faltan ids' }, { status: 400 });
//     }
//     if (!pdfBase64) {
//       console.warn('[guardar-pdf] ❌ pdfBase64 ausente');
//       return NextResponse.json({ error: 'Falta pdfBase64' }, { status: 400 });
//     }

//     console.log('[guardar-pdf] ⏳ Ejecutando UPDATE en BD...');
//     const resultados = await Promise.all(
//       ids.map(async id => {
//         console.log(`[guardar-pdf]   UPDATE id=${id}`);
//         const res = await sql`
//           UPDATE reportes_alumbrado
//           SET pdf_base64 = ${pdfBase64}
//           WHERE id = ${id}
//           RETURNING id
//         `;
//         console.log(`[guardar-pdf]   rowCount para id=${id}:`, res.rowCount);
//         return res;
//       })
//     );

//     const actualizados = resultados.reduce((sum, r) => sum + (r.rowCount ?? 0), 0);
//     console.log('[guardar-pdf] ✅ Filas actualizadas en total:', actualizados);

//     if (actualizados === 0) {
//       console.warn('[guardar-pdf] ⚠️ No se actualizó ninguna fila — ¿los IDs existen en la tabla?');
//     }

//     revalidatePath('/dashboard/Historial');
//     return NextResponse.json({ ok: true, actualizados });

//   } catch (err) {
//     console.error('[guardar-pdf] 💥 Error:', err);
//     return NextResponse.json({ error: String(err) }, { status: 500 });
//   }
// }
