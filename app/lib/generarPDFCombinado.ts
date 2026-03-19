import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { QueuedForm } from '../../app/context/pdf-queue-context';

// Etiquetas de sección por categoría
const TITULOS: Record<string, string> = {
  'ALUMBRADO PÚBLICO':  'LISTA DE VERIFICACIÓN – ALUMBRADO PÚBLICO',
  'AREAS VERDES':       'LISTA DE VERIFICACIÓN – ÁREAS VERDES',
  'BARRIDO VIALIDADES': 'LISTA DE VERIFICACIÓN – BARRIDO DE VIALIDADES',
  'LIMPIEZA URBANA':    'LISTA DE VERIFICACIÓN – LIMPIEZA URBANA',
};

// Solo Alumbrado tiene fila separadora antes del ítem 9
const tieneSeparador = (categoria: string) => categoria === 'ALUMBRADO PÚBLICO';

// ── Construir filas del checklist ──────────────────────────────────────────
function buildChecklistRows(checklist: QueuedForm['checklist'], categoria: string): any[] {
  const rows: any[] = [];
  const separador = tieneSeparador(categoria);

  checklist.forEach(item => {
    if (separador && item.id === 9) {
      rows.push([
        { content: 'ESTADO FÍSICO', colSpan: 2, styles: { halign: 'center', fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' } },
        { content: 'Bueno',        styles: { halign: 'center', fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' } },
        { content: 'Malo',         styles: { halign: 'center', fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' } },
        { content: 'Observaciones',styles: { halign: 'center', fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' } },
      ]);
    }
    const obs = item.observacion || '';
    const geo = item.geoRef
      ? `Lat: ${item.geoRef.lat}\nLon: ${item.geoRef.lon}\n±${item.geoRef.precision} — ${item.geoRef.timestamp}`
      : '';
    rows.push([
      item.id,
      item.pregunta,
      item.respuesta === 'SI' ? 'X' : '',
      item.respuesta === 'NO' ? 'X' : '',
      [obs, geo].filter(Boolean).join('\n'),
    ]);
  });
  return rows;
}

// ── Función principal ──────────────────────────────────────────────────────
export async function generarPDFCombinado(lista: QueuedForm[]): Promise<void> {
  const doc        = new jsPDF('p', 'mm', 'a4');
  const pageWidth  = doc.internal.pageSize.getWidth();   // 210
  const pageHeight = doc.internal.pageSize.getHeight();  // 297
  const margin     = 15;
  // Ancho útil = 180mm en todas las tablas

  // ── Marca de agua (aplicada al final) ────────────────────────────────────
  const aplicarMarcaDeAgua = () => {
    const total = doc.getNumberOfPages()
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
      const iw = 140, ih = 40;
      doc.addImage('/logo_fonatur.png', 'PNG', (pageWidth - iw) / 2, (pageHeight - ih) / 2, iw, ih);
      doc.restoreGraphicsState();
    }
  };

  // ── Generar folio global ─────────────────────────────────────────────────
  const folio = `REV-COMB-${Math.floor(Math.random() * 9000 + 1000)}`;

  // ── Índice en portada ────────────────────────────────────────────────────
  // (solo si hay más de un formulario)
  if (lista.length > 1) {
    let y = 30;
    doc.setFont('helvetica', 'bold').setFontSize(16);
    doc.text('REPORTE COMBINADO – CIP ACAPULCO-COYUCA', margin, y); y += 8;
    doc.setFont('helvetica', 'normal').setFontSize(10);
    doc.text(`Folio: ${folio}`, margin, y); y += 4;
    doc.setLineWidth(0.5).line(margin, y, pageWidth - margin, y); y += 8;

    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('Contenido:', margin, y); y += 7;
    doc.setFont('helvetica', 'normal').setFontSize(10);

    lista.forEach((form, idx) => {
      const fecha = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
      doc.text(
        `${idx + 1}. ${form.categoria}  —  ${form.formData.sector} / ${form.formData.Tramo}  (${fecha})`,
        margin + 4, y
      );
      y += 6;
    });
    doc.addPage();
  }

  // ── Un formulario por "capítulo" ─────────────────────────────────────────
  for (let index = 0; index < lista.length; index++) {
    const form = lista[index];
    if (index > 0 || lista.length > 1) {
      // Si ya hay portada, la primera página de datos empieza en la página 2
      if (index > 0) doc.addPage();
    }

    let y = 26;
    const fechaStr = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaStr  = form.fechaCaptura.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const ubStr    = form.gps.lat ? `Lat: ${form.gps.lat}  |  Lon: ${form.gps.lon}` : 'No capturada';

    // ── Encabezado ─────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold').setFontSize(13);
    doc.text(`REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA (${index + 1}/${lista.length})`, margin, y);
    y += 3; doc.setLineWidth(0.6).line(margin, y, pageWidth - margin, y); y += 8;

    // Banda de categoría
    doc.setFillColor(30, 30, 30);
    doc.roundedRect(margin, y - 1, pageWidth - margin * 2, 8, 1, 1, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(255, 255, 255);
    doc.text(form.categoria, pageWidth / 2, y + 4.5, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 12;

    // Datos generales
    doc.setFont('helvetica', 'normal').setFontSize(10);
    doc.text(`Folio: ${folio}-${index + 1}`, margin, y);
    doc.text(`Fecha: ${fechaStr}`, pageWidth / 2, y);
    doc.text(`Hora: ${horaStr}`, pageWidth - 50, y); y += 6;
    doc.text(`Sector: ${form.formData.sector}`, margin, y); y += 6;
    doc.text(`Tramo: ${form.formData.Tramo}`, margin, y); y += 6;
    doc.text(`Acceso público: ${form.formData.accesoPublico || 'No especificado'}`, margin, y); y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text(`TIPO: ${(form.formData.tipoMantenimiento ?? 'N/E').toUpperCase()}`, margin, y);
    doc.setFont('helvetica', 'normal'); y += 8;

    // ── Checklist ──────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold').setFontSize(12);
    doc.text(`1. ${TITULOS[form.categoria] ?? 'LISTA DE VERIFICACIÓN'}`, margin, y); y += 5;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['No.', 'Concepto Evaluado', 'Cumple', 'No Cumple', 'Observaciones / Geo-ref']],
      body: buildChecklistRows(form.checklist, form.categoria),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, valign: 'top', lineWidth: 0.2, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 88 },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 50 }, // 10+88+16+16+50 = 180 ✓
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
    // doc.setFontSize(9).text(`Ubicación: ${ubStr}`, margin, y);

    // // ── Geo-referencias ────────────────────────────────────────────────────
    // const conGeo = form.checklist.filter(i => i.geoRef);
    // if (conGeo.length > 0) {
    //   doc.addPage();
    //   doc.setFont('helvetica', 'bold').setFontSize(12);
    //   doc.text(`2. GEO-REFERENCIAS DE INCIDENCIAS (${index + 1}/${lista.length})`, margin, 20);
    //   doc.setFont('helvetica', 'normal').setFontSize(9);
    //   doc.text(`${form.categoria} — ${form.formData.sector}`, margin, 28);
    //   autoTable(doc, {
    //     startY: 33,
    //     margin: { left: margin, right: margin },
    //     head: [['No.', 'Concepto', 'Latitud', 'Longitud', 'Precisión', 'Hora']],
    //     body: conGeo.map(item => [
    //       item.id, item.pregunta,
    //       item.geoRef!.lat, item.geoRef!.lon, item.geoRef!.precision, item.geoRef!.timestamp,
    //     ]),
    //     theme: 'striped',
    //     styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    //     headStyles: { fillColor: [20, 83, 45], textColor: 255, fontStyle: 'bold', halign: 'center' },
    //     columnStyles: {
    //       0: { cellWidth: 10, halign: 'center' },
    //       1: { cellWidth: 80 },
    //       2: { cellWidth: 22, halign: 'center' },
    //       3: { cellWidth: 22, halign: 'center' },
    //       4: { cellWidth: 22, halign: 'center' },
    //       5: { cellWidth: 24, halign: 'center' }, // 180 ✓
    //     },
    //   });
    // }

    // ── Mapa ───────────────────────────────────────────────────────────────
    // if (form.mapImage) {
    //   doc.addPage();
    //   doc.setFont('helvetica', 'bold').setFontSize(12);
    //   doc.text(`2. MAPA DE UBICACIÓN (${index + 1}/${lista.length})`, margin, 20);
    //   doc.setFont('helvetica', 'normal').setFontSize(9);
    //   doc.text(`${form.categoria} — ${ubStr}`, margin, 27);
    //   doc.addImage(form.mapImage, 'PNG', margin, 33, pageWidth - margin * 2, 120, '', 'FAST');
    // }

    if (typeof form.mapImage === 'string' && form.mapImage.trim() !== '') {
  doc.addPage();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`2. MAPA DE UBICACIÓN (${index + 1}/${lista.length})`, margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${form.categoria} — ${ubStr}`, margin, 27);

  // Crear imagen SIN usar onload (evitamos async)
  const img = new Image();
  img.src = form.mapImage;

  // Fallback seguro por si no carga dimensiones
  const maxWidth = pageWidth - margin * 2;
  const scale = 0.7;

  let imgWidth = maxWidth * scale;
  let imgHeight = imgWidth * 0.6; // proporción fallback

  // Si ya tiene dimensiones disponibles, usar proporción real
  if (img.width && img.height) {
    imgHeight = (img.height / img.width) * imgWidth;
  }

  doc.addImage(
    form.mapImage, // ya es string seguro
    'PNG',
    margin,
    33,
    imgWidth,
    imgHeight,
    undefined,
    'MEDIUM' // buena calidad sin inflar demasiado el PDF
  );
}

    // ── Fotos ──────────────────────────────────────────────────────────────
    const imagenes = (Object.entries(form.fotos) as [string, string | null][])
      .filter(([, v]) => v !== null) as [string, string][];

    if (imagenes.length > 0) {
      doc.addPage();
      let yImg = 20;
      doc.setFont('helvetica', 'bold').setFontSize(12);
      doc.text(`4. EVIDENCIA FOTOGRÁFICA (${index + 1}/${lista.length})`, margin, yImg);
      yImg += 4;
      doc.setLineWidth(0.3).setDrawColor(200, 200, 200).line(margin, yImg + 2, pageWidth - margin, yImg + 2);
      yImg += 10;
      doc.setDrawColor(0, 0, 0);

      const imgW = 82, imgH = 62, gapX = 10, gapY = 16, captH = 8;
      let xPos = margin, n = 1;

      for (let i = 0; i < imagenes.length; i++) {
        const [, b64] = imagenes[i];
        if (yImg + imgH + captH > pageHeight - 20) { doc.addPage(); yImg = 20; xPos = margin; }
        doc.setFillColor(220, 220, 220); doc.roundedRect(xPos + 1.5, yImg + 1.5, imgW, imgH, 2, 2, 'F');
        doc.setFillColor(255, 255, 255); doc.roundedRect(xPos, yImg, imgW, imgH, 2, 2, 'F');
        const props = doc.getImageProperties(b64);
        const ratio = Math.min(imgW / props.width, imgH / props.height);
        const drawW = props.width * ratio, drawH = props.height * ratio;
        doc.addImage(b64, 'JPEG', xPos + (imgW - drawW) / 2, yImg + (imgH - drawH) / 2, drawW, drawH, `img-${index}-${i}`, 'FAST');
        doc.setFont('helvetica', 'italic').setFontSize(7.5).setTextColor(100, 100, 100);
        doc.text(`Fotografía ${n}`, xPos + imgW / 2, yImg + imgH + 5.5, { align: 'center' });
        doc.setTextColor(0, 0, 0); n++;
        if (xPos + imgW + gapX + imgW <= pageWidth - margin) { xPos += imgW + gapX; }
        else { xPos = margin; yImg += imgH + captH + gapY; }
      }
    }
  }

  aplicarMarcaDeAgua();
  doc.save(`${folio}.pdf`);
}
