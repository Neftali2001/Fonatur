import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { QueuedForm } from '@/app/context/pdf-queue-context';

// ── Tipos ──────────────────────────────────────────────────────────────────
type GeoRef = { lat: string; lon: string; precision: string; timestamp: string };

type EvidenceEntry = {
  id: number;
  observation: string;
  geoRef: GeoRef | null;
  photo: string | null;
};

type ChecklistItem = {
  id: number | string;
  pregunta: string;
  respuesta: string;
  observacion: string;
  seccion?: string;
  foto?: string | null;
  geoRef?: GeoRef | null;
  // Nuevo modelo con múltiples evidencias (FormularioUnificado)
  evidence?: EvidenceEntry[];
};

// Paleta: todo negro/gris
const C = {
  black:   [0,   0,   0  ] as [number, number, number],
  darkGray:[45,  45,  45 ] as [number, number, number],
  midGray: [90,  90,  90 ] as [number, number, number],
  lightGray:[220,220, 220] as [number, number, number],
  white:   [255, 255, 255] as [number, number, number],
  rowBg:   [250, 250, 250] as [number, number, number],
  green:   [20,  110,  60] as [number, number, number],
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Extrae todas las evidencias de un ítem, sea modelo viejo o nuevo */
function getEvidences(item: ChecklistItem): Array<{ obs: string; lat: string; lon: string; foto: string | null }> {
  // Modelo nuevo: evidence[]
  if (Array.isArray(item.evidence) && item.evidence.length > 0) {
    return item.evidence
      .filter(e => e.observation || e.geoRef || e.photo)
      .map(e => ({
        obs:  e.observation || '',
        lat:  e.geoRef?.lat ?? '',
        lon:  e.geoRef?.lon ?? '',
        foto: e.photo ?? null,
      }));
  }
  // Modelo viejo: observacion + geoRef planos
  const tieneAlgo = !!(item.observacion?.trim() || item.geoRef || item.foto);
  if (!tieneAlgo) return [];
  return [{
    obs:  item.observacion || '',
    lat:  item.geoRef?.lat ?? '',
    lon:  item.geoRef?.lon ?? '',
    foto: item.foto ?? null,
  }];
}

const tieneEvidencia = (item: ChecklistItem): boolean => getEvidences(item).length > 0;

export function mostrarOpcionesPostGuardado(): Promise<'otro_mismo' | 'otro_distinto' | 'generar_ahora'> {
  return new Promise(resolve => {
    if (window.confirm('✅ Formulario guardado.\n\n¿Llenar OTRO del mismo tipo?\n(Cancelar = usar cola flotante)'))
      return resolve('otro_mismo');
    resolve(
      window.confirm('¿Generar el PDF AHORA con la cola?\n(Cancelar = seguir con otro tipo)')
        ? 'generar_ahora' : 'otro_distinto'
    );
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  FUNCIÓN PRINCIPAL
//  • Agrupa por categoría → un solo encabezado por categoría
//  • head de autoTable tiene: [banda negra de cat] + [fila de columnas]
//    → se repite automáticamente en saltos de página, nunca se duplica
//  • Cada evidencia adicional de un ítem = fila extra en la tabla
// ══════════════════════════════════════════════════════════════════════════════
export async function generarPDFCombinado(lista: QueuedForm[]): Promise<string> {
  const doc   = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mg    = 12; // margin

  // Anchos de columna: 6 columnas, suma = 210-24 = 186mm
  // No. | Concepto | X | Y | Observaciones | Foto
  const CW = { no: 8, concepto: 60, x: 22, y: 22, obs: 50, foto: 24 }; // 8+60+22+22+50+24=186 ✓
  const NCOLS = 6;

  const folio = `REV-COMB-${Math.floor(Math.random() * 9000 + 1000)}`;

  const aplicarMarcaDeAgua = () => {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.07 }));
      doc.addImage('/logo_fonatur.png', 'PNG', (pageW - 140) / 2, (pageH - 40) / 2, 140, 40);
      doc.restoreGraphicsState();
    }
  };

  // ── Portada ───────────────────────────────────────────────────────────
  if (lista.length > 1) {
    let y = 30;
    doc.setFont('helvetica', 'bold').setFontSize(15);
    doc.text('REPORTE COMBINADO – CIP ACAPULCO-COYUCA', mg, y); y += 8;
    doc.setFont('helvetica', 'normal').setFontSize(10);
    doc.text(`Folio: ${folio}`, mg, y); y += 4;
    doc.setLineWidth(0.5).line(mg, y, pageW - mg, y); y += 8;
    doc.setFont('helvetica', 'bold').setFontSize(11).text('Contenido:', mg, y); y += 7;
    doc.setFont('helvetica', 'normal').setFontSize(10);
    lista.forEach((form, idx) => {
      const fecha = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const sub   = (form.formData as any).subTipo ? ` › ${(form.formData as any).subTipo}` : '';
      doc.text(`${idx + 1}. ${form.categoria}${sub}  —  ${form.formData.sector || '—'} / ${form.formData.Tramo || '—'}  (${fecha})`, mg + 4, y);
      y += 6;
    });
    doc.addPage();
  }

  // ── Agrupar por categoría (orden de aparición) ─────────────────────────
  const ordenCats: string[] = [];
  const grupos = new Map<string, QueuedForm[]>();
  for (const form of lista) {
    if (!grupos.has(form.categoria)) { grupos.set(form.categoria, []); ordenCats.push(form.categoria); }
    grupos.get(form.categoria)!.push(form);
  }

  let primerGrupo = true;

  for (const cat of ordenCats) {
    const formsGrupo = grupos.get(cat)!;
    if (!primerGrupo) doc.addPage();
    primerGrupo = false;

    // ── Texto de encabezado general ──────────────────────────────────
    let y = 20;
    doc.setFont('helvetica', 'bold').setFontSize(12);
    doc.text('REPORTE DE MANTENIMIENTO – CIP ACAPULCO-COYUCA', mg, y); y += 4;
    doc.setLineWidth(0.4).line(mg, y, pageW - mg, y); y += 5;

    const sectores = [...new Set(formsGrupo.map(f => f.formData.sector).filter(Boolean))].join(', ') || '—';
    const tramos   = [...new Set(formsGrupo.map(f => f.formData.Tramo ).filter(Boolean))].join(', ') || '—';
    const tipo     = formsGrupo[0].formData.tipoMantenimiento ?? 'N/E';
    const fechaStr = formsGrupo[0].fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaStr  = formsGrupo[0].fechaCaptura.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    doc.setFont('helvetica', 'normal').setFontSize(8.5);
    doc.text(`Folio: ${folio}`, mg, y);
    doc.text(`Fecha: ${fechaStr}   Hora: ${horaStr}`, pageW / 2, y, { align: 'center' }); y += 5;
    doc.text(`Sector: ${sectores}    Tramo: ${tramos}`, mg, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`TIPO: ${tipo.toUpperCase()}`, pageW - mg, y, { align: 'right' });
    doc.setFont('helvetica', 'normal'); y += 7;

    // ── Construir filas del body ──────────────────────────────────────
    // Estructura del body:
    //   • Banda de sub-tipo (gris oscuro, colspan 6) — solo si hay varios sub-tipos distintos
    //   • Banda de sección interna (gris claro, colspan 6) — cuando cambia de sección
    //   • Filas de datos: [no, pregunta, lat, lon, obs, foto]
    //     - Si un ítem tiene N evidencias → N filas; la primera muestra el número,
    //       las siguientes muestran "↳ " en el campo concepto

    type RowFoto = string | null;
    const bodyRows: any[]      = [];
    const fotoRows: RowFoto[]  = []; // paralelo a bodyRows; solo 'data' rows tienen foto

    // Para didDrawCell necesitamos saber qué índice de body row es una fila de dato y su foto
    type RowType = 'sep' | 'data';
    const rowTypes: Array<{ type: RowType; foto?: string | null }> = [];

    const subTiposUnicos = [...new Set(formsGrupo.map(f => (f.formData as any).subTipo).filter(Boolean))] as string[];
    let lastSeccion = '';

    formsGrupo.forEach(form => {
      const checklist = (form.checklist as ChecklistItem[]).filter(tieneEvidencia);
      if (checklist.length === 0) return;

      const subTipo = (form.formData as any).subTipo as string | undefined;

      // Banda de sub-tipo (solo si hay varios sub-tipos distintos o el sub-tipo ≠ cat)
      const mostrarBandaSub = subTipo && (subTiposUnicos.length > 1 || subTipo !== cat);
      if (mostrarBandaSub && subTipo !== lastSeccion) {
        bodyRows.push([{
          content: subTipo,
          colSpan: NCOLS,
          styles: {
            halign: 'center', fontStyle: 'bold', fontSize: 9.5,
            fillColor: C.darkGray, textColor: C.white,
            cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
          },
        }]);
        rowTypes.push({ type: 'sep' });
        lastSeccion = subTipo!.toUpperCase().trim();
      }

      checklist.forEach(item => {
        const evidences = getEvidences(item);
        const seccion   = item.seccion ?? '';

        // Banda de sección interna (cuando cambia dentro del mismo sub-tipo)
        // Normaliza a mayúsculas para evitar duplicados por diferencia de case
        // ej: subTipo "Alumbrado Público Solar" === seccion "ALUMBRADO PÚBLICO SOLAR"
        const seccionUp = seccion.toUpperCase().trim();
        const subTipoUp = (subTipo ?? '').toUpperCase().trim();
        const catUp     = cat.toUpperCase().trim();
        if (seccion && seccionUp !== lastSeccion.toUpperCase().trim() && seccionUp !== subTipoUp && seccionUp !== catUp) {
          bodyRows.push([{
            content: seccion,
            colSpan: NCOLS,
            styles: {
              halign: 'left', fontStyle: 'bold', fontSize: 8.5,
              fillColor: C.lightGray, textColor: C.black,
              cellPadding: { top: 3, bottom: 3, left: 8, right: 4 },
            },
          }]);
          rowTypes.push({ type: 'sep' });
          lastSeccion = seccion.toUpperCase().trim();
        }

        // Una fila por evidencia
        evidences.forEach((ev, ei) => {
          const esExtra = ei > 0;
          bodyRows.push([
            // No.
            {
              content: esExtra ? '' : String(item.id),
              styles: {
                halign: 'center', fontSize: 7.5, fontStyle: esExtra ? 'normal' : 'bold',
                valign: 'middle',
                fillColor: esExtra ? C.rowBg : C.white,
              },
            },
            // Concepto
            {
              content: esExtra ? `↳ Evidencia ${ei + 1}` : item.pregunta,
              styles: {
                fontSize: 7.5, fontStyle: esExtra ? 'italic' : 'normal',
                valign: 'middle',
                fillColor: esExtra ? C.rowBg : C.white,
                textColor: esExtra ? C.midGray : C.black,
              },
            },
            // X (lat)
            {
              content: ev.lat,
              styles: {
                halign: 'center', fontSize: 7,
                textColor: ev.lat ? C.green : C.black,
                valign: 'middle',
                fillColor: esExtra ? C.rowBg : C.white,
              },
            },
            // Y (lon)
            {
              content: ev.lon,
              styles: {
                halign: 'center', fontSize: 7,
                textColor: ev.lon ? C.green : C.black,
                valign: 'middle',
                fillColor: esExtra ? C.rowBg : C.white,
              },
            },
            // Observaciones
            {
              content: ev.obs,
              styles: {
                fontSize: 7.5, valign: 'top',
                fillColor: esExtra ? C.rowBg : C.white,
              },
            },
            // Foto (contenido vacío; se dibuja en didDrawCell)
            {
              content: '',
              styles: {
                halign: 'center', valign: 'middle',
                fillColor: esExtra ? C.rowBg : C.white,
                minCellHeight: 24,
              },
            },
          ]);
          rowTypes.push({ type: 'data', foto: ev.foto });
        });
      });
    });

    if (bodyRows.length === 0) {
      doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(120, 120, 120);
      doc.text('No se registraron evidencias en esta categoría.', mg, y);
      doc.setFont('helvetica', 'normal').setTextColor(0, 0, 0);
      continue;
    }

    // ── autoTable con head de dos filas ─────────────────────────────
    // head[1] = nombres de columnas
    autoTable(doc, {
      startY: y,
      margin: { left: mg, right: mg },

      head: [
        // Fila 0 — banda de categoría (negra)
        [{
          content: cat,
          colSpan: NCOLS,
          styles: {
            halign: 'center', fontStyle: 'bold', fontSize: 11,
            fillColor: C.black, textColor: C.white,
            cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
          },
        }],
        // Fila 1 — nombres de columnas (gris oscuro)
        [
          { content: 'No.',          styles: { halign: 'center' } },
          { content: 'Concepto / Incidencia' },
          { content: 'X (Lat)',      styles: { halign: 'center' } },
          { content: 'Y (Lon)',      styles: { halign: 'center' } },
          { content: 'Observaciones' },
          { content: 'Foto',         styles: { halign: 'center' } },
        ],
      ],
      headStyles: {
        fillColor: C.midGray,
        textColor: C.white,
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
        cellPadding: 2.5,
      },

      body: bodyRows,
      theme: 'grid',

      styles: {
        lineWidth: 0.15,
        lineColor: [180, 180, 180] as any,
        fontSize: 7.5,
        cellPadding: 2.5,
        overflow: 'linebreak',
        minCellHeight: 9,
      },
      columnStyles: {
        0: { cellWidth: CW.no,       halign: 'center' },
        1: { cellWidth: CW.concepto  },
        2: { cellWidth: CW.x,        halign: 'center' },
        3: { cellWidth: CW.y,        halign: 'center' },
        4: { cellWidth: CW.obs       },
        5: { cellWidth: CW.foto,     halign: 'center', minCellHeight: 24 },
      },

      didDrawCell: (data: any) => {
        if (data.section !== 'body' || data.column.index !== 5) return;
        const meta = rowTypes[data.row.index];
        if (!meta || meta.type !== 'data' || !meta.foto) return;
        try {
          const props = doc.getImageProperties(meta.foto);
          const maxW  = CW.foto - 2;
          const maxH  = data.cell.height - 2;
          const ratio = Math.min(maxW / props.width, maxH / props.height);
          const dw = props.width  * ratio;
          const dh = props.height * ratio;
          doc.addImage(
            meta.foto, 'JPEG',
            data.cell.x + (CW.foto - dw) / 2,
            data.cell.y + (data.cell.height - dh) / 2,
            dw, dh,
            `fotoR${data.row.index}`,
            'FAST'
          );
        } catch { /* imagen inválida */ }
      },

      rowPageBreak: 'avoid',
    });

    // Nota al pie
    const totalItems = formsGrupo.reduce((acc, f) => acc + (f.checklist as ChecklistItem[]).length, 0);
    const conEv = formsGrupo.reduce((acc, f) =>
      acc + (f.checklist as ChecklistItem[]).filter(tieneEvidencia).length, 0);
    const yFin = (doc as any).lastAutoTable.finalY + 4;
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(120, 120, 120);
    doc.text(
      `${conEv} ítem(s) con evidencia de ${totalItems} totales${totalItems - conEv > 0 ? ` · ${totalItems - conEv} sin evidencia omitidos` : ''}.`,
      mg, yFin
    );
    doc.setTextColor(0, 0, 0);
  }

  aplicarMarcaDeAgua();
  doc.save(`${folio}.pdf`);
  return doc.output('datauristring');
}

















// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
// import type { QueuedForm } from '@/app/context/pdf-queue-context';

// // ── Tipos ──────────────────────────────────────────────────────────────────
// type GeoRef = { lat: string; lon: string; precision: string; timestamp: string };

// type EvidenceEntry = {
//   id: number;
//   observation: string;
//   geoRef: GeoRef | null;
//   photo: string | null;
// };

// type ChecklistItem = {
//   id: number | string;
//   pregunta: string;
//   respuesta: string;
//   observacion: string;
//   seccion?: string;
//   foto?: string | null;
//   geoRef?: GeoRef | null;
//   // Nuevo modelo con múltiples evidencias (FormularioUnificado)
//   evidence?: EvidenceEntry[];
// };

// // Paleta: todo negro/gris
// const C = {
//   black:   [0,   0,   0  ] as [number, number, number],
//   darkGray:[45,  45,  45 ] as [number, number, number],
//   midGray: [90,  90,  90 ] as [number, number, number],
//   lightGray:[220,220, 220] as [number, number, number],
//   white:   [255, 255, 255] as [number, number, number],
//   rowBg:   [250, 250, 250] as [number, number, number],
//   green:   [20,  110,  60] as [number, number, number],
// };

// // ── Helpers ────────────────────────────────────────────────────────────────

// /** Extrae todas las evidencias de un ítem, sea modelo viejo o nuevo */
// function getEvidences(item: ChecklistItem): Array<{ obs: string; lat: string; lon: string; foto: string | null }> {
//   // Modelo nuevo: evidence[]
//   if (Array.isArray(item.evidence) && item.evidence.length > 0) {
//     return item.evidence
//       .filter(e => e.observation || e.geoRef || e.photo)
//       .map(e => ({
//         obs:  e.observation || '',
//         lat:  e.geoRef?.lat ?? '',
//         lon:  e.geoRef?.lon ?? '',
//         foto: e.photo ?? null,
//       }));
//   }
//   // Modelo viejo: observacion + geoRef planos
//   const tieneAlgo = !!(item.observacion?.trim() || item.geoRef || item.foto);
//   if (!tieneAlgo) return [];
//   return [{
//     obs:  item.observacion || '',
//     lat:  item.geoRef?.lat ?? '',
//     lon:  item.geoRef?.lon ?? '',
//     foto: item.foto ?? null,
//   }];
// }

// const tieneEvidencia = (item: ChecklistItem): boolean => getEvidences(item).length > 0;

// export function mostrarOpcionesPostGuardado(): Promise<'otro_mismo' | 'otro_distinto' | 'generar_ahora'> {
//   return new Promise(resolve => {
//     if (window.confirm('✅ Formulario guardado.\n\n¿Llenar OTRO del mismo tipo?\n(Cancelar = usar cola flotante)'))
//       return resolve('otro_mismo');
//     resolve(
//       window.confirm('¿Generar el PDF AHORA con la cola?\n(Cancelar = seguir con otro tipo)')
//         ? 'generar_ahora' : 'otro_distinto'
//     );
//   });
// }

// // ══════════════════════════════════════════════════════════════════════════════
// //  FUNCIÓN PRINCIPAL
// //  • Agrupa por categoría → un solo encabezado por categoría
// //  • head de autoTable tiene: [banda negra de cat] + [fila de columnas]
// //    → se repite automáticamente en saltos de página, nunca se duplica
// //  • Cada evidencia adicional de un ítem = fila extra en la tabla
// // ══════════════════════════════════════════════════════════════════════════════
// export async function generarPDFCombinado(lista: QueuedForm[]): Promise<string> {
//   const doc   = new jsPDF('p', 'mm', 'a4');
//   const pageW = doc.internal.pageSize.getWidth();
//   const pageH = doc.internal.pageSize.getHeight();
//   const mg    = 12; // margin

//   // Anchos de columna: 6 columnas, suma = 210-24 = 186mm
//   // No. | Concepto | X | Y | Observaciones | Foto
//   const CW = { no: 8, concepto: 60, x: 22, y: 22, obs: 50, foto: 24 }; // 8+60+22+22+50+24=186 ✓
//   const NCOLS = 6;

//   const folio = `REV-COMB-${Math.floor(Math.random() * 9000 + 1000)}`;

//   const aplicarMarcaDeAgua = () => {
//     const total = doc.getNumberOfPages();
//     for (let i = 1; i <= total; i++) {
//       doc.setPage(i);
//       doc.saveGraphicsState();
//       doc.setGState(new (doc as any).GState({ opacity: 0.07 }));
//       doc.addImage('/logo_fonatur.png', 'PNG', (pageW - 140) / 2, (pageH - 40) / 2, 140, 40);
//       doc.restoreGraphicsState();
//     }
//   };

//   // ── Portada ───────────────────────────────────────────────────────────
//   if (lista.length > 1) {
//     let y = 30;
//     doc.setFont('helvetica', 'bold').setFontSize(15);
//     doc.text('REPORTE COMBINADO – CIP ACAPULCO-COYUCA', mg, y); y += 8;
//     doc.setFont('helvetica', 'normal').setFontSize(10);
//     doc.text(`Folio: ${folio}`, mg, y); y += 4;
//     doc.setLineWidth(0.5).line(mg, y, pageW - mg, y); y += 8;
//     doc.setFont('helvetica', 'bold').setFontSize(11).text('Contenido:', mg, y); y += 7;
//     doc.setFont('helvetica', 'normal').setFontSize(10);
//     lista.forEach((form, idx) => {
//       const fecha = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
//       const sub   = (form.formData as any).subTipo ? ` › ${(form.formData as any).subTipo}` : '';
//       doc.text(`${idx + 1}. ${form.categoria}${sub}  —  ${form.formData.sector || '—'} / ${form.formData.Tramo || '—'}  (${fecha})`, mg + 4, y);
//       y += 6;
//     });
//     doc.addPage();
//   }

//   // ── Agrupar por categoría (orden de aparición) ─────────────────────────
//   const ordenCats: string[] = [];
//   const grupos = new Map<string, QueuedForm[]>();
//   for (const form of lista) {
//     if (!grupos.has(form.categoria)) { grupos.set(form.categoria, []); ordenCats.push(form.categoria); }
//     grupos.get(form.categoria)!.push(form);
//   }

//   let primerGrupo = true;

//   for (const cat of ordenCats) {
//     const formsGrupo = grupos.get(cat)!;
//     if (!primerGrupo) doc.addPage();
//     primerGrupo = false;

//     // ── Texto de encabezado general ──────────────────────────────────
//     let y = 20;
//     doc.setFont('helvetica', 'bold').setFontSize(12);
//     doc.text('REPORTE DE MANTENIMIENTO – CIP ACAPULCO-COYUCA', mg, y); y += 4;
//     doc.setLineWidth(0.4).line(mg, y, pageW - mg, y); y += 5;

//     const sectores = [...new Set(formsGrupo.map(f => f.formData.sector).filter(Boolean))].join(', ') || '—';
//     const tramos   = [...new Set(formsGrupo.map(f => f.formData.Tramo ).filter(Boolean))].join(', ') || '—';
//     const tipo     = formsGrupo[0].formData.tipoMantenimiento ?? 'N/E';
//     const fechaStr = formsGrupo[0].fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
//     const horaStr  = formsGrupo[0].fechaCaptura.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

//     doc.setFont('helvetica', 'normal').setFontSize(8.5);
//     doc.text(`Folio: ${folio}`, mg, y);
//     doc.text(`Fecha: ${fechaStr}   Hora: ${horaStr}`, pageW / 2, y, { align: 'center' }); y += 5;
//     doc.text(`Sector: ${sectores}    Tramo: ${tramos}`, mg, y);
//     doc.setFont('helvetica', 'bold');
//     doc.text(`TIPO: ${tipo.toUpperCase()}`, pageW - mg, y, { align: 'right' });
//     doc.setFont('helvetica', 'normal'); y += 7;

//     // ── Construir filas del body ──────────────────────────────────────
//     // Estructura del body:
//     //   • Banda de sub-tipo (gris oscuro, colspan 6) — solo si hay varios sub-tipos distintos
//     //   • Banda de sección interna (gris claro, colspan 6) — cuando cambia de sección
//     //   • Filas de datos: [no, pregunta, lat, lon, obs, foto]
//     //     - Si un ítem tiene N evidencias → N filas; la primera muestra el número,
//     //       las siguientes muestran "↳ " en el campo concepto

//     type RowFoto = string | null;
//     const bodyRows: any[]      = [];
//     const fotoRows: RowFoto[]  = []; // paralelo a bodyRows; solo 'data' rows tienen foto

//     // Para didDrawCell necesitamos saber qué índice de body row es una fila de dato y su foto
//     type RowType = 'sep' | 'data';
//     const rowTypes: Array<{ type: RowType; foto?: string | null }> = [];

