// app/api/generar-pdf-lote/pdf-lote-document.tsx
//
// Documento React-PDF para lote de reportes.
// Replicando el formato, diseño y flujo continuo sin saltos forzados.

import React from 'react';
import {
  Document, Page, View, Text, Image, StyleSheet, Font
} from '@react-pdf/renderer';

// ── Tipos ──────────────────────────────────────────────────────────────────
interface EvidRow {
  item_id: number;
  item_pregunta: string;
  item_seccion: string | null;
  evidencia_num: number;
  observacion: string | null;
  lat: string | null;
  lon: string | null;
  precision_gps: string | null;
  foto: string | null;
}
interface ChecklistItem {
  id: number;
  seccion: string;
  pregunta: string;
  evidence: EvidRow[];
}
interface ReporteData {
  folio: string;
  fecha: string;
  categoria: string;
  sub_tipo: string | null;
  sector: string | null;
  tramo: string | null;
  acceso_publico: string | null;
  tipo_mantenimiento: string | null;
}
interface ReporteEntry {
  reporte: ReporteData;
  checklist: ChecklistItem[];
}

// ── Paleta ─────────────────────────────────────────────────────────────────
const C = {
  black:      '#000000',
  darkGray:   '#2D2D2D',
  midGray:    '#5A5A5A',
  lightGray:  '#DCDCDC',
  white:      '#FFFFFF',
  rowBg:      '#FAFAFA',
  green:      '#285C4D',
  borderColor:'#B4B4B4',
};

// ── Anchos de Columna ──────────────────────────────────────────────────────
const CW = { 
  no: '5%', 
  concepto: '23%', 
  x: '10%', 
  y: '10%', 
  obs: '17%', 
  foto: '35%'
};

// ── Estilos ────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    paddingTop: 34,
    paddingBottom: 34,
    paddingHorizontal: 34,
    backgroundColor: C.white,
  },
  watermark: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    justifyContent: 'center', alignItems: 'center',
    zIndex: -1, opacity: 0.07,
  },
  watermarkImg: { width: 396, height: 113 },

  // Portada (Índice)
  coverTitle: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: C.black, marginBottom: 8, marginTop: 10 },
  coverFolio: { fontFamily: 'Helvetica', fontSize: 10, color: C.midGray, marginBottom: 4 },
  coverLine: { borderBottomWidth: 1.5, borderColor: C.lightGray, marginBottom: 7 },
  coverContenido: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.black, marginBottom: 7 },
  coverItem: { fontFamily: 'Helvetica', fontSize: 10, color: C.black, marginBottom: 6, paddingLeft: 4 },

  // Encabezado de Reporte
  repHeader: { marginBottom: 7 },
  repTitleMain: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: C.black, marginBottom: 4 },
  repLineMain: { borderBottomWidth: 1.2, borderColor: C.black, marginBottom: 5 },
  repSubRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  repSubRow2: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  repText: { fontFamily: 'Helvetica', fontSize: 8.5, color: C.black },
  repTextCenter: { fontFamily: 'Helvetica', fontSize: 8.5, color: C.black, textAlign: 'center', flex: 1, paddingRight: 40 },
  repType: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.black, textAlign: 'right' },

  // Wrappers de Tabla (Separados para manejar bordes correctos en saltos)
  tableWrapper: { width: '100%', borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: C.borderColor },
  tableContinuation: { width: '100%',borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: C.borderColor },
  
  catBand: { backgroundColor: C.black, paddingVertical: 5, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: C.borderColor },
  catText: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.white, textAlign: 'center' },

  thRow: { flexDirection: 'row', backgroundColor: C.midGray, borderBottomWidth: 0.5, borderColor: C.borderColor },
  thCell: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5, textAlign: 'center', paddingVertical: 3.5, borderRightWidth: 0.5, borderColor: C.borderColor },

  subBand: { backgroundColor: C.darkGray, paddingVertical: 3.5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderRightWidth: 0.5, borderColor: C.borderColor },
  subText: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: C.white, textAlign: 'center' },

  secBand: { backgroundColor: C.lightGray, paddingVertical: 3, paddingHorizontal: 8, borderBottomWidth: 0.5, borderRightWidth: 0.5, borderColor: C.borderColor },
  secText: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.black, textAlign: 'left' },

  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: C.borderColor, minHeight: 120 },
  rowAlt: { backgroundColor: C.rowBg },
  cell: { fontSize: 7.5, padding: 3, borderRightWidth: 0.5, borderColor: C.borderColor, color: C.black, justifyContent: 'center' },
  cellCenter: { textAlign: 'center' },
  cellGreen: { color: C.green },
  cellItalic: { fontStyle: 'italic', color: C.midGray },
  cellBold: { fontFamily: 'Helvetica-Bold' },

  photoContainer: { flex: 1, width: '100%', padding: 3, justifyContent: 'center', alignItems: 'center' },
  photoPlaceholder: { width: '100%', height: 110, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', borderRadius: 2 },
  photoPlaceholderText: { color: '#969696', fontSize: 6 },
  photo: { width: '100%', height: 110, objectFit: 'contain', borderRadius: 2 },

  summaryText: { fontFamily: 'Helvetica', fontSize: 7, color: '#787878', marginTop: 4 },

  footer: { position: 'absolute', bottom: 15, left: 34, right: 34, flexDirection: 'row', justifyContent: 'space-between' },
  footerTxt: { fontSize: 7, color: '#969696' },
});

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtFechaCorta(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  } catch { return iso; }
}

