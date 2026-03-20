// 'use server';

// // Usamos 'pg' (node-postgres) directamente en Server Actions.
// // Funciona tanto en local (Windows) como en Vercel producción
// // porque usa TCP en lugar de fetch HTTP.
// // pg se importa dinámicamente en query() para compatibilidad con Turbopack
// import { revalidatePath } from 'next/cache';
// import { put, del } from '@vercel/blob';

// function getConnectionString(): string {
//   const conn =
//     process.env.POSTGRES_URL ??
//     process.env.DATABASE_URL ??
//     process.env.NEON_DATABASE_URL;
//   if (!conn) throw new Error('Variable de entorno de BD no encontrada');
//   return conn;
// }

// // Cliente por request — evita problemas con HMR de Turbopack
// async function query(text: string, params: any[] = []) {
//   const { Client } = await import('pg');
//   const client = new Client({
//     connectionString: getConnectionString(),
//     ssl: { rejectUnauthorized: false },
//     connectionTimeoutMillis: 15_000,
//     query_timeout: 30_000,
//   });
//   await client.connect();
//   try {
//     const result = await client.query(text, params);
//     return result.rows;
//   } finally {
//     await client.end().catch(() => {});
//   }
// }

// // ── crearReporte ───────────────────────────────────────────────────────────
// export async function crearReporte(
//   formData: any,
//   checklist: any,
//   gps: any,
//   fotos: Record<string, string | null>
// ): Promise<string> {
//   const ahora   = new Date();
//   const fechaMX = ahora.toLocaleDateString('es-MX', {
//     timeZone: 'America/Mexico_City',
//     year: 'numeric', month: '2-digit', day: '2-digit',
//   });
//   const [dia, mes, anio] = fechaMX.split('/');
//   const random  = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
//   const folio   = `REV-${anio}-${mes}-${dia}-${random}`;

//   const sectorFinal       = formData.sector === 'Otro' ? formData.sectorPersonalizado : formData.sector;
//   const tramoFinal        = formData.sector === 'Otro' ? formData.tramoPersonalizado  : formData.Tramo;
//   const tipoMantenimiento = formData.tipoMantenimiento || 'Ordinario';
//   const latitud           = gps?.lat ? parseFloat(gps.lat) : null;
//   const longitud          = gps?.lon ? parseFloat(gps.lon) : null;
//   const categoria         = formData.categoria || 'General';

//   try {
//     const rows = await query(
//       `INSERT INTO reportes_alumbrado
//          (folio, sector, tramo, acceso_publico, tipo_mantenimiento,
//           latitud, longitud, checklist, fecha, categoria, fotos)
//        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,$10)
//        RETURNING id`,
//       [
//         folio,
//         sectorFinal   ?? '',
//         tramoFinal    ?? '',
//         formData.accesoPublico || '',
//         tipoMantenimiento,
//         latitud,
//         longitud,
//         JSON.stringify(checklist),
//         categoria,
//         JSON.stringify(fotos ?? {}),
//       ]
//     );
//     revalidatePath('/dashboard/Historial');
//     return rows[0].id.toString();
//   } catch (error: any) {
//     // Captura agresiva — el objeto error puede ser de cualquier tipo
//     const msg = error?.message || error?.detail || error?.hint
//       || (typeof error === 'string' ? error : null)
//       || JSON.stringify(error)
//       || 'Error desconocido';
//     console.error('[crearReporte] ERROR COMPLETO:', error);
//     console.error('[crearReporte] Mensaje:', msg);
//     throw new Error(`Fallo al crear el reporte: ${msg}`);
//   }
// }

// // ── actualizarReporte ──────────────────────────────────────────────────────
// export async function actualizarReporte(
//   id: string,
//   formData: any,
//   checklist: any,
//   gps: any,
//   fotos?: Record<string, string | null>
// ): Promise<string> {
//   const sectorFinal       = formData.sector === 'Otro' ? formData.sectorPersonalizado : formData.sector;
//   const tramoFinal        = formData.sector === 'Otro' ? formData.tramoPersonalizado  : formData.Tramo;
//   const tipoMantenimiento = formData.tipoMantenimiento || 'Ordinario';
//   const latitud           = gps?.lat ? parseFloat(gps.lat) : null;
//   const longitud          = gps?.lon ? parseFloat(gps.lon) : null;
//   const categoria         = formData.categoria || 'General';