//     const subTiposUnicos = [...new Set(formsGrupo.map(f => (f.formData as any).subTipo).filter(Boolean))] as string[];
//     let lastSeccion = '';

//     formsGrupo.forEach(form => {
//       const checklist = (form.checklist as ChecklistItem[]).filter(tieneEvidencia);
//       if (checklist.length === 0) return;

//       const subTipo = (form.formData as any).subTipo as string | undefined;

//       // Banda de sub-tipo (solo si hay varios sub-tipos distintos o el sub-tipo ≠ cat)
//       const mostrarBandaSub = subTipo && (subTiposUnicos.length > 1 || subTipo !== cat);
//       if (mostrarBandaSub && subTipo !== lastSeccion) {
//         bodyRows.push([{
//           content: subTipo,
//           colSpan: NCOLS,
//           styles: {
//             halign: 'center', fontStyle: 'bold', fontSize: 9.5,
//             fillColor: C.darkGray, textColor: C.white,
//             cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
//           },
//         }]);
//         rowTypes.push({ type: 'sep' });
//         lastSeccion = subTipo!;
//       }

//       checklist.forEach(item => {
//         const evidences = getEvidences(item);
//         const seccion   = item.seccion ?? '';

//         // Banda de sección interna (cuando cambia dentro del mismo sub-tipo)
//         if (seccion && seccion !== lastSeccion && seccion !== subTipo && seccion !== cat) {
//           bodyRows.push([{
//             content: seccion,
//             colSpan: NCOLS,
//             styles: {
//               halign: 'left', fontStyle: 'bold', fontSize: 8.5,
//               fillColor: C.lightGray, textColor: C.black,
//               cellPadding: { top: 3, bottom: 3, left: 8, right: 4 },
//             },
//           }]);
//           rowTypes.push({ type: 'sep' });
//           lastSeccion = seccion;
//         }

//         // Una fila por evidencia
//         evidences.forEach((ev, ei) => {
//           const esExtra = ei > 0;
//           bodyRows.push([
//             // No.
//             {
//               content: esExtra ? '' : String(item.id),
//               styles: {
//                 halign: 'center', fontSize: 7.5, fontStyle: esExtra ? 'normal' : 'bold',
//                 valign: 'middle',
//                 fillColor: esExtra ? C.rowBg : C.white,
//               },
//             },
//             // Concepto
//             {
//               content: esExtra ? `↳ Evidencia ${ei + 1}` : item.pregunta,
//               styles: {
//                 fontSize: 7.5, fontStyle: esExtra ? 'italic' : 'normal',
//                 valign: 'middle',
//                 fillColor: esExtra ? C.rowBg : C.white,
//                 textColor: esExtra ? C.midGray : C.black,
//               },
//             },
//             // X (lat)
//             {
//               content: ev.lat,
//               styles: {
//                 halign: 'center', fontSize: 7,
//                 textColor: ev.lat ? C.green : C.black,
//                 valign: 'middle',
//                 fillColor: esExtra ? C.rowBg : C.white,
//               },
//             },
//             // Y (lon)
//             {
//               content: ev.lon,
//               styles: {
//                 halign: 'center', fontSize: 7,
//                 textColor: ev.lon ? C.green : C.black,
//                 valign: 'middle',
//                 fillColor: esExtra ? C.rowBg : C.white,
//               },
//             },
//             // Observaciones
//             {
//               content: ev.obs,
//               styles: {
//                 fontSize: 7.5, valign: 'top',
//                 fillColor: esExtra ? C.rowBg : C.white,
//               },
//             },
//             // Foto (contenido vacío; se dibuja en didDrawCell)
//             {
//               content: '',
//               styles: {
//                 halign: 'center', valign: 'middle',
//                 fillColor: esExtra ? C.rowBg : C.white,
//                 minCellHeight: 24,
//               },
//             },
//           ]);
//           rowTypes.push({ type: 'data', foto: ev.foto });
//         });
//       });
//     });

//     if (bodyRows.length === 0) {
//       doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(120, 120, 120);
//       doc.text('No se registraron evidencias en esta categoría.', mg, y);
//       doc.setFont('helvetica', 'normal').setTextColor(0, 0, 0);
//       continue;
//     }

//     // ── autoTable con head de dos filas ─────────────────────────────
//     // head[0] = banda negra de categoría (se repite en cada página → correcto)
//     // head[1] = nombres de columnas
//     autoTable(doc, {
//       startY: y,
//       margin: { left: mg, right: mg },

//       head: [
//         // Fila 0 — banda de categoría (negra)
//         [{
//           content: cat,
//           colSpan: NCOLS,
//           styles: {
//             halign: 'center', fontStyle: 'bold', fontSize: 11,
//             fillColor: C.black, textColor: C.white,
//             cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
//           },
//         }],
//         // Fila 1 — nombres de columnas (gris oscuro)
//         [
//           { content: 'No.',          styles: { halign: 'center' } },
//           { content: 'Concepto / Incidencia' },
//           { content: 'X (Lat)',      styles: { halign: 'center' } },
//           { content: 'Y (Lon)',      styles: { halign: 'center' } },
//           { content: 'Observaciones' },
//           { content: 'Foto',         styles: { halign: 'center' } },
//         ],
//       ],
//       headStyles: {
//         fillColor: C.midGray,
//         textColor: C.white,
//         fontStyle: 'bold',
//         fontSize: 7.5,
//         halign: 'center',
//         cellPadding: 2.5,
//       },

//       body: bodyRows,
//       theme: 'grid',

//       styles: {
//         lineWidth: 0.15,
//         lineColor: [180, 180, 180] as any,
//         fontSize: 7.5,
//         cellPadding: 2.5,
//         overflow: 'linebreak',
//         minCellHeight: 9,
//       },
//       columnStyles: {
//         0: { cellWidth: CW.no,       halign: 'center' },
//         1: { cellWidth: CW.concepto  },
//         2: { cellWidth: CW.x,        halign: 'center' },
//         3: { cellWidth: CW.y,        halign: 'center' },
//         4: { cellWidth: CW.obs       },
//         5: { cellWidth: CW.foto,     halign: 'center', minCellHeight: 24 },
//       },

//       didDrawCell: (data: any) => {
//         // Solo columna de foto (índice 5), en sección body
//         if (data.section !== 'body' || data.column.index !== 5) return;
//         const meta = rowTypes[data.row.index];
//         if (!meta || meta.type !== 'data' || !meta.foto) return;
//         try {
//           const props = doc.getImageProperties(meta.foto);
//           const maxW  = CW.foto - 2;
//           const maxH  = data.cell.height - 2;
//           const ratio = Math.min(maxW / props.width, maxH / props.height);
//           const dw = props.width  * ratio;
//           const dh = props.height * ratio;
//           doc.addImage(
//             meta.foto, 'JPEG',
//             data.cell.x + (CW.foto - dw) / 2,
//             data.cell.y + (data.cell.height - dh) / 2,
//             dw, dh,
//             `fotoR${data.row.index}`,
//             'FAST'
//           );
//         } catch { /* imagen inválida */ }
//       },

//       rowPageBreak: 'avoid',
//     });

//     // Nota al pie
//     const totalItems = formsGrupo.reduce((acc, f) => acc + (f.checklist as ChecklistItem[]).length, 0);
//     const conEv = formsGrupo.reduce((acc, f) =>
//       acc + (f.checklist as ChecklistItem[]).filter(tieneEvidencia).length, 0);
//     const yFin = (doc as any).lastAutoTable.finalY + 4;
//     doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(120, 120, 120);
//     doc.text(
//       `${conEv} ítem(s) con evidencia de ${totalItems} totales${totalItems - conEv > 0 ? ` · ${totalItems - conEv} sin evidencia omitidos` : ''}.`,
//       mg, yFin
//     );
//     doc.setTextColor(0, 0, 0);
//   }

//   aplicarMarcaDeAgua();
//   doc.save(`${folio}.pdf`);
//   return doc.output('datauristring');
// }







// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
// import type { QueuedForm } from '@/app/context/pdf-queue-context';

// // ── Tipos ────────────────────────────────────────────────────────────────
// type EvidenceEntry = {
//   observation?: string;
//   geoRef?: { lat: string; lon: string; precision: string; timestamp: string } | null;
//   photo?: string | null;
// };

// type ChecklistItem = {
//   id: number | string;
//   pregunta: string;
//   respuesta: string;
//   observacion: string;
//   seccion?: string;
//   foto?: string | null;
//   geoRef?: { lat: string; lon: string; precision: string; timestamp: string } | null;
//   evidence?: EvidenceEntry[]; // Agregado para soportar múltiples incidencias
// };

// const TITULOS: Record<string, string> = {
//   'ALUMBRADO PÚBLICO':  'LISTA DE VERIFICACIÓN – ALUMBRADO PÚBLICO',
//   'AREAS VERDES':       'LISTA DE VERIFICACIÓN – ÁREAS VERDES',
//   'BARRIDO VIALIDADES': 'LISTA DE VERIFICACIÓN – BARRIDO DE VIALIDADES',
//   'LIMPIEZA URBANA':    'LISTA DE VERIFICACIÓN – LIMPIEZA URBANA',
// };

// // ── Colores formales ───────────────────────────────────────────────────────
// const C = {
//   cat:     [15,  40,  80 ] as [number,number,number],
//   sec:     [30,  70,  130] as [number,number,number],
//   item:    [220, 230, 242] as [number,number,number],
//   itemTxt: [15,  40,  80 ] as [number,number,number],
//   col:     [55,  90,  150] as [number,number,number],
//   white:   [255, 255, 255] as [number,number,number],
//   alt:     [248, 250, 253] as [number,number,number],
// };

// // ── Ítem tiene evidencia registrada (soporta múltiples incidencias) ────────
// const tieneEvidencia = (item: ChecklistItem): boolean => {
//   if (item.evidence && item.evidence.length > 0) {
//     return item.evidence.some(e => e.observation?.trim() || e.geoRef || e.photo);
//   }
//   return !!(item.observacion?.trim() || item.geoRef || item.foto);
// };

// export function mostrarOpcionesPostGuardado(): Promise<'otro_mismo' | 'otro_distinto' | 'generar_ahora'> {
//   return new Promise(resolve => {
//     if (window.confirm('✅ Formulario guardado.\n\n¿Llenar OTRO del mismo tipo?\n(Cancelar = cola flotante)'))
//       return resolve('otro_mismo');
//     resolve(
//       window.confirm('¿Generar el PDF AHORA con la cola?\n(Cancelar = seguir con otro tipo)')
//         ? 'generar_ahora' : 'otro_distinto'
//     );
//   });
// }

// export async function generarPDFCombinado(lista: QueuedForm[]): Promise<string> {
//   const doc   = new jsPDF('p', 'mm', 'a4');
//   const pageW = doc.internal.pageSize.getWidth();
//   const pageH = doc.internal.pageSize.getHeight();
//   const margin = 12;
  
//   // 210 - 24 = 186mm útiles
//   const CW = { x: 30, y: 30, obs: 86, foto: 40 };
//   const COLS = 4;

//   const aplicarMarcaDeAgua = () => {
//     const total = (doc as any).getNumberOfPages() as number;
//     for (let i = 1; i <= total; i++) {
//       doc.setPage(i);
//       doc.saveGraphicsState();
//       doc.setGState(new (doc as any).GState({ opacity: 0.10 }));
//       doc.addImage('/logo_fonatur.png', 'PNG', (pageW - 140) / 2, (pageH - 40) / 2, 140, 40);
//       doc.restoreGraphicsState();
//     }
//   };

//   const folio = `REV-COMB-${Math.floor(Math.random() * 9000 + 1000)}`;

