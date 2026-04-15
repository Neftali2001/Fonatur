// app/api/generar-pdf/pdf-document.tsx
//
// Componente React-PDF que renderiza el reporte completo.
// Se ejecuta SOLO en servidor (Node.js runtime).
// Las imágenes llegan como data-URL base64 desde la tabla evidencias.

import React from 'react';
import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from '@react-pdf/renderer';

// ── Paleta de colores por categoría ───────────────────────
const CAT_COLOR: Record<string, string> = {
  'ALUMBRADO PÚBLICO': '#D97706',
  'AREAS VERDES':      '#059669',
  'LIMPIEZA URBANA':   '#EA580C',
  'MOBILIARIO URBANO': '#7C3AED',
};

// ── Estilos ────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily:      'Helvetica',
    fontSize:        8,
    color:           '#1e293b',
    paddingTop:      28,
    paddingBottom:   28,
    paddingLeft:     28,
    paddingRight:    28,
    backgroundColor: '#ffffff',
  },

  // ── Encabezado ───────────────────────────────────────────
  headerBox: {
    marginBottom:    10,
    paddingBottom:   8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#e2e8f0',
  },
  headerRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'flex-start',
    marginBottom:    4,
  },
  title: {
    fontSize:        11,
    fontFamily:      'Helvetica-Bold',
    color:           '#0f172a',
    textTransform:   'uppercase',
    flexShrink:      1,
  },
  folio: {
    fontSize:        7.5,
    fontFamily:      'Helvetica-Bold',
    color:           '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical:   3,
    borderRadius:    3,
  },
  metaRow: {
    flexDirection:   'row',
    flexWrap:        'wrap',
    gap:             8,
    marginTop:       3,
  },
  metaChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             3,
    backgroundColor: '#f8fafc',
    borderWidth:     0.5,
    borderColor:     '#e2e8f0',
    borderRadius:    3,
    paddingHorizontal: 5,
    paddingVertical:   2,
  },
  metaLabel: { fontSize: 6.5, color: '#94a3b8', textTransform: 'uppercase' },
  metaValue: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#334155' },

  // ── Sección badge ─────────────────────────────────────────
  sectionBadge: {
    marginTop:       10,
    marginBottom:    4,
    paddingHorizontal: 6,
    paddingVertical:   3,
    borderRadius:    3,
    alignSelf:       'flex-start',
  },
  sectionText: {
    fontSize:        7,
    fontFamily:      'Helvetica-Bold',
    textTransform:   'uppercase',
    letterSpacing:   0.5,
    color:           '#ffffff',
  },

  // ── Tabla ─────────────────────────────────────────────────
  tableHeader: {
    flexDirection:   'row',
    backgroundColor: '#1e293b',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius:    3,
    marginBottom:    2,
  },
  thText: {
    color:           '#ffffff',
    fontSize:        7,
    fontFamily:      'Helvetica-Bold',
    textTransform:   'uppercase',
  },
  row: {
    flexDirection:   'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    minHeight:       22,
    alignItems:      'center',
  },
  rowAlt: { backgroundColor: '#f8fafc' },

  // Anchos de columna (suma = 100%)
  colN:    { width: '6%' },
  colConc: { width: '34%' },
  colObs:  { width: '26%' },
  colGeo:  { width: '20%' },
  colFoto: { width: '14%' },

  cellText: { fontSize: 7.5, color: '#334155', lineHeight: 1.4 },
  cellMono: { fontSize: 6.5, color: '#64748b', fontFamily: 'Courier', lineHeight: 1.3 },
  cellGray: { fontSize: 7, color: '#94a3b8', fontStyle: 'italic' },

  photo: {
    width:        '100%',
    aspectRatio:  4 / 3,
    objectFit:    'cover',
    borderRadius: 2,
  },

  // ── Pie de página ─────────────────────────────────────────
  footer: {
    position:        'absolute',
    bottom:          14,
    left:            28,
    right:           28,
    flexDirection:   'row',
    justifyContent:  'space-between',
    borderTopWidth:  0.5,
    borderTopColor:  '#e2e8f0',
    paddingTop:      4,
  },
  footerText: { fontSize: 6.5, color: '#94a3b8' },
  pageNum: {
    fontSize: 6.5,
    color:    '#94a3b8',
    render: ({ pageNumber, totalPages }: any) => `${pageNumber} / ${totalPages}`,
  },
});

// ── Helpers ────────────────────────────────────────────────
function chipFecha(fechaIso: string): string {
  try {
    return new Date(fechaIso).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return fechaIso; }
}