//   try {
//     await query(
//       `UPDATE reportes_alumbrado SET
//          sector             = $1,
//          tramo              = $2,
//          acceso_publico     = $3,
//          tipo_mantenimiento = $4,
//          latitud            = $5,
//          longitud           = $6,
//          checklist          = $7,
//          categoria          = $8,
//          fotos              = $9
//        WHERE id = $10`,
//       [
//         sectorFinal  ?? '',
//         tramoFinal   ?? '',
//         formData.accesoPublico || '',
//         tipoMantenimiento,
//         latitud,
//         longitud,
//         JSON.stringify(checklist),
//         categoria,
//         JSON.stringify(fotos ?? {}),
//         id,
//       ]
//     );
//     revalidatePath('/dashboard/Historial');
//     return id;
//   } catch (error: any) {
//     console.error('[actualizarReporte] Error:', error?.message ?? error);
//     throw new Error(`Fallo al actualizar el reporte: ${error?.message ?? error}`);
//   }
// }

// // ── obtenerReportePorId ────────────────────────────────────────────────────
// export async function obtenerReportePorId(id: string) {
//   try {
//     const rows = await query(
//       'SELECT * FROM reportes_alumbrado WHERE id::text = $1',
//       [id]
//     );
//     const row = rows[0];
//     if (!row) return null;
//     return {
//       ...row,
//       checklist: typeof row.checklist === 'string' ? JSON.parse(row.checklist) : row.checklist,
//       fotos:     typeof row.fotos     === 'string' ? JSON.parse(row.fotos)     : (row.fotos ?? {}),
//     };
//   } catch (error: any) {
//     console.error('[obtenerReportePorId] Error:', error?.message ?? error);
//     throw new Error('Fallo al obtener el reporte.');
//   }
// }

// // ── eliminarReporte ────────────────────────────────────────────────────────
// export async function eliminarReporte(id: string) {
//   try {
//     await query('DELETE FROM reportes_alumbrado WHERE id = $1', [id]);
//     revalidatePath('/dashboard/Historial');
//   } catch (error: any) {
//     console.error('[eliminarReporte] Error:', error?.message ?? error);
//     throw new Error('Fallo al eliminar el reporte.');
//   }
// }

// // ── guardarPDFEnReportes ───────────────────────────────────────────────────
// export async function guardarPDFEnReportes(ids: string[], pdfBase64: string): Promise<void> {
//   if (!ids.length || !pdfBase64) return;
//   try {
//     await Promise.all(
//       ids.map(id =>
//         query('UPDATE reportes_alumbrado SET pdf_base64 = $1 WHERE id = $2', [pdfBase64, id])
//       )
//     );
//     revalidatePath('/dashboard/Historial');
//   } catch (error: any) {
//     console.error('[guardarPDFEnReportes] Error:', error?.message ?? error);
//   }
// }

// // ── Vercel Blob (sin cambios) ──────────────────────────────────────────────
// export async function subirFoto(formData: FormData) {
//   const file = formData.get('file') as File;
//   const blob = await put(file.name, file, { access: 'public', addRandomSuffix: true });
//   return blob.url;
// }

// export async function eliminarFoto(url: string) {
//   await del(url);
// }



'use server';

import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { put, del } from '@vercel/blob';


// ── FIX: retorna Promise<string> con el id del registro creado ─────────────
export async function crearReporte(
  formData: any,
  checklist: any,
  gps: any,
  fotos: Record<string, string | null>
): Promise<string> {

  const ahora = new Date();
  const fechaMX = ahora.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const [dia, mes, anio] = fechaMX.split('/');
  const fechaParaFolio = `${anio}-${mes}-${dia}`;
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const folio = `REV-${fechaParaFolio}-${random}`;

  const sectorFinal = formData.sector === 'Otro' ? formData.sectorPersonalizado : formData.sector;
  const tramoFinal  = formData.sector === 'Otro' ? formData.tramoPersonalizado  : formData.Tramo;
  const tipoMantenimiento = formData.tipoMantenimiento || 'Ordinario';
  const latitud  = gps?.lat ? parseFloat(gps.lat) : null;
  const longitud = gps?.lon ? parseFloat(gps.lon) : null;
  const categoria = formData.categoria || 'General';

  try {
    const result = await sql`
      INSERT INTO reportes_alumbrado (
        folio, sector, tramo, acceso_publico, tipo_mantenimiento,
        latitud, longitud, checklist, fecha, categoria, fotos
      )
      VALUES (
        ${folio},
        ${sectorFinal ?? ''},
        ${tramoFinal ?? ''},
        ${formData.accesoPublico || ''},
        ${tipoMantenimiento},
        ${latitud},
        ${longitud},
        ${JSON.stringify(checklist)},
        NOW(),
        ${categoria},
        ${JSON.stringify(fotos ?? '')}
      )
      RETURNING id
    `;
    revalidatePath('/dashboard/Historial');
    return result.rows[0].id.toString();
  } catch (error) {
    console.error('Error al guardar en BD:', error);
    throw new Error('Fallo al crear el reporte.');
  }
}


