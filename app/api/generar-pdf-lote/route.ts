// app/api/generar-pdf-lote/route.ts
//
// Genera un PDF combinado en el servidor para un lote de reportes filtrados.
// Acepta: POST { ids: string[], titulo?: string }
// Devuelve: application/pdf (descarga directa)

import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer }            from '@react-pdf/renderer';
import { sql }                       from '@vercel/postgres';
import { PDFLoteDocument }           from './pdf-lote-document';
import React                         from 'react';

export const runtime     = 'nodejs';
export const maxDuration = 300; // 5 min — Vercel Pro soporta hasta 300 s para lotes grandes

// Tamaño de lote paralelo: procesar N reportes a la vez para no saturar la BD
const CHUNK_SIZE = 20;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ids: string[] = body?.ids ?? [];
    const titulo: string = body?.titulo ?? 'REPORTE COMBINADO';

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un ID' }, { status: 400 });
    }
    // Validar formato UUID
    const uuidsValidos = ids.filter(id => /^[0-9a-f-]{36}$/i.test(id));
    if (uuidsValidos.length === 0) {
      return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 });
    }

    // ── 1. Leer reportes en lotes paralelos (no saturar la BD) ──────────
    const chunks   = chunkArray(uuidsValidos, CHUNK_SIZE);
    const allResults: Array<{ reporte: any; checklist: any[] }> = [];

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(id =>
          Promise.all([
            sql`SELECT * FROM reportes_alumbrado WHERE id = ${id}::uuid`,
            sql`
              SELECT item_id, item_pregunta, item_seccion,
                     evidencia_num, observacion,
                     lat, lon, precision_gps, timestamp_gps, foto
              FROM evidencias
              WHERE reporte_id = ${id}::uuid
              ORDER BY item_id, evidencia_num
            `,
          ])
        )
      );

      // Procesar cada chunk y acumular
      for (const [rRes, evRes] of chunkResults) {
        if (rRes.rows.length === 0) continue;
        const row = rRes.rows[0];

        const evMap = new Map<number, any[]>();
        for (const ev of evRes.rows) {
          if (!evMap.has(ev.item_id)) evMap.set(ev.item_id, []);
          evMap.get(ev.item_id)!.push(ev);
        }

        const checklistBase: any[] = Array.isArray(row.checklist)
          ? row.checklist
          : (typeof row.checklist === 'string' ? JSON.parse(row.checklist) : []);

        const checklist = checklistBase.map((item: any) => ({
          ...item,
          evidence: evMap.get(item.id) ?? [],
        }));

        allResults.push({
          reporte: {
            folio:              String(row.folio              ?? ''),
            fecha:              String(row.fecha              ?? ''),
            categoria:          String(row.categoria          ?? ''),
            sub_tipo:           row.sub_tipo           != null ? String(row.sub_tipo)           : null,
            sector:             row.sector             != null ? String(row.sector)             : null,
            tramo:              row.tramo              != null ? String(row.tramo)              : null,
            acceso_publico:     row.acceso_publico     != null ? String(row.acceso_publico)     : null,
            tipo_mantenimiento: row.tipo_mantenimiento != null ? String(row.tipo_mantenimiento) : null,
          },
          checklist,
        });
      }
    } // fin loop de chunks

    const reportes = allResults;

    if (reportes.length === 0) {
      return NextResponse.json({ error: 'No se encontraron reportes' }, { status: 404 });
    }

    // ── 3. Generar PDF en servidor ──────────────────────────────────────
    const buffer = await renderToBuffer(
      React.createElement(PDFLoteDocument, { reportes, titulo })
    );
    const uint8 = new Uint8Array(buffer);
    const folio = `LOTE-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 900 + 100)}`;

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${folio}.pdf"`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (err: any) {
    console.error('[generar-pdf-lote]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Error interno al generar el PDF' },
      { status: 500 }
    );
  }
}