// ── Tipos ──────────────────────────────────────────────────
interface EvidRow {
  item_id:       number;
  item_pregunta: string;
  item_seccion:  string | null;
  evidencia_num: number;
  observacion:   string | null;
  lat:           string | null;
  lon:           string | null;
  precision_gps: string | null;
  foto:          string | null;
}
interface ChecklistItem {
  id:       number;
  seccion:  string;
  pregunta: string;
  evidence: EvidRow[];
}
interface Reporte {
  folio:              string;
  fecha:              string;
  categoria:          string;
  sub_tipo:           string | null;
  sector:             string | null;
  tramo:              string | null;
  acceso_publico:     string | null;
  tipo_mantenimiento: string | null;
}

// ── Componente principal ───────────────────────────────────
export function PDFDocument({
  reporte,
  checklist,
}: {
  reporte: Reporte;
  checklist: ChecklistItem[];
}) {
  const accentColor = CAT_COLOR[reporte.categoria] ?? '#285C4D';
  const fechaStr    = chipFecha(reporte.fecha);
  const folio       = reporte.folio ?? '–';

  // Agrupar filas: (ítem, índice de evidencia)
  type Fila = {
    item:     ChecklistItem;
    evIdx:    number;          // índice dentro de item.evidence (-1 = primera sin evidencia)
    isFirst:  boolean;
  };

  const filas: Fila[] = [];
  checklist.forEach(item => {
    if (!item.evidence || item.evidence.length === 0) {
      filas.push({ item, evIdx: -1, isFirst: true });
    } else {
      item.evidence.forEach((_, i) => {
        filas.push({ item, evIdx: i, isFirst: i === 0 });
      });
    }
  });

  // Agrupar por sección para insertar badges
  let lastSeccion = '';

  return (
    <Document
      title={`Reporte ${folio}`}
      author="CIP Acapulco-Coyuca"
      subject={reporte.categoria}
    >
      <Page size="A4" style={S.page} wrap>

        {/* ── ENCABEZADO ─────────────────────────────── */}
        <View style={S.headerBox} fixed>
          <View style={S.headerRow}>
            <Text style={S.title}>
              Reporte {reporte.categoria} — CIP Acapulco-Coyuca
            </Text>
            <Text style={S.folio}>{folio}</Text>
          </View>

          <View style={S.metaRow}>
            {reporte.sector && (
              <View style={S.metaChip}>
                <Text style={S.metaLabel}>Sector</Text>
                <Text style={S.metaValue}>{reporte.sector}</Text>
              </View>
            )}
            {reporte.tramo && (
              <View style={S.metaChip}>
                <Text style={S.metaLabel}>Tramo</Text>
                <Text style={S.metaValue}>{reporte.tramo}</Text>
              </View>
            )}
            {/* ── FIX: Añadido acceso a playa aquí ── */}
            {reporte.acceso_publico && (
              <View style={S.metaChip}>
                <Text style={S.metaLabel}>Acceso</Text>
                <Text style={S.metaValue}>{reporte.acceso_publico}</Text>
              </View>
            )}
            {reporte.sub_tipo && (
              <View style={S.metaChip}>
                <Text style={S.metaLabel}>Sub-tipo</Text>
                <Text style={S.metaValue}>{reporte.sub_tipo}</Text>
              </View>
            )}
            {reporte.tipo_mantenimiento && (
              <View style={[S.metaChip, { borderColor: accentColor }]}>
                <Text style={S.metaLabel}>Mantenimiento</Text>
                <Text style={[S.metaValue, { color: accentColor }]}>
                  {reporte.tipo_mantenimiento}
                </Text>
              </View>
            )}
            <View style={S.metaChip}>
              <Text style={S.metaLabel}>Fecha</Text>
              <Text style={S.metaValue}>{fechaStr}</Text>
            </View>
          </View>
        </View>

        {/* ── CABECERA DE TABLA ─────────────────────── */}
        <View style={S.tableHeader} fixed>
          <Text style={[S.thText, S.colN]}>N°</Text>
          <Text style={[S.thText, S.colConc]}>Concepto / Incidencia</Text>
          <Text style={[S.thText, S.colObs]}>Observaciones</Text>
          <Text style={[S.thText, S.colGeo]}>Geo-referencia</Text>
          <Text style={[S.thText, S.colFoto]}>Foto</Text>
        </View>

        {/* ── FILAS ─────────────────────────────────── */}
        {filas.map((fila, rowIdx) => {
          const { item, evIdx, isFirst } = fila;
          const ev = evIdx >= 0 ? item.evidence[evIdx] : null;
          const isAlt = rowIdx % 2 === 1;

          // Badge de sección antes de la primera fila de cada sección
          const showBadge = isFirst && item.seccion !== lastSeccion;
          if (showBadge) lastSeccion = item.seccion;

          return (
            <React.Fragment key={`${item.id}-${evIdx}`}>
              {showBadge && (
                <View
                  style={[S.sectionBadge, { backgroundColor: accentColor }]}
                  break={false}
                >
                  <Text style={S.sectionText}>{item.seccion}</Text>
                </View>
              )}
              <View style={[S.row, isAlt ? S.rowAlt : {}]} wrap={false}>

                {/* N° */}
                <View style={S.colN}>
                  <Text style={S.cellText}>
                    {isFirst ? String(item.id) : ''}
                  </Text>
                </View>

                {/* Concepto */}
                <View style={S.colConc}>
                  <Text style={S.cellText}>
                    {isFirst
                      ? item.pregunta
                      : `↳ Evidencia ${evIdx + 1}`}
                  </Text>
                </View>

                {/* Observaciones */}
                <View style={S.colObs}>
                  <Text style={ev?.observacion ? S.cellText : S.cellGray}>
                    {ev?.observacion ?? '–'}
                  </Text>
                </View>

                {/* Geo-referencia */}
                <View style={S.colGeo}>
                  {ev?.lat ? (
                    <>
                      <Text style={S.cellMono}>X: {ev.lat}</Text>
                      <Text style={S.cellMono}>Y: {ev.lon}</Text>
                      {ev.precision_gps && (
                        <Text style={[S.cellMono, { color: '#22c55e' }]}>
                          ±{ev.precision_gps}
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text style={S.cellGray}>–</Text>
                  )}
                </View>

                {/* Foto */}
                <View style={S.colFoto}>
                  {ev?.foto &&
                   typeof ev.foto === 'string' &&
                   ev.foto.startsWith('data:image') ? (
                    <Image src={ev.foto} style={S.photo} />
                  ) : (
                    <Text style={S.cellGray}>–</Text>
                  )}
                </View>

              </View>
            </React.Fragment>
          );
        })}

        {/* ── PIE DE PÁGINA ─────────────────────────── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>
            CIP Acapulco-Coyuca — {reporte.categoria}
          </Text>
          <Text
            style={S.footerText}
            render={({ pageNumber, totalPages }: any) =>
              `Pág. ${pageNumber} / ${totalPages}`
            }
          />
        </View>

      </Page>
    </Document>
  );
}








// // app/api/generar-pdf/pdf-document.tsx
// //
// // Componente React-PDF que renderiza el reporte completo.
// // Se ejecuta SOLO en servidor (Node.js runtime).
// // Las imágenes llegan como data-URL base64 desde la tabla evidencias.

// import React from 'react';
// import {
//   Document, Page, View, Text, Image, StyleSheet, Font,
// } from '@react-pdf/renderer';

// // ── Paleta de colores por categoría ───────────────────────
// const CAT_COLOR: Record<string, string> = {
//   'ALUMBRADO PÚBLICO': '#D97706',
//   'AREAS VERDES':      '#059669',
//   'LIMPIEZA URBANA':   '#EA580C',
//   'MOBILIARIO URBANO': '#7C3AED',
// };

// // ── Estilos ────────────────────────────────────────────────
// const S = StyleSheet.create({
//   page: {
//     fontFamily:      'Helvetica',
//     fontSize:        8,
//     color:           '#1e293b',
//     paddingTop:      28,
//     paddingBottom:   28,
//     paddingLeft:     28,
//     paddingRight:    28,
//     backgroundColor: '#ffffff',
//   },

//   // ── Encabezado ───────────────────────────────────────────
//   headerBox: {
//     marginBottom:    10,
//     paddingBottom:   8,
//     borderBottomWidth: 1.5,
//     borderBottomColor: '#e2e8f0',
//   },
//   headerRow: {
//     flexDirection:   'row',
//     justifyContent:  'space-between',
//     alignItems:      'flex-start',
//     marginBottom:    4,
//   },
//   title: {
//     fontSize:        11,
//     fontFamily:      'Helvetica-Bold',
//     color:           '#0f172a',
//     textTransform:   'uppercase',
//     flexShrink:      1,
//   },
//   folio: {
//     fontSize:        7.5,
//     fontFamily:      'Helvetica-Bold',
//     color:           '#64748b',
//     backgroundColor: '#f1f5f9',
//     paddingHorizontal: 6,
//     paddingVertical:   3,
//     borderRadius:    3,
//   },
//   metaRow: {
//     flexDirection:   'row',
//     flexWrap:        'wrap',
//     gap:             8,
//     marginTop:       3,
//   },
//   metaChip: {
//     flexDirection:   'row',
//     alignItems:      'center',
//     gap:             3,
//     backgroundColor: '#f8fafc',
//     borderWidth:     0.5,
//     borderColor:     '#e2e8f0',
//     borderRadius:    3,
//     paddingHorizontal: 5,
//     paddingVertical:   2,
//   },
//   metaLabel: { fontSize: 6.5, color: '#94a3b8', textTransform: 'uppercase' },
//   metaValue: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#334155' },

//   // ── Sección badge ─────────────────────────────────────────
//   sectionBadge: {
//     marginTop:       10,
//     marginBottom:    4,
//     paddingHorizontal: 6,
//     paddingVertical:   3,
//     borderRadius:    3,
//     alignSelf:       'flex-start',
//   },
//   sectionText: {
//     fontSize:        7,
//     fontFamily:      'Helvetica-Bold',
//     textTransform:   'uppercase',
//     letterSpacing:   0.5,
//     color:           '#ffffff',
//   },

//   // ── Tabla ─────────────────────────────────────────────────
//   tableHeader: {
//     flexDirection:   'row',
//     backgroundColor: '#1e293b',
//     paddingVertical: 5,
//     paddingHorizontal: 4,
//     borderRadius:    3,
//     marginBottom:    2,
//   },
//   thText: {
//     color:           '#ffffff',
//     fontSize:        7,
//     fontFamily:      'Helvetica-Bold',
//     textTransform:   'uppercase',
//   },
//   row: {
//     flexDirection:   'row',
//     paddingVertical: 5,
//     paddingHorizontal: 4,
//     borderBottomWidth: 0.5,
//     borderBottomColor: '#e2e8f0',
//     minHeight:       22,
//     alignItems:      'center',
//   },
//   rowAlt: { backgroundColor: '#f8fafc' },

//   // Anchos de columna (suma = 100%)
//   colN:    { width: '6%' },
//   colConc: { width: '34%' },
//   colObs:  { width: '26%' },
//   colGeo:  { width: '20%' },
//   colFoto: { width: '14%' },

//   cellText: { fontSize: 7.5, color: '#334155', lineHeight: 1.4 },
//   cellMono: { fontSize: 6.5, color: '#64748b', fontFamily: 'Courier', lineHeight: 1.3 },
//   cellGray: { fontSize: 7, color: '#94a3b8', fontStyle: 'italic' },

//   photo: {
//     width:        '100%',
//     aspectRatio:  4 / 3,
//     objectFit:    'cover',
//     borderRadius: 2,
//   },

//   // ── Pie de página ─────────────────────────────────────────
//   footer: {
//     position:        'absolute',
//     bottom:          14,
//     left:            28,
//     right:           28,
//     flexDirection:   'row',
//     justifyContent:  'space-between',
//     borderTopWidth:  0.5,
//     borderTopColor:  '#e2e8f0',
//     paddingTop:      4,
//   },
//   footerText: { fontSize: 6.5, color: '#94a3b8' },
//   pageNum: {
//     fontSize: 6.5,
//     color:    '#94a3b8',
//     render: ({ pageNumber, totalPages }: any) => `${pageNumber} / ${totalPages}`,
//   },
// });

// // ── Helpers ────────────────────────────────────────────────
// function chipFecha(fechaIso: string): string {
//   try {
//     return new Date(fechaIso).toLocaleString('es-MX', {
//       timeZone: 'America/Mexico_City',
//       day: '2-digit', month: '2-digit', year: 'numeric',
//       hour: '2-digit', minute: '2-digit', hour12: true,
//     });
//   } catch { return fechaIso; }
// }

// // ── Tipos ──────────────────────────────────────────────────
// interface EvidRow {
//   item_id:       number;
//   item_pregunta: string;
//   item_seccion:  string | null;
//   evidencia_num: number;
//   observacion:   string | null;
//   lat:           string | null;
//   lon:           string | null;
//   precision_gps: string | null;
//   foto:          string | null;
// }
// interface ChecklistItem {
//   id:       number;
//   seccion:  string;
//   pregunta: string;
//   evidence: EvidRow[];
// }
// interface Reporte {
//   folio:              string;
//   fecha:              string;
//   categoria:          string;
//   sub_tipo:           string | null;
//   sector:             string | null;
//   tramo:              string | null;
//   acceso_publico:     string | null;
//   tipo_mantenimiento: string | null;
// }

// // ── Componente principal ───────────────────────────────────
// export function PDFDocument({
//   reporte,
//   checklist,
// }: {
//   reporte: Reporte;
//   checklist: ChecklistItem[];
// }) {
//   const accentColor = CAT_COLOR[reporte.categoria] ?? '#285C4D';
//   const fechaStr    = chipFecha(reporte.fecha);
//   const folio       = reporte.folio ?? '–';

//   // Agrupar filas: (ítem, índice de evidencia)
//   type Fila = {
//     item:     ChecklistItem;
//     evIdx:    number;          // índice dentro de item.evidence (-1 = primera sin evidencia)
//     isFirst:  boolean;
//   };

//   const filas: Fila[] = [];
//   checklist.forEach(item => {
//     if (!item.evidence || item.evidence.length === 0) {
//       filas.push({ item, evIdx: -1, isFirst: true });
//     } else {
//       item.evidence.forEach((_, i) => {
//         filas.push({ item, evIdx: i, isFirst: i === 0 });
//       });
//     }
//   });

//   // Agrupar por sección para insertar badges
//   let lastSeccion = '';

//   return (
//     <Document
//       title={`Reporte ${folio}`}
//       author="CIP Acapulco-Coyuca"
//       subject={reporte.categoria}
//     >
//       <Page size="A4" style={S.page} wrap>

//         {/* ── ENCABEZADO ─────────────────────────────── */}
//         <View style={S.headerBox} fixed>
//           <View style={S.headerRow}>
//             <Text style={S.title}>
//               Reporte {reporte.categoria} — CIP Acapulco-Coyuca
//             </Text>
//             <Text style={S.folio}>{folio}</Text>
//           </View>

//           <View style={S.metaRow}>
//             {reporte.sector && (
//               <View style={S.metaChip}>
//                 <Text style={S.metaLabel}>Sector</Text>
//                 <Text style={S.metaValue}>{reporte.sector}</Text>
//               </View>
//             )}
//             {reporte.tramo && (
//               <View style={S.metaChip}>
//                 <Text style={S.metaLabel}>Tramo</Text>
//                 <Text style={S.metaValue}>{reporte.tramo}</Text>
//               </View>
//             )}
//             {reporte.sub_tipo && (
//               <View style={S.metaChip}>
//                 <Text style={S.metaLabel}>Sub-tipo</Text>
//                 <Text style={S.metaValue}>{reporte.sub_tipo}</Text>
//               </View>
//             )}
//             {reporte.tipo_mantenimiento && (
//               <View style={[S.metaChip, { borderColor: accentColor }]}>
//                 <Text style={S.metaLabel}>Mantenimiento</Text>
//                 <Text style={[S.metaValue, { color: accentColor }]}>
//                   {reporte.tipo_mantenimiento}
//                 </Text>
//               </View>
//             )}
//             <View style={S.metaChip}>
//               <Text style={S.metaLabel}>Fecha</Text>
//               <Text style={S.metaValue}>{fechaStr}</Text>
//             </View>
//           </View>
//         </View>

//         {/* ── CABECERA DE TABLA ─────────────────────── */}
//         <View style={S.tableHeader} fixed>
//           <Text style={[S.thText, S.colN]}>N°</Text>
//           <Text style={[S.thText, S.colConc]}>Concepto / Incidencia</Text>
//           <Text style={[S.thText, S.colObs]}>Observaciones</Text>
//           <Text style={[S.thText, S.colGeo]}>Geo-referencia</Text>
//           <Text style={[S.thText, S.colFoto]}>Foto</Text>
//         </View>

//         {/* ── FILAS ─────────────────────────────────── */}
//         {filas.map((fila, rowIdx) => {
//           const { item, evIdx, isFirst } = fila;
//           const ev = evIdx >= 0 ? item.evidence[evIdx] : null;
//           const isAlt = rowIdx % 2 === 1;

//           // Badge de sección antes de la primera fila de cada sección
//           const showBadge = isFirst && item.seccion !== lastSeccion;
//           if (showBadge) lastSeccion = item.seccion;

//           return (
//             <React.Fragment key={`${item.id}-${evIdx}`}>
//               {showBadge && (
//                 <View
//                   style={[S.sectionBadge, { backgroundColor: accentColor }]}
//                   break={false}
//                 >
//                   <Text style={S.sectionText}>{item.seccion}</Text>
//                 </View>
//               )}
//               <View style={[S.row, isAlt ? S.rowAlt : {}]} wrap={false}>

//                 {/* N° */}
//                 <View style={S.colN}>
//                   <Text style={S.cellText}>
//                     {isFirst ? String(item.id) : ''}
//                   </Text>
//                 </View>

//                 {/* Concepto */}
//                 <View style={S.colConc}>
//                   <Text style={S.cellText}>
//                     {isFirst
//                       ? item.pregunta
//                       : `↳ Evidencia ${evIdx + 1}`}
//                   </Text>
//                 </View>

//                 {/* Observaciones */}
//                 <View style={S.colObs}>
//                   <Text style={ev?.observacion ? S.cellText : S.cellGray}>
//                     {ev?.observacion ?? '–'}
//                   </Text>
//                 </View>

//                 {/* Geo-referencia */}
//                 <View style={S.colGeo}>
//                   {ev?.lat ? (
//                     <>
//                       <Text style={S.cellMono}>X: {ev.lat}</Text>
//                       <Text style={S.cellMono}>Y: {ev.lon}</Text>
//                       {ev.precision_gps && (
//                         <Text style={[S.cellMono, { color: '#22c55e' }]}>
//                           ±{ev.precision_gps}
//                         </Text>
//                       )}
//                     </>
//                   ) : (
//                     <Text style={S.cellGray}>–</Text>
//                   )}
//                 </View>

//                 {/* Foto */}
//                 <View style={S.colFoto}>
//                   {ev?.foto &&
//                    typeof ev.foto === 'string' &&
//                    ev.foto.startsWith('data:image') ? (
//                     <Image src={ev.foto} style={S.photo} />
//                   ) : (
//                     <Text style={S.cellGray}>–</Text>
//                   )}
//                 </View>

//               </View>
//             </React.Fragment>
//           );
//         })}

//         {/* ── PIE DE PÁGINA ─────────────────────────── */}
//         <View style={S.footer} fixed>
//           <Text style={S.footerText}>
//             CIP Acapulco-Coyuca — {reporte.categoria}
//           </Text>
//           <Text
//             style={S.footerText}
//             render={({ pageNumber, totalPages }: any) =>
//               `Pág. ${pageNumber} / ${totalPages}`
//             }
//           />
//         </View>

//       </Page>
//     </Document>
//   );
// }










// // app/api/generar-pdf/pdf-document.tsx
// //
// // Componente React-PDF que renderiza el reporte completo.
// // Se ejecuta SOLO en servidor (Node.js runtime).
// // Las imágenes llegan como data-URL base64 desde la tabla evidencias.

// import React from 'react';
// import {
//   Document, Page, View, Text, Image, StyleSheet, Font,
// } from '@react-pdf/renderer';

// // ── Paleta de colores por categoría ───────────────────────
// const CAT_COLOR: Record<string, string> = {
//   'ALUMBRADO PÚBLICO': '#D97706',
//   'AREAS VERDES':      '#059669',
//   'LIMPIEZA URBANA':   '#EA580C',
//   'MOBILIARIO URBANO': '#7C3AED',
// };

// // ── Estilos ────────────────────────────────────────────────
// const S = StyleSheet.create({
//   page: {
//     fontFamily:      'Helvetica',
//     fontSize:        8,
//     color:           '#1e293b',
//     paddingTop:      28,
//     paddingBottom:   28,
//     paddingLeft:     28,
//     paddingRight:    28,
//     backgroundColor: '#ffffff',
//   },

//   // ── Encabezado ───────────────────────────────────────────
//   headerBox: {
//     marginBottom:    10,
//     paddingBottom:   8,
//     borderBottomWidth: 1.5,
//     borderBottomColor: '#e2e8f0',
//   },
//   headerRow: {
//     flexDirection:   'row',
//     justifyContent:  'space-between',
//     alignItems:      'flex-start',
//     marginBottom:    4,
//   },
//   title: {
//     fontSize:        11,
//     fontFamily:      'Helvetica-Bold',
//     color:           '#0f172a',
//     textTransform:   'uppercase',
//     flexShrink:      1,
//   },
//   folio: {
//     fontSize:        7.5,
//     fontFamily:      'Helvetica-Bold',
//     color:           '#64748b',
//     backgroundColor: '#f1f5f9',
//     paddingHorizontal: 6,
//     paddingVertical:   3,
//     borderRadius:    3,
//   },
//   metaRow: {
//     flexDirection:   'row',
//     flexWrap:        'wrap',
//     gap:             8,
//     marginTop:       3,
//   },
//   metaChip: {
//     flexDirection:   'row',
//     alignItems:      'center',
//     gap:             3,
//     backgroundColor: '#f8fafc',
//     borderWidth:     0.5,
//     borderColor:     '#e2e8f0',
//     borderRadius:    3,
//     paddingHorizontal: 5,
//     paddingVertical:   2,
//   },
//   metaLabel: { fontSize: 6.5, color: '#94a3b8', textTransform: 'uppercase' },
//   metaValue: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#334155' },

//   // ── Sección badge ─────────────────────────────────────────
//   sectionBadge: {
//     marginTop:       10,
//     marginBottom:    4,
//     paddingHorizontal: 6,
//     paddingVertical:   3,
//     borderRadius:    3,
//     alignSelf:       'flex-start',
//   },
//   sectionText: {
//     fontSize:        7,
//     fontFamily:      'Helvetica-Bold',
//     textTransform:   'uppercase',
//     letterSpacing:   0.5,
//     color:           '#ffffff',
//   },

//   // ── Tabla ─────────────────────────────────────────────────
//   tableHeader: {
//     flexDirection:   'row',
//     backgroundColor: '#1e293b',
//     paddingVertical: 5,
//     paddingHorizontal: 4,
//     borderRadius:    3,
//     marginBottom:    2,
//   },
//   thText: {
//     color:           '#ffffff',
//     fontSize:        7,
//     fontFamily:      'Helvetica-Bold',
//     textTransform:   'uppercase',
//   },
//   row: {
//     flexDirection:   'row',
//     paddingVertical: 5,
//     paddingHorizontal: 4,
//     borderBottomWidth: 0.5,
//     borderBottomColor: '#e2e8f0',
//     minHeight:       22,
//     alignItems:      'center',
//   },
//   rowAlt: { backgroundColor: '#f8fafc' },

//   // Anchos de columna (suma = 100%)
//   colN:    { width: '6%' },
//   colConc: { width: '34%' },
//   colObs:  { width: '26%' },
//   colGeo:  { width: '20%' },
//   colFoto: { width: '14%' },

//   cellText: { fontSize: 7.5, color: '#334155', lineHeight: 1.4 },
//   cellMono: { fontSize: 6.5, color: '#64748b', fontFamily: 'Courier', lineHeight: 1.3 },
//   cellGray: { fontSize: 7, color: '#94a3b8', fontStyle: 'italic' },

//   photo: {
//     width:        '100%',
//     aspectRatio:  4 / 3,
//     objectFit:    'cover',
//     borderRadius: 2,
//   },

//   // ── Pie de página ─────────────────────────────────────────
//   footer: {
//     position:        'absolute',
//     bottom:          14,
//     left:            28,
//     right:           28,
//     flexDirection:   'row',
//     justifyContent:  'space-between',
//     borderTopWidth:  0.5,
//     borderTopColor:  '#e2e8f0',
//     paddingTop:      4,
//   },
//   footerText: { fontSize: 6.5, color: '#94a3b8' },
//   pageNum: {
//     fontSize: 6.5,
//     color:    '#94a3b8',
//     render: ({ pageNumber, totalPages }: any) => `${pageNumber} / ${totalPages}`,
//   },
// });

// // ── Helpers ────────────────────────────────────────────────
// function chipFecha(fechaIso: string): string {
//   try {
//     return new Date(fechaIso).toLocaleString('es-MX', {
//       timeZone: 'America/Mexico_City',
//       day: '2-digit', month: '2-digit', year: 'numeric',
//       hour: '2-digit', minute: '2-digit', hour12: true,
//     });
//   } catch { return fechaIso; }
// }

// // ── Tipos ──────────────────────────────────────────────────
// interface EvidRow {
//   item_id:       number;
//   item_pregunta: string;
//   item_seccion:  string | null;
//   evidencia_num: number;
//   observacion:   string | null;
//   lat:           string | null;
//   lon:           string | null;
//   precision_gps: string | null;
//   foto:          string | null;
// }
// interface ChecklistItem {
//   id:       number;
//   seccion:  string;
//   pregunta: string;
//   evidence: EvidRow[];
// }
// interface Reporte {
//   folio:              string;
//   fecha:              string;
//   categoria:          string;
//   sub_tipo:           string | null;
//   sector:             string | null;
//   tramo:              string | null;
//   acceso_publico:     string | null;
//   tipo_mantenimiento: string | null;
// }

// // ── Componente principal ───────────────────────────────────
// export function PDFDocument({
//   reporte,
//   checklist,
// }: {
//   reporte: Reporte;
//   checklist: ChecklistItem[];
// }) {
//   const accentColor = CAT_COLOR[reporte.categoria] ?? '#285C4D';
//   const fechaStr    = chipFecha(reporte.fecha);
//   const folio       = reporte.folio ?? '–';

//   // Agrupar filas: (ítem, índice de evidencia)
//   type Fila = {
//     item:     ChecklistItem;
//     evIdx:    number;          // índice dentro de item.evidence (-1 = primera sin evidencia)
//     isFirst:  boolean;
//   };

//   const filas: Fila[] = [];
//   checklist.forEach(item => {
//     if (!item.evidence || item.evidence.length === 0) {
//       filas.push({ item, evIdx: -1, isFirst: true });
//     } else {
//       item.evidence.forEach((_, i) => {
//         filas.push({ item, evIdx: i, isFirst: i === 0 });
//       });
//     }
//   });

//   // Agrupar por sección para insertar badges
//   let lastSeccion = '';

//   return (
//     <Document
//       title={`Reporte ${folio}`}
//       author="CIP Acapulco-Coyuca"
//       subject={reporte.categoria}
//     >
//       <Page size="A4" style={S.page} wrap>

//         {/* ── ENCABEZADO ─────────────────────────────── */}
//         <View style={S.headerBox} fixed>
//           <View style={S.headerRow}>
//             <Text style={S.title}>
//               Reporte {reporte.categoria} — CIP Acapulco-Coyuca
//             </Text>
//             <Text style={S.folio}>{folio}</Text>
//           </View>

//           <View style={S.metaRow}>
//             {reporte.sector && (
//               <View style={S.metaChip}>
//                 <Text style={S.metaLabel}>Sector</Text>
//                 <Text style={S.metaValue}>{reporte.sector}</Text>
//               </View>
//             )}
//             {reporte.tramo && (
//               <View style={S.metaChip}>
//                 <Text style={S.metaLabel}>Tramo</Text>
//                 <Text style={S.metaValue}>{reporte.tramo}</Text>
//               </View>
//             )}
//             {reporte.sub_tipo && (
//               <View style={S.metaChip}>
//                 <Text style={S.metaLabel}>Sub-tipo</Text>
//                 <Text style={S.metaValue}>{reporte.sub_tipo}</Text>
//               </View>
//             )}
//             {reporte.tipo_mantenimiento && (
//               <View style={[S.metaChip, { borderColor: accentColor }]}>
//                 <Text style={S.metaLabel}>Mantenimiento</Text>
//                 <Text style={[S.metaValue, { color: accentColor }]}>
//                   {reporte.tipo_mantenimiento}
//                 </Text>
//               </View>
//             )}
//             <View style={S.metaChip}>
//               <Text style={S.metaLabel}>Fecha</Text>
//               <Text style={S.metaValue}>{fechaStr}</Text>
//             </View>
//           </View>
//         </View>

//         {/* ── CABECERA DE TABLA ─────────────────────── */}
//         <View style={S.tableHeader} fixed>
//           <Text style={[S.thText, S.colN]}>N°</Text>
//           <Text style={[S.thText, S.colConc]}>Concepto / Incidencia</Text>
//           <Text style={[S.thText, S.colObs]}>Observaciones</Text>
//           <Text style={[S.thText, S.colGeo]}>Geo-referencia</Text>
//           <Text style={[S.thText, S.colFoto]}>Foto</Text>
//         </View>

//         {/* ── FILAS ─────────────────────────────────── */}
//         {filas.map((fila, rowIdx) => {
//           const { item, evIdx, isFirst } = fila;
//           const ev = evIdx >= 0 ? item.evidence[evIdx] : null;
//           const isAlt = rowIdx % 2 === 1;

//           // Badge de sección antes de la primera fila de cada sección
//           const showBadge = isFirst && item.seccion !== lastSeccion;
//           if (showBadge) lastSeccion = item.seccion;

//           return (
//             <React.Fragment key={`${item.id}-${evIdx}`}>
//               {showBadge && (
//                 <View
//                   style={[S.sectionBadge, { backgroundColor: accentColor }]}
//                   break={false}
//                 >
//                   <Text style={S.sectionText}>{item.seccion}</Text>
//                 </View>
//               )}
//               <View style={[S.row, isAlt && S.rowAlt]} wrap={false}>

//                 {/* N° */}
//                 <View style={S.colN}>
//                   <Text style={S.cellText}>
//                     {isFirst ? String(item.id) : ''}
//                   </Text>
//                 </View>

//                 {/* Concepto */}
//                 <View style={S.colConc}>
//                   <Text style={S.cellText}>
//                     {isFirst
//                       ? item.pregunta
//                       : `↳ Evidencia ${evIdx + 1}`}
//                   </Text>
//                 </View>

//                 {/* Observaciones */}
//                 <View style={S.colObs}>
//                   <Text style={ev?.observacion ? S.cellText : S.cellGray}>
//                     {ev?.observacion ?? '–'}
//                   </Text>
//                 </View>

//                 {/* Geo-referencia */}
//                 <View style={S.colGeo}>
//                   {ev?.lat ? (
//                     <>
//                       <Text style={S.cellMono}>X: {ev.lat}</Text>
//                       <Text style={S.cellMono}>Y: {ev.lon}</Text>
//                       {ev.precision_gps && (
//                         <Text style={[S.cellMono, { color: '#22c55e' }]}>
//                           ±{ev.precision_gps}
//                         </Text>
//                       )}
//                     </>
//                   ) : (
//                     <Text style={S.cellGray}>–</Text>
//                   )}
//                 </View>

//                 {/* Foto */}
//                 <View style={S.colFoto}>
//                   {ev?.foto &&
//                    typeof ev.foto === 'string' &&
//                    ev.foto.startsWith('data:image') ? (
//                     <Image src={ev.foto} style={S.photo} />
//                   ) : (
//                     <Text style={S.cellGray}>–</Text>
//                   )}
//                 </View>

//               </View>
//             </React.Fragment>
//           );
//         })}

//         {/* ── PIE DE PÁGINA ─────────────────────────── */}
//         <View style={S.footer} fixed>
//           <Text style={S.footerText}>
//             CIP Acapulco-Coyuca — {reporte.categoria}
//           </Text>
//           <Text
//             style={S.footerText}
//             render={({ pageNumber, totalPages }: any) =>
//               `Pág. ${pageNumber} / ${totalPages}`
//             }
//           />
//         </View>

//       </Page>
//     </Document>
//   );
// }