// ── FIX: retorna Promise<string> con el mismo id recibido ──────────────────
export async function actualizarReporte(
  id: string,
  formData: any,
  checklist: any,
  gps: any,
  fotos?: Record<string, string | null>
): Promise<string> {

  const sectorFinal = formData.sector === 'Otro' ? formData.sectorPersonalizado : formData.sector;
  const tramoFinal  = formData.sector === 'Otro' ? formData.tramoPersonalizado  : formData.Tramo;
  const tipoMantenimiento = formData.tipoMantenimiento || 'Ordinario';
  const latitud  = gps?.lat ? parseFloat(gps.lat) : null;
  const longitud = gps?.lon ? parseFloat(gps.lon) : null;
  const categoria = formData.categoria || 'General';

  try {
    await sql`
      UPDATE reportes_alumbrado
      SET
        sector             = ${sectorFinal ?? ''},
        tramo              = ${tramoFinal ?? ''},
        acceso_publico     = ${formData.accesoPublico || ''},
        tipo_mantenimiento = ${tipoMantenimiento},
        latitud            = ${latitud},
        longitud           = ${longitud},
        checklist          = ${JSON.stringify(checklist)},
        categoria          = ${categoria},
        fotos              = ${JSON.stringify(fotos ?? {})}
      WHERE id = ${id}
    `;
    revalidatePath('/dashboard/Historial');
    return id;
  } catch (error) {
    console.error('Error al actualizar en BD:', error);
    throw new Error('Fallo al actualizar el reporte.');
  }
}


export async function obtenerReportePorId(id: string) {
  try {
    const data = await sql`
      SELECT *, checklist::text as checklist_raw  
      FROM reportes_alumbrado 
      WHERE id::text = ${id}
    `;
    const row = data.rows[0];
    if (!row) return null;
    return {
      ...row,
      checklist: typeof row.checklist === 'string' ? JSON.parse(row.checklist) : row.checklist,
      fotos:     typeof row.fotos === 'string'     ? JSON.parse(row.fotos)     : (row.fotos ?? {}),
    };
  } catch (error) {
    console.error('Error al obtener reporte:', error);
    throw new Error('Fallo al obtener los datos del reporte.');
  }
}

export async function eliminarReporte(id: string) {
  try {
    await sql`DELETE FROM reportes_alumbrado WHERE id = ${id}`;
    revalidatePath('/dashboard/Historial');
  } catch (error) {
    console.error('Error al eliminar:', error);
    throw new Error('Fallo al eliminar el reporte.');
  }
}

export async function subirFoto(formData: FormData) {
  const file = formData.get('file') as File;
  const blob = await put(file.name, file, { access: 'public', addRandomSuffix: true });
  return blob.url;
}

export async function eliminarFoto(url: string) {
  await del(url);
}

export async function guardarPDFEnReportes(ids: string[], pdfBase64: string): Promise<void> {
  if (!ids.length || !pdfBase64) return;
  await Promise.all(
    ids.map(id => sql`UPDATE reportes_alumbrado SET pdf_base64 = ${pdfBase64} WHERE id = ${id}`)
  );
  revalidatePath('/dashboard/Historial');
}




// 'use server';

// import { sql } from '@vercel/postgres';
// import { revalidatePath } from 'next/cache';
// import { put, del } from '@vercel/blob';


// export async function crearReporte(formData: any, checklist: any, gps: any, fotos: Record<string, string | null>) {
  
  
//   const ahora = new Date();
  
//   const fechaMX = ahora.toLocaleDateString('es-MX', {
//     timeZone: 'America/Mexico_City',
//     year: 'numeric',
//     month: '2-digit',
//     day: '2-digit',
//   });

//   const [dia, mes, anio] = fechaMX.split('/');
//   const fechaParaFolio = `${anio}-${mes}-${dia}`;

//   const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
//   const folio = `REV-${fechaParaFolio}-${random}`;

//   const sectorFinal = formData.sector === 'Otro' 
//     ? formData.sectorPersonalizado 
//     : formData.sector;
    
//   const tramoFinal = formData.sector === 'Otro' 
//     ? formData.tramoPersonalizado 
//     : formData.Tramo;

//   const tipoMantenimiento = formData.tipoMantenimiento || 'Ordinario';
//   const latitud  = gps?.lat ? parseFloat(gps.lat) : null;
//   const longitud = gps?.lon ? parseFloat(gps.lon) : null;
  

