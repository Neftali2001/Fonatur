import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { QueuedForm } from '@/app/context/pdf-queue-context';

type ChecklistItem = {
  id: number | string;
  pregunta: string;
  respuesta: string;
  observacion: string;
  seccion?: string;
  foto?: string | null;
  geoRef?: { lat: string; lon: string; precision: string; timestamp: string } | null;
};

const TITULOS: Record<string, string> = {
  'ALUMBRADO PÚBLICO':  'LISTA DE VERIFICACIÓN – ALUMBRADO PÚBLICO',
  'AREAS VERDES':       'LISTA DE VERIFICACIÓN – ÁREAS VERDES',
  'BARRIDO VIALIDADES': 'LISTA DE VERIFICACIÓN – BARRIDO DE VIALIDADES',
  'LIMPIEZA URBANA':    'LISTA DE VERIFICACIÓN – LIMPIEZA URBANA',
};

export function mostrarOpcionesPostGuardado(): Promise<'otro_mismo' | 'otro_distinto' | 'generar_ahora'> {
  return new Promise(resolve => {
    if (window.confirm('✅ Formulario guardado.\n\n¿Llenar OTRO del mismo tipo?\n(Cancelar = cola flotante)'))
      return resolve('otro_mismo');
    resolve(
      window.confirm('¿Generar el PDF AHORA con la cola?\n(Cancelar = seguir con otro tipo)')
        ? 'generar_ahora' : 'otro_distinto'
    );
  });
}

