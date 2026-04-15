// app/api/generar-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { sql } from '@vercel/postgres';
import { PDFDocument } from './pdf-document';
import React from 'react';

export const runtime    = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body      = await req.json();
    const reporteId = body?.reporteId as string | undefined;

    if (!reporteId || !/^[0-9a-f-]{36}$/i.test(reporteId)) {
      return NextResponse.json({ error: 'reporteId inválido' }, { status: 400 });
    }

    const [reporteRes, evidenciasRes] = await Promise.all([
      sql`SELECT * FROM reportes_alumbrado WHERE id = ${reporteId}::uuid`,
      sql`
        SELECT item_id, item_pregunta, item_seccion,
               evidencia_num, observacion,
               lat, lon, precision_gps, timestamp_gps,
               foto
        FROM evidencias
        WHERE reporte_id = ${reporteId}::uuid
        ORDER BY item_id, evidencia_num
      `,
    ]);

    if (reporteRes.rows.length === 0) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
    }

    // ── FIX 1: tipar explícitamente como Reporte ──────────
    const row = reporteRes.rows[0];
    const reporte = {
      folio:              String(row.folio              ?? ''),
      fecha:              String(row.fecha              ?? ''),
      categoria:          String(row.categoria          ?? ''),
      sub_tipo:           row.sub_tipo   != null ? String(row.sub_tipo)   : null,
      sector:             row.sector     != null ? String(row.sector)     : null,
      tramo:              row.tramo      != null ? String(row.tramo)      : null,
      acceso_publico:     row.acceso_publico != null ? String(row.acceso_publico) : null,
      tipo_mantenimiento: row.tipo_mantenimiento != null ? String(row.tipo_mantenimiento) : null,
    };

    const evidencias = evidenciasRes.rows;
    const evMap      = new Map<number, typeof evidencias>();
    for (const ev of evidencias) {
      if (!evMap.has(ev.item_id)) evMap.set(ev.item_id, []);
      evMap.get(ev.item_id)!.push(ev);
    }

    const checklistBase = Array.isArray(row.checklist)
      ? row.checklist
      : (typeof row.checklist === 'string' ? JSON.parse(row.checklist) : []);

    const checklist = checklistBase.map((item: any) => ({
      ...item,
      evidence: evMap.get(item.id) ?? [],
    }));

    // ── FIX 2: convertir Buffer → Uint8Array para NextResponse ──
    // AQUÍ ESTÁ LA SOLUCIÓN DEL ERROR DE TIPOS: Añadimos "as React.ReactElement<any>"
    const buffer    = await renderToBuffer(
      React.createElement(PDFDocument, { reporte, checklist }) as React.ReactElement<any>
    );
    
    const uint8     = new Uint8Array(buffer);
    const folio     = reporte.folio || `REP-${reporteId.slice(0, 8)}`;

    return new NextResponse(uint8, {
      status:  200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${folio}.pdf"`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (err: any) {
    console.error('[generar-pdf]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Error interno al generar el PDF' },
      { status: 500 }
    );
  }
}









// // app/api/generar-pdf/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { renderToBuffer } from '@react-pdf/renderer';
// import { sql } from '@vercel/postgres';
// import { PDFDocument } from './pdf-document';
// import React from 'react';

// export const runtime    = 'nodejs';
// export const maxDuration = 60;

// export async function POST(req: NextRequest) {
//   try {
//     const body      = await req.json();
//     const reporteId = body?.reporteId as string | undefined;

//     if (!reporteId || !/^[0-9a-f-]{36}$/i.test(reporteId)) {
//       return NextResponse.json({ error: 'reporteId inválido' }, { status: 400 });
//     }

//     const [reporteRes, evidenciasRes] = await Promise.all([
//       sql`SELECT * FROM reportes_alumbrado WHERE id = ${reporteId}::uuid`,
//       sql`
//         SELECT item_id, item_pregunta, item_seccion,
//                evidencia_num, observacion,
//                lat, lon, precision_gps, timestamp_gps,
//                foto
//         FROM evidencias
//         WHERE reporte_id = ${reporteId}::uuid
//         ORDER BY item_id, evidencia_num
//       `,
//     ]);

//     if (reporteRes.rows.length === 0) {
//       return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
//     }

//     // ── FIX 1: tipar explícitamente como Reporte ──────────
//     const row = reporteRes.rows[0];
//     const reporte = {
//       folio:              String(row.folio              ?? ''),
//       fecha:              String(row.fecha              ?? ''),
//       categoria:          String(row.categoria          ?? ''),
//       sub_tipo:           row.sub_tipo   != null ? String(row.sub_tipo)   : null,
//       sector:             row.sector     != null ? String(row.sector)     : null,
//       tramo:              row.tramo      != null ? String(row.tramo)      : null,
//       acceso_publico:     row.acceso_publico != null ? String(row.acceso_publico) : null,
//       tipo_mantenimiento: row.tipo_mantenimiento != null ? String(row.tipo_mantenimiento) : null,
//     };

//     const evidencias = evidenciasRes.rows;
//     const evMap      = new Map<number, typeof evidencias>();
//     for (const ev of evidencias) {
//       if (!evMap.has(ev.item_id)) evMap.set(ev.item_id, []);
//       evMap.get(ev.item_id)!.push(ev);
//     }

//     const checklistBase = Array.isArray(row.checklist)
//       ? row.checklist
//       : (typeof row.checklist === 'string' ? JSON.parse(row.checklist) : []);

//     const checklist = checklistBase.map((item: any) => ({
//       ...item,
//       evidence: evMap.get(item.id) ?? [],
//     }));

//     // ── FIX 2: convertir Buffer → Uint8Array para NextResponse ──
//     const buffer    = await renderToBuffer(React.createElement(PDFDocument, { reporte, checklist }));
//     const uint8     = new Uint8Array(buffer);
//     const folio     = reporte.folio || `REP-${reporteId.slice(0, 8)}`;

//     return new NextResponse(uint8, {
//       status:  200,
//       headers: {
//         'Content-Type':        'application/pdf',
//         'Content-Disposition': `attachment; filename="${folio}.pdf"`,
//         'Cache-Control':       'no-store',
//       },
//     });
//   } catch (err: any) {
//     console.error('[generar-pdf]', err);
//     return NextResponse.json(
//       { error: err?.message ?? 'Error interno al generar el PDF' },
//       { status: 500 }
//     );
//   }
// }