//   // ✅ Se lee desde formData; si no viene, usa 'General' como fallback
//   const categoria = formData.categoria || 'General';

//   try {
//     await sql`
//       INSERT INTO reportes_alumbrado (
//         folio, 
//         sector, 
//         tramo, 
//         acceso_publico, 
//         tipo_mantenimiento, 
//         latitud, 
//         longitud, 
//         checklist, 
//         fecha,
//         categoria,
//         fotos
//       )
//       VALUES (
//         ${folio}, 
//         ${sectorFinal ?? ''}, 
//         ${tramoFinal ?? ''}, 
//         ${formData.accesoPublico || ''}, 
//         ${tipoMantenimiento}, 
//         ${latitud}, 
//         ${longitud}, 
//         ${JSON.stringify(checklist)},
//         NOW(),
//         ${categoria},
//         ${JSON.stringify(fotos ??'' )}
//       )
//     `;
//   } catch (error) {
//     console.error('Error al guardar en BD:', error);
//     throw new Error('Fallo al crear el reporte.');
//   }

//   revalidatePath('/dashboard/Historial');
// }

// export async function actualizarReporte(id: string, formData: any, checklist: any, gps: any, fotos?: Record<string, string | null>) {
//   const sectorFinal = formData.sector === 'Otro'
//     ? formData.sectorPersonalizado
//     : formData.sector;

//   const tramoFinal = formData.sector === 'Otro'
//     ? formData.tramoPersonalizado
//     : formData.Tramo;

//   const tipoMantenimiento = formData.tipoMantenimiento || 'Ordinario';
//   const latitud  = gps?.lat ? parseFloat(gps.lat) : null;
//   const longitud = gps?.lon ? parseFloat(gps.lon) : null;
//   const categoria = formData.categoria || 'General'; // ← también actualiza categoría

//   try {
//     await sql`
//       UPDATE reportes_alumbrado
//       SET
//         sector             = ${sectorFinal ?? ''},
//         tramo              = ${tramoFinal ?? ''},
//         acceso_publico     = ${formData.accesoPublico || ''},
//         tipo_mantenimiento = ${tipoMantenimiento},
//         latitud            = ${latitud},
//         longitud           = ${longitud},
//         checklist          = ${JSON.stringify(checklist)},
//         categoria          = ${categoria},
//         fotos              = ${JSON.stringify(fotos ?? {})}

//       WHERE id = ${id}
//     `;
//   } catch (error) {
//     console.error('Error al actualizar en BD:', error);
//     throw new Error('Fallo al actualizar el reporte.');
//   }

//   revalidatePath('/dashboard/Historial');
// }

// export async function obtenerReportePorId(id: string) {
//   try {
//     const data = await sql`
//       SELECT *, checklist::text as checklist_raw  
//       FROM reportes_alumbrado 
//       WHERE id::text = ${id}
//     `;
//     const row = data.rows[0];
//     if (!row) return null;
    
//     return {
//       ...row,
//       checklist: typeof row.checklist === 'string' 
//         ? JSON.parse(row.checklist) 
//         : row.checklist,
//         fotos: typeof row.fotos === 'string'      // ← NUEVO
//     ? JSON.parse(row.fotos)
//     : (row.fotos ?? {}),
 
//     };
//   } catch (error) {
//     console.error('Error al obtener reporte:', error);
//     throw new Error('Fallo al obtener los datos del reporte.');
//   }
// }

// export async function eliminarReporte(id: string) {
//   try {
//     await sql`DELETE FROM reportes_alumbrado WHERE id = ${id}`;
//     revalidatePath('/dashboard/Historial');
//   } catch (error) {
//     console.error('Error al eliminar:', error);
//     throw new Error('Fallo al eliminar el reporte.');
//   }
// }

// export async function subirFoto(formData: FormData) {
//   const file = formData.get('file') as File;
//   const blob = await put(file.name, file, {
//     access: 'public',
//     addRandomSuffix: true, // evita colisiones de nombres
//   });
//   return blob.url; // ← solo guardas esta URL
// }

// export async function eliminarFoto(url: string) {
//   await del(url);
// }

// export async function guardarPDFEnReportes(ids: string[], pdfBase64: string): Promise<void> {
//   if (!ids.length || !pdfBase64) return;

//   // Actualizamos cada reporte en paralelo
//   await Promise.all(
//     ids.map(id =>
//       sql`
//         UPDATE reportes_alumbrado
//         SET pdf_base64 = ${pdfBase64}
//         WHERE id = ${id}
//       `
//     )
//   );