export async function generarPDFCombinado(lista: QueuedForm[]): Promise<string> {
  const doc    = new jsPDF('p', 'mm', 'a4');
  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const margin = 15;

  // ── Columnas (total = 180mm) ──────────────────────────────────────────
  // No(12) | Concepto(66) | X(22) | Y(22) | Observaciones(36) | Foto(22) = 180
  const CW = { no: 12, concepto: 60, x: 20, y: 20, obs: 38, foto: 30 };

  const aplicarMarcaDeAgua = () => {
    const total = (doc as any).getNumberOfPages() as number;
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.13 }));
      doc.addImage('/logo_fonatur.png', 'PNG', (pageW - 140) / 2, (pageH - 40) / 2, 140, 40);
      doc.restoreGraphicsState();
    }
  };

  const folio = `REV-COMB-${Math.floor(Math.random() * 9000 + 1000)}`;

  // ── Portada ───────────────────────────────────────────────────────────
  if (lista.length > 1) {
    let y = 30;
    doc.setFont('helvetica', 'bold').setFontSize(16);
    doc.text('REPORTE COMBINADO – CIP ACAPULCO-COYUCA', margin, y); y += 8;
    doc.setFont('helvetica', 'normal').setFontSize(10);
    doc.text(`Folio: ${folio}`, margin, y); y += 4;
    doc.setLineWidth(0.5).line(margin, y, pageW - margin, y); y += 8;
    doc.setFont('helvetica', 'bold').setFontSize(11).text('Contenido:', margin, y); y += 7;
    doc.setFont('helvetica', 'normal').setFontSize(10);
    lista.forEach((form, idx) => {
      const fecha = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
      doc.text(`${idx + 1}. ${form.categoria}  —  ${form.formData.sector} / ${form.formData.Tramo}  (${fecha})`, margin + 4, y);
      y += 6;
    });
    doc.addPage();
  }

  // ── Un capítulo por formulario ────────────────────────────────────────
  for (let index = 0; index < lista.length; index++) {
    const form = lista[index];
    if (index > 0) doc.addPage();

    let y = 26;
    const fechaStr = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaStr  = form.fechaCaptura.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const ubStr    = form.gps.lat ? `Lat: ${form.gps.lat}  |  Lon: ${form.gps.lon}` : 'No capturada';

    // Encabezado
    doc.setFont('helvetica', 'bold').setFontSize(13);
    doc.text(`REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA (${index + 1}/${lista.length})`, margin, y);
    y += 3; doc.setLineWidth(0.6).line(margin, y, pageW - margin, y); y += 8;

    // Banda de categoría
    doc.setFillColor(20, 20, 20);
    doc.roundedRect(margin, y - 1, pageW - margin * 2, 8, 1, 1, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(255, 255, 255);
    doc.text(form.categoria, pageW / 2, y + 4.5, { align: 'center' });
    doc.setTextColor(0, 0, 0); y += 12;

    // Datos generales
    doc.setFont('helvetica', 'normal').setFontSize(9);
    doc.text(`Folio: ${folio}-${index + 1}`, margin, y);
    doc.text(`Fecha: ${fechaStr}`, pageW / 2, y, { align: 'center' });
    doc.text(`Hora: ${horaStr}`, pageW - margin, y, { align: 'right' }); y += 5;
    doc.text(`Sector: ${form.formData.sector}`, margin, y); y += 5;
    doc.text(`Tramo: ${form.formData.Tramo}`, margin, y); y += 5;
    doc.text(`Acceso: ${form.formData.accesoPublico || 'No especificado'}`, margin, y); y += 5;
    doc.setFont('helvetica', 'bold').text(`TIPO: ${(form.formData.tipoMantenimiento ?? 'N/E').toUpperCase()}`, margin, y);
    doc.setFont('helvetica', 'normal'); y += 8;

    // Título
    doc.setFont('helvetica', 'bold').setFontSize(12);
    doc.text(`1. ${TITULOS[form.categoria] ?? 'LISTA DE VERIFICACIÓN'}`, margin, y); y += 5;

    // ── TABLA ─────────────────────────────────────────────────────────────
    //
    // La cabecera tiene dos filas:
    //   Fila 0: No | Concepto (colspan 3) | Observaciones | Foto
    //   Fila 1: -- | x | y | ----------- | ---
    //
    // El body tiene una fila por ítem donde:
    //   col 0 = id
    //   col 1 = pregunta  (en didDrawCell pintamos la pregunta arriba y coords abajo)
    //   col 2 = lat (oculto visualmente — lo pinta didDrawCell dentro de col 1)
    //   col 3 = lon (igual)
    //   col 4 = observación
    //   col 5 = foto (pintada en didDrawCell)
    //
    // Para lograr el efecto visual de la imagen usamos didDrawCell para dibujar
    // una línea divisoria dentro de la celda concepto y las coords debajo.

    const checklist = form.checklist as ChecklistItem[];

    // Body: una fila por ítem — cols 2 y 3 llevan lat/lon pero las pintamos manualmente
    const bodyRows = checklist.map(item => [
      String(item.id),
      item.pregunta,             // col 1: lo redibujamos en didDrawCell
      item.geoRef?.lat ?? '',    // col 2: X
      item.geoRef?.lon ?? '',    // col 3: Y
      item.observacion || '',    // col 4: observaciones
      '',                        // col 5: foto placeholder
    ]);

    // Guardamos una referencia para acceder en didDrawCell
    const fotoPorFila: (string | null)[] = checklist.map(i => i.foto || null);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },

      // Cabecera doble nivel usando 6 columnas reales
      head: [
        // Fila 0 de cabecera
        [
          { content: 'No.',           styles: { halign: 'center', valign: 'middle' } },
          { content: 'Concepto',      styles: { halign: 'center', valign: 'middle' } },
          { content: 'X',             styles: { halign: 'center', valign: 'middle' } },
          { content: 'Y',             styles: { halign: 'center', valign: 'middle' } },
          { content: 'Observaciones', styles: { halign: 'center', valign: 'middle' } },
          { content: 'Foto o liga\nde la imagen', styles: { halign: 'center', valign: 'middle' } },
        ],
      ],

      body: bodyRows,
      theme: 'grid',

      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        valign: 'top',
        lineWidth: 0.18,
        overflow: 'linebreak',
        minCellHeight: 28,
      },
      headStyles: {
        fillColor: [20, 20, 20],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 8,
        minCellHeight: 10,
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: CW.no,       halign: 'center', valign: 'middle', fontStyle: 'bold' },
        1: { cellWidth: CW.concepto, valign: 'top'    },
        2: { cellWidth: CW.x,        halign: 'center', valign: 'middle', textColor: [40, 100, 40] as any, fontSize: 7 },
        3: { cellWidth: CW.y,        halign: 'center', valign: 'middle', textColor: [40, 100, 40] as any, fontSize: 7 },
        4: { cellWidth: CW.obs,      valign: 'top'    },
        5: { cellWidth: CW.foto,     halign: 'center', valign: 'middle' },
      },

      // Dibujar foto en col 5
      didDrawCell: (data: any) => {
        if (data.section !== 'body' || data.column.index !== 5) return;
        const foto = fotoPorFila[data.row.index];
        if (!foto) return;
        try {
          const props = doc.getImageProperties(foto);
          const maxW  = CW.foto - 3;
          const maxH  = data.cell.height - 3;
          const ratio = Math.min(maxW / props.width, maxH / props.height);
          const dw = props.width * ratio;
          const dh = props.height * ratio;
          doc.addImage(
            foto, 'JPEG',
            data.cell.x + (CW.foto - dw) / 2,
            data.cell.y + (data.cell.height - dh) / 2,
            dw, dh,
            `foto-comb-${index}-${data.row.index}`,
            'FAST'
          );
        } catch { /* imagen inválida */ }
      },

      rowPageBreak: 'avoid',
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // Ubicación al pie de la tabla
    doc.setFont('helvetica', 'bold').setFontSize(9);
    doc.text(`Ubicación: ${ubStr}`, margin, y);
    doc.setFont('helvetica', 'normal'); y += 8;

  }

  aplicarMarcaDeAgua();
  doc.save(`${folio}.pdf`);
  return doc.output('datauristring');
}




// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
// import type { QueuedForm } from '@/app/context/pdf-queue-context';

// // ── Tipos internos ─────────────────────────────────────────────────────────
// type ChecklistItem = {
//   id: number | string;
//   pregunta: string;
//   respuesta: string;
//   observacion: string;
//   seccion?: string;
//   foto?: string | null;
//   geoRef?: { lat: string; lon: string; precision: string; timestamp: string } | null;
// };

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





// // app/api/guardar-pdf/route.ts
// import { neon } from '@neondatabase/serverless';
// import { NextRequest, NextResponse } from 'next/server';
// import { revalidatePath } from 'next/cache';

// const MAX_B64_BYTES = 4 * 1024 * 1024; // 4 MB en base64

// export async function POST(req: NextRequest) {
//   console.log('[guardar-pdf] ▶ POST recibido');

//   try {
//     const { ids, pdfBase64 } = await req.json() as { ids: string[]; pdfBase64: string };

//     console.log('[guardar-pdf] ids:', ids);
//     console.log('[guardar-pdf] pdf size MB:', (pdfBase64?.length / 1024 / 1024).toFixed(2));

//     if (!ids?.length || !pdfBase64) {
//       return NextResponse.json({ error: 'Faltan ids o pdfBase64' }, { status: 400 });
//     }

//     // PDF demasiado grande — se descargó OK pero no se guarda en BD
//     if (pdfBase64.length > MAX_B64_BYTES) {
//       console.warn(`[guardar-pdf] PDF ${(pdfBase64.length / 1024 / 1024).toFixed(1)} MB > límite 4MB — omitiendo guardado`);
//       return NextResponse.json({
//         ok: false,
//         motivo: 'pdf_demasiado_grande',
//         tamano_mb: (pdfBase64.length / 1024 / 1024).toFixed(1),
//       });
//     }

//     // Conexión directa con @neondatabase/serverless
//     const connectionString =
//       process.env.POSTGRES_URL ??
//       process.env.DATABASE_URL ??
//       process.env.NEON_DATABASE_URL;

//     if (!connectionString) {
//       console.error('[guardar-pdf] Variable de entorno de BD no encontrada');
//       return NextResponse.json({ error: 'Sin conexión a BD' }, { status: 500 });
//     }

//     const sql = neon(connectionString);
//     let actualizados = 0;

//     for (const id of ids) {
//       const res = await sql`
//         UPDATE reportes_alumbrado
//         SET pdf_base64 = ${pdfBase64}
//         WHERE id = ${id}
//         RETURNING id
//       `;
//       actualizados += res.length;
//       console.log(`[guardar-pdf] id=${id} rowCount=${res.length}`);
//     }

//     console.log('[guardar-pdf] ✅ actualizados:', actualizados);
//     revalidatePath('/dashboard/Historial');
//     return NextResponse.json({ ok: true, actualizados });

//   } catch (err) {
//     console.error('[guardar-pdf] 💥', err);
//     return NextResponse.json({ error: String(err) }, { status: 500 });
//   }
// }




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