//   // ── Portada ───────────────────────────────────────────────────────────
//   if (lista.length > 1) {
//     let y = 30;
//     doc.setFont('helvetica', 'bold').setFontSize(16);
//     doc.text('REPORTE COMBINADO – CIP ACAPULCO-COYUCA', margin, y); y += 8;
//     doc.setFont('helvetica', 'normal').setFontSize(10);
//     doc.text(`Folio: ${folio}`, margin, y); y += 4;
//     doc.setLineWidth(0.5).line(margin, y, pageW - margin, y); y += 8;
//     doc.setFont('helvetica', 'bold').setFontSize(11).text('Contenido:', margin, y); y += 7;
//     doc.setFont('helvetica', 'normal').setFontSize(10);
//     lista.forEach((form, idx) => {
//       const fecha = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
//       doc.text(`${idx + 1}. ${form.categoria}  —  ${form.formData.sector} / ${form.formData.Tramo}  (${fecha})`, margin + 4, y);
//       y += 6;
//     });
//     doc.addPage();
//   }

//   // ── Un capítulo por formulario ────────────────────────────────────────
//   for (let index = 0; index < lista.length; index++) {
//     const form = lista[index];
//     if (index > 0) doc.addPage();

//     let y = 26;
//     const fechaStr = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
//     const horaStr  = form.fechaCaptura.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
//     const ubStr    = form.gps.lat ? `Lat: ${form.gps.lat}  |  Lon: ${form.gps.lon}` : 'No capturada';

//     // Encabezado
//     doc.setFont('helvetica', 'bold').setFontSize(12);
//     doc.text(`REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA (${index + 1}/${lista.length})`, margin, y);
//     y += 3;
//     doc.setFillColor(...C.cat); doc.rect(margin, y, pageW - margin * 2, 0.6, 'F');
//     y += 5;

//     doc.setFont('helvetica', 'normal').setFontSize(8.5);
//     doc.text(`Folio: ${folio}-${index + 1}`, margin, y);
//     doc.text(`Fecha: ${fechaStr}   Hora: ${horaStr}`, pageW / 2, y, { align: 'center' });y += 5;
//     // doc.text(ubStr, pageW - margin, y, { align: 'right' }); 
//     doc.text(
//       `Sector: ${form.formData.sector || '—'}    Tramo: ${form.formData.Tramo || '—'}    Acceso: ${form.formData.accesoPublico || 'N/E'}`,
//       margin, y
//     ); y += 5;
 
//     doc.setFont('helvetica', 'bold').setTextColor(...C.cat);
//     doc.text(`TIPO MANTENIMIENTO: ${(form.formData.tipoMantenimiento ?? 'N/E').toUpperCase()}`, margin, y);
//     doc.setFont('helvetica', 'normal').setTextColor(0, 0, 0); y += 8;

//     // Título sección
//     doc.setFont('helvetica', 'bold').setFontSize(11);
//     doc.text( 'LISTA DE VERIFICACIÓN', margin, y); y += 5;

//     // ── Filtrar ítems con evidencia ────────────────────────────────────
//     const checklist = (form.checklist as ChecklistItem[]).filter(tieneEvidencia);

//     if (checklist.length === 0) {
//       doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(120, 120, 120);
//       doc.text('No se registraron evidencias en este formulario.', margin, y);
//       doc.setFont('helvetica', 'normal').setTextColor(0, 0, 0);
//       continue;
//     }

//     // ── Agrupar por sección ────────────────────────────────────────────
//     const seccionesOrdenadas: string[] = [];
//     const porSeccion: Record<string, ChecklistItem[]> = {};
//     checklist.forEach(item => {
//       const sec = item.seccion ?? form.categoria;
//       if (!porSeccion[sec]) { porSeccion[sec] = []; seccionesOrdenadas.push(sec); }
//       porSeccion[sec].push(item);
//     });

//     // ── Construir filas ────────────────────────────────────────────────
//     type RowMeta = { type: 'cat' | 'sec' | 'item' | 'colhead' | 'data'; dataIndex?: number };
//     const bodyRows: any[]  = [];
//     const rowMeta: RowMeta[] = [];
//     const fotosPorDataRow: (string | null)[] = [];

//     // Fila de categoría
//     bodyRows.push([{
//       content: form.categoria,
//       colSpan: COLS,
//       styles: {
//         halign: 'center', fontStyle: 'bold', fontSize: 10,
//         fillColor: C.cat, textColor: C.white,
//         cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
//       },
//     }]);
//     rowMeta.push({ type: 'cat' });

//     seccionesOrdenadas.forEach(sec => {
//       const items = porSeccion[sec];

//       // Fila de sección
//       if (sec !== form.categoria) {
//         bodyRows.push([{
//           content: sec,
//           colSpan: COLS,
//           styles: {
//             halign: 'center', fontStyle: 'bold', fontSize: 9,
//             fillColor: C.sec, textColor: C.white,
//             cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
//           },
//         }]);
//         rowMeta.push({ type: 'sec' });
//       }

//       items.forEach(item => {
//         // Extraer evidencias. Soporta tanto el arreglo nuevo como compatibilidad con datos legacy.
//         let evidences: EvidenceEntry[] = [];
//         if (item.evidence && item.evidence.length > 0) {
//           evidences = item.evidence.filter(e => e.observation?.trim() || e.geoRef || e.photo);
//         } else if (item.observacion?.trim() || item.geoRef || item.foto) {
//           evidences = [{ observation: item.observacion, geoRef: item.geoRef, photo: item.foto }];
//         }

//         if (evidences.length === 0) return;

//         // Fila nombre de pregunta
//         bodyRows.push([{
//           content: `${item.id}.  ${item.pregunta}`,
//           colSpan: COLS,
//           styles: {
//             halign: 'left', fontStyle: 'bold', fontSize: 8,
//             fillColor: C.item, textColor: C.itemTxt,
//             cellPadding: { top: 3, bottom: 3, left: 6, right: 4 },
//           },
//         }]);
//         rowMeta.push({ type: 'item' });

//         // Cabeceras de columnas
//         bodyRows.push([
//           { content: 'X',             styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.5, fillColor: C.col, textColor: C.white, cellPadding: 2.5 } },
//           { content: 'Y',             styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.5, fillColor: C.col, textColor: C.white, cellPadding: 2.5 } },
//           { content: 'OBSERVACIONES', styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.5, fillColor: C.col, textColor: C.white, cellPadding: 2.5 } },
//           { content: 'FOTO',          styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.5, fillColor: C.col, textColor: C.white, cellPadding: 2.5 } },
//         ]);
//         rowMeta.push({ type: 'colhead' });

//         // Una fila de datos por CADA incidencia
//         evidences.forEach((ev, idx) => {
//           const dataIdx = fotosPorDataRow.length;
//           fotosPorDataRow.push(ev.photo || null);
          
//           // Prefijo para distinguir visualmente cuando hay más de 1 incidencia
//           const obsPrefix = evidences.length > 1 ? `[Incidencia ${idx + 1}]\n` : '';

//           bodyRows.push([
//             { content: ev.geoRef?.lat ?? '', styles: { halign: 'center', fontSize: 7, textColor: [20,100,60] as any, valign: 'middle', fillColor: C.alt } },
//             { content: ev.geoRef?.lon ?? '', styles: { halign: 'center', fontSize: 7, textColor: [20,100,60] as any, valign: 'middle', fillColor: C.alt } },
//             { content: obsPrefix + (ev.observation || ''), styles: { fontSize: 7.5, valign: 'top', fillColor: C.alt } },
//             { content: '',                   styles: { halign: 'center', valign: 'middle', fillColor: C.alt } },
//           ]);
//           rowMeta.push({ type: 'data', dataIndex: dataIdx });
//         });
//       });
//     });

//     autoTable(doc, {
//       startY: y,
//       margin: { left: margin, right: margin },
//       head: [],
//       body: bodyRows,
//       theme: 'plain',
//       tableLineColor: [180, 195, 220] as any,
//       tableLineWidth: 0.2,
//       styles: {
//         lineWidth: 0.15,
//         lineColor: [180, 195, 220] as any,
//         fontSize: 7.5,
//         cellPadding: 2.5,
//         overflow: 'linebreak',
//         minCellHeight: 10,
//       },
//       columnStyles: {
//         0: { cellWidth: CW.x,    halign: 'center' },
//         1: { cellWidth: CW.y,    halign: 'center' },
//         2: { cellWidth: CW.obs  },
//         3: { cellWidth: CW.foto, halign: 'center', minCellHeight: 26 },
//       },
//       didDrawCell: (data: any) => {
//         if (data.column.index !== 3) return; 
//         const meta = rowMeta[data.row.index];
//         if (!meta || meta.type !== 'data') return;
//         const foto = fotosPorDataRow[meta.dataIndex!];
//         if (!foto) return;
//         try {
//           const props = doc.getImageProperties(foto);
//           const maxW = CW.foto - 2;
//           const maxH = data.cell.height - 2;
//           const ratio = Math.min(maxW / props.width, maxH / props.height);
//           const dw = props.width  * ratio;
//           const dh = props.height * ratio;
//           doc.addImage(
//             foto, 'JPEG',
//             data.cell.x + (CW.foto - dw) / 2,
//             data.cell.y + (data.cell.height - dh) / 2,
//             dw, dh,
//             `foto-${index}-${meta.dataIndex}`,
//             'FAST'
//           );
//         } catch { /* imagen inválida */ }
//       },
//       rowPageBreak: 'avoid',
//     });

//     y = (doc as any).lastAutoTable.finalY + 5;

//     // Resumen al pie
//     const total     = (form.checklist as ChecklistItem[]).length;
//     const conEv     = checklist.length;
//     const sinEv     = total - conEv;
//     doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(100, 100, 100);
//     // doc.text(
//     //   `${conEv} ítem(s) con evidencia mostrados de ${total} totales${sinEv > 0 ? ` (${sinEv} sin evidencia omitidos)` : ''}.   ${ubStr}`,
//     //   margin, y
//     // );
//     doc.setTextColor(0, 0, 0);
//   }

//   aplicarMarcaDeAgua();
//   doc.save(`${folio}.pdf`);
//   return doc.output('datauristring');
// }





// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
// import type { QueuedForm } from '@/app/context/pdf-queue-context';

// type ChecklistItem = {
//   id: number | string;
//   pregunta: string;
//   respuesta: string;
//   observacion: string;
//   seccion?: string;
//   foto?: string | null;
//   geoRef?: { lat: string; lon: string; precision: string; timestamp: string } | null;
// };

// const TITULOS: Record<string, string> = {
//   'ALUMBRADO PÚBLICO':  'LISTA DE VERIFICACIÓN – ALUMBRADO PÚBLICO',
//   'AREAS VERDES':       'LISTA DE VERIFICACIÓN – ÁREAS VERDES',
//   'BARRIDO VIALIDADES': 'LISTA DE VERIFICACIÓN – BARRIDO DE VIALIDADES',
//   'LIMPIEZA URBANA':    'LISTA DE VERIFICACIÓN – LIMPIEZA URBANA',
// };

// // ── Colores formales ───────────────────────────────────────────────────────
// const C = {
//   cat:     [15,  40,  80 ] as [number,number,number],
//   sec:     [30,  70,  130] as [number,number,number],
//   item:    [220, 230, 242] as [number,number,number],
//   itemTxt: [15,  40,  80 ] as [number,number,number],
//   col:     [55,  90,  150] as [number,number,number],
//   white:   [255, 255, 255] as [number,number,number],
//   alt:     [248, 250, 253] as [number,number,number],
// };

// // ── Ítem tiene evidencia registrada ───────────────────────────────────────
// const tieneEvidencia = (item: ChecklistItem): boolean =>
//   !!(item.observacion?.trim() || item.geoRef || item.foto);

// export function mostrarOpcionesPostGuardado(): Promise<'otro_mismo' | 'otro_distinto' | 'generar_ahora'> {
//   return new Promise(resolve => {
//     if (window.confirm('✅ Formulario guardado.\n\n¿Llenar OTRO del mismo tipo?\n(Cancelar = cola flotante)'))
//       return resolve('otro_mismo');
//     resolve(
//       window.confirm('¿Generar el PDF AHORA con la cola?\n(Cancelar = seguir con otro tipo)')
//         ? 'generar_ahora' : 'otro_distinto'
//     );
//   });
// }