//   revalidatePath('/dashboard/Historial');
// }


// 'use server';

// import { sql } from '@vercel/postgres';
// import { revalidatePath } from 'next/cache';

// export async function crearReporte(formData: any, checklist: any, gps: any) {
  
//   // ✅ FIX 1: Fecha en formato correcto
//   const ahora = new Date();
  
//   const fechaMX = ahora.toLocaleDateString('es-MX', {
//     timeZone: 'America/Mexico_City',
//     year: 'numeric',
//     month: '2-digit',
//     day: '2-digit',
//   });

//   const [dia, mes, anio] = fechaMX.split('/');
//   const fechaParaFolio = `${anio}-${mes}-${dia}`;

//   const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
//   const folio = `REV-${fechaParaFolio}-${random}`;

//   const sectorFinal = formData.sector === 'Otro' 
//     ? formData.sectorPersonalizado 
//     : formData.sector;
    
//   const tramoFinal = formData.sector === 'Otro' 
//     ? formData.tramoPersonalizado 
//     : formData.Tramo;

//   // ✅ Extraemos el nuevo campo de tipo de mantenimiento
//   const tipoMantenimiento = formData.tipoMantenimiento || 'Ordinario';

//   const latitud  = gps?.lat ? parseFloat(gps.lat) : null;
//   const longitud = gps?.lon ? parseFloat(gps.lon) : null;

//   try {
//     await sql`
//       INSERT INTO reportes_alumbrado (
//         folio, 
//         sector, 
//         tramo, 
//         acceso_publico, 
//         tipo_mantenimiento, -- 👈 1. Agregamos la columna
//         latitud, 
//         longitud, 
//         checklist, 
//         fecha
//       )
//       VALUES (
//         ${folio}, 
//         ${sectorFinal ?? ''}, 
//         ${tramoFinal ?? ''}, 
//         ${formData.accesoPublico || ''}, 
//         ${tipoMantenimiento}, -- 👈 2. Agregamos el valor
//         ${latitud}, 
//         ${longitud}, 
//         ${JSON.stringify(checklist)},
//         NOW()
//       )
//     `;
//   } catch (error) {
//     console.error('Error al guardar en BD:', error);
//     throw new Error('Fallo al crear el reporte.');
//   }

//   revalidatePath('/dashboard/Historial');
// }

// // ... resto de funciones (eliminarReporte) se mantienen igual

// export async function eliminarReporte(id: string) {
//   try {
//     await sql`DELETE FROM reportes_alumbrado WHERE id = ${id}`;
//     revalidatePath('/dashboard/Historial');
//   } catch (error) {
//     console.error('Error al eliminar:', error);
//     throw new Error('Fallo al eliminar el reporte.');
//   }
// }





// // 'use server';

// // import { sql } from '@vercel/postgres';
// // import { revalidatePath } from 'next/cache';
// // import { redirect } from 'next/navigation';

// // export async function crearReporte(formData: any, checklist: any, gps: any) {
// //   // Generamos un folio único
// //   const folio = `REV-${new Date().toISOString().split('T')[0]}-${Math.floor(Math.random() * 1000)}`;
  
// //   // Procesamos datos
// //   const sectorFinal = formData.sector === 'Otro' ? formData.sectorPersonalizado : formData.sector;
// //   const tramoFinal = formData.sector === 'Otro' ? formData.tramoPersonalizado : formData.Tramo;
  
// //   try {
// //     await sql`
// //       INSERT INTO reportes_alumbrado (folio, sector, tramo, acceso_publico, latitud, longitud, checklist)
// //       VALUES (
// //         ${folio}, 
// //         ${sectorFinal}, 
// //         ${tramoFinal}, 
// //         ${formData.accesoPublico || ''}, 
// //         ${gps.lat ? parseFloat(gps.lat) : null}, 
// //         ${gps.lon ? parseFloat(gps.lon) : null}, 
// //         ${JSON.stringify(checklist)}
// //       )
// //     `;
// //   } catch (error) {
// //     console.error('Error al guardar en BD:', error);
// //     throw new Error('Fallo al crear el reporte.');
// //   }

// //   // Refresca la página del historial para que muestre el nuevo dato
// //   revalidatePath('/dashboard/Historial');
// // }

// // export async function eliminarReporte(id: string) {
// //   try {
// //     await sql`DELETE FROM reportes_alumbrado WHERE id = ${id}`;
// //     revalidatePath('/dashboard/Historial');
// //   } catch (error) {
// //     console.error('Error al eliminar:', error);
// //     throw new Error('Fallo al eliminar el reporte.');
// //   }
// // }