function fmtHora(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return ''; }
}

// ── Sección de contenido ────────────────────────────────────────────────────
function ReporteSection({ entry, folioGlobal, isFirstReport }: { entry: ReporteEntry; folioGlobal: string; isFirstReport: boolean }) {
  const { reporte, checklist } = entry;
  
  type Fila = { item: ChecklistItem; ev: EvidRow; evIdx: number; isFirst: boolean; showSec: boolean };
  const filas: Fila[] = [];
  let itemsConEvidencia = 0;
  let lastSeccion = '';

  const cat = reporte.categoria;
  const subTipo = reporte.sub_tipo;
  const mostrarBandaSub = subTipo && subTipo !== cat;

  const catUp = cat.toUpperCase().trim();
  const subTipoUp = (subTipo || '').toUpperCase().trim();

  // Pre-calcular condiciones de visualización para asegurar la integridad visual
  checklist.forEach(item => {
    const validEvs = (item.evidence || []).filter(e => e.observacion?.trim() || e.lat || e.foto);
    if (validEvs.length > 0) {
      itemsConEvidencia++;
      validEvs.forEach((ev, i) => {
        const seccionUp = (item.seccion || '').toUpperCase().trim();
        let showSec = false;
        
        if (i === 0 && seccionUp && seccionUp !== lastSeccion && seccionUp !== subTipoUp && seccionUp !== catUp) {
          showSec = true;
          lastSeccion = seccionUp;
        }

        filas.push({ item, ev, evIdx: i, isFirst: i === 0, showSec });
      });
    }
  });

  const fechaStr = fmtFechaCorta(reporte.fecha);
  const horaStr  = fmtHora(reporte.fecha);
  const sectores = reporte.sector || '—';
  const tramos   = reporte.tramo || '—';
  const acceso   = reporte.acceso_publico || '—';
  const tipoMant = reporte.tipo_mantenimiento ?? 'N/E';

  // Función para renderizar fila atando "Banda de Sección" y "Fila" para que no se separen
  const renderFila = (fila: Fila) => {
    const { item, ev, evIdx, isFirst, showSec } = fila;
    
    return (
      <View key={`${item.id}-${evIdx}`} wrap={false}>
        {showSec && (
          <View style={S.secBand}>
            <Text style={S.secText}>{item.seccion}</Text>
          </View>
        )}

        <View style={[S.row, !isFirst ? S.rowAlt : {}]}>
          <View style={[S.cell, S.cellCenter, { width: CW.no }]}>
            <Text style={isFirst ? S.cellBold : {}}>{isFirst ? String(item.id) : ''}</Text>
          </View>
          
          <View style={[S.cell, { width: CW.concepto }]}>
            {/* Texto mejorado: Da contexto a las evidencias extra si caen en una nueva página */}
            <Text style={!isFirst ? S.cellItalic : {}}>
              {isFirst 
                ? item.pregunta 
                : `↳ ${item.pregunta}\n(Evidencia ${evIdx + 1})`}
            </Text>
          </View>
          
          <View style={[S.cell, S.cellCenter, { width: CW.x }]}>
            <Text style={ev.lat ? S.cellGreen : {}}>{ev.lat || ''}</Text>
          </View>
          
          <View style={[S.cell, S.cellCenter, { width: CW.y }]}>
            <Text style={ev.lon ? S.cellGreen : {}}>{ev.lon || ''}</Text>
          </View>
          
          <View style={[S.cell, { width: CW.obs }]}>
            <Text>{ev.observacion || ''}</Text>
          </View>
          
          <View style={[S.cell, { width: CW.foto, borderRightWidth: 0 }]}>
            <View style={S.photoContainer}>
              {ev.foto && ev.foto.startsWith('data:image') ? (
                <Image src={ev.foto} style={S.photo} />
              ) : (
                <View style={S.photoPlaceholder}>
                  <Text style={S.photoPlaceholderText}>SIN FOTO</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View wrap={true} style={{ marginTop: isFirstReport ? 0 : 25 }}>
      
      {/* ── BLOQUE MAESTRO 1: Título Reporte + Encabezado Tabla + 1ra Fila ── */}
      {/* Este bloque envuelto en wrap={false} asegura que jamás veas un título suelto */}
      <View wrap={false}>
        <View style={S.repHeader}>
          <Text style={S.repTitleMain}>REPORTE DE MANTENIMIENTO – CIP ACAPULCO-COYUCA</Text>
          <View style={S.repLineMain} />
          
          <View style={S.repSubRow}>
            <Text style={S.repText}>Folio: {folioGlobal}</Text>
            <Text style={S.repTextCenter}>Fecha: {fechaStr}   Hora: {horaStr}</Text>
          </View>
          <View style={S.repSubRow2}>
            <Text style={S.repText}>Sector: {sectores}    Tramo: {tramos}    Acceso Público: {acceso}</Text>
            <Text style={S.repType}>TIPO: {tipoMant.toUpperCase()}</Text>
          </View>
        </View>

        {filas.length > 0 && (
          <View style={S.tableWrapper}>
            <View style={S.catBand}>
              <Text style={S.catText}>{cat}</Text>
            </View>

            <View style={S.thRow}>
              <Text style={[S.thCell, { width: CW.no }]}>N.</Text>
              <Text style={[S.thCell, { width: CW.concepto }]}>Concepto / Incidencia</Text>
              <Text style={[S.thCell, { width: CW.x }]}>X (Lat)</Text>
              <Text style={[S.thCell, { width: CW.y }]}>Y (Lon)</Text>
              <Text style={[S.thCell, { width: CW.obs }]}>Observaciones</Text>
              <Text style={[S.thCell, { width: CW.foto, borderRightWidth: 0 }]}>Foto</Text>
            </View>

            {mostrarBandaSub && (
              <View style={S.subBand}>
                <Text style={S.subText}>{subTipo}</Text>
              </View>
            )}

            {/* La primera fila siempre va pegada a los encabezados */}
            {renderFila(filas[0])}
          </View>
        )}

        {filas.length === 0 && (
          <Text style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: '#787878' }}>
            No se registraron evidencias en esta categoría.
          </Text>
        )}
      </View>

      {/* ── BLOQUE CONTINUO: Resto de las filas ── */}
{filas.length > 1 && (
  <View style={S.tableContinuation}>
    {filas.slice(1).map((fila, i) => {
      // La primera fila de continuación va PEGADA al mini-header
      if (i === 0) {
        return (
          <View key={`${fila.item.id}-${fila.evIdx}-cont`} wrap={false}>
            {/* Mini-header SIN fixed — solo aparece una vez, donde realmente cae */}
            <View style={[S.thRow, { opacity: 0.7 }]}>
              <Text style={[S.thCell, { width: CW.no }]}>N.</Text>
              <Text style={[S.thCell, { width: CW.concepto }]}>Concepto / Incidencia</Text>
              <Text style={[S.thCell, { width: CW.x }]}>X (Lat)</Text>
              <Text style={[S.thCell, { width: CW.y }]}>Y (Lon)</Text>
              <Text style={[S.thCell, { width: CW.obs }]}>Observaciones</Text>
              <Text style={[S.thCell, { width: CW.foto, borderRightWidth: 0 }]}>Foto</Text>
            </View>
            {renderFila(fila)}
          </View>
        );
      }
      return renderFila(fila);
    })}
  </View>
)}

      {/* ── Resumen ── */}
      {filas.length > 0 && (
        <Text style={S.summaryText} wrap={false}>
          {itemsConEvidencia} ítem(s) con evidencia de {checklist.length} totales
          {checklist.length - itemsConEvidencia > 0 ? ` · ${checklist.length - itemsConEvidencia} sin evidencia omitidos` : ''}.
        </Text>
      )}
    </View>
  );
}

// ── Documento completo ────────────────────────────────────────────────────────
export function PDFLoteDocument({
  reportes, titulo,
}: {
  reportes: ReporteEntry[];
  titulo:   string;
}) {
  const folioGlobal = `REV-COMB-${Math.floor(Math.random() * 9000 + 1000)}`;

  return (
    <Document title={titulo} author="CIP Acapulco-Coyuca">
      {/* ── Portada / Índice ── */}
      {reportes.length > 1 && (
        <Page size="A4" style={S.page}>
          <View style={S.watermark} fixed>
            <Image src="/logo_fonatur.png" style={S.watermarkImg} />
          </View>

          <Text style={S.coverTitle}>REPORTE COMBINADO – CIP ACAPULCO-COYUCA</Text>
          <Text style={S.coverFolio}>Folio: {folioGlobal}</Text>
          <View style={S.coverLine} />

          <Text style={S.coverContenido}>Contenido:</Text>
          
          {reportes.map((entry, idx) => {
            const sub = entry.reporte.sub_tipo ? ` › ${entry.reporte.sub_tipo}` : '';
            const sector = entry.reporte.sector || '—';
            const tramo = entry.reporte.tramo || '—';
            const fecha = fmtFechaCorta(entry.reporte.fecha);
            return (
              <Text key={idx} style={S.coverItem}>
                {`${idx + 1}. ${entry.reporte.categoria}${sub}  —  ${sector} / ${tramo}  (${fecha})`}
              </Text>
            );
          })}

          <View style={S.footer} fixed>
            <Text style={S.footerTxt}>{folioGlobal}</Text>
            <Text style={S.footerTxt} render={({ pageNumber, totalPages }: any) => `Pág. ${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      )}

      {/* ── TODOS LOS REPORTES EN UN SOLO FLUJO CONTINUO ── */}
      <Page size="A4" style={S.page} wrap={true}>
        {/* Elementos fijos que sí deben repetirse en todas las páginas físicas */}
        <View style={S.watermark} fixed>
          <Image src="/logo_fonatur.png" style={S.watermarkImg} />
        </View>
        <View style={S.footer} fixed>
          <Text style={S.footerTxt}>{folioGlobal}</Text>
          <Text style={S.footerTxt} render={({ pageNumber, totalPages }: any) => `Pág. ${pageNumber} / ${totalPages}`} />
        </View>

        {/* Iteración de secciones (flujo natural) */}
        {reportes.map((entry, idx) => (
          <ReporteSection
            key={idx}
            entry={entry}
            folioGlobal={folioGlobal}
            isFirstReport={idx === 0}
          />
        ))}
      </Page>
    </Document>
  );
}


















// // app/api/generar-pdf-lote/pdf-lote-document.tsx
// //
// // Documento React-PDF para lote de reportes.
// // Genera una portada con índice y luego una sección por cada reporte.

// import React from 'react';
// import {
//   Document, Page, View, Text, Image, StyleSheet,
// } from '@react-pdf/renderer';

// // ── Paleta ─────────────────────────────────────────────────────────────────
// const CAT_COLOR: Record<string, string> = {
//   'ALUMBRADO PÚBLICO': '#D97706',
//   'AREAS VERDES':      '#059669',
//   'LIMPIEZA URBANA':   '#EA580C',
//   'MOBILIARIO URBANO': '#7C3AED',
// };

// // ── Estilos ────────────────────────────────────────────────────────────────
// const S = StyleSheet.create({
//   page: {
//     fontFamily: 'Helvetica',
//     fontSize:   8,
//     color:      '#1e293b',
//     paddingTop:    28,
//     paddingBottom: 32,
//     paddingHorizontal: 26,
//     backgroundColor: '#ffffff',
//   },

//   // Portada
//   coverTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 6 },
//   coverSub:   { fontSize: 9,  color: '#64748b', textAlign: 'center', marginBottom: 20 },
//   coverLine:  { borderBottomWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },

//   // TOC
//   tocRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderColor: '#f1f5f9' },
//   tocNum:     { fontSize: 8, color: '#64748b', width: 20 },
//   tocCat:     { fontSize: 8, flex: 1 },
//   tocSub:     { fontSize: 7.5, color: '#64748b', flex: 1, paddingLeft: 8 },
//   tocSect:    { fontSize: 7.5, color: '#94a3b8' },
//   tocPg:      { fontSize: 8, fontFamily: 'Helvetica-Bold', width: 20, textAlign: 'right' },

//   // Encabezado de reporte
//   repHeader:  { marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderColor: '#e2e8f0' },
//   repTitle:   { fontSize: 11, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 3 },
//   metaRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
//   metaChip:   { flexDirection: 'row', gap: 3, backgroundColor: '#f8fafc', borderWidth: 0.5, borderColor: '#e2e8f0', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
//   metaLbl:    { fontSize: 6, color: '#94a3b8', textTransform: 'uppercase' },
//   metaVal:    { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#334155' },

//   // Cabecera tabla
//   thead:      { flexDirection: 'row', backgroundColor: '#1e293b', paddingVertical: 4, paddingHorizontal: 3, marginBottom: 1 },
//   th:         { color: '#ffffff', fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },

//   // Sección badge
//   secBadge:   { backgroundColor: '#334155', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 3, alignSelf: 'flex-start', marginTop: 8, marginBottom: 3 },
//   secTxt:     { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5 },

//   // Filas
//   row:        { flexDirection: 'row', borderBottomWidth: 0.4, borderColor: '#e2e8f0', paddingVertical: 4, paddingHorizontal: 3, minHeight: 20, alignItems: 'center' },
//   rowAlt:     { backgroundColor: '#f8fafc' },
//   cell:       { fontSize: 7.5, color: '#334155', lineHeight: 1.4 },
//   cellMono:   { fontSize: 6.5, color: '#64748b', fontFamily: 'Courier', lineHeight: 1.3 },
//   cellGray:   { fontSize: 7, color: '#94a3b8', fontStyle: 'italic' },
//   cellGreen:  { fontSize: 6.5, color: '#16a34a', fontFamily: 'Courier', lineHeight: 1.3 },

//   photo:      { width: '100%', aspectRatio: 4 / 3, objectFit: 'cover', borderRadius: 2 },

//   // Pie de página
//   footer:     { position: 'absolute', bottom: 12, left: 26, right: 26, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.4, borderColor: '#e2e8f0', paddingTop: 4 },
//   footerTxt:  { fontSize: 6.5, color: '#94a3b8' },
// });

// // Anchos de columna (mm) - suma = 148mm con padding 2×26
// const CW = { no: '6%', conc: '34%', obs: '24%', geo: '20%', foto: '16%' };

// // ── Helpers ─────────────────────────────────────────────────────────────────
// function fmtFecha(iso: string) {
//   try {
//     return new Date(iso).toLocaleString('es-MX', {
//       timeZone: 'America/Mexico_City',
//       day: '2-digit', month: '2-digit', year: 'numeric',
//       hour: '2-digit', minute: '2-digit', hour12: true,
//     });
//   } catch { return iso; }
// }

// interface EvidRow {
//   item_id: number; item_pregunta: string; item_seccion: string | null;
//   evidencia_num: number; observacion: string | null;
//   lat: string | null; lon: string | null; precision_gps: string | null;
//   foto: string | null;
// }
// interface ChecklistItem { id: number; seccion: string; pregunta: string; evidence: EvidRow[]; }
// interface ReporteData {
//   folio: string; fecha: string; categoria: string; sub_tipo: string | null;
//   sector: string | null; tramo: string | null;
//   acceso_publico: string | null; tipo_mantenimiento: string | null;
// }
// interface ReporteEntry { reporte: ReporteData; checklist: ChecklistItem[]; }

// // ── Página de contenido para un solo reporte ─────────────────────────────────
// function ReportePage({ entry, pageLabel }: { entry: ReporteEntry; pageLabel: string }) {
//   const { reporte, checklist } = entry;
//   const accent = CAT_COLOR[reporte.categoria] ?? '#285C4D';

//   // Aplanar filas
//   type Fila = { item: ChecklistItem; evIdx: number; isFirst: boolean };
//   const filas: Fila[] = [];
//   checklist.forEach(item => {
//     if (!item.evidence || item.evidence.length === 0) {
//       filas.push({ item, evIdx: -1, isFirst: true });
//     } else {
//       item.evidence.forEach((_, i) => filas.push({ item, evIdx: i, isFirst: i === 0 }));
//     }
//   });

//   let lastSec = '';

//   return (
//     <Page size="A4" style={S.page} wrap>
//       {/* Encabezado */}
//       <View style={S.repHeader} fixed>
//         <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
//           <Text style={S.repTitle}>{reporte.categoria}</Text>
//           <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#64748b', backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 3 }}>
//             {reporte.folio}
//           </Text>
//         </View>
//         <View style={S.metaRow}>
//           {reporte.sector && <View style={S.metaChip}><Text style={S.metaLbl}>Sector</Text><Text style={S.metaVal}>{reporte.sector}</Text></View>}
//           {reporte.tramo  && <View style={S.metaChip}><Text style={S.metaLbl}>Tramo</Text><Text style={S.metaVal}>{reporte.tramo}</Text></View>}
//           {reporte.sub_tipo && <View style={S.metaChip}><Text style={S.metaLbl}>Sub-tipo</Text><Text style={S.metaVal}>{reporte.sub_tipo}</Text></View>}
//           {reporte.tipo_mantenimiento && (
//             <View style={[S.metaChip, { borderColor: accent }]}>
//               <Text style={S.metaLbl}>Mantenimiento</Text>
//               <Text style={[S.metaVal, { color: accent }]}>{reporte.tipo_mantenimiento}</Text>
//             </View>
//           )}
//           <View style={S.metaChip}><Text style={S.metaLbl}>Fecha</Text><Text style={S.metaVal}>{fmtFecha(reporte.fecha)}</Text></View>
//         </View>
//       </View>

//       {/* Cabecera tabla */}
//       <View style={S.thead} fixed>
//         <Text style={[S.th, { width: CW.no, textAlign: 'center' }]}>N°</Text>
//         <Text style={[S.th, { width: CW.conc }]}>Concepto / Incidencia</Text>
//         <Text style={[S.th, { width: CW.obs }]}>Observaciones</Text>
//         <Text style={[S.th, { width: CW.geo, textAlign: 'center' }]}>Geo-referencia</Text>
//         <Text style={[S.th, { width: CW.foto, textAlign: 'center' }]}>Foto</Text>
//       </View>

//       {/* Filas */}
//       {filas.map((fila, idx) => {
//         const { item, evIdx, isFirst } = fila;
//         const ev = evIdx >= 0 ? item.evidence[evIdx] : null;
//         const isAlt = idx % 2 === 1;

//         const showBadge = isFirst && item.seccion && item.seccion !== lastSec;
//         if (showBadge) lastSec = item.seccion;

//         return (
//           <React.Fragment key={`${item.id}-${evIdx}`}>
//             {showBadge && (
//               <View style={[S.secBadge, { backgroundColor: accent }]} break={false}>
//                 <Text style={S.secTxt}>{item.seccion}</Text>
//               </View>
//             )}
//             <View style={[S.row, isAlt ? S.rowAlt : {}]} wrap={false}>
//               <View style={{ width: CW.no, alignItems: 'center' }}>
//                 <Text style={S.cell}>{isFirst ? String(item.id) : ''}</Text>
//               </View>
//               <View style={{ width: CW.conc }}>
//                 <Text style={S.cell}>{isFirst ? item.pregunta : `↳ Ev. ${evIdx + 1}`}</Text>
//               </View>
//               <View style={{ width: CW.obs }}>
//                 <Text style={ev?.observacion ? S.cell : S.cellGray}>{ev?.observacion ?? '–'}</Text>
//               </View>
//               <View style={{ width: CW.geo }}>
//                 {ev?.lat
//                   ? <>
//                       <Text style={S.cellGreen}>X: {ev.lat}</Text>
//                       <Text style={S.cellGreen}>Y: {ev.lon}</Text>
//                       {ev.precision_gps && <Text style={[S.cellMono, { color: '#22c55e' }]}>±{ev.precision_gps}</Text>}
//                     </>
//                   : <Text style={S.cellGray}>–</Text>
//                 }
//               </View>
//               <View style={{ width: CW.foto }}>
//                 {ev?.foto && typeof ev.foto === 'string' && ev.foto.startsWith('data:image')
//                   ? <Image src={ev.foto} style={S.photo} />
//                   : <Text style={S.cellGray}>–</Text>
//                 }
//               </View>
//             </View>
//           </React.Fragment>
//         );
//       })}

//       {/* Pie */}
//       <View style={S.footer} fixed>
//         <Text style={S.footerTxt}>CIP Acapulco-Coyuca — {reporte.categoria}</Text>
//         <Text style={S.footerTxt} render={({ pageNumber, totalPages }: any) => `Pág. ${pageNumber} / ${totalPages}`} />
//       </View>
//     </Page>
//   );
// }

// // ── Documento completo ────────────────────────────────────────────────────────
// export function PDFLoteDocument({
//   reportes, titulo,
// }: {
//   reportes: ReporteEntry[];
//   titulo:   string;
// }) {
//   const ahora   = new Date();
//   const fechaGen = ahora.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
//   const horaGen  = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
//   const folio    = `LOTE-${ahora.toISOString().slice(0, 10)}`;

//   return (
//     <Document title={titulo} author="CIP Acapulco-Coyuca">
//       {/* ── Portada / Índice ── */}
//       <Page size="A4" style={[S.page, { justifyContent: 'flex-start' }]}>
//         {/* Marco */}
//         <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 24, flex: 1 }}>
//           {/* Título */}
//           <Text style={[S.coverTitle, { marginTop: 20 }]}>ÍNDICE</Text>
//           <Text style={S.coverSub}>CIP Acapulco-Coyuca — Reporte de Mantenimiento</Text>
//           <View style={S.coverLine} />

//           {/* Metadatos del lote */}
//           <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
//             <Text style={{ fontSize: 8, color: '#64748b' }}>Folio: {folio}</Text>
//             <Text style={{ fontSize: 8, color: '#64748b' }}>Generado: {fechaGen}  {horaGen}</Text>
//             <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{reportes.length} reporte(s)</Text>
//           </View>

//           {/* Tabla de índice */}
//           <View style={{ borderBottomWidth: 1, borderColor: '#1e293b', marginBottom: 4, paddingBottom: 3 }}>
//             <View style={{ flexDirection: 'row' }}>
//               <Text style={[S.tocNum, { fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase' }]}>#</Text>
//               <Text style={[S.tocCat, { fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase' }]}>Categoría / Sub-tipo</Text>
//               <Text style={[S.tocSect, { fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase', width: 70 }]}>Sector / Tramo</Text>
//               <Text style={[S.tocSect, { fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase', width: 50 }]}>Tipo</Text>
//               <Text style={[S.tocSect, { fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase', width: 40 }]}>Fecha</Text>
//             </View>
//           </View>

//           {reportes.map((entry, idx) => (
//             <View key={idx} style={[S.tocRow, idx % 2 === 1 ? { backgroundColor: '#f8fafc' } : {}]}>
//               <Text style={S.tocNum}>{idx + 1}</Text>
//               <View style={{ flex: 1 }}>
//                 <Text style={[S.tocCat, { fontFamily: 'Helvetica-Bold' }]}>{entry.reporte.categoria}</Text>
//                 {entry.reporte.sub_tipo && <Text style={S.tocSub}>{entry.reporte.sub_tipo}</Text>}
//               </View>
//               <Text style={[S.tocSect, { width: 70 }]}>
//                 {[entry.reporte.sector, entry.reporte.tramo].filter(Boolean).join(' / ') || '—'}
//               </Text>
//               <Text style={[S.tocSect, { width: 50 }]}>{entry.reporte.tipo_mantenimiento ?? '—'}</Text>
//               <Text style={[S.tocSect, { width: 40 }]}>
//                 {new Date(entry.reporte.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })}
//               </Text>
//             </View>
//           ))}

//           {/* Resumen */}
//           <View style={{ marginTop: 24, borderTopWidth: 0.5, borderColor: '#e2e8f0', paddingTop: 10 }}>
//             <Text style={{ fontSize: 7.5, color: '#64748b', textAlign: 'center' }}>
//               {reportes.length} reporte(s) · CIP Acapulco-Coyuca · {fechaGen}
//             </Text>
//           </View>
//         </View>

//         <View style={S.footer}>
//           <Text style={S.footerTxt}>CIP Acapulco-Coyuca</Text>
//           <Text style={S.footerTxt}>1 / {reportes.length + 1}</Text>
//         </View>
//       </Page>

//       {/* ── Una página por reporte ── */}
//       {reportes.map((entry, idx) => (
//         <ReportePage
//           key={idx}
//           entry={entry}
//           pageLabel={String(idx + 2)}
//         />
//       ))}
//     </Document>
//   );
// }