// export async function generarPDFCombinado(lista: QueuedForm[]): Promise<string> {
//   const doc   = new jsPDF('p', 'mm', 'a4');
//   const pageW = doc.internal.pageSize.getWidth();
//   const pageH = doc.internal.pageSize.getHeight();
//   const margin = 12;
  
//   // 210 - 24 = 186mm útiles
//   // Sin concepto, redistribuimos el ancho: X(30) | Y(30) | Observaciones(86) | Foto(40) = 186 ✓
//   const CW = { x: 30, y: 30, obs: 86, foto: 40 };
//   const COLS = 4; // Ajustado de 5 a 4 columnas

//   const aplicarMarcaDeAgua = () => {
//     const total = (doc as any).getNumberOfPages() as number;
//     for (let i = 1; i <= total; i++) {
//       doc.setPage(i);
//       doc.saveGraphicsState();
//       doc.setGState(new (doc as any).GState({ opacity: 0.10 }));
//       doc.addImage('/logo_fonatur.png', 'PNG', (pageW - 140) / 2, (pageH - 40) / 2, 140, 40);
//       doc.restoreGraphicsState();
//     }
//   };

//   const folio = `REV-COMB-${Math.floor(Math.random() * 9000 + 1000)}`;

//   // ── Portada ───────────────────────────────────────────────────────────
//   if (lista.length > 1) {
//     let y = 30;
//     doc.setFont('helvetica', 'bold').setFontSize(16);
//     doc.text('REPORTE COMBINADO – CIP ACAPULCO-COYUCA', margin, y); y += 8;
//     doc.setFont('helvetica', 'normal').setFontSize(10);
//     doc.text(`Folio: ${folio}`, margin, y); y += 4;
//     doc.setLineWidth(0.5).line(margin, y, pageW - margin, y); y += 8;
//     doc.setFont('helvetica', 'bold').setFontSize(11).text('Contenido:', margin, y); y += 7;
//     doc.setFont('helvetica', 'normal').setFontSize(10);
//     lista.forEach((form, idx) => {
//       const fecha = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
//       doc.text(`${idx + 1}. ${form.categoria}  —  ${form.formData.sector} / ${form.formData.Tramo}  (${fecha})`, margin + 4, y);
//       y += 6;
//     });
//     doc.addPage();
//   }

//   // ── Un capítulo por formulario ────────────────────────────────────────
//   for (let index = 0; index < lista.length; index++) {
//     const form = lista[index];
//     if (index > 0) doc.addPage();

//     let y = 26;
//     const fechaStr = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
//     const horaStr  = form.fechaCaptura.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
//     const ubStr    = form.gps.lat ? `Lat: ${form.gps.lat}  |  Lon: ${form.gps.lon}` : 'No capturada';

//     // Encabezado
//     doc.setFont('helvetica', 'bold').setFontSize(12);
//     doc.text(`REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA (${index + 1}/${lista.length})`, margin, y);
//     y += 3;
//     doc.setFillColor(...C.cat); doc.rect(margin, y, pageW - margin * 2, 0.6, 'F');
//     y += 5;

//     doc.setFont('helvetica', 'normal').setFontSize(8.5);
//     doc.text(`Folio: ${folio}-${index + 1}`, margin, y);
//     doc.text(`Fecha: ${fechaStr}   Hora: ${horaStr}`, pageW / 2, y, { align: 'center' });
//     doc.text(ubStr, pageW - margin, y, { align: 'right' }); y += 5;
//     doc.text(
//       `Sector: ${form.formData.sector || '—'}    Tramo: ${form.formData.Tramo || '—'}    Acceso: ${form.formData.accesoPublico || 'N/E'}`,
//       margin, y
//     ); y += 5;
 
//     doc.setFont('helvetica', 'bold').setTextColor(...C.cat);
//     doc.text(`TIPO MANTENIMIENTO: ${(form.formData.tipoMantenimiento ?? 'N/E').toUpperCase()}`, margin, y);
//     doc.setFont('helvetica', 'normal').setTextColor(0, 0, 0); y += 8;

//     // Título sección
//     doc.setFont('helvetica', 'bold').setFontSize(11);
//     doc.text(`${TITULOS[form.categoria] ?? 'LISTA DE VERIFICACIÓN'}`, margin, y); y += 5;

//     // ── Filtrar ítems con evidencia ────────────────────────────────────
//     const checklist = (form.checklist as ChecklistItem[]).filter(tieneEvidencia);

//     if (checklist.length === 0) {
//       doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(120, 120, 120);
//       doc.text('No se registraron evidencias en este formulario.', margin, y);
//       doc.setFont('helvetica', 'normal').setTextColor(0, 0, 0);
//       continue;
//     }

//     // ── Agrupar por sección ────────────────────────────────────────────
//     const seccionesOrdenadas: string[] = [];
//     const porSeccion: Record<string, ChecklistItem[]> = {};
//     checklist.forEach(item => {
//       const sec = item.seccion ?? form.categoria;
//       if (!porSeccion[sec]) { porSeccion[sec] = []; seccionesOrdenadas.push(sec); }
//       porSeccion[sec].push(item);
//     });

//     // ── Construir filas ────────────────────────────────────────────────
//     type RowMeta = { type: 'cat' | 'sec' | 'item' | 'colhead' | 'data'; dataIndex?: number };
//     const bodyRows: any[]  = [];
//     const rowMeta: RowMeta[] = [];
//     const fotosPorDataRow: (string | null)[] = [];

//     // Fila de categoría
//     bodyRows.push([{
//       content: form.categoria,
//       colSpan: COLS,
//       styles: {
//         halign: 'center', fontStyle: 'bold', fontSize: 10,
//         fillColor: C.cat, textColor: C.white,
//         cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
//       },
//     }]);
//     rowMeta.push({ type: 'cat' });

//     seccionesOrdenadas.forEach(sec => {
//       const items = porSeccion[sec];

//       // Fila de sección
//       if (sec !== form.categoria) {
//         bodyRows.push([{
//           content: sec,
//           colSpan: COLS,
//           styles: {
//             halign: 'center', fontStyle: 'bold', fontSize: 9,
//             fillColor: C.sec, textColor: C.white,
//             cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
//           },
//         }]);
//         rowMeta.push({ type: 'sec' });
//       }

//       items.forEach(item => {
//         // Fila nombre de pregunta
//         bodyRows.push([{
//           content: `${item.id}.  ${item.pregunta}`,
//           colSpan: COLS,
//           styles: {
//             halign: 'left', fontStyle: 'bold', fontSize: 8,
//             fillColor: C.item, textColor: C.itemTxt,
//             cellPadding: { top: 3, bottom: 3, left: 6, right: 4 },
//           },
//         }]);
//         rowMeta.push({ type: 'item' });

//         // Cabeceras de columnas (Solo 4)
//         bodyRows.push([
//           { content: 'X',             styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.5, fillColor: C.col, textColor: C.white, cellPadding: 2.5 } },
//           { content: 'Y',             styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.5, fillColor: C.col, textColor: C.white, cellPadding: 2.5 } },
//           { content: 'OBSERVACIONES', styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.5, fillColor: C.col, textColor: C.white, cellPadding: 2.5 } },
//           { content: 'FOTO',          styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.5, fillColor: C.col, textColor: C.white, cellPadding: 2.5 } },
//         ]);
//         rowMeta.push({ type: 'colhead' });

//         // Fila de datos (Solo 4)
//         const dataIdx = fotosPorDataRow.length;
//         fotosPorDataRow.push(item.foto || null);
//         bodyRows.push([
//           { content: item.geoRef?.lat ?? '', styles: { halign: 'center', fontSize: 7, textColor: [20,100,60] as any, valign: 'middle', fillColor: C.alt } },
//           { content: item.geoRef?.lon ?? '', styles: { halign: 'center', fontSize: 7, textColor: [20,100,60] as any, valign: 'middle', fillColor: C.alt } },
//           { content: item.observacion || '', styles: { fontSize: 7.5, valign: 'top', fillColor: C.alt } },
//           { content: '',                     styles: { halign: 'center', valign: 'middle', fillColor: C.alt } },
//         ]);
//         rowMeta.push({ type: 'data', dataIndex: dataIdx });
//       });
//     });

//     autoTable(doc, {
//       startY: y,
//       margin: { left: margin, right: margin },
//       head: [],
//       body: bodyRows,
//       theme: 'plain',
//       tableLineColor: [180, 195, 220] as any,
//       tableLineWidth: 0.2,
//       styles: {
//         lineWidth: 0.15,
//         lineColor: [180, 195, 220] as any,
//         fontSize: 7.5,
//         cellPadding: 2.5,
//         overflow: 'linebreak',
//         minCellHeight: 10,
//       },
//       columnStyles: {
//         0: { cellWidth: CW.x,    halign: 'center' },
//         1: { cellWidth: CW.y,    halign: 'center' },
//         2: { cellWidth: CW.obs  },
//         3: { cellWidth: CW.foto, halign: 'center', minCellHeight: 26 },
//       },
//       didDrawCell: (data: any) => {
//         // ¡Importante! El índice de la foto ahora es 3 (antes era 4)
//         if (data.column.index !== 3) return; 
//         const meta = rowMeta[data.row.index];
//         if (!meta || meta.type !== 'data') return;
//         const foto = fotosPorDataRow[meta.dataIndex!];
//         if (!foto) return;
//         try {
//           const props = doc.getImageProperties(foto);
//           const maxW = CW.foto - 2;
//           const maxH = data.cell.height - 2;
//           const ratio = Math.min(maxW / props.width, maxH / props.height);
//           const dw = props.width  * ratio;
//           const dh = props.height * ratio;
//           doc.addImage(
//             foto, 'JPEG',
//             data.cell.x + (CW.foto - dw) / 2,
//             data.cell.y + (data.cell.height - dh) / 2,
//             dw, dh,
//             `foto-${index}-${meta.dataIndex}`,
//             'FAST'
//           );
//         } catch { /* imagen inválida */ }
//       },
//       rowPageBreak: 'avoid',
//     });

//     y = (doc as any).lastAutoTable.finalY + 5;

//     // Resumen al pie
//     const total     = (form.checklist as ChecklistItem[]).length;
//     const conEv     = checklist.length;
//     const sinEv     = total - conEv;
//     doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(100, 100, 100);
//     doc.text(
//       `${conEv} ítem(s) con evidencia mostrados de ${total} totales${sinEv > 0 ? ` (${sinEv} sin evidencia omitidos)` : ''}.   ${ubStr}`,
//       margin, y
//     );
//     doc.setTextColor(0, 0, 0);
//   }

//   aplicarMarcaDeAgua();
//   doc.save(`${folio}.pdf`);
//   return doc.output('datauristring');
// }




// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
// import type { QueuedForm } from '@/app/context/pdf-queue-context';

// type ChecklistItem = {
//   id: number | string;
//   pregunta: string;
//   respuesta: string;
//   observacion: string;
//   seccion?: string;
//   foto?: string | null;
//   geoRef?: { lat: string; lon: string; precision: string; timestamp: string } | null;
// };

// const TITULOS: Record<string, string> = {
//   'ALUMBRADO PÚBLICO':  'LISTA DE VERIFICACIÓN – ALUMBRADO PÚBLICO',
//   'AREAS VERDES':       'LISTA DE VERIFICACIÓN – ÁREAS VERDES',
//   'BARRIDO VIALIDADES': 'LISTA DE VERIFICACIÓN – BARRIDO DE VIALIDADES',
//   'LIMPIEZA URBANA':    'LISTA DE VERIFICACIÓN – LIMPIEZA URBANA',
// };

// export function mostrarOpcionesPostGuardado(): Promise<'otro_mismo' | 'otro_distinto' | 'generar_ahora'> {
//   return new Promise(resolve => {
//     if (window.confirm('✅ Formulario guardado.\n\n¿Llenar OTRO del mismo tipo?\n(Cancelar = cola flotante)'))
//       return resolve('otro_mismo');
//     resolve(
//       window.confirm('¿Generar el PDF AHORA con la cola?\n(Cancelar = seguir con otro tipo)')
//         ? 'generar_ahora' : 'otro_distinto'
//     );
//   });
// }

