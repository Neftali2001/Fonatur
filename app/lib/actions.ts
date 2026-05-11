'use server';

import sql from '@/app/lib/db'; // <--- Cambiado a tu conexión de Supabase/Postgres.js
import { revalidatePath } from 'next/cache';

// ── Tipos ──────────────────────────────────────────────────────────────────
interface GpsCoords {
  lat: string | null;
  lon: string | null;
  precision: string;
}

interface GeoRef {
  lat: string; lon: string; precision: string; timestamp: string;
}

interface EvidenceEntry {
  id: number;
  observation: string;
  geoRef: GeoRef | null;
  photo: string | null;
}

interface ChecklistItem {
  id: number;
  seccion?: string;
  pregunta: string;
  respuesta: string;
  observacion: string;
  geoRef?: GeoRef | null;
  evidence?: EvidenceEntry[];
}

interface FormData {
  sector:             string;
  Tramo:              string;
  accesoPublico?:     string;
  tipoMantenimiento: string;
  categoria:          string;
  subTipo?:           string;
  [key: string]:      any;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getEvidenceList(item: ChecklistItem): EvidenceEntry[] {
  if (Array.isArray(item.evidence) && item.evidence.length > 0) {
    return item.evidence.filter(e => e.observation || e.geoRef || e.photo);
  }
  const tieneAlgo = !!(item.observacion?.trim() || item.geoRef);
  if (!tieneAlgo) return [];
  return [{ id: 0, observation: item.observacion || '', geoRef: item.geoRef ?? null, photo: null }];
}

function generarFolio(categoria: string): string {
  const prefix = categoria.slice(0, 3).toUpperCase().replace(/\s/g, '');
  const fecha  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand   = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${fecha}-${rand}`;
}

function stripPhotosFromChecklist(checklist: ChecklistItem[]): ChecklistItem[] {
  return checklist.map(item => ({
    ...item,
    evidence: item.evidence?.map(ev => ({ ...ev, photo: null })) ?? [],
  }));
}

// ══════════════════════════════════════════════════════════════════════════
//  CREAR REPORTE
// ══════════════════════════════════════════════════════════════════════════
export async function crearReporte(
  formData: FormData,
  checklist: ChecklistItem[],
  gps: GpsCoords,
  fotos: { [key: string]: string | null }
): Promise<string> {

  const folio = generarFolio(formData.categoria);
  const checklistSinFotos = stripPhotosFromChecklist(checklist);

  const result = await sql`
    INSERT INTO reportes_alumbrado (
      folio,
      sector, tramo, acceso_publico,
      tipo_mantenimiento, categoria, sub_tipo,
      latitud, longitud,
      checklist, fotos
    ) VALUES (
      ${folio},
      ${formData.sector           ?? null},
      ${formData.Tramo            ?? null},
      ${formData.accesoPublico    ?? null},
      ${formData.tipoMantenimiento ?? null},
      ${formData.categoria        ?? 'ALUMBRADO PÚBLICO'},
      ${formData.subTipo          ?? null},
      ${gps.lat ? parseFloat(gps.lat) : null},
      ${gps.lon ? parseFloat(gps.lon) : null},
      ${JSON.stringify(checklistSinFotos)}::jsonb,
      ${JSON.stringify(fotos)}::jsonb
    )
    RETURNING id
  `;

  const reporteId = result[0].id; // <--- Sin .rows
  await insertarEvidencias(reporteId, checklist);
  return reporteId;
}

// ══════════════════════════════════════════════════════════════════════════
//  ACTUALIZAR REPORTE
// ══════════════════════════════════════════════════════════════════════════
export async function actualizarReporte(
  id: string,
  formData: FormData,
  checklist: ChecklistItem[],
  gps: GpsCoords,
  fotos: { [key: string]: string | null }
): Promise<string> {

  const checklistSinFotos = stripPhotosFromChecklist(checklist);

  await sql`
    UPDATE reportes_alumbrado SET
      sector             = ${formData.sector           ?? null},
      tramo              = ${formData.Tramo            ?? null},
      acceso_publico     = ${formData.accesoPublico    ?? null},
      tipo_mantenimiento = ${formData.tipoMantenimiento ?? null},
      categoria          = ${formData.categoria        ?? null},
      sub_tipo           = ${formData.subTipo          ?? null},
      latitud            = ${gps.lat ? parseFloat(gps.lat) : null},
      longitud           = ${gps.lon ? parseFloat(gps.lon) : null},
      checklist          = ${JSON.stringify(checklistSinFotos)}::jsonb,
      fotos              = ${JSON.stringify(fotos)}::jsonb
    WHERE id = ${id}::uuid
  `;

  await sql`DELETE FROM evidencias WHERE reporte_id = ${id}::uuid`;
  await insertarEvidencias(id, checklist);
  return id;
}

async function insertarEvidencias(reporteId: string, checklist: ChecklistItem[]) {
  for (const item of checklist) {
    const evidences = getEvidenceList(item);
    for (let i = 0; i < evidences.length; i++) {
      const ev = evidences[i];
      const fotoValida = ev.photo?.startsWith('data:image/') ? ev.photo : null;

      await sql`
        INSERT INTO evidencias (
          reporte_id, item_id, item_pregunta, item_seccion,
          evidencia_num, observacion,
          lat, lon, precision_gps, timestamp_gps,
          foto
        ) VALUES (
          ${reporteId}::uuid,
          ${item.id},
          ${item.pregunta},
          ${item.seccion ?? null},
          ${i + 1},
          ${ev.observation || null},
          ${ev.geoRef?.lat ? parseFloat(ev.geoRef.lat) : null},
          ${ev.geoRef?.lon ? parseFloat(ev.geoRef.lon) : null},
          ${ev.geoRef?.precision ?? null},
          ${ev.geoRef?.timestamp ?? null},
          ${fotoValida}
        )
      `;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  HISTORIAL / OBTENER REPORTES
// ══════════════════════════════════════════════════════════════════════════
export async function obtenerReportes() {
  const result = await sql`
    SELECT id, folio, categoria, sub_tipo, sector, tramo, acceso_publico,
           tipo_mantenimiento, latitud, longitud, fecha
    FROM reportes_alumbrado
    ORDER BY fecha DESC
    LIMIT 200
  `;
  return result; // <--- Sin .rows
}

export async function obtenerReporteConEvidencias(id: string) {
  const [reporteResult, evidenciasResult] = await Promise.all([
    sql`SELECT * FROM reportes_alumbrado WHERE id = ${id}::uuid`,
    sql`SELECT * FROM evidencias WHERE reporte_id = ${id}::uuid ORDER BY item_id, evidencia_num`,
  ]);

  if (reporteResult.length === 0) return null;

  const r = reporteResult[0];
  const checklistBase: ChecklistItem[] = r.checklist ?? [];
  const evMap = new Map<number, EvidenceEntry[]>();

  for (const ev of evidenciasResult) {
    if (!evMap.has(ev.item_id)) evMap.set(ev.item_id, []);
    evMap.get(ev.item_id)!.push({
      id:          ev.id,
      observation: ev.observacion ?? '',
      photo:       ev.foto        ?? null,
      geoRef: ev.lat ? {
        lat:       String(ev.lat),
        lon:       String(ev.lon),
        precision: ev.precision_gps ?? '--',
        timestamp: ev.timestamp_gps ?? '',
      } : null,
    });
  }

  const checklistHidratado = checklistBase.map((item: ChecklistItem) => ({
    ...item,
    evidence: evMap.get(item.id) ?? [{ id: Date.now(), observation: '', geoRef: null, photo: null }],
  }));

  return { ...r, checklist: checklistHidratado };
}

export async function eliminarReporte(id: string): Promise<void> {
  await sql`DELETE FROM reportes_alumbrado WHERE id = ${id}::uuid`;
  revalidatePath('/dashboard/Historial');
}

export async function obtenerFechasConConteo(): Promise<{ fecha: string; total: number }[]> {
  const result = await sql`
    SELECT
      TO_CHAR(fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD') AS fecha,
      COUNT(*)::int AS total
    FROM reportes_alumbrado
    GROUP BY 1
    ORDER BY 1 DESC
  `;
  return result as unknown as { fecha: string; total: number }[];
}

export async function eliminarReportesPorFecha(dateStr: string): Promise<number> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('Formato de fecha inválido.');
  }

  const result = await sql`
    DELETE FROM reportes_alumbrado
    WHERE TO_CHAR(fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD') = ${dateStr}
  `;

  revalidatePath('/dashboard/Historial');
  return result.count; // <--- En postgres.js se usa .count para filas afectadas
}





















// 'use server';

// import { sql } from '@vercel/postgres';
// import { revalidatePath } from 'next/cache';

// // ── Tipos ──────────────────────────────────────────────────────────────────
// interface GpsCoords {
//   lat: string | null;
//   lon: string | null;
//   precision: string;
// }

// interface GeoRef {
//   lat: string; lon: string; precision: string; timestamp: string;
// }

// interface EvidenceEntry {
//   id: number;
//   observation: string;
//   geoRef: GeoRef | null;
//   photo: string | null;
// }

// interface ChecklistItem {
//   id: number;
//   seccion?: string;
//   pregunta: string;
//   respuesta: string;
//   observacion: string;
//   geoRef?: GeoRef | null;
//   evidence?: EvidenceEntry[];
// }

// interface FormData {
//   sector:            string;
//   Tramo:             string;
//   accesoPublico?:    string;
//   tipoMantenimiento: string;
//   categoria:         string;
//   subTipo?:          string;
//   [key: string]:     any;
// }

// // ── Helper: normalizar evidencias (modelo nuevo y viejo) ───────────────────
// function getEvidenceList(item: ChecklistItem): EvidenceEntry[] {
//   if (Array.isArray(item.evidence) && item.evidence.length > 0) {
//     return item.evidence.filter(e => e.observation || e.geoRef || e.photo);
//   }
//   const tieneAlgo = !!(item.observacion?.trim() || item.geoRef);
//   if (!tieneAlgo) return [];
//   return [{ id: 0, observation: item.observacion || '', geoRef: item.geoRef ?? null, photo: null }];
// }

// // ── Helper: generar folio ──────────────────────────────────────────────────
// function generarFolio(categoria: string): string {
//   const prefix = categoria.slice(0, 3).toUpperCase().replace(/\s/g, '');
//   const fecha  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
//   const rand   = Math.floor(Math.random() * 900 + 100);
//   return `${prefix}-${fecha}-${rand}`;
// }

// /**
//  * FIX CRÍTICO: Elimina los datos de foto (base64) del checklist antes de
//  * persistirlo como JSONB. Las fotos solo se almacenan en la tabla `evidencias`.
//  *
//  * Sin este paso, una sola foto (~300 KB en base64) multiplicada por N ítems
//  * puede superar los límites de parámetro de Vercel Postgres (~10 MB) y además
//  * duplicar el almacenamiento innecesariamente.
//  */
// function stripPhotosFromChecklist(checklist: ChecklistItem[]): ChecklistItem[] {
//   return checklist.map(item => ({
//     ...item,
//     // Eliminar foto de cada entrada de evidencia en el JSONB
//     evidence: item.evidence?.map(ev => ({ ...ev, photo: null })) ?? [],
//   }));
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  CREAR REPORTE
// // ══════════════════════════════════════════════════════════════════════════
// export async function crearReporte(
//   formData: FormData,
//   checklist: ChecklistItem[],
//   gps: GpsCoords,
//   fotos: { [key: string]: string | null }
// ): Promise<string> {

//   const folio = generarFolio(formData.categoria);

//   // ── FIX: guardar JSONB sin fotos (evita payload gigante y duplicados) ──
//   const checklistSinFotos = stripPhotosFromChecklist(checklist);

//   const result = await sql`
//     INSERT INTO reportes_alumbrado (
//       folio,
//       sector, tramo, acceso_publico,
//       tipo_mantenimiento, categoria, sub_tipo,
//       latitud, longitud,
//       checklist, fotos
//     ) VALUES (
//       ${folio},
//       ${formData.sector           ?? null},
//       ${formData.Tramo            ?? null},
//       ${formData.accesoPublico    ?? null},
//       ${formData.tipoMantenimiento ?? null},
//       ${formData.categoria        ?? 'ALUMBRADO PÚBLICO'},
//       ${formData.subTipo          ?? null},
//       ${gps.lat ? parseFloat(gps.lat) : null},
//       ${gps.lon ? parseFloat(gps.lon) : null},
//       ${JSON.stringify(checklistSinFotos)}::jsonb,
//       ${JSON.stringify(fotos)}::jsonb
//     )
//     RETURNING id
//   `;

//   const reporteId: string = result.rows[0].id;

//   // ── Insertar evidencias con fotos (aquí sí se guardan) ──
//   await insertarEvidencias(reporteId, checklist);

//   return reporteId;
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  ACTUALIZAR REPORTE
// // ══════════════════════════════════════════════════════════════════════════
// export async function actualizarReporte(
//   id: string,
//   formData: FormData,
//   checklist: ChecklistItem[],
//   gps: GpsCoords,
//   fotos: { [key: string]: string | null }
// ): Promise<string> {

//   // ── FIX: guardar JSONB sin fotos ──
//   const checklistSinFotos = stripPhotosFromChecklist(checklist);

//   await sql`
//     UPDATE reportes_alumbrado SET
//       sector             = ${formData.sector           ?? null},
//       tramo              = ${formData.Tramo            ?? null},
//       acceso_publico     = ${formData.accesoPublico    ?? null},
//       tipo_mantenimiento = ${formData.tipoMantenimiento ?? null},
//       categoria          = ${formData.categoria        ?? null},
//       sub_tipo           = ${formData.subTipo          ?? null},
//       latitud            = ${gps.lat ? parseFloat(gps.lat) : null},
//       longitud           = ${gps.lon ? parseFloat(gps.lon) : null},
//       checklist          = ${JSON.stringify(checklistSinFotos)}::jsonb,
//       fotos              = ${JSON.stringify(fotos)}::jsonb
//     WHERE id = ${id}::uuid
//   `;

//   // ── Reemplazar evidencias (con fotos) ──
//   await sql`DELETE FROM evidencias WHERE reporte_id = ${id}::uuid`;
//   await insertarEvidencias(id, checklist);

//   return id;
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  HELPER: insertar filas en evidencias
// //  Las fotos se guardan aquí — es el único lugar donde persisten.
// // ══════════════════════════════════════════════════════════════════════════
// async function insertarEvidencias(reporteId: string, checklist: ChecklistItem[]) {
//   for (const item of checklist) {
//     const evidences = getEvidenceList(item);
//     for (let i = 0; i < evidences.length; i++) {
//       const ev = evidences[i];

//       // Validar que la foto sea un data URL válido antes de insertar
//       const fotoValida =
//         ev.photo &&
//         typeof ev.photo === 'string' &&
//         ev.photo.startsWith('data:image/')
//           ? ev.photo
//           : null;

//       await sql`
//         INSERT INTO evidencias (
//           reporte_id, item_id, item_pregunta, item_seccion,
//           evidencia_num, observacion,
//           lat, lon, precision_gps, timestamp_gps,
//           foto
//         ) VALUES (
//           ${reporteId}::uuid,
//           ${item.id},
//           ${item.pregunta},
//           ${item.seccion ?? null},
//           ${i + 1},
//           ${ev.observation || null},
//           ${ev.geoRef?.lat ? parseFloat(ev.geoRef.lat) : null},
//           ${ev.geoRef?.lon ? parseFloat(ev.geoRef.lon) : null},
//           ${ev.geoRef?.precision ?? null},
//           ${ev.geoRef?.timestamp ?? null},
//           ${fotoValida}
//         )
//       `;
//     }
//   }
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  OBTENER REPORTES (Historial)
// // ══════════════════════════════════════════════════════════════════════════
// export async function obtenerReportes(filtros?: {
//   categoria?: string;
//   sector?:    string;
// }) {
//   const rows = await sql`
//     SELECT
//       id, folio, categoria, sub_tipo,
//       sector, tramo, acceso_publico,
//       tipo_mantenimiento,
//       latitud, longitud,
//       fecha
//     FROM reportes_alumbrado
//     ORDER BY fecha DESC
//     LIMIT 200
//   `;
//   return rows.rows;
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  OBTENER REPORTE + EVIDENCIAS (para editar)
// //  Rehidrata el checklist con las fotos desde la tabla `evidencias`.
// // ══════════════════════════════════════════════════════════════════════════
// export async function obtenerReporteConEvidencias(id: string) {
//   const [reporte, evidencias] = await Promise.all([
//     sql`SELECT * FROM reportes_alumbrado WHERE id = ${id}::uuid`,
//     sql`SELECT * FROM evidencias WHERE reporte_id = ${id}::uuid
//         ORDER BY item_id, evidencia_num`,
//   ]);

//   if (reporte.rows.length === 0) return null;

//   const r = reporte.rows[0];
//   const checklistBase: ChecklistItem[] = r.checklist ?? [];

//   // Agrupar evidencias por item_id
//   const evMap = new Map<number, EvidenceEntry[]>();
//   for (const ev of evidencias.rows) {
//     if (!evMap.has(ev.item_id)) evMap.set(ev.item_id, []);
//     evMap.get(ev.item_id)!.push({
//       id:          ev.id,
//       observation: ev.observacion  ?? '',
//       // ── Rehidratar foto desde tabla evidencias (no viene en el JSONB) ──
//       photo:       ev.foto         ?? null,
//       geoRef: ev.lat ? {
//         lat:       String(ev.lat),
//         lon:       String(ev.lon),
//         precision: ev.precision_gps ?? '--',
//         timestamp: ev.timestamp_gps ?? '',
//       } : null,
//     });
//   }

//   // Inyectar evidence[] en cada ítem del checklist
//   const checklistHidratado = checklistBase.map((item: ChecklistItem) => ({
//     ...item,
//     evidence: evMap.get(item.id) ?? [{ id: Date.now(), observation: '', geoRef: null, photo: null }],
//   }));

//   return { ...r, checklist: checklistHidratado };
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  ELIMINAR REPORTE
// // ══════════════════════════════════════════════════════════════════════════
// export async function eliminarReporte(id: string): Promise<void> {
//   await sql`DELETE FROM reportes_alumbrado WHERE id = ${id}::uuid`;
//   // ON DELETE CASCADE elimina las evidencias automáticamente
//   revalidatePath('/dashboard/Historial');
// }


// // ══════════════════════════════════════════════════════════════════════════
// //  OBTENER REPORTE POR ID (Solo base)
// // ══════════════════════════════════════════════════════════════════════════
// export async function obtenerReportePorId(id: string) {
//   const result = await sql`
//     SELECT * FROM reportes_alumbrado
//     WHERE id = ${id}::uuid
//   `;
//   if (result.rows.length === 0) return null;
//   return result.rows[0];
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  OBTENER FECHAS CON CONTEO (para el borrador por fecha)
// //  Devuelve cada fecha única (en zona America/Mexico_City) con cuántos
// //  reportes se crearon ese día, ordenadas de más reciente a más antigua.
// // ══════════════════════════════════════════════════════════════════════════
// export async function obtenerFechasConConteo(): Promise<
//   { fecha: string; total: number }[]
// > {
//   const result = await sql`
//     SELECT
//       TO_CHAR(
//         fecha AT TIME ZONE 'America/Mexico_City',
//         'YYYY-MM-DD'
//       )                       AS fecha,
//       COUNT(*)::int           AS total
//     FROM reportes_alumbrado
//     GROUP BY 1
//     ORDER BY 1 DESC
//   `;
//   return result.rows as { fecha: string; total: number }[];
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  ELIMINAR REPORTES POR FECHA
// //  Borra todos los reportes (y sus evidencias por CASCADE) cuya fecha,
// //  convertida a la zona horaria local, coincida con el día indicado.
// //  dateStr: "YYYY-MM-DD"
// // ══════════════════════════════════════════════════════════════════════════
// export async function eliminarReportesPorFecha(dateStr: string): Promise<number> {
//   // Validación básica del formato para evitar inyección
//   if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
//     throw new Error('Formato de fecha inválido. Se esperaba YYYY-MM-DD.');
//   }

//   const result = await sql`
//     DELETE FROM reportes_alumbrado
//     WHERE TO_CHAR(
//       fecha AT TIME ZONE 'America/Mexico_City',
//       'YYYY-MM-DD'
//     ) = ${dateStr}
//   `;

//   revalidatePath('/dashboard/Historial');
//   return result.rowCount ?? 0;
// }



















// 'use server';

// import { sql } from '@vercel/postgres';
// import { revalidatePath } from 'next/cache';

// // ── Tipos ──────────────────────────────────────────────────────────────────
// interface GpsCoords {
//   lat: string | null;
//   lon: string | null;
//   precision: string;
// }

// interface GeoRef {
//   lat: string; lon: string; precision: string; timestamp: string;
// }

// interface EvidenceEntry {
//   id: number;
//   observation: string;
//   geoRef: GeoRef | null;
//   photo: string | null;
// }

// interface ChecklistItem {
//   id: number;
//   seccion?: string;
//   pregunta: string;
//   respuesta: string;
//   observacion: string;
//   geoRef?: GeoRef | null;
//   evidence?: EvidenceEntry[];
// }

// interface FormData {
//   sector:            string;
//   Tramo:             string;
//   accesoPublico?:    string;
//   tipoMantenimiento: string;
//   categoria:         string;
//   subTipo?:          string;
//   [key: string]:     any;
// }

// // ── Helper: normalizar evidencias (modelo nuevo y viejo) ───────────────────
// function getEvidenceList(item: ChecklistItem): EvidenceEntry[] {
//   if (Array.isArray(item.evidence) && item.evidence.length > 0) {
//     return item.evidence.filter(e => e.observation || e.geoRef || e.photo);
//   }
//   const tieneAlgo = !!(item.observacion?.trim() || item.geoRef);
//   if (!tieneAlgo) return [];
//   return [{ id: 0, observation: item.observacion || '', geoRef: item.geoRef ?? null, photo: null }];
// }

// // ── Helper: generar folio ──────────────────────────────────────────────────
// function generarFolio(categoria: string): string {
//   const prefix = categoria.slice(0, 3).toUpperCase().replace(/\s/g, '');
//   const fecha  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
//   const rand   = Math.floor(Math.random() * 900 + 100);
//   return `${prefix}-${fecha}-${rand}`;
// }

// /**
//  * FIX CRÍTICO: Elimina los datos de foto (base64) del checklist antes de
//  * persistirlo como JSONB. Las fotos solo se almacenan en la tabla `evidencias`.
//  *
//  * Sin este paso, una sola foto (~300 KB en base64) multiplicada por N ítems
//  * puede superar los límites de parámetro de Vercel Postgres (~10 MB) y además
//  * duplicar el almacenamiento innecesariamente.
//  */
// function stripPhotosFromChecklist(checklist: ChecklistItem[]): ChecklistItem[] {
//   return checklist.map(item => ({
//     ...item,
//     // Eliminar foto de cada entrada de evidencia en el JSONB
//     evidence: item.evidence?.map(ev => ({ ...ev, photo: null })) ?? [],
//   }));
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  CREAR REPORTE
// // ══════════════════════════════════════════════════════════════════════════
// export async function crearReporte(
//   formData: FormData,
//   checklist: ChecklistItem[],
//   gps: GpsCoords,
//   fotos: { [key: string]: string | null }
// ): Promise<string> {

//   const folio = generarFolio(formData.categoria);

//   // ── FIX: guardar JSONB sin fotos (evita payload gigante y duplicados) ──
//   const checklistSinFotos = stripPhotosFromChecklist(checklist);

//   const result = await sql`
//     INSERT INTO reportes_alumbrado (
//       folio,
//       sector, tramo, acceso_publico,
//       tipo_mantenimiento, categoria, sub_tipo,
//       latitud, longitud,
//       checklist, fotos
//     ) VALUES (
//       ${folio},
//       ${formData.sector           ?? null},
//       ${formData.Tramo            ?? null},
//       ${formData.accesoPublico    ?? null},
//       ${formData.tipoMantenimiento ?? null},
//       ${formData.categoria        ?? 'ALUMBRADO PÚBLICO'},
//       ${formData.subTipo          ?? null},
//       ${gps.lat ? parseFloat(gps.lat) : null},
//       ${gps.lon ? parseFloat(gps.lon) : null},
//       ${JSON.stringify(checklistSinFotos)}::jsonb,
//       ${JSON.stringify(fotos)}::jsonb
//     )
//     RETURNING id
//   `;

//   const reporteId: string = result.rows[0].id;

//   // ── Insertar evidencias con fotos (aquí sí se guardan) ──
//   await insertarEvidencias(reporteId, checklist);

//   return reporteId;
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  ACTUALIZAR REPORTE
// // ══════════════════════════════════════════════════════════════════════════
// export async function actualizarReporte(
//   id: string,
//   formData: FormData,
//   checklist: ChecklistItem[],
//   gps: GpsCoords,
//   fotos: { [key: string]: string | null }
// ): Promise<string> {

//   // ── FIX: guardar JSONB sin fotos ──
//   const checklistSinFotos = stripPhotosFromChecklist(checklist);

//   await sql`
//     UPDATE reportes_alumbrado SET
//       sector             = ${formData.sector           ?? null},
//       tramo              = ${formData.Tramo            ?? null},
//       acceso_publico     = ${formData.accesoPublico    ?? null},
//       tipo_mantenimiento = ${formData.tipoMantenimiento ?? null},
//       categoria          = ${formData.categoria        ?? null},
//       sub_tipo           = ${formData.subTipo          ?? null},
//       latitud            = ${gps.lat ? parseFloat(gps.lat) : null},
//       longitud           = ${gps.lon ? parseFloat(gps.lon) : null},
//       checklist          = ${JSON.stringify(checklistSinFotos)}::jsonb,
//       fotos              = ${JSON.stringify(fotos)}::jsonb
//     WHERE id = ${id}::uuid
//   `;

//   // ── Reemplazar evidencias (con fotos) ──
//   await sql`DELETE FROM evidencias WHERE reporte_id = ${id}::uuid`;
//   await insertarEvidencias(id, checklist);

//   return id;
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  HELPER: insertar filas en evidencias
// //  Las fotos se guardan aquí — es el único lugar donde persisten.
// // ══════════════════════════════════════════════════════════════════════════
// async function insertarEvidencias(reporteId: string, checklist: ChecklistItem[]) {
//   for (const item of checklist) {
//     const evidences = getEvidenceList(item);
//     for (let i = 0; i < evidences.length; i++) {
//       const ev = evidences[i];

//       // Validar que la foto sea un data URL válido antes de insertar
//       const fotoValida =
//         ev.photo &&
//         typeof ev.photo === 'string' &&
//         ev.photo.startsWith('data:image/')
//           ? ev.photo
//           : null;

//       await sql`
//         INSERT INTO evidencias (
//           reporte_id, item_id, item_pregunta, item_seccion,
//           evidencia_num, observacion,
//           lat, lon, precision_gps, timestamp_gps,
//           foto
//         ) VALUES (
//           ${reporteId}::uuid,
//           ${item.id},
//           ${item.pregunta},
//           ${item.seccion ?? null},
//           ${i + 1},
//           ${ev.observation || null},
//           ${ev.geoRef?.lat ? parseFloat(ev.geoRef.lat) : null},
//           ${ev.geoRef?.lon ? parseFloat(ev.geoRef.lon) : null},
//           ${ev.geoRef?.precision ?? null},
//           ${ev.geoRef?.timestamp ?? null},
//           ${fotoValida}
//         )
//       `;
//     }
//   }
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  OBTENER REPORTES (Historial)
// // ══════════════════════════════════════════════════════════════════════════
// export async function obtenerReportes(filtros?: {
//   categoria?: string;
//   sector?:    string;
// }) {
//   const rows = await sql`
//     SELECT
//       id, folio, categoria, sub_tipo,
//       sector, tramo, acceso_publico,
//       tipo_mantenimiento,
//       latitud, longitud,
//       fecha
//     FROM reportes_alumbrado
//     ORDER BY fecha DESC
//     LIMIT 200
//   `;
//   return rows.rows;
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  OBTENER REPORTE + EVIDENCIAS (para editar)
// //  Rehidrata el checklist con las fotos desde la tabla `evidencias`.
// // ══════════════════════════════════════════════════════════════════════════
// export async function obtenerReporteConEvidencias(id: string) {
//   const [reporte, evidencias] = await Promise.all([
//     sql`SELECT * FROM reportes_alumbrado WHERE id = ${id}::uuid`,
//     sql`SELECT * FROM evidencias WHERE reporte_id = ${id}::uuid
//         ORDER BY item_id, evidencia_num`,
//   ]);

//   if (reporte.rows.length === 0) return null;

//   const r = reporte.rows[0];
//   const checklistBase: ChecklistItem[] = r.checklist ?? [];

//   // Agrupar evidencias por item_id
//   const evMap = new Map<number, EvidenceEntry[]>();
//   for (const ev of evidencias.rows) {
//     if (!evMap.has(ev.item_id)) evMap.set(ev.item_id, []);
//     evMap.get(ev.item_id)!.push({
//       id:          ev.id,
//       observation: ev.observacion  ?? '',
//       // ── Rehidratar foto desde tabla evidencias (no viene en el JSONB) ──
//       photo:       ev.foto         ?? null,
//       geoRef: ev.lat ? {
//         lat:       String(ev.lat),
//         lon:       String(ev.lon),
//         precision: ev.precision_gps ?? '--',
//         timestamp: ev.timestamp_gps ?? '',
//       } : null,
//     });
//   }

//   // Inyectar evidence[] en cada ítem del checklist
//   const checklistHidratado = checklistBase.map((item: ChecklistItem) => ({
//     ...item,
//     evidence: evMap.get(item.id) ?? [{ id: Date.now(), observation: '', geoRef: null, photo: null }],
//   }));

//   return { ...r, checklist: checklistHidratado };
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  ELIMINAR REPORTE
// // ══════════════════════════════════════════════════════════════════════════
// export async function eliminarReporte(id: string): Promise<void> {
//   await sql`DELETE FROM reportes_alumbrado WHERE id = ${id}::uuid`;
//   // ON DELETE CASCADE elimina las evidencias automáticamente
//   revalidatePath('/dashboard/Historial');
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  OBTENER REPORTE POR ID (Solo base)
// // ══════════════════════════════════════════════════════════════════════════
// export async function obtenerReportePorId(id: string) {
//   const result = await sql`
//     SELECT * FROM reportes_alumbrado
//     WHERE id = ${id}::uuid
//   `;
//   if (result.rows.length === 0) return null;
//   return result.rows[0];
// }









// 'use server';

// import { sql } from '@vercel/postgres';
// // Si usas @neondatabase/serverless:
// // import { neon } from '@neondatabase/serverless';
// // const sql = neon(process.env.DATABASE_URL!);
// import { revalidatePath } from 'next/cache';
// // ── Tipos ──────────────────────────────────────────────────────────────────
// interface GpsCoords {
//   lat: string | null;
//   lon: string | null;
//   precision: string;
// }

// interface GeoRef {
//   lat: string; lon: string; precision: string; timestamp: string;
// }

// interface EvidenceEntry {
//   id: number;
//   observation: string;
//   geoRef: GeoRef | null;
//   photo: string | null;
// }

// interface ChecklistItem {
//   id: number;
//   seccion?: string;
//   pregunta: string;
//   respuesta: string;
//   observacion: string;
//   geoRef?: GeoRef | null;
//   evidence?: EvidenceEntry[];
// }

// interface FormData {
//   sector:            string;
//   Tramo:             string;
//   accesoPublico?:    string;
//   tipoMantenimiento: string;
//   categoria:         string;
//   subTipo?:          string;
//   [key: string]:     any;
// }

// // ── Helper: normalizar evidencias (modelo nuevo y viejo) ───────────────────
// function getEvidenceList(item: ChecklistItem): EvidenceEntry[] {
//   if (Array.isArray(item.evidence) && item.evidence.length > 0) {
//     return item.evidence.filter(e => e.observation || e.geoRef || e.photo);
//   }
//   const tieneAlgo = !!(item.observacion?.trim() || item.geoRef);
//   if (!tieneAlgo) return [];
//   return [{ id: 0, observation: item.observacion || '', geoRef: item.geoRef ?? null, photo: null }];
// }

// // ── Helper: generar folio ──────────────────────────────────────────────────
// function generarFolio(categoria: string): string {
//   const prefix = categoria.slice(0, 3).toUpperCase().replace(/\s/g, '');
//   const fecha  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
//   const rand   = Math.floor(Math.random() * 900 + 100);
//   return `${prefix}-${fecha}-${rand}`;
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  CREAR REPORTE
// // ══════════════════════════════════════════════════════════════════════════
// export async function crearReporte(
//   formData: FormData,
//   checklist: ChecklistItem[],
//   gps: GpsCoords,
//   fotos: { [key: string]: string | null }
// ): Promise<string> {

//   const folio = generarFolio(formData.categoria);

//   const result = await sql`
//     INSERT INTO reportes_alumbrado (
//       folio,
//       sector, tramo, acceso_publico,
//       tipo_mantenimiento, categoria, sub_tipo,
//       latitud, longitud,
//       checklist, fotos
//     ) VALUES (
//       ${folio},
//       ${formData.sector           ?? null},
//       ${formData.Tramo            ?? null},
//       ${formData.accesoPublico    ?? null},
//       ${formData.tipoMantenimiento ?? null},
//       ${formData.categoria        ?? 'ALUMBRADO PÚBLICO'},
//       ${formData.subTipo          ?? null},
//       ${gps.lat ? parseFloat(gps.lat) : null},
//       ${gps.lon ? parseFloat(gps.lon) : null},
//       ${JSON.stringify(checklist)}::jsonb,
//       ${JSON.stringify(fotos)}::jsonb
//     )
//     RETURNING id
//   `;

//   const reporteId: string = result.rows[0].id; // UUID string
//   await insertarEvidencias(reporteId, checklist);
//   return reporteId;
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  ACTUALIZAR REPORTE
// // ══════════════════════════════════════════════════════════════════════════
// export async function actualizarReporte(
//   id: string,
//   formData: FormData,
//   checklist: ChecklistItem[],
//   gps: GpsCoords,
//   fotos: { [key: string]: string | null }
// ): Promise<string> {

//   await sql`
//     UPDATE reportes_alumbrado SET
//       sector             = ${formData.sector           ?? null},
//       tramo              = ${formData.Tramo            ?? null},
//       acceso_publico     = ${formData.accesoPublico    ?? null},
//       tipo_mantenimiento = ${formData.tipoMantenimiento ?? null},
//       categoria          = ${formData.categoria        ?? null},
//       sub_tipo           = ${formData.subTipo          ?? null},
//       latitud            = ${gps.lat ? parseFloat(gps.lat) : null},
//       longitud           = ${gps.lon ? parseFloat(gps.lon) : null},
//       checklist          = ${JSON.stringify(checklist)}::jsonb,
//       fotos              = ${JSON.stringify(fotos)}::jsonb
//     WHERE id = ${id}::uuid
//   `;

//   // Reemplazar evidencias
//   await sql`DELETE FROM evidencias WHERE reporte_id = ${id}::uuid`;
//   await insertarEvidencias(id, checklist);
//   return id;
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  HELPER: insertar filas en evidencias
// // ══════════════════════════════════════════════════════════════════════════
// async function insertarEvidencias(reporteId: string, checklist: ChecklistItem[]) {
//   for (const item of checklist) {
//     const evidences = getEvidenceList(item);
//     for (let i = 0; i < evidences.length; i++) {
//       const ev = evidences[i];
//       await sql`
//         INSERT INTO evidencias (
//           reporte_id, item_id, item_pregunta, item_seccion,
//           evidencia_num, observacion,
//           lat, lon, precision_gps, timestamp_gps,
//           foto
//         ) VALUES (
//           ${reporteId}::uuid,
//           ${item.id},
//           ${item.pregunta},
//           ${item.seccion ?? null},
//           ${i + 1},
//           ${ev.observation || null},
//           ${ev.geoRef?.lat ? parseFloat(ev.geoRef.lat) : null},
//           ${ev.geoRef?.lon ? parseFloat(ev.geoRef.lon) : null},
//           ${ev.geoRef?.precision ?? null},
//           ${ev.geoRef?.timestamp ?? null},
//           ${ev.photo ?? null}
//         )
//       `;
//     }
//   }
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  OBTENER REPORTES (Historial)
// // ══════════════════════════════════════════════════════════════════════════
// export async function obtenerReportes(filtros?: {
//   categoria?: string;
//   sector?:    string;
// }) {
//   const rows = await sql`
//     SELECT
//       id, folio, categoria, sub_tipo,
//       sector, tramo, acceso_publico,
//       tipo_mantenimiento,
//       latitud, longitud,
//       fecha
//     FROM reportes_alumbrado
//     ORDER BY fecha DESC
//     LIMIT 200
//   `;
//   return rows.rows;
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  OBTENER REPORTE + EVIDENCIAS (para editar)
// // ══════════════════════════════════════════════════════════════════════════
// export async function obtenerReporteConEvidencias(id: string) {
//   const [reporte, evidencias] = await Promise.all([
//     sql`SELECT * FROM reportes_alumbrado WHERE id = ${id}::uuid`,
//     sql`SELECT * FROM evidencias WHERE reporte_id = ${id}::uuid
//         ORDER BY item_id, evidencia_num`,
//   ]);

//   if (reporte.rows.length === 0) return null;

//   const r = reporte.rows[0];
//   const checklistBase: ChecklistItem[] = r.checklist ?? [];

//   // Agrupar evidencias por item_id
//   const evMap = new Map<number, EvidenceEntry[]>();
//   for (const ev of evidencias.rows) {
//     if (!evMap.has(ev.item_id)) evMap.set(ev.item_id, []);
//     evMap.get(ev.item_id)!.push({
//       id:          ev.id,
//       observation: ev.observacion  ?? '',
//       photo:       ev.foto         ?? null,
//       geoRef: ev.lat ? {
//         lat:       String(ev.lat),
//         lon:       String(ev.lon),
//         precision: ev.precision_gps ?? '--',
//         timestamp: ev.timestamp_gps ?? '',
//       } : null,
//     });
//   }

//   // Inyectar evidence[] en cada ítem del checklist
//   const checklistHidratado = checklistBase.map((item: ChecklistItem) => ({
//     ...item,
//     evidence: evMap.get(item.id) ?? [{ id: Date.now(), observation: '', geoRef: null, photo: null }],
//   }));

//   return { ...r, checklist: checklistHidratado };
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  ELIMINAR REPORTE
// // ══════════════════════════════════════════════════════════════════════════
// export async function eliminarReporte(id: string): Promise<void> {
//   await sql`DELETE FROM reportes_alumbrado WHERE id = ${id}::uuid`;
//   // ON DELETE CASCADE elimina las evidencias automáticamente
//   revalidatePath('/dashboard/Historial');
// }

// // ══════════════════════════════════════════════════════════════════════════
// //  OBTENER REPORTE POR ID (Solo base)
// // ══════════════════════════════════════════════════════════════════════════
// export async function obtenerReportePorId(id: string) {
//   const result = await sql`
//     SELECT * FROM reportes_alumbrado 
//     WHERE id = ${id}::uuid
//   `;
  
//   if (result.rows.length === 0) return null;
//   return result.rows[0];
// }





// 'use server';

// import { sql } from '@vercel/postgres';
// import { revalidatePath } from 'next/cache';
// import { put, del } from '@vercel/blob';


// // ── FIX: retorna Promise<string> con el id del registro creado ─────────────
// export async function crearReporte(
//   formData: any,
//   checklist: any,
//   gps: any,
//   fotos: Record<string, string | null>
// ): Promise<string> {

//   const ahora = new Date();
//   const fechaMX = ahora.toLocaleDateString('es-MX', {
//     timeZone: 'America/Mexico_City',
//     year: 'numeric', month: '2-digit', day: '2-digit',
//   });
//   const [dia, mes, anio] = fechaMX.split('/');
//   const fechaParaFolio = `${anio}-${mes}-${dia}`;
//   const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
//   const folio = `REV-${fechaParaFolio}-${random}`;

//   const sectorFinal = formData.sector === 'Otro' ? formData.sectorPersonalizado : formData.sector;
//   const tramoFinal  = formData.sector === 'Otro' ? formData.tramoPersonalizado  : formData.Tramo;
//   const tipoMantenimiento = formData.tipoMantenimiento || 'Ordinario';
//   const latitud  = gps?.lat ? parseFloat(gps.lat) : null;
//   const longitud = gps?.lon ? parseFloat(gps.lon) : null;
//   const categoria = formData.categoria || 'General';

//   try {
//     const result = await sql`
//       INSERT INTO reportes_alumbrado (
//         folio, sector, tramo, acceso_publico, tipo_mantenimiento,
//         latitud, longitud, checklist, fecha, categoria, fotos
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
//         ${JSON.stringify(fotos ?? '')}
//       )
//       RETURNING id
//     `;
//     revalidatePath('/dashboard/Historial');
//     return result.rows[0].id.toString();
//   } catch (error) {
//     console.error('Error al guardar en BD:', error);
//     throw new Error('Fallo al crear el reporte.');
//   }
// }


// // ── FIX: retorna Promise<string> con el mismo id recibido ──────────────────
// export async function actualizarReporte(
//   id: string,
//   formData: any,
//   checklist: any,
//   gps: any,
//   fotos?: Record<string, string | null>
// ): Promise<string> {

//   const sectorFinal = formData.sector === 'Otro' ? formData.sectorPersonalizado : formData.sector;
//   const tramoFinal  = formData.sector === 'Otro' ? formData.tramoPersonalizado  : formData.Tramo;
//   const tipoMantenimiento = formData.tipoMantenimiento || 'Ordinario';
//   const latitud  = gps?.lat ? parseFloat(gps.lat) : null;
//   const longitud = gps?.lon ? parseFloat(gps.lon) : null;
//   const categoria = formData.categoria || 'General';

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
//     revalidatePath('/dashboard/Historial');
//     return id;
//   } catch (error) {
//     console.error('Error al actualizar en BD:', error);
//     throw new Error('Fallo al actualizar el reporte.');
//   }
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
//       checklist: typeof row.checklist === 'string' ? JSON.parse(row.checklist) : row.checklist,
//       fotos:     typeof row.fotos === 'string'     ? JSON.parse(row.fotos)     : (row.fotos ?? {}),
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
//   const blob = await put(file.name, file, { access: 'public', addRandomSuffix: true });
//   return blob.url;
// }

// export async function eliminarFoto(url: string) {
//   await del(url);
// }

// export async function guardarPDFEnReportes(ids: string[], pdfBase64: string): Promise<void> {
//   if (!ids.length || !pdfBase64) return;
//   await Promise.all(
//     ids.map(id => sql`UPDATE reportes_alumbrado SET pdf_base64 = ${pdfBase64} WHERE id = ${id}`)
//   );
//   revalidatePath('/dashboard/Historial');
// }




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