// export async function generarPDFCombinado(lista: QueuedForm[]): Promise<string> {
//   const doc    = new jsPDF('p', 'mm', 'a4');
//   const pageW  = doc.internal.pageSize.getWidth();
//   const pageH  = doc.internal.pageSize.getHeight();
//   const margin = 15;

//   // ── Columnas (total = 180mm) ──────────────────────────────────────────
//   // No(12) | Concepto(66) | X(22) | Y(22) | Observaciones(36) | Foto(22) = 180
//   const CW = { no: 12, concepto: 60, x: 20, y: 20, obs: 38, foto: 30 };

//   const aplicarMarcaDeAgua = () => {
//     const total = (doc as any).getNumberOfPages() as number;
//     for (let i = 1; i <= total; i++) {
//       doc.setPage(i);
//       doc.saveGraphicsState();
//       doc.setGState(new (doc as any).GState({ opacity: 0.13 }));
//       doc.addImage('/logo_fonatur.png', 'PNG', (pageW - 140) / 2, (pageH - 40) / 2, 140, 40);
//       doc.restoreGraphicsState();
//     }
//   };

//   const folio = `REV-COMB-${Math.floor(Math.random() * 9000 + 1000)}`;

//   // ── Portada ───────────────────────────────────────────────────────────
//   if (lista.length > 1) {
//     let y = 30;
//     doc.setFont('helvetica', 'bold').setFontSize(16);
//     doc.text('REPORTE COMBINADO – CIP ACAPULCO-COYUCA', margin, y); y += 8;
//     doc.setFont('helvetica', 'normal').setFontSize(10);
//     doc.text(`Folio: ${folio}`, margin, y); y += 4;
//     doc.setLineWidth(0.5).line(margin, y, pageW - margin, y); y += 8;
//     doc.setFont('helvetica', 'bold').setFontSize(11).text('Contenido:', margin, y); y += 7;
//     doc.setFont('helvetica', 'normal').setFontSize(10);
//     lista.forEach((form, idx) => {
//       const fecha = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
//       doc.text(`${idx + 1}. ${form.categoria}  —  ${form.formData.sector} / ${form.formData.Tramo}  (${fecha})`, margin + 4, y);
//       y += 6;
//     });
//     doc.addPage();
//   }

//   // ── Un capítulo por formulario ────────────────────────────────────────
//   for (let index = 0; index < lista.length; index++) {
//     const form = lista[index];
//     if (index > 0) doc.addPage();

//     let y = 26;
//     const fechaStr = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
//     const horaStr  = form.fechaCaptura.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
//     const ubStr    = form.gps.lat ? `Lat: ${form.gps.lat}  |  Lon: ${form.gps.lon}` : 'No capturada';

//     // Encabezado
//     doc.setFont('helvetica', 'bold').setFontSize(13);
//     doc.text(`REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA (${index + 1}/${lista.length})`, margin, y);
//     y += 3; doc.setLineWidth(0.6).line(margin, y, pageW - margin, y); y += 8;

//     // Banda de categoría
//     doc.setFillColor(20, 20, 20);
//     doc.roundedRect(margin, y - 1, pageW - margin * 2, 8, 1, 1, 'F');
//     doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(255, 255, 255);
//     doc.text(form.categoria, pageW / 2, y + 4.5, { align: 'center' });
//     doc.setTextColor(0, 0, 0); y += 12;

//     // Datos generales
//     doc.setFont('helvetica', 'normal').setFontSize(9);
//     doc.text(`Folio: ${folio}-${index + 1}`, margin, y);
//     doc.text(`Fecha: ${fechaStr}`, pageW / 2, y, { align: 'center' });
//     doc.text(`Hora: ${horaStr}`, pageW - margin, y, { align: 'right' }); y += 5;
//     doc.text(`Sector: ${form.formData.sector}`, margin, y); y += 5;
//     doc.text(`Tramo: ${form.formData.Tramo}`, margin, y); y += 5;
//     doc.text(`Tramo: ${form.formData.tipoAlumbrado}`, margin, y); y += 5;

//     doc.text(`Acceso: ${form.formData.accesoPublico || 'No especificado'}`, margin, y); y += 5;
//     doc.setFont('helvetica', 'bold').text(`TIPO: ${(form.formData.tipoMantenimiento ?? 'N/E').toUpperCase()}`, margin, y);
//     doc.setFont('helvetica', 'normal'); y += 8;

//     // Título
//     doc.setFont('helvetica', 'bold').setFontSize(12);
//     doc.text(`1. ${TITULOS[form.categoria] ?? 'LISTA DE VERIFICACIÓN'}`, margin, y); y += 5;

//     // ── TABLA ─────────────────────────────────────────────────────────────
//     //
//     // La cabecera tiene dos filas:
//     //   Fila 0: No | Concepto (colspan 3) | Observaciones | Foto
//     //   Fila 1: -- | x | y | ----------- | ---
//     //
//     // El body tiene una fila por ítem donde:
//     //   col 0 = id
//     //   col 1 = pregunta  (en didDrawCell pintamos la pregunta arriba y coords abajo)
//     //   col 2 = lat (oculto visualmente — lo pinta didDrawCell dentro de col 1)
//     //   col 3 = lon (igual)
//     //   col 4 = observación
//     //   col 5 = foto (pintada en didDrawCell)
//     //
//     // Para lograr el efecto visual de la imagen usamos didDrawCell para dibujar
//     // una línea divisoria dentro de la celda concepto y las coords debajo.

//     const checklist = form.checklist as ChecklistItem[];

//     // Body: una fila por ítem — cols 2 y 3 llevan lat/lon pero las pintamos manualmente
//     const bodyRows = checklist.map(item => [
//       String(item.id),
//       item.pregunta,             // col 1: lo redibujamos en didDrawCell
//       item.geoRef?.lat ?? '',    // col 2: X
//       item.geoRef?.lon ?? '',    // col 3: Y
//       item.observacion || '',    // col 4: observaciones
//       '',                        // col 5: foto placeholder
//     ]);

//     // Guardamos una referencia para acceder en didDrawCell
//     const fotoPorFila: (string | null)[] = checklist.map(i => i.foto || null);

//     autoTable(doc, {
//       startY: y,
//       margin: { left: margin, right: margin },

//       // Cabecera doble nivel usando 6 columnas reales
//       head: [
//         // Fila 0 de cabecera
//         [
//           { content: 'No.',           styles: { halign: 'center', valign: 'middle' } },
//           { content: 'Concepto',      styles: { halign: 'center', valign: 'middle' } },
//           { content: 'X',             styles: { halign: 'center', valign: 'middle' } },
//           { content: 'Y',             styles: { halign: 'center', valign: 'middle' } },
//           { content: 'Observaciones', styles: { halign: 'center', valign: 'middle' } },
//           { content: 'Foto o liga\nde la imagen', styles: { halign: 'center', valign: 'middle' } },
//         ],
//       ],

//       body: bodyRows,
//       theme: 'grid',

//       styles: {
//         fontSize: 7.5,
//         cellPadding: 2.5,
//         valign: 'top',
//         lineWidth: 0.18,
//         overflow: 'linebreak',
//         minCellHeight: 28,
//       },
//       headStyles: {
//         fillColor: [20, 20, 20],
//         textColor: 255,
//         fontStyle: 'bold',
//         halign: 'center',
//         fontSize: 8,
//         minCellHeight: 10,
//       },
//       alternateRowStyles: { fillColor: [250, 250, 250] },
//       columnStyles: {
//         0: { cellWidth: CW.no,       halign: 'center', valign: 'middle', fontStyle: 'bold' },
//         1: { cellWidth: CW.concepto, valign: 'top'    },
//         2: { cellWidth: CW.x,        halign: 'center', valign: 'middle', textColor: [40, 100, 40] as any, fontSize: 7 },
//         3: { cellWidth: CW.y,        halign: 'center', valign: 'middle', textColor: [40, 100, 40] as any, fontSize: 7 },
//         4: { cellWidth: CW.obs,      valign: 'top'    },
//         5: { cellWidth: CW.foto,     halign: 'center', valign: 'middle' },
//       },

//       // Dibujar foto en col 5
//       didDrawCell: (data: any) => {
//         if (data.section !== 'body' || data.column.index !== 5) return;
//         const foto = fotoPorFila[data.row.index];
//         if (!foto) return;
//         try {
//           const props = doc.getImageProperties(foto);
//           const maxW  = CW.foto - 3;
//           const maxH  = data.cell.height - 3;
//           const ratio = Math.min(maxW / props.width, maxH / props.height);
//           const dw = props.width * ratio;
//           const dh = props.height * ratio;
//           doc.addImage(
//             foto, 'JPEG',
//             data.cell.x + (CW.foto - dw) / 2,
//             data.cell.y + (data.cell.height - dh) / 2,
//             dw, dh,
//             `foto-comb-${index}-${data.row.index}`,
//             'FAST'
//           );
//         } catch { /* imagen inválida */ }
//       },

//       rowPageBreak: 'avoid',
//     });

//     y = (doc as any).lastAutoTable.finalY + 6;

//     // Ubicación al pie de la tabla
//     doc.setFont('helvetica', 'bold').setFontSize(9);
//     doc.text(`Ubicación: ${ubStr}`, margin, y);
//     doc.setFont('helvetica', 'normal'); y += 8;

//   }

//   aplicarMarcaDeAgua();
//   doc.save(`${folio}.pdf`);
//   return doc.output('datauristring');
// }




// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
// import type { QueuedForm } from '@/app/context/pdf-queue-context';

// // ── Tipos internos ─────────────────────────────────────────────────────────
// type ChecklistItem = QueuedForm['checklist'][number];

// // ── Etiquetas por categoría ────────────────────────────────────────────────
// const TITULOS: Record<string, string> = {
//   'ALUMBRADO PÚBLICO':  'LISTA DE VERIFICACIÓN – ALUMBRADO PÚBLICO',
//   'AREAS VERDES':       'LISTA DE VERIFICACIÓN – ÁREAS VERDES',
//   'BARRIDO VIALIDADES': 'LISTA DE VERIFICACIÓN – BARRIDO DE VIALIDADES',
//   'LIMPIEZA URBANA':    'LISTA DE VERIFICACIÓN – LIMPIEZA URBANA',
// };

// const tieneSeparador = (categoria: string) => categoria === 'ALUMBRADO PÚBLICO';

// // ── Construir filas del checklist ──────────────────────────────────────────
// // FIX: tipo explícito en el parámetro item → elimina "implicitly has any type"
// function buildChecklistRows(checklist: ChecklistItem[], categoria: string): unknown[] {
//   const rows: unknown[] = [];
//   const separador = tieneSeparador(categoria);

//   checklist.forEach((item: ChecklistItem) => {
//     if (separador && item.id === 9) {
//       rows.push([
//         { content: 'ESTADO FÍSICO', colSpan: 2, styles: { halign: 'center', fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' } },
//         { content: 'Bueno',         styles: { halign: 'center', fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' } },
//         { content: 'Malo',          styles: { halign: 'center', fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' } },
//         { content: 'Observaciones', styles: { halign: 'center', fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' } },
//       ]);
//     }
//     const obs = item.observacion || '';
//     const geo = item.geoRef
//       ? `Lat: ${item.geoRef.lat}\nLon: ${item.geoRef.lon}\n±${item.geoRef.precision} — ${item.geoRef.timestamp}`
//       : '';
//     rows.push([
//       item.id,
//       item.pregunta,
//       item.respuesta === 'SI' ? 'X' : '',
//       item.respuesta === 'NO' ? 'X' : '',
//       [obs, geo].filter(Boolean).join('\n'),
//     ]);
//   });
//   return rows;
// }

// // ── Diálogo de 3 opciones ─────────────────────────────────────────────────
// // FIX: exportado desde aquí → los formularios lo importan, no lo definen localmente
// export function mostrarOpcionesPostGuardado(): Promise<'otro_mismo' | 'otro_distinto' | 'generar_ahora'> {
//   return new Promise(resolve => {
//     const mismo = window.confirm(
//       '✅ Formulario guardado.\n\n' +
//       '¿Quieres llenar OTRO del MISMO tipo para añadirlo al PDF?\n\n' +
//       '(Cancelar = ir a otro formulario o generar desde la cola flotante)'
//     );
//     if (mismo) return resolve('otro_mismo');

//     const ahora = window.confirm(
//       '¿Generar el PDF AHORA con los formularios en cola?\n\n' +
//       '(Cancelar = seguir llenando otro tipo de formulario)'
//     );
//     resolve(ahora ? 'generar_ahora' : 'otro_distinto');
//   });
// }

// // ── Función principal ──────────────────────────────────────────────────────
// export async function generarPDFCombinado(lista: QueuedForm[]): Promise<string> {
//   const doc        = new jsPDF('p', 'mm', 'a4');
//   const pageWidth  = doc.internal.pageSize.getWidth();
//   const pageHeight = doc.internal.pageSize.getHeight();
//   const margin     = 15;

//   // FIX: doc.getNumberOfPages() en lugar de doc.internal.getNumberOfPages()
//   // que no existe en el tipo público de jsPDF
//   const aplicarMarcaDeAgua = () => {
//     const total = (doc as any).getNumberOfPages() as number;
//     for (let i = 1; i <= total; i++) {
//       doc.setPage(i);
//       doc.saveGraphicsState();
//       doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
//       const iw = 140, ih = 40;
//       doc.addImage('/logo_fonatur.png', 'PNG', (pageWidth - iw) / 2, (pageHeight - ih) / 2, iw, ih);
//       doc.restoreGraphicsState();
//     }
//   };

//   const folio = `REV-COMB-${Math.floor(Math.random() * 9000 + 1000)}`;

//   // Portada (solo si hay más de un formulario)
//   if (lista.length > 1) {
//     let y = 30;
//     doc.setFont('helvetica', 'bold').setFontSize(16);
//     doc.text('REPORTE COMBINADO – CIP ACAPULCO-COYUCA', margin, y); y += 8;
//     doc.setFont('helvetica', 'normal').setFontSize(10);
//     doc.text(`Folio: ${folio}`, margin, y); y += 4;
//     doc.setLineWidth(0.5).line(margin, y, pageWidth - margin, y); y += 8;

//     doc.setFont('helvetica', 'bold').setFontSize(11);
//     doc.text('Contenido:', margin, y); y += 7;
//     doc.setFont('helvetica', 'normal').setFontSize(10);

//     lista.forEach((form: QueuedForm, idx: number) => {
//       const fecha = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
//       doc.text(
//         `${idx + 1}. ${form.categoria}  —  ${form.formData.sector} / ${form.formData.Tramo}  (${fecha})`,
//         margin + 4, y
//       );
//       y += 6;
//     });
//     doc.addPage();
//   }

//   for (let index = 0; index < lista.length; index++) {
//     const form: QueuedForm = lista[index];
//     if (index > 0) doc.addPage();

//     let y = 26;
//     const fechaStr = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
//     const horaStr  = form.fechaCaptura.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
//     const ubStr    = form.gps.lat ? `Lat: ${form.gps.lat}  |  Lon: ${form.gps.lon}` : 'No capturada';

//     // Encabezado
//     doc.setFont('helvetica', 'bold').setFontSize(13);
//     doc.text(`REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA (${index + 1}/${lista.length})`, margin, y);
//     y += 3; doc.setLineWidth(0.6).line(margin, y, pageWidth - margin, y); y += 8;

//     // Banda de categoría
//     doc.setFillColor(30, 30, 30);
//     doc.roundedRect(margin, y - 1, pageWidth - margin * 2, 8, 1, 1, 'F');
//     doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(255, 255, 255);
//     doc.text(form.categoria, pageWidth / 2, y + 4.5, { align: 'center' });
//     doc.setTextColor(0, 0, 0);
//     y += 12;

//     // Datos generales
//     doc.setFont('helvetica', 'normal').setFontSize(10);
//     doc.text(`Folio: ${folio}-${index + 1}`, margin, y);
//     doc.text(`Fecha: ${fechaStr}`, pageWidth / 2, y);
//     doc.text(`Hora: ${horaStr}`, pageWidth - 50, y); y += 6;
//     doc.text(`Sector: ${form.formData.sector}`, margin, y); y += 6;
//     doc.text(`Tramo: ${form.formData.Tramo}`, margin, y); y += 6;
//     doc.text(`Acceso público: ${form.formData.accesoPublico || 'No especificado'}`, margin, y); y += 6;
//     doc.setFont('helvetica', 'bold');
//     doc.text(`TIPO: ${(form.formData.tipoMantenimiento ?? 'N/E').toUpperCase()}`, margin, y);
//     doc.setFont('helvetica', 'normal'); y += 8;

//     // Checklist
//     doc.setFont('helvetica', 'bold').setFontSize(12);
//     doc.text(`1. ${TITULOS[form.categoria] ?? 'LISTA DE VERIFICACIÓN'}`, margin, y); y += 5;

//     autoTable(doc, {
//       startY: y,
//       margin: { left: margin, right: margin },
//       head: [['No.', 'Concepto Evaluado', 'Cumple', 'No Cumple', 'Observaciones / Geo-ref']],
//       body: buildChecklistRows(form.checklist, form.categoria) as any[],
//       theme: 'grid',
//       styles:      { fontSize: 8, cellPadding: 3, valign: 'top', lineWidth: 0.2, overflow: 'linebreak' },
//       headStyles:  { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', halign: 'center' },
//       columnStyles: {
//         0: { cellWidth: 10, halign: 'center' },
//         1: { cellWidth: 88 },
//         2: { cellWidth: 16, halign: 'center' },
//         3: { cellWidth: 16, halign: 'center' },
//         4: { cellWidth: 50 }, // 180 ✓
//       },
//     });

//     y = (doc as any).lastAutoTable.finalY + 8;
//     doc.setFontSize(9).text(`Ubicación: ${ubStr}`, margin, y);

//     // Geo-referencias
//     const conGeo = form.checklist.filter((item: ChecklistItem) => item.geoRef);
//     if (conGeo.length > 0) {
//       doc.addPage();
//       doc.setFont('helvetica', 'bold').setFontSize(12);
//       doc.text(`2. GEO-REFERENCIAS DE INCIDENCIAS (${index + 1}/${lista.length})`, margin, 20);
//       doc.setFont('helvetica', 'normal').setFontSize(9);
//       doc.text(`${form.categoria} — ${form.formData.sector}`, margin, 28);

//       autoTable(doc, {
//         startY: 33,
//         margin: { left: margin, right: margin },
//         head: [['No.', 'Concepto', 'Latitud', 'Longitud', 'Precisión', 'Hora']],
//         body: conGeo.map((item: ChecklistItem) => [
//           item.id, item.pregunta,
//           item.geoRef!.lat, item.geoRef!.lon, item.geoRef!.precision, item.geoRef!.timestamp,
//         ]),
//         theme: 'striped',
//         styles:      { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
//         headStyles:  { fillColor: [20, 83, 45], textColor: 255, fontStyle: 'bold', halign: 'center' },
//         columnStyles: {
//           0: { cellWidth: 10, halign: 'center' },
//           1: { cellWidth: 80 },
//           2: { cellWidth: 22, halign: 'center' },
//           3: { cellWidth: 22, halign: 'center' },
//           4: { cellWidth: 22, halign: 'center' },
//           5: { cellWidth: 24, halign: 'center' }, // 180 ✓
//         },
//       });
//     }

//     // Mapa
//     if (form.mapImage) {
//       doc.addPage();
//       doc.setFont('helvetica', 'bold').setFontSize(12);
//       doc.text(`3. MAPA DE UBICACIÓN (${index + 1}/${lista.length})`, margin, 20);
//       doc.setFont('helvetica', 'normal').setFontSize(9);
//       doc.text(`${form.categoria} — ${ubStr}`, margin, 27);
//       doc.addImage(form.mapImage, 'PNG', margin, 33, pageWidth - margin * 2, 120, '', 'FAST');
//     }

//     // Fotos
//     const imagenes = (Object.entries(form.fotos) as [string, string | null][])
//       .filter(([, v]) => v !== null) as [string, string][];

//     if (imagenes.length > 0) {
//       doc.addPage();
//       let yImg = 20;
//       doc.setFont('helvetica', 'bold').setFontSize(12);
//       doc.text(`4. EVIDENCIA FOTOGRÁFICA (${index + 1}/${lista.length})`, margin, yImg);
//       yImg += 4;
//       doc.setLineWidth(0.3).setDrawColor(200, 200, 200).line(margin, yImg + 2, pageWidth - margin, yImg + 2);
//       yImg += 10;
//       doc.setDrawColor(0, 0, 0);

//       const imgW = 82, imgH = 62, gapX = 10, gapY = 16, captH = 8;
//       let xPos = margin, n = 1;

//       for (let i = 0; i < imagenes.length; i++) {
//         const [, b64] = imagenes[i];
//         if (yImg + imgH + captH > pageHeight - 20) { doc.addPage(); yImg = 20; xPos = margin; }
//         doc.setFillColor(220, 220, 220); doc.roundedRect(xPos + 1.5, yImg + 1.5, imgW, imgH, 2, 2, 'F');
//         doc.setFillColor(255, 255, 255); doc.roundedRect(xPos, yImg, imgW, imgH, 2, 2, 'F');
//         const props = doc.getImageProperties(b64);
//         const ratio = Math.min(imgW / props.width, imgH / props.height);
//         const drawW = props.width * ratio, drawH = props.height * ratio;
//         doc.addImage(b64, 'JPEG', xPos + (imgW - drawW) / 2, yImg + (imgH - drawH) / 2, drawW, drawH, `img-${index}-${i}`, 'FAST');
//         doc.setFont('helvetica', 'italic').setFontSize(7.5).setTextColor(100, 100, 100);
//         doc.text(`Fotografía ${n}`, xPos + imgW / 2, yImg + imgH + 5.5, { align: 'center' });
//         doc.setTextColor(0, 0, 0); n++;
//         if (xPos + imgW + gapX + imgW <= pageWidth - margin) { xPos += imgW + gapX; }
//         else { xPos = margin; yImg += imgH + captH + gapY; }
//       }
//     }
//   }

//   aplicarMarcaDeAgua();

//   // Guardar el archivo localmente
//   doc.save(`${folio}.pdf`);

//   // Retornar el data URI base64 para que el llamador lo guarde en la BD
//   // Formato: "data:application/pdf;base64,JVBERi0x..."
//   return doc.output('datauristring');
// }





// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
// import type { QueuedForm } from '../../app/context/pdf-queue-context';

// // Etiquetas de sección por categoría
// const TITULOS: Record<string, string> = {
//   'ALUMBRADO PÚBLICO':  'LISTA DE VERIFICACIÓN – ALUMBRADO PÚBLICO',
//   'AREAS VERDES':       'LISTA DE VERIFICACIÓN – ÁREAS VERDES',
//   'BARRIDO VIALIDADES': 'LISTA DE VERIFICACIÓN – BARRIDO DE VIALIDADES',
//   'LIMPIEZA URBANA':    'LISTA DE VERIFICACIÓN – LIMPIEZA URBANA',
// };

// // Solo Alumbrado tiene fila separadora antes del ítem 9
// const tieneSeparador = (categoria: string) => categoria === 'ALUMBRADO PÚBLICO';

// // ── Construir filas del checklist ──────────────────────────────────────────
// function buildChecklistRows(checklist: QueuedForm['checklist'], categoria: string): any[] {
//   const rows: any[] = [];
//   const separador = tieneSeparador(categoria);

//   checklist.forEach(item => {
//     if (separador && item.id === 9) {
//       rows.push([
//         { content: 'ESTADO FÍSICO', colSpan: 2, styles: { halign: 'center', fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' } },
//         { content: 'Bueno',        styles: { halign: 'center', fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' } },
//         { content: 'Malo',         styles: { halign: 'center', fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' } },
//         { content: 'Observaciones',styles: { halign: 'center', fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' } },
//       ]);
//     }
//     const obs = item.observacion || '';
//     const geo = item.geoRef
//       ? `Lat: ${item.geoRef.lat}\nLon: ${item.geoRef.lon}\n±${item.geoRef.precision} — ${item.geoRef.timestamp}`
//       : '';
//     rows.push([
//       item.id,
//       item.pregunta,
//       item.respuesta === 'SI' ? 'X' : '',
//       item.respuesta === 'NO' ? 'X' : '',
//       [obs, geo].filter(Boolean).join('\n'),
//     ]);
//   });
//   return rows;
// }

// // ── Función principal ──────────────────────────────────────────────────────
// export async function generarPDFCombinado(lista: QueuedForm[]): Promise<void> {
//   const doc        = new jsPDF('p', 'mm', 'a4');
//   const pageWidth  = doc.internal.pageSize.getWidth();   // 210
//   const pageHeight = doc.internal.pageSize.getHeight();  // 297
//   const margin     = 15;
//   // Ancho útil = 180mm en todas las tablas

//   // ── Marca de agua (aplicada al final) ────────────────────────────────────
//   const aplicarMarcaDeAgua = () => {
//     const total = doc.getNumberOfPages()
//     for (let i = 1; i <= total; i++) {
//       doc.setPage(i);
//       doc.saveGraphicsState();
//       doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
//       const iw = 140, ih = 40;
//       doc.addImage('/logo_fonatur.png', 'PNG', (pageWidth - iw) / 2, (pageHeight - ih) / 2, iw, ih);
//       doc.restoreGraphicsState();
//     }
//   };

//   // ── Generar folio global ─────────────────────────────────────────────────
//   const folio = `REV-COMB-${Math.floor(Math.random() * 9000 + 1000)}`;

//   // ── Índice en portada ────────────────────────────────────────────────────
//   // (solo si hay más de un formulario)
//   if (lista.length > 1) {
//     let y = 30;
//     doc.setFont('helvetica', 'bold').setFontSize(16);
//     doc.text('REPORTE COMBINADO – CIP ACAPULCO-COYUCA', margin, y); y += 8;
//     doc.setFont('helvetica', 'normal').setFontSize(10);
//     doc.text(`Folio: ${folio}`, margin, y); y += 4;
//     doc.setLineWidth(0.5).line(margin, y, pageWidth - margin, y); y += 8;

//     doc.setFont('helvetica', 'bold').setFontSize(11);
//     doc.text('Contenido:', margin, y); y += 7;
//     doc.setFont('helvetica', 'normal').setFontSize(10);

//     lista.forEach((form, idx) => {
//       const fecha = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
//       doc.text(
//         `${idx + 1}. ${form.categoria}  —  ${form.formData.sector} / ${form.formData.Tramo}  (${fecha})`,
//         margin + 4, y
//       );
//       y += 6;
//     });
//     doc.addPage();
//   }

//   // ── Un formulario por "capítulo" ─────────────────────────────────────────
//   for (let index = 0; index < lista.length; index++) {
//     const form = lista[index];
//     if (index > 0 || lista.length > 1) {
//       // Si ya hay portada, la primera página de datos empieza en la página 2
//       if (index > 0) doc.addPage();
//     }

//     let y = 26;
//     const fechaStr = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
//     const horaStr  = form.fechaCaptura.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
//     const ubStr    = form.gps.lat ? `Lat: ${form.gps.lat}  |  Lon: ${form.gps.lon}` : 'No capturada';

//     // ── Encabezado ─────────────────────────────────────────────────────────
//     doc.setFont('helvetica', 'bold').setFontSize(13);
//     doc.text(`REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA (${index + 1}/${lista.length})`, margin, y);
//     y += 3; doc.setLineWidth(0.6).line(margin, y, pageWidth - margin, y); y += 8;

//     // Banda de categoría
//     doc.setFillColor(30, 30, 30);
//     doc.roundedRect(margin, y - 1, pageWidth - margin * 2, 8, 1, 1, 'F');
//     doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(255, 255, 255);
//     doc.text(form.categoria, pageWidth / 2, y + 4.5, { align: 'center' });
//     doc.setTextColor(0, 0, 0);
//     y += 12;

//     // Datos generales
//     doc.setFont('helvetica', 'normal').setFontSize(10);
//     doc.text(`Folio: ${folio}-${index + 1}`, margin, y);
//     doc.text(`Fecha: ${fechaStr}`, pageWidth / 2, y);
//     doc.text(`Hora: ${horaStr}`, pageWidth - 50, y); y += 6;
//     doc.text(`Sector: ${form.formData.sector}`, margin, y); y += 6;
//     doc.text(`Tramo: ${form.formData.Tramo}`, margin, y); y += 6;
//     doc.text(`Acceso público: ${form.formData.accesoPublico || 'No especificado'}`, margin, y); y += 6;
//     doc.setFont('helvetica', 'bold');
//     doc.text(`TIPO: ${(form.formData.tipoMantenimiento ?? 'N/E').toUpperCase()}`, margin, y);
//     doc.setFont('helvetica', 'normal'); y += 8;

//     // ── Checklist ──────────────────────────────────────────────────────────
//     doc.setFont('helvetica', 'bold').setFontSize(12);
//     doc.text(`1. ${TITULOS[form.categoria] ?? 'LISTA DE VERIFICACIÓN'}`, margin, y); y += 5;

//     autoTable(doc, {
//       startY: y,
//       margin: { left: margin, right: margin },
//       head: [['No.', 'Concepto Evaluado', 'Cumple', 'No Cumple', 'Observaciones / Geo-ref']],
//       body: buildChecklistRows(form.checklist, form.categoria),
//       theme: 'grid',
//       styles: { fontSize: 8, cellPadding: 3, valign: 'top', lineWidth: 0.2, overflow: 'linebreak' },
//       headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', halign: 'center' },
//       columnStyles: {
//         0: { cellWidth: 10, halign: 'center' },
//         1: { cellWidth: 88 },
//         2: { cellWidth: 16, halign: 'center' },
//         3: { cellWidth: 16, halign: 'center' },
//         4: { cellWidth: 50 }, // 10+88+16+16+50 = 180 ✓
//       },
//     });

//     y = (doc as any).lastAutoTable.finalY + 8;
//     // doc.setFontSize(9).text(`Ubicación: ${ubStr}`, margin, y);

//     // // ── Geo-referencias ────────────────────────────────────────────────────
//     // const conGeo = form.checklist.filter(i => i.geoRef);
//     // if (conGeo.length > 0) {
//     //   doc.addPage();
//     //   doc.setFont('helvetica', 'bold').setFontSize(12);
//     //   doc.text(`2. GEO-REFERENCIAS DE INCIDENCIAS (${index + 1}/${lista.length})`, margin, 20);
//     //   doc.setFont('helvetica', 'normal').setFontSize(9);
//     //   doc.text(`${form.categoria} — ${form.formData.sector}`, margin, 28);
//     //   autoTable(doc, {
//     //     startY: 33,
//     //     margin: { left: margin, right: margin },
//     //     head: [['No.', 'Concepto', 'Latitud', 'Longitud', 'Precisión', 'Hora']],
//     //     body: conGeo.map(item => [
//     //       item.id, item.pregunta,
//     //       item.geoRef!.lat, item.geoRef!.lon, item.geoRef!.precision, item.geoRef!.timestamp,
//     //     ]),
//     //     theme: 'striped',
//     //     styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
//     //     headStyles: { fillColor: [20, 83, 45], textColor: 255, fontStyle: 'bold', halign: 'center' },
//     //     columnStyles: {
//     //       0: { cellWidth: 10, halign: 'center' },
//     //       1: { cellWidth: 80 },
//     //       2: { cellWidth: 22, halign: 'center' },
//     //       3: { cellWidth: 22, halign: 'center' },
//     //       4: { cellWidth: 22, halign: 'center' },
//     //       5: { cellWidth: 24, halign: 'center' }, // 180 ✓
//     //     },
//     //   });
//     // }

//     // ── Mapa ───────────────────────────────────────────────────────────────
//     // if (form.mapImage) {
//     //   doc.addPage();
//     //   doc.setFont('helvetica', 'bold').setFontSize(12);
//     //   doc.text(`2. MAPA DE UBICACIÓN (${index + 1}/${lista.length})`, margin, 20);
//     //   doc.setFont('helvetica', 'normal').setFontSize(9);
//     //   doc.text(`${form.categoria} — ${ubStr}`, margin, 27);
//     //   doc.addImage(form.mapImage, 'PNG', margin, 33, pageWidth - margin * 2, 120, '', 'FAST');
//     // }

//     if (typeof form.mapImage === 'string' && form.mapImage.trim() !== '') {
//   doc.addPage();

//   doc.setFont('helvetica', 'bold');
//   doc.setFontSize(12);
//   doc.text(`2. MAPA DE UBICACIÓN (${index + 1}/${lista.length})`, margin, 20);

//   doc.setFont('helvetica', 'normal');
//   doc.setFontSize(9);
//   doc.text(`${form.categoria} — ${ubStr}`, margin, 27);

//   // Crear imagen SIN usar onload (evitamos async)
//   const img = new Image();
//   img.src = form.mapImage;

//   // Fallback seguro por si no carga dimensiones
//   const maxWidth = pageWidth - margin * 2;
//   const scale = 0.7;

//   let imgWidth = maxWidth * scale;
//   let imgHeight = imgWidth * 0.6; // proporción fallback

//   // Si ya tiene dimensiones disponibles, usar proporción real
//   if (img.width && img.height) {
//     imgHeight = (img.height / img.width) * imgWidth;
//   }

//   doc.addImage(
//     form.mapImage, // ya es string seguro
//     'PNG',
//     margin,
//     33,
//     imgWidth,
//     imgHeight,
//     undefined,
//     'MEDIUM' // buena calidad sin inflar demasiado el PDF
//   );
// }

//     // ── Fotos ──────────────────────────────────────────────────────────────
//     const imagenes = (Object.entries(form.fotos) as [string, string | null][])
//       .filter(([, v]) => v !== null) as [string, string][];

//     if (imagenes.length > 0) {
//       doc.addPage();
//       let yImg = 20;
//       doc.setFont('helvetica', 'bold').setFontSize(12);
//       doc.text(`4. EVIDENCIA FOTOGRÁFICA (${index + 1}/${lista.length})`, margin, yImg);
//       yImg += 4;
//       doc.setLineWidth(0.3).setDrawColor(200, 200, 200).line(margin, yImg + 2, pageWidth - margin, yImg + 2);
//       yImg += 10;
//       doc.setDrawColor(0, 0, 0);

//       const imgW = 82, imgH = 62, gapX = 10, gapY = 16, captH = 8;
//       let xPos = margin, n = 1;

//       for (let i = 0; i < imagenes.length; i++) {
//         const [, b64] = imagenes[i];
//         if (yImg + imgH + captH > pageHeight - 20) { doc.addPage(); yImg = 20; xPos = margin; }
//         doc.setFillColor(220, 220, 220); doc.roundedRect(xPos + 1.5, yImg + 1.5, imgW, imgH, 2, 2, 'F');
//         doc.setFillColor(255, 255, 255); doc.roundedRect(xPos, yImg, imgW, imgH, 2, 2, 'F');
//         const props = doc.getImageProperties(b64);
//         const ratio = Math.min(imgW / props.width, imgH / props.height);
//         const drawW = props.width * ratio, drawH = props.height * ratio;
//         doc.addImage(b64, 'JPEG', xPos + (imgW - drawW) / 2, yImg + (imgH - drawH) / 2, drawW, drawH, `img-${index}-${i}`, 'FAST');
//         doc.setFont('helvetica', 'italic').setFontSize(7.5).setTextColor(100, 100, 100);
//         doc.text(`Fotografía ${n}`, xPos + imgW / 2, yImg + imgH + 5.5, { align: 'center' });
//         doc.setTextColor(0, 0, 0); n++;
//         if (xPos + imgW + gapX + imgW <= pageWidth - margin) { xPos += imgW + gapX; }
//         else { xPos = margin; yImg += imgH + captH + gapY; }
//       }
//     }
//   }

//   aplicarMarcaDeAgua();
//   doc.save(`${folio}.pdf`);
// }
