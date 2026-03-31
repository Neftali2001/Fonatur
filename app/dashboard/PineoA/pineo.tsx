'use client';

import { usePDFQueue } from '@/app/context/pdf-queue-context';
import { mostrarOpcionesPostGuardado } from '@/app/lib/generarPDFCombinado';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FaCrosshairs, FaCamera, FaMapMarkedAlt,
  FaFilePdf, FaTrash, FaUndo, FaPlus, FaSpinner,
} from 'react-icons/fa';
import jsPDF from 'jspdf';
import 'leaflet/dist/leaflet.css';
import dynamic from 'next/dynamic';
import autoTable from 'jspdf-autotable';
import { crearReporte, actualizarReporte } from '@/app/lib/actions';

const LeafletMap = dynamic(
  () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
  { ssr: false }
);

// ═══════════════════════════════════════════════════════════
//  INTERFACES
// ═══════════════════════════════════════════════════════════
interface FormularioProps {
  reportesIniciales?: any[];
  reporteParaEditar?: any;
}
interface GpsCoords  { lat: string | null; lon: string | null; precision: string; }
interface GeoRef     { lat: string; lon: string; precision: string; timestamp: string; }
interface EvidenceEntry { id: number; observation: string; geoRef: GeoRef | null; photo: string | null; }
interface ChecklistItem {
  id: number; seccion: string; pregunta: string; respuesta: string;
  evidence: EvidenceEntry[];
  observacion: string; geoRef?: GeoRef | null;
}
interface FormData {
  sector: string; Tramo: string; accesoPublico: string;
  tipoMantenimiento: string; categoria: string; subTipo: string;
}
interface Seccion { titulo: string; items: string[]; }

// ═══════════════════════════════════════════════════════════
//  CATÁLOGO UNIFICADO
// ═══════════════════════════════════════════════════════════
const CATALOGO: Record<string, Record<string, Seccion[]>> = {

  'ALUMBRADO PÚBLICO': {
    'Alumbrado Público Solar': [{
      titulo: 'ALUMBRADO PÚBLICO SOLAR',
      items: [
        'OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?',
        'LA FOTOCELDA ¿CUMPLE CON SU FUNCIÓN?',
        'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
        'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
        'INTEGRIDAD DE LUMINARIA',
        'ESTADO DE POSTE METÁLICO/CONCRETO',
        'ESTADO DE BASE DE CONCRETO',
      ],
    }],
    'Alumbrado Público Eléctrico': [{
      titulo: 'ALUMBRADO PÚBLICO ELÉCTRICO',
      items: [
        'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
        'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
        'ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS',
        'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
        'EL BRAZO ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
        'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
        'INTEGRIDAD DE LUMINARIA',
        'ESTADO DE POSTE METÁLICO/CONCRETO',
        'ESTADO DE BASE DE CONCRETO',
      ],
    }],
    'Luminaria Tipo Cerillo': [{
      titulo: 'LUMINARIA TIPO CERILLO',
      items: [
        'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
        'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
        'ESTADO DE BASE DE CONCRETO',
        'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
      ],
    }],
    'Luminaria Tipo Europea': [{
      titulo: 'LUMINARIA TIPO EUROPEA',
      items: [
        'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
        'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
        'ESTADO DE BASE DE CONCRETO',
        'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
        'ESTADO DEL ELEMENTO PORTADOR DE LA LUMINARIA (POSTE PIRAMIDAL PREFABRICADO)',
      ],
    }],
    'Otros': [{
      titulo: 'OTROS – DESCRIPCIÓN LIBRE',
      items: ['DESCRIPCIÓN DE LA INCIDENCIA'],
    }],
  },

  'AREAS VERDES': {
    '1. Poda': [{
      titulo: '1. PODA',
      items: [
        '1.1 DESHIERBE – EN CAMELLÓN EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
        '1.1 DESHIERBE – EN JARDINERA EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
        '1.2 CAJETE – EN CAMELLÓN',
        '1.3 CAJILLO – EN CAMELLONES CON UN ANCHO DE 10 CM Y PROFUNDIDAD DE 12 CM',
        '1.4 DESORILLE DE ARRIATES/JARDINERA: SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
        '1.4 DESORILLE DE CAMELLÓN ANCHO 15 CM ± 2 CM; SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
        '1.5 PODA DE PASTO CON MAQUINARIA A UNA ALTURA PROMEDIO DE 2.5 A 5 CM',
        '1.6 PODA DE SETOS CUANDO LA GEOMETRÍA DEL ARBUSTO YA NO ES UNIFORME (ARBUSTOS Y PLANTAS DE ORNATO) UTILIZANDO HERRAMIENTA MANUAL Y MECÁNICA',
        '1.7 PODA DE ÁRBOLES DE 2 A 5 M DE FRONDOSIDAD Y DE 2.00 A 6.00 M DE ALTURA',
        '1.7 PODA DE ÁRBOLES DE 5.01 M. A 10 DE FRONDOSIDAD Y DE 6.01 A 12.00 M DE ALTURA',
        '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
        '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
        '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
        '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
      ],
    }],
    '2. Tala': [{
      titulo: '2. TALA DE ÁRBOLES O PALMERAS',
      items: [
        'TALA, TROZA, CARGA Y RETIRO DE ÁRBOLES POR MEDIOS MANUALES BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) HASTA 5.00 M DE ALTURA',
        'TALA, TROZA, CARGA Y RETIRO DE PALMERAS BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) DE 5.01 A 12.00 M',
      ],
    }],
    '4. Escombro': [{
      titulo: '4. ESCOMBRO',
      items: ['ÁREA LIBRE DE CONTAMINACIÓN (TIERRA/CASCAJO, LODOS, EXCRETAS, HIDROCARBUROS, ESCOMBROS)'],
    }],
    '5. Limpieza': [{
      titulo: '5. LIMPIEZA ÁREAS VERDES',
      items: [
        'JARDINERAS/ARRIATES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
        'CAMELLONES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
      ],
    }],
    '6. Red de riego': [{
      titulo: '6. RED DE RIEGO',
      items: ['RED DE RIEGO TAPADA, FUERA DE DIRECCIÓN O CON FUGAS'],
    }],
    '7. Retiro de tocones': [{
      titulo: '7. RETIRO DE TOCONES',
      items: ['CORTE A 15 CM DEBAJO DEL NIVEL EXISTENTE DE TOCON. DE HASTA 50 CM DE DIAMETRO'],
    }],
    '8. Fumigación': [{
      titulo: '8. FUMIGACIÓN',
      items: [
        'ESPECIE PRESENTA PLAGA',
        'ESPECIE PRESENTA HONGO O PUDRICIÓN',
      ],
    }],
    '9. Arriate sin pasto': [{
      titulo: '9. ARRIATE SIN PASTO (SOLO TIERRA)',
      items: [
        'ARRIATE PRESENTA MALEZA O VEGETACIÓN NO DESEADA',
        'ARRIATE PRESENTA EROSIÓN O SOCAVACIÓN EN LA TIERRA',
        'ARRIATE REQUIERE NIVELACIÓN O REINTEGRACIÓN DE TIERRA',
        'TIERRA LIBRE DE RESIDUOS SÓLIDOS (BASURA, ESCOMBRO, PLÁSTICOS)',
        'ARRIATE SIN ACUMULACIÓN DE AGUA O ENCHARCAMIENTO',
        'BORDES/GUARNICIONES DEL ARRIATE EN BUEN ESTADO (SIN INVASIÓN A BANQUETA)',
      ],
    }],
      '10. Jardinera rota': [{
      titulo: '10. Jardinera rota',
      items: [
        '¿LA JARDINERA PRESENTA ALGUN DAÑO?',
      ],
    }],
  },

  'LIMPIEZA URBANA': {
    'Limpieza General': [{
      titulo: '1. LIMPIEZA GENERAL',
      items: ['1.1 BARRIDO', '1.2 LAVADO DE PISO', '1.4 LAVADO DE MUROS'],
    }],
    'Residuos y Contenedores': [{
      titulo: 'RESIDUOS Y CONTENEDORES',
      items: [
        'ÁREA GENERAL LIMPIA DE BASURA VISIBLE A LO LARGO DEL TRAMO',
        'BANQUETAS BARRIDAS Y LIBRES DE RESIDUOS SÓLIDOS',
        'CUNETAS LIMPIAS Y SIN OBSTRUCCIONES POR RESIDUOS',
        'ACUMULACIÓN DE BASURA EN PUNTOS CRÍTICOS (ESQUINAS, ACCESOS, MUROS)',
        'PLAYA LIMPIA DE RESIDUOS ORGÁNICOS E INORGÁNICOS (SI APLICA)',
        'ACCESOS A PLAYA O ZONA PÚBLICA LIBRES DE BASURA',
        'BOTES DE BASURA VACÍOS (NO REBASADOS)',
        'BOTES Y CONTENEDORES LIMPIOS POR DENTRO Y POR FUERA',
        'ÁREA ALREDEDOR DEL BOTE (1 METRO) LIBRE DE RESIDUOS',
        'LIXIVIADOS O DERRAMES ALREDEDOR DE BOTES O CONTENEDORES',
        'RESIDUOS DISPERSOS DESPUÉS DE LA RECOLECCIÓN',
        'PODA EN GRAL CADA 6 MESES',
      ],
    }],
    'Canal Pluvial': [{
      titulo: 'CANAL PLUVIAL',
      items: [
        '¿EL CANAL PLUVIAL PRESENTA OBSTRUCCIONES (BASURA, SEDIMENTOS, VEGETACIÓN, LODO, ETC.)?',
        '¿EL CANAL PLUVIAL PRESENTA DAÑOS ESTRUCTURALES (FISURAS, DESPRENDIMIENTOS, DEFORMACIONES, SOCAVACIONES)?',
        '¿EL AGUA PUEDE FLUIR LIBREMENTE A TRAVÉS DEL CANAL PLUVIAL?',
        '¿LOS ACCESOS AL CANAL (TAPAS, REJILLAS, REGISTROS) ESTÁN EN BUEN ESTADO?',
        '¿EL CANAL PLUVIAL SE ENCUENTRA EN BUENAS CONDICIONES (SIN OBSTRUCCIONES, SIN DAÑO ESTRUCTURAL Y CON FLUJO LIBRE)?',
        'INDIQUE EL ESTADO ACTUAL DE LA REJILLA PLUVIAL (PUEDE SELECCIONAR MÁS DE UNA OPCIÓN)',
      ],
    }],
  },

  'MOBILIARIO URBANO': {
    '1. Bacheo':             [{ titulo: '1. BACHEO',                  items: ['1.1 M2 DAÑADOS'] }],
    '2. Parabuses':          [{ titulo: '2. PARABUSES',               items: ['2.1 BANDALIZADOS', '2.2 GOLPEADOS', '2.3 OTRO DAÑO'] }],
    '3. Tapas de registros': [{ titulo: '3. TAPAS DE REGISTROS DE CONCRETO', items: ['3.1 ROTA', '3.2 FALTANTE', '3.3 OTRO DAÑO', '3.4 DE CFE O TELECOMUNICACIONES (IDENTIFICAR PARA REPORTAR)'] }],
    '4. Barandales': [{ titulo: '4. BARANDALES', items: [
      '4.1 ACERO INOXIDABLE – TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESALINEADO O DETALLES EN EL ANCLAJE',
      '4.2 METÁLICO – TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESALINEADO O DETALLES EN EL ANCLAJE',
    ]}],
    '5. Señaleticas':       [{ titulo: '5. SEÑALETICAS',    items: ['5.1 TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESPLOME O DETALLES EN EL ANCLAJE'] }],
    '6. Balizamiento':      [{ titulo: '6. BALIZAMIENTO',   items: ['6.1 M2 O ML CON BALIZAMIENTO FALTANTE – IDENTIFICAR ELEMENTO'] }],
    '7. Murales':           [{ titulo: '7. MURALES',         items: ['7.1 DESCRIBIR DETALLES ENCONTRADOS'] }],
    '8. Bolardos':          [{ titulo: '8. BOLARDOS',        items: ['8.1 BOLARDOS DAÑADOS – IDENTIFICAR EL TIPO DE DAÑO'] }],
    '9. Figuras lúdicas':   [{ titulo: '9. FIGURAS LÚDICAS', items: ['9.1 FIGURAS LÚDICAS – IDENTIFICAR EL TIPO DE DAÑO'] }],
    '10. Postes semáforos': [{ titulo: '10. POSTES SEMÁFOROS', items: ['10.1 POSTES – IDENTIFICAR EL TIPO DE DAÑO'] }],
    '11. Guarnicion':       [{ titulo: '11. GUARNICION',     items: ['Guarnicion dañada'] }],
    '12. Banqueta':         [{ titulo: '12. BANQUETA',       items: ['Banqueta dañada'] }],
    '13. Rampa':            [{ titulo: '13. RAMPA',          items: ['1. RAMPA ROTA', '2. RAMPA NO CUMPLE PENDIENTE'] }],
  },
};

const CATEGORIA_COLOR: Record<string, { header: string; tab: string; badge: string }> = {
  'ALUMBRADO PÚBLICO':  { header: 'from-yellow-600 to-yellow-700',   tab: 'bg-yellow-50  text-yellow-800',  badge: 'bg-yellow-100  text-yellow-700'  },
  'AREAS VERDES':       { header: 'from-emerald-600 to-emerald-700', tab: 'bg-emerald-50 text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
  'BARRIDO VIALIDADES': { header: 'from-blue-600 to-blue-700',       tab: 'bg-blue-50    text-blue-800',    badge: 'bg-blue-100    text-blue-700'    },
  'LIMPIEZA URBANA':    { header: 'from-orange-600 to-orange-700',   tab: 'bg-orange-50  text-orange-800',  badge: 'bg-orange-100  text-orange-700'  },
  'MOBILIARIO URBANO':  { header: 'from-purple-600 to-purple-700',   tab: 'bg-purple-50  text-purple-800',  badge: 'bg-purple-100  text-purple-700'  },
};

const TRAMOS_POR_SECTOR: Record<string, string[]> = {
  'Barra de Coyuca':      ['Sendero-Seguro-Barra Coyuca'],
  'Pie de la Cuesta':     ['Sendero-seguro-Pie de la cuesta'],
  'Barrios Historicos':   ['Caleta-caletilla', 'Sendero-Costera-antigua', 'Corredor Zocalo-quebrada', 'Corredor zocalo-fuerte'],
  'Acapulco Tradicional': ['Sendero-Tadeo-arredondo', 'Sendero-cinerio-hornitos', 'Michoacan', 'Av. Universidad', 'Dr. Ignacio chavez'],
  'Acapulco Dorado':      ['Costa azul', 'Condesa', 'La diana', 'Parque papagayo', 'Papagayo-Edifico inteligente', 'El zocalo', 'Zocalo-Caleta'],
  'Las Brisas':           [''],
  'Puerto Márquez':       ['Sendero-Puerto-Marquez'],
  'Acapulco Diamante':    ['Av. Costera Palmas', 'Boulevar de las naciones', 'Revolcadero'],
  'Otro':                 [''],
};

// ═══════════════════════════════════════════════════════════
//  HELPERS DE IMAGEN — DEFINIDOS FUERA DEL COMPONENTE
//
//  Por qué FileReader y no file.arrayBuffer() / URL.createObjectURL():
//  • file.arrayBuffer() no existe en iOS Safari < 15.4 → excepción
//  • URL.createObjectURL puede devolver imagen en blanco en algunos
//    contextos restringidos de WebKit (PWA en iOS, Safari privado)
//  • FileReader existe desde iOS 8 y es la API más compatible
// ═══════════════════════════════════════════════════════════

/** Lee un Blob como ArrayBuffer con FileReader (iOS Safari < 15.4 compatible) */
function readAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error ?? new Error('FileReader error'));
    r.readAsArrayBuffer(blob);
  });
}

/** Lee un Blob como data-URL con FileReader */
function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error('FileReader error'));
    r.readAsDataURL(blob);
  });
}

/**
 * Extrae orientación EXIF de un JPEG.
 * Solo lee los primeros 64 KB (APP1 siempre está al inicio).
 * Devuelve 1 (sin rotación) si no hay EXIF o no es JPEG.
 */
function getJpegOrientation(buffer: ArrayBuffer): number {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xFFD8) return 1;
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      offset += 2;
      if (marker === 0xFFE1) {
        const segLen = view.getUint16(offset);
        const segEnd = offset + segLen;
        if (segEnd > view.byteLength) break;
        const app1 = new DataView(buffer, offset + 2, segLen - 2);
        if (app1.byteLength < 14) break;
        const hdr = String.fromCharCode(
          app1.getUint8(0), app1.getUint8(1),
          app1.getUint8(2), app1.getUint8(3),
        );
        if (hdr !== 'Exif') break;
        const le   = app1.getUint16(6) === 0x4949;
        const ifd0 = app1.getUint32(10, le) + 6;
        if (ifd0 + 2 > app1.byteLength) break;
        const entries = app1.getUint16(ifd0, le);
        for (let i = 0; i < entries; i++) {
          const e = ifd0 + 2 + i * 12;
          if (e + 12 > app1.byteLength) break;
          if (app1.getUint16(e, le) === 0x0112) {
            const v = app1.getUint16(e + 8, le);
            return v >= 1 && v <= 8 ? v : 1;
          }
        }
        break;
      }
      if ((marker & 0xFF00) !== 0xFF00) break;
      if (offset + 2 > view.byteLength) break;
      offset += view.getUint16(offset);
    }
  } catch { /* silencioso */ }
  return 1;
}

/** Carga un data-URL en un HTMLImageElement */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img   = new Image();
    img.onerror = () => reject(new Error('No se pudo decodificar la imagen.'));
    img.onload  = () => resolve(img);
    img.src     = src;
  });
}

/**
 * Redimensiona y rota la imagen aplicando corrección EXIF.
 * Usa naturalWidth/naturalHeight (img.width puede ser 0 en iOS).
 * Valida la exportación: en iOS bajo presión de memoria, toDataURL
 * devuelve 'data:,' sin lanzar error.
 */
function renderToCanvas(img: HTMLImageElement, orientation: number, maxDim = 1200): string {
  const needsSwap = orientation >= 5 && orientation <= 8;
  const srcW      = img.naturalWidth  || img.width  || 1;
  const srcH      = img.naturalHeight || img.height || 1;
  const longSide  = Math.max(srcW, srcH);
  const scale     = longSide > maxDim ? maxDim / longSide : 1;
  const dstW      = Math.round((needsSwap ? srcH : srcW) * scale);
  const dstH      = Math.round((needsSwap ? srcW : srcH) * scale);

  const canvas  = document.createElement('canvas');
  canvas.width  = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible en este dispositivo.');

  ctx.save();
  ctx.translate(dstW / 2, dstH / 2);
  switch (orientation) {
    case 2: ctx.scale(-1,  1);                           break;
    case 3: ctx.rotate(Math.PI);                         break;
    case 4: ctx.scale( 1, -1);                           break;
    case 5: ctx.rotate(-Math.PI / 2); ctx.scale(-1, 1);  break;
    case 6: ctx.rotate( Math.PI / 2);                    break;
    case 7: ctx.rotate( Math.PI / 2); ctx.scale(-1, 1);  break;
    case 8: ctx.rotate(-Math.PI / 2);                    break;
  }
  ctx.drawImage(img, -(srcW * scale) / 2, -(srcH * scale) / 2, srcW * scale, srcH * scale);
  ctx.restore();

  const result = canvas.toDataURL('image/jpeg', 0.82);
  if (!result || result === 'data:,' || result.length < 200) {
    throw new Error('El canvas no pudo exportar la imagen. Intenta con una foto más pequeña.');
  }
  return result;
}

/**
 * Pipeline completo: EXIF → data-URL → Image → canvas → JPEG base64.
 * Acepta el objeto File directamente para desacoplar el input del handler.
 */
async function procesarFoto(file: File): Promise<string> {
  // Leer solo los primeros 64 KB para EXIF (más rápido en móviles)
  const exifBuffer  = await readAsArrayBuffer(file.slice(0, 65_536));
  const orientation = getJpegOrientation(exifBuffer);
  const dataUrl     = await readAsDataURL(file);
  const img         = await loadImage(dataUrl);
  return renderToCanvas(img, orientation);
}

// ── Helpers generales ──────────────────────────────────────
const emptyEntry    = (): EvidenceEntry => ({ id: Date.now(), observation: '', geoRef: null, photo: null });
const buildChecklist = (categoria: string, subTipo: string): ChecklistItem[] => {
  const secciones = CATALOGO[categoria]?.[subTipo] ?? [];
  let counter = 1;
  return secciones.flatMap(sec =>
    sec.items.map(pregunta => ({
      id: counter++, seccion: sec.titulo, pregunta,
      respuesta: '', observacion: '', geoRef: null,
      evidence: [emptyEntry()],
    }))
  );
};
const CATEGORIAS = Object.keys(CATALOGO);

// ═══════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════
const FormularioUnificado: React.FC<FormularioProps> = ({ reporteParaEditar }) => {
  const { addToQueue } = usePDFQueue();
  const mapRef        = useRef<HTMLDivElement>(null);
  const geoRefWatchId = useRef<number | null>(null);

  const [currentTime,         setCurrentTime]        = useState('');
  const [preguntaActual,      setPreguntaActual]      = useState(0);
  const [sectorPersonalizado, setSectorPersonalizado] = useState('');
  const [tramoPersonalizado,  setTramoPersonalizado]  = useState('');
  const [capturandoGps,       setCapturandoGps]       = useState<{ itemId: number; entryId: number } | null>(null);
  // Precisión en tiempo real que se muestra en la animación mientras se triangula
  const [gpsLiveAccuracy,    setGpsLiveAccuracy]     = useState<number | null>(null);

  // Set de claves "itemId-entryId" → permite spinner por entrada sin bloquear otras
  const [procesandoFotos, setProcesandoFotos] = useState<Set<string>>(new Set());

  const [gps, setGps] = useState<GpsCoords>({
    lat:       reporteParaEditar?.latitud  ? String(reporteParaEditar.latitud)  : null,
    lon:       reporteParaEditar?.longitud ? String(reporteParaEditar.longitud) : null,
    precision: '--',
  });

  const catInicial     = reporteParaEditar?.categoria ?? 'ALUMBRADO PÚBLICO';
  const subtiposInic   = Object.keys(CATALOGO[catInicial] ?? {});
  const subTipoInicial = reporteParaEditar?.subTipo ?? subtiposInic[0] ?? '';

  const [formData, setFormData] = useState<FormData>({
    sector:            reporteParaEditar?.sector             ?? '',
    Tramo:             reporteParaEditar?.tramo              ?? '',
    accesoPublico:     reporteParaEditar?.acceso_publico     ?? '',
    tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
    categoria:         catInicial,
    subTipo:           subTipoInicial,
  });

  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    buildChecklist(catInicial, subTipoInicial)
  );

  // ── Geo-pins para el mapa ──────────────────────────────
  const georefPins = React.useMemo(() =>
    checklist.flatMap(item =>
      item.evidence.filter(ev => ev.geoRef).map((ev, ei) => ({
        lat: ev.geoRef!.lat, lon: ev.geoRef!.lon,
        label:       item.evidence.length > 1 ? `${item.id}.${ei + 1}` : String(item.id),
        pregunta:    item.pregunta,
        observation: ev.observation,
        cumple:      item.respuesta,
      }))
    )
  , [checklist]);

  const gpsVista: GpsCoords = React.useMemo(() =>
    georefPins.length > 0
      ? { lat: georefPins[georefPins.length - 1].lat, lon: georefPins[georefPins.length - 1].lon, precision: '--' }
      : { lat: null, lon: null, precision: '--' }
  , [georefPins]);

  // ── Efectos ────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    import('leaflet').then(L => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });
    });
  }, []);

  useEffect(() => {
    return () => {
      if (geoRefWatchId.current !== null) navigator.geolocation.clearWatch(geoRefWatchId.current);
    };
  }, []);

  // ── Cargar datos para edición ──────────────────────────
  useEffect(() => {
    if (!reporteParaEditar) return;
    setFormData({
      sector:            reporteParaEditar.sector             || '',
      Tramo:             reporteParaEditar.tramo              || '',
      accesoPublico:     reporteParaEditar.acceso_publico     || '',
      tipoMantenimiento: reporteParaEditar.tipo_mantenimiento || '',
      categoria:         reporteParaEditar.categoria          || 'ALUMBRADO PÚBLICO',
      subTipo:           reporteParaEditar.sub_tipo           || '',
    });
    if (reporteParaEditar.checklist) setChecklist(reporteParaEditar.checklist);
    if (reporteParaEditar.latitud && reporteParaEditar.longitud) {
      setGps({ lat: String(reporteParaEditar.latitud), lon: String(reporteParaEditar.longitud), precision: 'Recuperado de BD' });
    }
  }, [reporteParaEditar]);

  // ── Cambio de categoría ────────────────────────────────
  const handleCategoriaChange = useCallback((nuevaCat: string) => {
    const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
    if (hayEvidencias && !window.confirm('Cambiar categoría borrará las evidencias actuales. ¿Continuar?')) return;
    const subtipo = Object.keys(CATALOGO[nuevaCat] ?? {})[0] ?? '';
    setFormData(prev => ({ ...prev, categoria: nuevaCat, subTipo: subtipo }));
    setChecklist(buildChecklist(nuevaCat, subtipo));
    setPreguntaActual(0);
  }, [checklist]);

  // ── Cambio de sub-tipo ─────────────────────────────────
  const handleSubTipoChange = useCallback((nuevoSub: string) => {
    const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
    if (hayEvidencias && !window.confirm('Cambiar el tipo borrará las evidencias actuales. ¿Continuar?')) return;
    setFormData(prev => ({ ...prev, subTipo: nuevoSub }));
    setChecklist(buildChecklist(formData.categoria, nuevoSub));
    setPreguntaActual(0);
  }, [checklist, formData.categoria]);

  // ── GPS por evidencia — precisión optimizada para datos móviles ──────
  //
  //  Estrategia:
  //  • watchPosition sigue recibiendo lecturas; cada vez que llega una
  //    mejor (accuracy más baja), actualiza el estado en vivo.
  //  • Se CONFIRMA automáticamente cuando accuracy ≤ 7 m (objetivo).
  //  • Si en 35 s no se alcanza 7 m, se usa la mejor lectura obtenida
  //    (siempre que sea ≤ 50 m — umbral mínimo aceptable).
  //  • Si tras 35 s no se obtuvo NINGUNA lectura ≤ 50 m, alerta de error.
  //
  const bestReadingRef = useRef<{ lat: number; lon: number; accuracy: number } | null>(null);

  const capturarGeoRef = useCallback((itemId: number, entryId: number) => {
    if (!navigator.geolocation) {
      alert('Tu dispositivo no soporta GPS. Activa la ubicación e inténtalo de nuevo.');
      return;
    }
    // Limpiar watcher anterior
    if (geoRefWatchId.current !== null) {
      navigator.geolocation.clearWatch(geoRefWatchId.current);
      geoRefWatchId.current = null;
    }
    bestReadingRef.current = null;
    setCapturandoGps({ itemId, entryId });
    setGpsLiveAccuracy(null);

    const TARGET_ACCURACY   = 7;   // m — confirmar inmediatamente si se alcanza
    const FALLBACK_ACCURACY = 50;  // m — umbral mínimo para aceptar tras timeout
    const TIMEOUT_MS        = 35_000;

    // Función que guarda la lectura, limpia el watcher y actualiza el checklist
    const confirmar = (lat: number, lon: number, accuracy: number) => {
      if (geoRefWatchId.current !== null) {
        navigator.geolocation.clearWatch(geoRefWatchId.current);
        geoRefWatchId.current = null;
      }
      const timestamp = new Date().toLocaleTimeString('es-MX', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      setChecklist(prev =>
        prev.map(item =>
          item.id === itemId
            ? {
                ...item,
                evidence: item.evidence.map(ev =>
                  ev.id === entryId
                    ? {
                        ...ev,
                        geoRef: {
                          lat:       lat.toFixed(6),
                          lon:       lon.toFixed(6),
                          precision: `${accuracy.toFixed(1)}m`,
                          timestamp,
                        },
                      }
                    : ev
                ),
              }
            : item
        )
      );
      setCapturandoGps(null);
      setGpsLiveAccuracy(null);
      bestReadingRef.current = null;
    };

    // Timeout: al expirar, usamos la mejor lectura acumulada si es aceptable
    const timeoutId = setTimeout(() => {
      if (geoRefWatchId.current !== null) {
        navigator.geolocation.clearWatch(geoRefWatchId.current);
        geoRefWatchId.current = null;
      }
      const best = bestReadingRef.current;
      if (best && best.accuracy <= FALLBACK_ACCURACY) {
        confirmar(best.lat, best.lon, best.accuracy);
      } else {
        setCapturandoGps(null);
        setGpsLiveAccuracy(null);
        bestReadingRef.current = null;
        alert(
          'No se pudo obtener una ubicación precisa.\n\n' +
          'Verifica que:\n' +
          '• El GPS esté activado\n' +
          '• La app tenga permiso de ubicación\n' +
          '• Estés al aire libre o cerca de una ventana\n\n' +
          'Puedes intentarlo de nuevo.'
        );
      }
    }, TIMEOUT_MS);

    geoRefWatchId.current = navigator.geolocation.watchPosition(
      ({ coords: { latitude, longitude, accuracy } }) => {
        // Actualizar precisión en vivo para la animación
        setGpsLiveAccuracy(accuracy);

        // Guardar si es la mejor lectura hasta ahora
        if (!bestReadingRef.current || accuracy < bestReadingRef.current.accuracy) {
          bestReadingRef.current = { lat: latitude, lon: longitude, accuracy };
        }

        // ✅ Confirmar inmediatamente si alcanzamos el objetivo
        if (accuracy <= TARGET_ACCURACY) {
          clearTimeout(timeoutId);
          confirmar(latitude, longitude, accuracy);
        }
      },
      (error) => {
        clearTimeout(timeoutId);
        if (geoRefWatchId.current !== null) {
          navigator.geolocation.clearWatch(geoRefWatchId.current);
          geoRefWatchId.current = null;
        }
        setCapturandoGps(null);
        setGpsLiveAccuracy(null);
        bestReadingRef.current = null;
        const msgs: Record<number, string> = {
          1: 'Permiso denegado. Ve a Ajustes > Permisos y activa la ubicación.',
          2: 'No se pudo determinar la ubicación. Asegúrate de estar al aire libre.',
          3: 'Tiempo agotado. Intenta en un lugar con mejor señal.',
        };
        alert(msgs[error.code] ?? `Error de GPS (código ${error.code}).`);
      },
      { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: 0 }
    );
  }, []);

  // ── Evidencia helpers ──────────────────────────────────
  const addEvidence = useCallback((itemId: number) => {
    setChecklist(prev => prev.map(item =>
      item.id === itemId ? { ...item, evidence: [...item.evidence, emptyEntry()] } : item
    ));
  }, []);

  const removeEvidence = useCallback((itemId: number, entryId: number) => {
    setChecklist(prev => prev.map(item =>
      item.id === itemId ? { ...item, evidence: item.evidence.filter(e => e.id !== entryId) } : item
    ));
  }, []);

  const updateObservation = useCallback((itemId: number, entryId: number, val: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, observation: val } : e) }
        : item
    ));
  }, []);

  // ── Manejador de fotos — cross-platform ───────────────
  //
  //  CAMBIOS CLAVE vs versión anterior:
  //  1. Recibe File directamente (no el evento) → el reset del input se
  //     hace en onChange DESPUÉS de capturar el File, sin onClick.
  //     Esto corrige el bug de iOS Safari donde onClick+reset impide
  //     abrir el selector de archivos/cámara.
  //  2. Usa procesarFoto() que internamente usa solo FileReader → evita
  //     file.arrayBuffer() (no disponible en iOS < 15.4) y objectURL.
  //  3. Spinner visible por entrada individual (procesandoFotos Set).
  //  4. Guardia contra doble-tap: si ya está procesando, ignora.
  //
  const handlePhotoUpload = useCallback(
    async (file: File, itemId: number, entryId: number) => {
      const key = `${itemId}-${entryId}`;
      if (procesandoFotos.has(key)) return; // guardia doble-tap

      // Aceptar imagen aunque el type esté vacío (algunos Android) o sea HEIC
      const esImagen =
        file.type.startsWith('image/') ||
        file.type === '' ||
        /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)$/i.test(file.name);
      if (!esImagen) {
        alert('El archivo seleccionado no es una imagen válida.');
        return;
      }

      setProcesandoFotos(prev => new Set(prev).add(key));
      try {
        const b64 = await procesarFoto(file);
        setChecklist(prev =>
          prev.map(item =>
            item.id === itemId
              ? { ...item, evidence: item.evidence.map(ev => ev.id === entryId ? { ...ev, photo: b64 } : ev) }
              : item
          )
        );
      } catch (err: any) {
        console.error('[handlePhotoUpload]', err);
        alert(err?.message ?? 'No se pudo procesar la imagen. Intenta con otra foto.');
      } finally {
        setProcesandoFotos(prev => { const s = new Set(prev); s.delete(key); return s; });
      }
    },
    [procesandoFotos]
  );

  const limpiarFormulario = useCallback(() => {
    setChecklist(buildChecklist(formData.categoria, formData.subTipo));
    setPreguntaActual(0);
  }, [formData.categoria, formData.subTipo]);

  // ── Guardar en BD ──────────────────────────────────────
  const guardarCuestionario = useCallback(async () => {
    const sectorFinal = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
    const tramoFinal  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;
    const fd = { ...formData, sector: sectorFinal, Tramo: tramoFinal };

    const checklistParaDB = checklist.map(item => ({
      ...item,
      observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
      geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
      evidence:    item.evidence, // fotos van a tabla evidencias en actions.ts
    }));

    const lastGeoRef = checklist.flatMap(i => i.evidence).find(e => e.geoRef)?.geoRef;
    const gpsDB: GpsCoords = lastGeoRef
      ? { lat: lastGeoRef.lat, lon: lastGeoRef.lon, precision: lastGeoRef.precision }
      : { lat: null, lon: null, precision: '--' };

    if (reporteParaEditar?.id) {
      await actualizarReporte(reporteParaEditar.id.toString(), fd, checklistParaDB as any, gpsDB, {});
      alert('¡Reporte actualizado!');
    } else {
      await crearReporte(fd, checklistParaDB as any, gpsDB, {});
      alert('¡Reporte guardado!');
    }
  }, [formData, sectorPersonalizado, tramoPersonalizado, checklist, reporteParaEditar]);

  // ── Procesar y añadir a cola ───────────────────────────
  const procesarFormularioActual = useCallback(async () => {
    try {
      await guardarCuestionario();
      addToQueue({
        categoria:    formData.categoria,
        formData:     { ...formData },
        checklist:    checklist.map(item => ({
          ...item,
          observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
          geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
        })) as any,
        gps:          gpsVista,
        fotos:        {},
        mapImage:     null,
        fechaCaptura: new Date(),
      });
      const opcion = await mostrarOpcionesPostGuardado();
      if (opcion === 'otro_mismo' || opcion === 'generar_ahora') limpiarFormulario();
    } catch (err) {
      console.error(err);
      alert('Error al procesar el formulario.');
    }
  }, [addToQueue, checklist, formData, gpsVista, guardarCuestionario, limpiarFormulario]);

  // ── PDF local rápido ───────────────────────────────────
  const generarPDFLocal = useCallback(async () => {
    const doc    = new jsPDF('p', 'mm', 'a4');
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const margin = 12;
    const folio  = `REV-${formData.categoria.slice(0, 3).toUpperCase()}-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 900 + 100)}`;
    const sector = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
    const tramo  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;

    let y = 18;
    doc.setFont('helvetica', 'bold').setFontSize(12);
    doc.text(`REPORTE ${formData.categoria} – CIP ACAPULCO-COYUCA`, margin, y);
    y += 4; doc.setLineWidth(0.5).line(margin, y, pageW - margin, y); y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(9);
    doc.text(`Folio: ${folio}   Sector: ${sector}   Tramo: ${tramo}`, margin, y); y += 5;
    doc.setFont('helvetica', 'bold').text(`Sub-tipo: ${formData.subTipo}   Mantenimiento: ${formData.tipoMantenimiento}`, margin, y);
    doc.setFont('helvetica', 'normal'); y += 8;

    const rows: any[] = [];
    checklist.forEach(item => {
      item.evidence.forEach((ev, ei) => {
        rows.push([
          ei === 0 ? String(item.id) : '',
          ei === 0 ? item.pregunta   : `↳ Incidencia ${ei + 1}`,
          ev.geoRef?.lat ?? '',
          ev.geoRef?.lon ?? '',
          ev.observation || '',
          { content: '', photo: ev.photo },
        ]);
      });
    });

    let imgAlias = 0;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[
        { content: 'No.',  styles: { halign: 'center' } },
        { content: 'Concepto / Incidencia' },
        { content: 'Lat',  styles: { halign: 'center', fontSize: 7 } },
        { content: 'Lon',  styles: { halign: 'center', fontSize: 7 } },
        { content: 'Observaciones' },
        { content: 'Foto', styles: { halign: 'center' } },
      ]],
      body: rows,
      theme: 'grid',
      styles:     { fontSize: 7.5, cellPadding: 2, valign: 'middle', overflow: 'linebreak', lineWidth: 0.2 },
      headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 62 },
        2: { cellWidth: 22, halign: 'center', fontSize: 7 },
        3: { cellWidth: 22, halign: 'center', fontSize: 7 },
        4: { cellWidth: 42 },
        5: { cellWidth: 28, halign: 'center' },
      },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 5 && data.cell.raw?.photo) {
          try {
            const foto = data.cell.raw.photo as string;
            if (typeof foto !== 'string' || !foto.startsWith('data:')) return;
            const fmt   = foto.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            const p     = doc.getImageProperties(foto);
            const maxW  = 24;
            const maxH  = data.cell.height - 2;
            const ratio = Math.min(maxW / p.width, maxH / p.height);
            doc.addImage(
              foto, fmt,
              data.cell.x + (maxW - p.width  * ratio) / 2 + 1,
              data.cell.y + (data.cell.height - p.height * ratio) / 2,
              p.width * ratio, p.height * ratio,
              `img_${imgAlias++}`, 'FAST'
            );
          } catch { /* imagen inválida */ }
        }
      },
      rowPageBreak: 'avoid',
    });

    for (let i = 1; i <= doc.getNumberOfPages(); i++) {
      doc.setPage(i);
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
      doc.addImage('/logo_fonatur.png', 'PNG', (pageW - 130) / 2, (pageH - 38) / 2, 130, 38);
      doc.restoreGraphicsState();
    }
    doc.save(`${folio}.pdf`);
  }, [checklist, formData, sectorPersonalizado, tramoPersonalizado]);

  // ═══════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════
  const itemActual    = checklist[preguntaActual];
  const subtipos      = Object.keys(CATALOGO[formData.categoria] ?? {});
  const tieneSubtipos = subtipos.length > 1;
  const totalItems    = checklist.length;
  const geoRefs       = checklist.flatMap(i => i.evidence).filter(e => e.geoRef).length;
  const fotos         = checklist.flatMap(i => i.evidence).filter(e => e.photo).length;
  const conEvidencia  = checklist.filter(i => i.evidence.some(e => e.observation || e.geoRef || e.photo)).length;

  return (
    <div className="min-h-screen bg-[#eef2f6] font-sans text-gray-700">
      <div className="max-w-5xl mx-auto">

        {/* ── HEADER ───────────────────────────────────────── */}
        <header className="bg-[#285C4D] text-white shadow-lg pt-6 px-6 flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-5">
            <div>
              <h1 className="text-xl font-extrabold tracking-wide uppercase">
                Reporte de Mantenimiento — CIP Acapulco-Coyuca
              </h1>
              <p className="text-white/70 text-xs mt-0.5">Selecciona categoría y sub-tipo para cargar el cuestionario</p>
            </div>
            <div className="text-xs font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">{currentTime}</div>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
            {CATEGORIAS.map(cat => (
              <button key={cat} onClick={() => handleCategoriaChange(cat)}
                className={`flex-shrink-0 px-3 py-2.5 rounded-t-xl font-bold text-[11px] transition-colors whitespace-nowrap ${
                  formData.categoria === cat ? 'bg-[#eef2f6] text-gray-800' : 'bg-black/20 text-white/80 hover:bg-black/30'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </header>

        {/* ── Sub-tipo tabs ─────────────────────────────────── */}
        {tieneSubtipos && (
          <div className="bg-white border-b border-gray-100 px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide shadow-sm">
            {subtipos.map(sub => (
              <button key={sub} onClick={() => handleSubTipoChange(sub)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  formData.subTipo === sub
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                {sub}
              </button>
            ))}
          </div>
        )}
        {!tieneSubtipos && subtipos.length === 1 && (
          <div className="px-6 py-2.5 border-b border-gray-100 bg-white shadow-sm">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-gray-800">{formData.subTipo}</span>
          </div>
        )}

        <div className="p-4 sm:p-5 space-y-4">

          {/* ── DATOS GENERALES ──────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Sector</label>
                <select value={formData.sector}
                  onChange={e => setFormData(prev => ({ ...prev, sector: e.target.value, Tramo: '' }))}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-[#e67e22] text-sm focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30">
                  <option value="">Seleccionar</option>
                  {Object.keys(TRAMOS_POR_SECTOR).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {formData.sector === 'Otro' && (
                  <input type="text" placeholder="Sector..." value={sectorPersonalizado}
                    onChange={e => setSectorPersonalizado(e.target.value)}
                    className="mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tramo</label>
                {formData.sector === 'Otro' ? (
                  <input type="text" placeholder="Tramo..." value={tramoPersonalizado}
                    onChange={e => setTramoPersonalizado(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                ) : (
                  <select value={formData.Tramo}
                    onChange={e => setFormData(prev => ({ ...prev, Tramo: e.target.value }))}
                    disabled={!formData.sector}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-50">
                    <option value="">Seleccionar</option>
                    {(TRAMOS_POR_SECTOR[formData.sector] || []).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Acceso a playa</label>
                <input type="text" placeholder="Acceso" value={formData.accesoPublico}
                  onChange={e => setFormData(prev => ({ ...prev, accesoPublico: e.target.value }))}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tipo mantenimiento</label>
                <select value={formData.tipoMantenimiento}
                  onChange={e => setFormData(prev => ({ ...prev, tipoMantenimiento: e.target.value }))}
                  className={`px-3 py-2 rounded-xl border font-bold text-sm ${
                    formData.tipoMantenimiento === 'Urgente'
                      ? 'bg-red-50 border-red-200 text-red-600'
                      : 'bg-slate-50 border-slate-200 text-gray-700'
                  }`}>
                  <option value="">Seleccionar</option>
                  <option value="Urgente">🚨 Urgente</option>
                  <option value="Ordinario">📋 Ordinario</option>
                  <option value="Programable">🗓️ Programable</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── GRID PRINCIPAL ───────────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-4">

            {/* ── WIZARD ────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-3">

              {/* Progreso */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{formData.subTipo}</span>
                  <div className="flex gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-gray-700">{conEvidencia}/{totalItems} con evidencia</span>
                    <span className="text-slate-400">📍{geoRefs} 📷{fotos}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                  <div className="h-1.5 rounded-full transition-all duration-500 bg-emerald-500"
                    style={{ width: `${totalItems ? (conEvidencia / totalItems) * 100 : 0}%` }} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {checklist.map((item, idx) => {
                    const tiene = item.evidence.some(e => e.observation || e.geoRef || e.photo);
                    return (
                      <button key={item.id} type="button" onClick={() => setPreguntaActual(idx)}
                        title={item.pregunta}
                        className={`w-7 h-7 rounded-full text-[10px] font-bold transition-all border-2 ${
                          idx === preguntaActual ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
                        } ${tiene ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
                        {item.id}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tarjeta ítem */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <span className="inline-block text-[10px] uppercase font-black text-slate-400 tracking-widest bg-slate-100 px-3 py-1 rounded-full mb-3">
                  {itemActual.seccion}
                </span>
                <h2 className="text-base font-bold text-slate-800 mb-4 leading-snug">
                  <span className="text-slate-300 mr-2 font-mono">#{itemActual.id}</span>
                  {itemActual.pregunta}
                </h2>

                <div className="border-t border-slate-100 pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidencias / Incidencias</h3>
                    <button onClick={() => addEvidence(itemActual.id)}
                      className="flex items-center gap-1 text-xs font-bold text-emerald-600 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
                      <FaPlus size={9} /> Añadir evidencia
                    </button>
                  </div>

                  <div className="space-y-3">
                    {itemActual.evidence.map(ev => {
                      const isCapturing  = capturandoGps?.itemId === itemActual.id && capturandoGps?.entryId === ev.id;
                      const fotoKey      = `${itemActual.id}-${ev.id}`;
                      const isProcessing = procesandoFotos.has(fotoKey);

                      return (
                        <div key={ev.id} className="group relative">
                          {itemActual.evidence.length > 1 && (
                            <button onClick={() => removeEvidence(itemActual.id, ev.id)}
                              className="absolute -right-1 top-3 z-10 w-7 h-7 rounded-full bg-red-500 text-white shadow
                                         flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <FaTrash size={10} />
                            </button>
                          )}
                          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                            <div className="grid md:grid-cols-2 gap-3">

                              {/* Observación + GeoRef */}
                              <div className="space-y-2">
                                <input type="text" placeholder="Observación..."
                                  value={ev.observation}
                                  onChange={e => updateObservation(itemActual.id, ev.id, e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />

                                {ev.geoRef ? (
                                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between">
                                    <div className="text-[11px] font-mono text-emerald-700">
                                      <span className="font-bold">X:</span> {ev.geoRef.lat}<br/>
                                      <span className="font-bold">Y:</span> {ev.geoRef.lon}
                                      <span className="ml-2 text-emerald-400">±{ev.geoRef.precision}</span>
                                    </div>
                                    <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
                                      className="text-emerald-400 hover:text-emerald-600 ml-2" title="Recapturar">
                                      <FaUndo size={10} />
                                    </button>
                                  </div>
                                ) : isCapturing ? (
                                  // ── Animación GPS en tiempo real ──────────────
                                  // Muestra precisión actual mejorando hacia ≤7 m
                                  (() => {
                                    const acc     = gpsLiveAccuracy;
                                    const hasFix  = acc !== null;
                                    // Porcentaje de progreso hacia el objetivo (7 m)
                                    // 100 m → 0 %, 7 m → 100 %
                                    const pct     = hasFix ? Math.min(100, Math.max(0, ((100 - acc) / 93) * 100)) : 0;
                                    const isGood  = hasFix && acc <= 7;
                                    const isFair  = hasFix && acc > 7  && acc <= 20;
                                    const bar     = isGood ? 'bg-emerald-400' : isFair ? 'bg-yellow-400' : 'bg-orange-400';
                                    const txt     = isGood ? 'text-emerald-300' : isFair ? 'text-yellow-300' : 'text-orange-300';
                                    const border  = isGood ? 'border-emerald-700' : isFair ? 'border-yellow-700' : 'border-orange-800';
                                    return (
                                      <div className={`rounded-xl bg-slate-900 border ${border} overflow-hidden`}>
                                        <style>{`
                                          @keyframes gping{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(1.6)}}
                                          @keyframes gspin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
                                          @keyframes gpulse{0%,100%{opacity:.7}50%{opacity:1}}
                                        `}</style>

                                        {/* Barra de progreso superior */}
                                        <div className="h-1 bg-slate-700 w-full">
                                          <div
                                            className={`h-full transition-all duration-700 ${bar}`}
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>

                                        <div className="px-3 py-2.5 flex items-center gap-3">
                                          {/* Ícono con pulso */}
                                          <div className="relative w-7 h-7 flex-shrink-0 flex items-center justify-center">
                                            <div
                                              className={`absolute inset-0 rounded-full border-2 ${isGood ? 'border-emerald-400' : 'border-slate-600'}`}
                                              style={{ animation: 'gping 1.4s ease-in-out infinite' }}
                                            />
                                            <div
                                              className="absolute inset-1 rounded-full border-2 border-transparent border-t-emerald-400"
                                              style={{ animation: 'gspin 0.9s linear infinite' }}
                                            />
                                            <FaCrosshairs className="text-emerald-300 relative z-10" size={9} />
                                          </div>

                                          {/* Texto central */}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-1.5">
                                              <span className="text-white text-[11px] font-bold">
                                                {hasFix ? 'Mejorando señal...' : 'Buscando señal...'}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                              {hasFix ? (
                                                <>
                                                  <span className={`text-[13px] font-black tabular-nums leading-none ${txt}`}>
                                                    ±{acc < 10 ? acc.toFixed(1) : Math.round(acc)} m
                                                  </span>
                                                  <span className="text-slate-500 text-[10px]">
                                                    {isGood ? '✓ listo' : `objetivo ≤7 m`}
                                                  </span>
                                                </>
                                              ) : (
                                                <span className="text-slate-500 text-[10px]" style={{ animation: 'gpulse 1.2s ease-in-out infinite' }}>
                                                  esperando primera señal...
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Barras de señal */}
                                          <div className="flex items-end gap-[3px] h-5 flex-shrink-0">
                                            {[1, 2, 3, 4].map((lvl) => {
                                              const filled = hasFix
                                                ? acc <= 7  ? 4
                                                : acc <= 15 ? 3
                                                : acc <= 30 ? 2
                                                : acc <= 60 ? 1
                                                : 0
                                                : 0;
                                              const active = lvl <= filled;
                                              return (
                                                <div
                                                  key={lvl}
                                                  className={`w-1.5 rounded-sm transition-all duration-500 ${
                                                    active
                                                      ? lvl <= 1 ? 'bg-orange-400'
                                                      : lvl <= 2 ? 'bg-yellow-400'
                                                      : 'bg-emerald-400'
                                                      : 'bg-slate-700'
                                                  }`}
                                                  style={{ height: `${25 + lvl * 18}%` }}
                                                />
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 active:scale-95 transition-all">
                                    <FaCrosshairs size={11} /> Capturar ubicación exacta
                                  </button>
                                )}
                              </div>

                              {/* ── Foto ────────────────────────────────────
                                  FIX iOS/Safari/Android:
                                  • SIN onClick que limpie el value — eso
                                    impedía abrir cámara en iOS Safari.
                                  • El reset se hace en onChange DESPUÉS de
                                    capturar la referencia al File.
                                  • Se pasa File (no el evento) a handlePhotoUpload.
                                  • isProcessing muestra spinner inmediato.
                              ──────────────────────────────────────────── */}
                              <div className="flex flex-col gap-2">
                                {isProcessing ? (
                                  <div className="aspect-video bg-slate-100 rounded-xl flex flex-col items-center justify-center gap-2 border border-slate-200">
                                    <FaSpinner className="text-emerald-500 animate-spin" size={22} />
                                    <span className="text-[11px] font-bold text-slate-400">Procesando foto...</span>
                                  </div>
                                ) : ev.photo ? (
                                  <div className="relative aspect-video bg-white rounded-xl overflow-hidden border border-slate-200">
                                    <img src={ev.photo} className="w-full h-full object-cover" alt="evidencia" />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setChecklist(prev =>
                                          prev.map(item =>
                                            item.id === itemActual.id
                                              ? { ...item, evidence: item.evidence.map(e => e.id === ev.id ? { ...e, photo: null } : e) }
                                              : item
                                          )
                                        )
                                      }
                                      className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">
                                      <FaTrash size={9} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-2">

                                    {/* CÁMARA */}
                                    <label className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors select-none">
                                      <FaCamera className="text-blue-400" size={16} />
                                      <span className="text-[10px] font-bold text-blue-500">CÁMARA</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                        onChange={e => {
                                          const file = e.target.files?.[0];
                                          e.target.value = ''; // reset AQUÍ, no en onClick
                                          if (file) handlePhotoUpload(file, itemActual.id, ev.id);
                                        }}
                                      />
                                    </label>

                                    {/* GALERÍA */}
                                    <label className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors select-none">
                                      <svg className="text-slate-400" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                        <circle cx="8.5" cy="8.5" r="1.5" />
                                        <path d="M21 15l-5-5L5 21" />
                                      </svg>
                                      <span className="text-[10px] font-bold text-slate-400">GALERÍA</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                        onChange={e => {
                                          const file = e.target.files?.[0];
                                          e.target.value = ''; // reset AQUÍ, no en onClick
                                          if (file) handlePhotoUpload(file, itemActual.id, ev.id);
                                        }}
                                      />
                                    </label>

                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Navegación */}
                <div className="flex justify-between mt-5">
                  <button onClick={() => setPreguntaActual(p => Math.max(0, p - 1))}
                    disabled={preguntaActual === 0}
                    className="px-5 py-2 font-bold text-slate-400 hover:text-slate-600 disabled:opacity-30 text-sm transition-colors">
                    ← Anterior
                  </button>
                  <button onClick={() => setPreguntaActual(p => Math.min(checklist.length - 1, p + 1))}
                    disabled={preguntaActual === checklist.length - 1}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-30">
                    Siguiente →
                  </button>
                </div>
              </div>
            </div>

            {/* ── PANEL LATERAL ─────────────────────────────── */}
            <div className="space-y-3">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
                  <FaMapMarkedAlt className="text-orange-500" size={13} />
                  <h3 className="font-bold text-slate-600 text-xs uppercase tracking-wide">Geo-referencias</h3>
                  {geoRefs > 0 && (
                    <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{geoRefs}</span>
                  )}
                </div>
                <div ref={mapRef} className="h-48">
                  <LeafletMap gps={gpsVista} reportes={[]} georefPins={georefPins} />
                </div>
                {geoRefs === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-2 border-t border-slate-50">
                    Las geo-refs aparecerán aquí
                  </p>
                )}
              </div>

              <button onClick={procesarFormularioActual}
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm">
                <FaFilePdf /> Guardar y añadir a cola PDF
              </button>
              <button onClick={() => { if (window.confirm('¿Reiniciar formulario?')) limpiarFormulario(); }}
                className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors text-sm">
                <FaUndo size={12} /> Reiniciar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormularioUnificado;














// 'use client';

// import { usePDFQueue } from '@/app/context/pdf-queue-context';
// import { mostrarOpcionesPostGuardado } from '@/app/lib/generarPDFCombinado';
// import React, { useState, useRef, useEffect, useCallback } from 'react';
// import {
//   FaCrosshairs, FaCamera, FaMapMarkedAlt,
//   FaFilePdf, FaTrash, FaUndo, FaPlus, FaSpinner,
// } from 'react-icons/fa';
// import jsPDF from 'jspdf';
// import 'leaflet/dist/leaflet.css';
// import dynamic from 'next/dynamic';
// import autoTable from 'jspdf-autotable';
// import { crearReporte, actualizarReporte } from '@/app/lib/actions';

// const LeafletMap = dynamic(
//   () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
//   { ssr: false }
// );

// // ═══════════════════════════════════════════════════════════
// //  INTERFACES
// // ═══════════════════════════════════════════════════════════
// interface FormularioProps {
//   reportesIniciales?: any[];
//   reporteParaEditar?: any;
// }
// interface GpsCoords  { lat: string | null; lon: string | null; precision: string; }
// interface GeoRef     { lat: string; lon: string; precision: string; timestamp: string; }
// interface EvidenceEntry { id: number; observation: string; geoRef: GeoRef | null; photo: string | null; }
// interface ChecklistItem {
//   id: number; seccion: string; pregunta: string; respuesta: string;
//   evidence: EvidenceEntry[];
//   observacion: string; geoRef?: GeoRef | null;
// }
// interface FormData {
//   sector: string; Tramo: string; accesoPublico: string;
//   tipoMantenimiento: string; categoria: string; subTipo: string;
// }
// interface Seccion { titulo: string; items: string[]; }

// // ═══════════════════════════════════════════════════════════
// //  CATÁLOGO UNIFICADO
// // ═══════════════════════════════════════════════════════════
// const CATALOGO: Record<string, Record<string, Seccion[]>> = {

//   'ALUMBRADO PÚBLICO': {
//     'Alumbrado Público Solar': [{
//       titulo: 'ALUMBRADO PÚBLICO SOLAR',
//       items: [
//         'OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?',
//         'LA FOTOCELDA ¿CUMPLE CON SU FUNCIÓN?',
//         'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'INTEGRIDAD DE LUMINARIA',
//         'ESTADO DE POSTE METÁLICO/CONCRETO',
//         'ESTADO DE BASE DE CONCRETO',
//       ],
//     }],
//     'Alumbrado Público Eléctrico': [{
//       titulo: 'ALUMBRADO PÚBLICO ELÉCTRICO',
//       items: [
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//         'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS',
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'EL BRAZO ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'INTEGRIDAD DE LUMINARIA',
//         'ESTADO DE POSTE METÁLICO/CONCRETO',
//         'ESTADO DE BASE DE CONCRETO',
//       ],
//     }],
//     'Luminaria Tipo Cerillo': [{
//       titulo: 'LUMINARIA TIPO CERILLO',
//       items: [
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'ESTADO DE BASE DE CONCRETO',
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//       ],
//     }],
//     'Luminaria Tipo Europea': [{
//       titulo: 'LUMINARIA TIPO EUROPEA',
//       items: [
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'ESTADO DE BASE DE CONCRETO',
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//         'ESTADO DEL ELEMENTO PORTADOR DE LA LUMINARIA (POSTE PIRAMIDAL PREFABRICADO)',
//       ],
//     }],
//     'Otros': [{
//       titulo: 'OTROS – DESCRIPCIÓN LIBRE',
//       items: ['DESCRIPCIÓN DE LA INCIDENCIA'],
//     }],
//   },

//   'AREAS VERDES': {
//     '1. Poda': [{
//       titulo: '1. PODA',
//       items: [
//         '1.1 DESHIERBE – EN CAMELLÓN EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
//         '1.1 DESHIERBE – EN JARDINERA EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
//         '1.2 CAJETE – EN CAMELLÓN',
//         '1.3 CAJILLO – EN CAMELLONES CON UN ANCHO DE 10 CM Y PROFUNDIDAD DE 12 CM',
//         '1.4 DESORILLE DE ARRIATES/JARDINERA: SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
//         '1.4 DESORILLE DE CAMELLÓN ANCHO 15 CM ± 2 CM; SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
//         '1.5 PODA DE PASTO CON MAQUINARIA A UNA ALTURA PROMEDIO DE 2.5 A 5 CM',
//         '1.6 PODA DE SETOS CUANDO LA GEOMETRÍA DEL ARBUSTO YA NO ES UNIFORME (ARBUSTOS Y PLANTAS DE ORNATO) UTILIZANDO HERRAMIENTA MANUAL Y MECÁNICA',
//         '1.7 PODA DE ÁRBOLES DE 2 A 5 M DE FRONDOSIDAD Y DE 2.00 A 6.00 M DE ALTURA',
//         '1.7 PODA DE ÁRBOLES DE 5.01 M. A 10 DE FRONDOSIDAD Y DE 6.01 A 12.00 M DE ALTURA',
//         '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
//         '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
//         '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
//         '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
//       ],
//     }],
//     '2. Tala': [{
//       titulo: '2. TALA DE ÁRBOLES O PALMERAS',
//       items: [
//         'TALA, TROZA, CARGA Y RETIRO DE ÁRBOLES POR MEDIOS MANUALES BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) HASTA 5.00 M DE ALTURA',
//         'TALA, TROZA, CARGA Y RETIRO DE PALMERAS BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) DE 5.01 A 12.00 M',
//       ],
//     }],
//     '4. Escombro': [{
//       titulo: '4. ESCOMBRO',
//       items: ['ÁREA LIBRE DE CONTAMINACIÓN (TIERRA/CASCAJO, LODOS, EXCRETAS, HIDROCARBUROS, ESCOMBROS)'],
//     }],
//     '5. Limpieza': [{
//       titulo: '5. LIMPIEZA ÁREAS VERDES',
//       items: [
//         'JARDINERAS/ARRIATES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
//         'CAMELLONES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
//       ],
//     }],
//     '6. Red de riego': [{
//       titulo: '6. RED DE RIEGO',
//       items: ['RED DE RIEGO TAPADA, FUERA DE DIRECCIÓN O CON FUGAS'],
//     }],
//     '7. Retiro de tocones': [{
//       titulo: '7. RETIRO DE TOCONES',
//       items: ['CORTE A 15 CM DEBAJO DEL NIVEL EXISTENTE DE TOCON. DE HASTA 50 CM DE DIAMETRO'],
//     }],
//     '8. Fumigación': [{
//       titulo: '8. FUMIGACIÓN',
//       items: [
//         'ESPECIE PRESENTA PLAGA',
//         'ESPECIE PRESENTA HONGO O PUDRICIÓN',
//       ],
//     }],
//     '9. Arriate sin pasto': [{
//       titulo: '9. ARRIATE SIN PASTO (SOLO TIERRA)',
//       items: [
//         'ARRIATE PRESENTA MALEZA O VEGETACIÓN NO DESEADA',
//         'ARRIATE PRESENTA EROSIÓN O SOCAVACIÓN EN LA TIERRA',
//         'ARRIATE REQUIERE NIVELACIÓN O REINTEGRACIÓN DE TIERRA',
//         'TIERRA LIBRE DE RESIDUOS SÓLIDOS (BASURA, ESCOMBRO, PLÁSTICOS)',
//         'ARRIATE SIN ACUMULACIÓN DE AGUA O ENCHARCAMIENTO',
//         'BORDES/GUARNICIONES DEL ARRIATE EN BUEN ESTADO (SIN INVASIÓN A BANQUETA)',
//       ],
//     }],
//   },

//   'LIMPIEZA URBANA': {
//     'Limpieza General': [{
//       titulo: '1. LIMPIEZA GENERAL',
//       items: ['1.1 BARRIDO', '1.2 LAVADO DE PISO', '1.4 LAVADO DE MUROS'],
//     }],
//     'Residuos y Contenedores': [{
//       titulo: 'RESIDUOS Y CONTENEDORES',
//       items: [
//         'ÁREA GENERAL LIMPIA DE BASURA VISIBLE A LO LARGO DEL TRAMO',
//         'BANQUETAS BARRIDAS Y LIBRES DE RESIDUOS SÓLIDOS',
//         'CUNETAS LIMPIAS Y SIN OBSTRUCCIONES POR RESIDUOS',
//         'ACUMULACIÓN DE BASURA EN PUNTOS CRÍTICOS (ESQUINAS, ACCESOS, MUROS)',
//         'PLAYA LIMPIA DE RESIDUOS ORGÁNICOS E INORGÁNICOS (SI APLICA)',
//         'ACCESOS A PLAYA O ZONA PÚBLICA LIBRES DE BASURA',
//         'BOTES DE BASURA VACÍOS (NO REBASADOS)',
//         'BOTES Y CONTENEDORES LIMPIOS POR DENTRO Y POR FUERA',
//         'ÁREA ALREDEDOR DEL BOTE (1 METRO) LIBRE DE RESIDUOS',
//         'LIXIVIADOS O DERRAMES ALREDEDOR DE BOTES O CONTENEDORES',
//         'RESIDUOS DISPERSOS DESPUÉS DE LA RECOLECCIÓN',
//         'PODA EN GRAL CADA 6 MESES',
//       ],
//     }],
//     'Canal Pluvial': [{
//       titulo: 'CANAL PLUVIAL',
//       items: [
//         '¿EL CANAL PLUVIAL PRESENTA OBSTRUCCIONES (BASURA, SEDIMENTOS, VEGETACIÓN, LODO, ETC.)?',
//         '¿EL CANAL PLUVIAL PRESENTA DAÑOS ESTRUCTURALES (FISURAS, DESPRENDIMIENTOS, DEFORMACIONES, SOCAVACIONES)?',
//         '¿EL AGUA PUEDE FLUIR LIBREMENTE A TRAVÉS DEL CANAL PLUVIAL?',
//         '¿LOS ACCESOS AL CANAL (TAPAS, REJILLAS, REGISTROS) ESTÁN EN BUEN ESTADO?',
//         '¿EL CANAL PLUVIAL SE ENCUENTRA EN BUENAS CONDICIONES (SIN OBSTRUCCIONES, SIN DAÑO ESTRUCTURAL Y CON FLUJO LIBRE)?',
//         'INDIQUE EL ESTADO ACTUAL DE LA REJILLA PLUVIAL (PUEDE SELECCIONAR MÁS DE UNA OPCIÓN)',
//       ],
//     }],
//   },

//   'MOBILIARIO URBANO': {
//     '1. Bacheo':             [{ titulo: '1. BACHEO',                  items: ['1.1 M2 DAÑADOS'] }],
//     '2. Parabuses':          [{ titulo: '2. PARABUSES',               items: ['2.1 BANDALIZADOS', '2.2 GOLPEADOS', '2.3 OTRO DAÑO'] }],
//     '3. Tapas de registros': [{ titulo: '3. TAPAS DE REGISTROS DE CONCRETO', items: ['3.1 ROTA', '3.2 FALTANTE', '3.3 OTRO DAÑO', '3.4 DE CFE O TELECOMUNICACIONES (IDENTIFICAR PARA REPORTAR)'] }],
//     '4. Barandales': [{ titulo: '4. BARANDALES', items: [
//       '4.1 ACERO INOXIDABLE – TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESALINEADO O DETALLES EN EL ANCLAJE',
//       '4.2 METÁLICO – TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESALINEADO O DETALLES EN EL ANCLAJE',
//     ]}],
//     '5. Señaleticas':       [{ titulo: '5. SEÑALETICAS',    items: ['5.1 TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESPLOME O DETALLES EN EL ANCLAJE'] }],
//     '6. Balizamiento':      [{ titulo: '6. BALIZAMIENTO',   items: ['6.1 M2 O ML CON BALIZAMIENTO FALTANTE – IDENTIFICAR ELEMENTO'] }],
//     '7. Murales':           [{ titulo: '7. MURALES',         items: ['7.1 DESCRIBIR DETALLES ENCONTRADOS'] }],
//     '8. Bolardos':          [{ titulo: '8. BOLARDOS',        items: ['8.1 BOLARDOS DAÑADOS – IDENTIFICAR EL TIPO DE DAÑO'] }],
//     '9. Figuras lúdicas':   [{ titulo: '9. FIGURAS LÚDICAS', items: ['9.1 FIGURAS LÚDICAS – IDENTIFICAR EL TIPO DE DAÑO'] }],
//     '10. Postes semáforos': [{ titulo: '10. POSTES SEMÁFOROS', items: ['10.1 POSTES – IDENTIFICAR EL TIPO DE DAÑO'] }],
//     '11. Guarnicion':       [{ titulo: '11. GUARNICION',     items: ['Guarnicion dañada'] }],
//     '12. Banqueta':         [{ titulo: '12. BANQUETA',       items: ['Banqueta dañada'] }],
//     '13. Rampa':            [{ titulo: '13. RAMPA',          items: ['1. RAMPA ROTA', '2. RAMPA NO CUMPLE PENDIENTE'] }],
//   },
// };

// const CATEGORIA_COLOR: Record<string, { header: string; tab: string; badge: string }> = {
//   'ALUMBRADO PÚBLICO':  { header: 'from-yellow-600 to-yellow-700',   tab: 'bg-yellow-50  text-yellow-800',  badge: 'bg-yellow-100  text-yellow-700'  },
//   'AREAS VERDES':       { header: 'from-emerald-600 to-emerald-700', tab: 'bg-emerald-50 text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
//   'BARRIDO VIALIDADES': { header: 'from-blue-600 to-blue-700',       tab: 'bg-blue-50    text-blue-800',    badge: 'bg-blue-100    text-blue-700'    },
//   'LIMPIEZA URBANA':    { header: 'from-orange-600 to-orange-700',   tab: 'bg-orange-50  text-orange-800',  badge: 'bg-orange-100  text-orange-700'  },
//   'MOBILIARIO URBANO':  { header: 'from-purple-600 to-purple-700',   tab: 'bg-purple-50  text-purple-800',  badge: 'bg-purple-100  text-purple-700'  },
// };

// const TRAMOS_POR_SECTOR: Record<string, string[]> = {
//   'Barra de Coyuca':      ['Sendero-Seguro-Barra Coyuca'],
//   'Pie de la Cuesta':     ['Sendero-seguro-Pie de la cuesta'],
//   'Barrios Historicos':   ['Caleta-caletilla', 'Sendero-Costera-antigua', 'Corredor Zocalo-quebrada', 'Corredor zocalo-fuerte'],
//   'Acapulco Tradicional': ['Sendero-Tadeo-arredondo', 'Sendero-cinerio-hornitos', 'Michoacan', 'Av. Universidad', 'Dr. Ignacio chavez'],
//   'Acapulco Dorado':      ['Costa azul'],
//   'Las Brisas':           [''],
//   'Puerto Márquez':       ['Sendero-Puerto-Marquez'],
//   'Acapulco Diamante':    ['Av. Costera Palmas'],
//   'Otro':                 [''],
// };

// // ═══════════════════════════════════════════════════════════
// //  HELPERS DE IMAGEN — DEFINIDOS FUERA DEL COMPONENTE
// //
// //  Por qué FileReader y no file.arrayBuffer() / URL.createObjectURL():
// //  • file.arrayBuffer() no existe en iOS Safari < 15.4 → excepción
// //  • URL.createObjectURL puede devolver imagen en blanco en algunos
// //    contextos restringidos de WebKit (PWA en iOS, Safari privado)
// //  • FileReader existe desde iOS 8 y es la API más compatible
// // ═══════════════════════════════════════════════════════════

// /** Lee un Blob como ArrayBuffer con FileReader (iOS Safari < 15.4 compatible) */
// function readAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
//   return new Promise((resolve, reject) => {
//     const r = new FileReader();
//     r.onload  = () => resolve(r.result as ArrayBuffer);
//     r.onerror = () => reject(r.error ?? new Error('FileReader error'));
//     r.readAsArrayBuffer(blob);
//   });
// }

// /** Lee un Blob como data-URL con FileReader */
// function readAsDataURL(blob: Blob): Promise<string> {
//   return new Promise((resolve, reject) => {
//     const r = new FileReader();
//     r.onload  = () => resolve(r.result as string);
//     r.onerror = () => reject(r.error ?? new Error('FileReader error'));
//     r.readAsDataURL(blob);
//   });
// }

// /**
//  * Extrae orientación EXIF de un JPEG.
//  * Solo lee los primeros 64 KB (APP1 siempre está al inicio).
//  * Devuelve 1 (sin rotación) si no hay EXIF o no es JPEG.
//  */
// function getJpegOrientation(buffer: ArrayBuffer): number {
//   try {
//     const view = new DataView(buffer);
//     if (view.byteLength < 4 || view.getUint16(0) !== 0xFFD8) return 1;
//     let offset = 2;
//     while (offset + 4 <= view.byteLength) {
//       const marker = view.getUint16(offset);
//       offset += 2;
//       if (marker === 0xFFE1) {
//         const segLen = view.getUint16(offset);
//         const segEnd = offset + segLen;
//         if (segEnd > view.byteLength) break;
//         const app1 = new DataView(buffer, offset + 2, segLen - 2);
//         if (app1.byteLength < 14) break;
//         const hdr = String.fromCharCode(
//           app1.getUint8(0), app1.getUint8(1),
//           app1.getUint8(2), app1.getUint8(3),
//         );
//         if (hdr !== 'Exif') break;
//         const le   = app1.getUint16(6) === 0x4949;
//         const ifd0 = app1.getUint32(10, le) + 6;
//         if (ifd0 + 2 > app1.byteLength) break;
//         const entries = app1.getUint16(ifd0, le);
//         for (let i = 0; i < entries; i++) {
//           const e = ifd0 + 2 + i * 12;
//           if (e + 12 > app1.byteLength) break;
//           if (app1.getUint16(e, le) === 0x0112) {
//             const v = app1.getUint16(e + 8, le);
//             return v >= 1 && v <= 8 ? v : 1;
//           }
//         }
//         break;
//       }
//       if ((marker & 0xFF00) !== 0xFF00) break;
//       if (offset + 2 > view.byteLength) break;
//       offset += view.getUint16(offset);
//     }
//   } catch { /* silencioso */ }
//   return 1;
// }

// /** Carga un data-URL en un HTMLImageElement */
// function loadImage(src: string): Promise<HTMLImageElement> {
//   return new Promise((resolve, reject) => {
//     const img   = new Image();
//     img.onerror = () => reject(new Error('No se pudo decodificar la imagen.'));
//     img.onload  = () => resolve(img);
//     img.src     = src;
//   });
// }

// /**
//  * Redimensiona y rota la imagen aplicando corrección EXIF.
//  * Usa naturalWidth/naturalHeight (img.width puede ser 0 en iOS).
//  * Valida la exportación: en iOS bajo presión de memoria, toDataURL
//  * devuelve 'data:,' sin lanzar error.
//  */
// function renderToCanvas(img: HTMLImageElement, orientation: number, maxDim = 1200): string {
//   const needsSwap = orientation >= 5 && orientation <= 8;
//   const srcW      = img.naturalWidth  || img.width  || 1;
//   const srcH      = img.naturalHeight || img.height || 1;
//   const longSide  = Math.max(srcW, srcH);
//   const scale     = longSide > maxDim ? maxDim / longSide : 1;
//   const dstW      = Math.round((needsSwap ? srcH : srcW) * scale);
//   const dstH      = Math.round((needsSwap ? srcW : srcH) * scale);

//   const canvas  = document.createElement('canvas');
//   canvas.width  = dstW;
//   canvas.height = dstH;
//   const ctx = canvas.getContext('2d');
//   if (!ctx) throw new Error('Canvas 2D no disponible en este dispositivo.');

//   ctx.save();
//   ctx.translate(dstW / 2, dstH / 2);
//   switch (orientation) {
//     case 2: ctx.scale(-1,  1);                           break;
//     case 3: ctx.rotate(Math.PI);                         break;
//     case 4: ctx.scale( 1, -1);                           break;
//     case 5: ctx.rotate(-Math.PI / 2); ctx.scale(-1, 1);  break;
//     case 6: ctx.rotate( Math.PI / 2);                    break;
//     case 7: ctx.rotate( Math.PI / 2); ctx.scale(-1, 1);  break;
//     case 8: ctx.rotate(-Math.PI / 2);                    break;
//   }
//   ctx.drawImage(img, -(srcW * scale) / 2, -(srcH * scale) / 2, srcW * scale, srcH * scale);
//   ctx.restore();

//   const result = canvas.toDataURL('image/jpeg', 0.82);
//   if (!result || result === 'data:,' || result.length < 200) {
//     throw new Error('El canvas no pudo exportar la imagen. Intenta con una foto más pequeña.');
//   }
//   return result;
// }

// /**
//  * Pipeline completo: EXIF → data-URL → Image → canvas → JPEG base64.
//  * Acepta el objeto File directamente para desacoplar el input del handler.
//  */
// async function procesarFoto(file: File): Promise<string> {
//   // Leer solo los primeros 64 KB para EXIF (más rápido en móviles)
//   const exifBuffer  = await readAsArrayBuffer(file.slice(0, 65_536));
//   const orientation = getJpegOrientation(exifBuffer);
//   const dataUrl     = await readAsDataURL(file);
//   const img         = await loadImage(dataUrl);
//   return renderToCanvas(img, orientation);
// }

// // ── Helpers generales ──────────────────────────────────────
// const emptyEntry    = (): EvidenceEntry => ({ id: Date.now(), observation: '', geoRef: null, photo: null });
// const buildChecklist = (categoria: string, subTipo: string): ChecklistItem[] => {
//   const secciones = CATALOGO[categoria]?.[subTipo] ?? [];
//   let counter = 1;
//   return secciones.flatMap(sec =>
//     sec.items.map(pregunta => ({
//       id: counter++, seccion: sec.titulo, pregunta,
//       respuesta: '', observacion: '', geoRef: null,
//       evidence: [emptyEntry()],
//     }))
//   );
// };
// const CATEGORIAS = Object.keys(CATALOGO);

// // ═══════════════════════════════════════════════════════════
// //  COMPONENTE PRINCIPAL
// // ═══════════════════════════════════════════════════════════
// const FormularioUnificado: React.FC<FormularioProps> = ({ reporteParaEditar }) => {
//   const { addToQueue } = usePDFQueue();
//   const mapRef        = useRef<HTMLDivElement>(null);
//   const geoRefWatchId = useRef<number | null>(null);

//   const [currentTime,         setCurrentTime]        = useState('');
//   const [preguntaActual,      setPreguntaActual]      = useState(0);
//   const [sectorPersonalizado, setSectorPersonalizado] = useState('');
//   const [tramoPersonalizado,  setTramoPersonalizado]  = useState('');
//   const [capturandoGps,       setCapturandoGps]       = useState<{ itemId: number; entryId: number } | null>(null);

//   // Set de claves "itemId-entryId" → permite spinner por entrada sin bloquear otras
//   const [procesandoFotos, setProcesandoFotos] = useState<Set<string>>(new Set());

//   const [gps, setGps] = useState<GpsCoords>({
//     lat:       reporteParaEditar?.latitud  ? String(reporteParaEditar.latitud)  : null,
//     lon:       reporteParaEditar?.longitud ? String(reporteParaEditar.longitud) : null,
//     precision: '--',
//   });

//   const catInicial     = reporteParaEditar?.categoria ?? 'ALUMBRADO PÚBLICO';
//   const subtiposInic   = Object.keys(CATALOGO[catInicial] ?? {});
//   const subTipoInicial = reporteParaEditar?.subTipo ?? subtiposInic[0] ?? '';

//   const [formData, setFormData] = useState<FormData>({
//     sector:            reporteParaEditar?.sector             ?? '',
//     Tramo:             reporteParaEditar?.tramo              ?? '',
//     accesoPublico:     reporteParaEditar?.acceso_publico     ?? '',
//     tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
//     categoria:         catInicial,
//     subTipo:           subTipoInicial,
//   });

//   const [checklist, setChecklist] = useState<ChecklistItem[]>(
//     buildChecklist(catInicial, subTipoInicial)
//   );

//   // ── Geo-pins para el mapa ──────────────────────────────
//   const georefPins = React.useMemo(() =>
//     checklist.flatMap(item =>
//       item.evidence.filter(ev => ev.geoRef).map((ev, ei) => ({
//         lat: ev.geoRef!.lat, lon: ev.geoRef!.lon,
//         label:       item.evidence.length > 1 ? `${item.id}.${ei + 1}` : String(item.id),
//         pregunta:    item.pregunta,
//         observation: ev.observation,
//         cumple:      item.respuesta,
//       }))
//     )
//   , [checklist]);

//   const gpsVista: GpsCoords = React.useMemo(() =>
//     georefPins.length > 0
//       ? { lat: georefPins[georefPins.length - 1].lat, lon: georefPins[georefPins.length - 1].lon, precision: '--' }
//       : { lat: null, lon: null, precision: '--' }
//   , [georefPins]);

//   // ── Efectos ────────────────────────────────────────────
//   useEffect(() => {
//     const tick = () => setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
//     tick();
//     const id = setInterval(tick, 1000);
//     return () => clearInterval(id);
//   }, []);

//   useEffect(() => {
//     import('leaflet').then(L => {
//       delete (L.Icon.Default.prototype as any)._getIconUrl;
//       L.Icon.Default.mergeOptions({
//         iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//         iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//         shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
//       });
//     });
//   }, []);

//   useEffect(() => {
//     return () => {
//       if (geoRefWatchId.current !== null) navigator.geolocation.clearWatch(geoRefWatchId.current);
//     };
//   }, []);

//   // ── Cargar datos para edición ──────────────────────────
//   useEffect(() => {
//     if (!reporteParaEditar) return;
//     setFormData({
//       sector:            reporteParaEditar.sector             || '',
//       Tramo:             reporteParaEditar.tramo              || '',
//       accesoPublico:     reporteParaEditar.acceso_publico     || '',
//       tipoMantenimiento: reporteParaEditar.tipo_mantenimiento || '',
//       categoria:         reporteParaEditar.categoria          || 'ALUMBRADO PÚBLICO',
//       subTipo:           reporteParaEditar.sub_tipo           || '',
//     });
//     if (reporteParaEditar.checklist) setChecklist(reporteParaEditar.checklist);
//     if (reporteParaEditar.latitud && reporteParaEditar.longitud) {
//       setGps({ lat: String(reporteParaEditar.latitud), lon: String(reporteParaEditar.longitud), precision: 'Recuperado de BD' });
//     }
//   }, [reporteParaEditar]);

//   // ── Cambio de categoría ────────────────────────────────
//   const handleCategoriaChange = useCallback((nuevaCat: string) => {
//     const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
//     if (hayEvidencias && !window.confirm('Cambiar categoría borrará las evidencias actuales. ¿Continuar?')) return;
//     const subtipo = Object.keys(CATALOGO[nuevaCat] ?? {})[0] ?? '';
//     setFormData(prev => ({ ...prev, categoria: nuevaCat, subTipo: subtipo }));
//     setChecklist(buildChecklist(nuevaCat, subtipo));
//     setPreguntaActual(0);
//   }, [checklist]);

//   // ── Cambio de sub-tipo ─────────────────────────────────
//   const handleSubTipoChange = useCallback((nuevoSub: string) => {
//     const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
//     if (hayEvidencias && !window.confirm('Cambiar el tipo borrará las evidencias actuales. ¿Continuar?')) return;
//     setFormData(prev => ({ ...prev, subTipo: nuevoSub }));
//     setChecklist(buildChecklist(formData.categoria, nuevoSub));
//     setPreguntaActual(0);
//   }, [checklist, formData.categoria]);

//   // ── GPS por evidencia ──────────────────────────────────
//   const capturarGeoRef = useCallback((itemId: number, entryId: number) => {
//     if (!navigator.geolocation) { alert('Tu dispositivo no soporta GPS. Activa la ubicación e inténtalo de nuevo.'); return; }
//     if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; }
//     setCapturandoGps({ itemId, entryId });

//     const timeoutId = setTimeout(() => {
//       if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; }
//       setCapturandoGps(null);
//       alert('No se pudo obtener la ubicación en 30 segundos.\n\nVerifica que:\n• El GPS esté activado\n• La app tenga permiso de ubicación\n• Estés al aire libre\n\nPuedes intentarlo de nuevo.');
//     }, 30_000);

//     geoRefWatchId.current = navigator.geolocation.watchPosition(
//       ({ coords: { latitude, longitude, accuracy } }) => {
//         clearTimeout(timeoutId);
//         const timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
//         setChecklist(prev =>
//           prev.map(item =>
//             item.id === itemId
//               ? { ...item, evidence: item.evidence.map(ev =>
//                   ev.id === entryId
//                     ? { ...ev, geoRef: { lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m`, timestamp } }
//                     : ev
//                 )}
//               : item
//           )
//         );
//         if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; }
//         setCapturandoGps(null);
//       },
//       (error) => {
//         clearTimeout(timeoutId);
//         if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; }
//         setCapturandoGps(null);
//         const msgs: Record<number, string> = {
//           1: 'Permiso denegado. Ve a Ajustes > Permisos y activa la ubicación.',
//           2: 'No se pudo determinar la ubicación. Asegúrate de estar al aire libre.',
//           3: 'Tiempo agotado. Intenta en un lugar con mejor señal.',
//         };
//         alert(msgs[error.code] ?? `Error de GPS (código ${error.code}).`);
//       },
//       { enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 }
//     );
//   }, []);

//   // ── Evidencia helpers ──────────────────────────────────
//   const addEvidence = useCallback((itemId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: [...item.evidence, emptyEntry()] } : item
//     ));
//   }, []);

//   const removeEvidence = useCallback((itemId: number, entryId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.filter(e => e.id !== entryId) } : item
//     ));
//   }, []);

//   const updateObservation = useCallback((itemId: number, entryId: number, val: string) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId
//         ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, observation: val } : e) }
//         : item
//     ));
//   }, []);

//   // ── Manejador de fotos — cross-platform ───────────────
//   //
//   //  CAMBIOS CLAVE vs versión anterior:
//   //  1. Recibe File directamente (no el evento) → el reset del input se
//   //     hace en onChange DESPUÉS de capturar el File, sin onClick.
//   //     Esto corrige el bug de iOS Safari donde onClick+reset impide
//   //     abrir el selector de archivos/cámara.
//   //  2. Usa procesarFoto() que internamente usa solo FileReader → evita
//   //     file.arrayBuffer() (no disponible en iOS < 15.4) y objectURL.
//   //  3. Spinner visible por entrada individual (procesandoFotos Set).
//   //  4. Guardia contra doble-tap: si ya está procesando, ignora.
//   //
//   const handlePhotoUpload = useCallback(
//     async (file: File, itemId: number, entryId: number) => {
//       const key = `${itemId}-${entryId}`;
//       if (procesandoFotos.has(key)) return; // guardia doble-tap

//       // Aceptar imagen aunque el type esté vacío (algunos Android) o sea HEIC
//       const esImagen =
//         file.type.startsWith('image/') ||
//         file.type === '' ||
//         /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)$/i.test(file.name);
//       if (!esImagen) {
//         alert('El archivo seleccionado no es una imagen válida.');
//         return;
//       }

//       setProcesandoFotos(prev => new Set(prev).add(key));
//       try {
//         const b64 = await procesarFoto(file);
//         setChecklist(prev =>
//           prev.map(item =>
//             item.id === itemId
//               ? { ...item, evidence: item.evidence.map(ev => ev.id === entryId ? { ...ev, photo: b64 } : ev) }
//               : item
//           )
//         );
//       } catch (err: any) {
//         console.error('[handlePhotoUpload]', err);
//         alert(err?.message ?? 'No se pudo procesar la imagen. Intenta con otra foto.');
//       } finally {
//         setProcesandoFotos(prev => { const s = new Set(prev); s.delete(key); return s; });
//       }
//     },
//     [procesandoFotos]
//   );

//   const limpiarFormulario = useCallback(() => {
//     setChecklist(buildChecklist(formData.categoria, formData.subTipo));
//     setPreguntaActual(0);
//   }, [formData.categoria, formData.subTipo]);

//   // ── Guardar en BD ──────────────────────────────────────
//   const guardarCuestionario = useCallback(async () => {
//     const sectorFinal = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramoFinal  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;
//     const fd = { ...formData, sector: sectorFinal, Tramo: tramoFinal };

//     const checklistParaDB = checklist.map(item => ({
//       ...item,
//       observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//       geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//       evidence:    item.evidence, // fotos van a tabla evidencias en actions.ts
//     }));

//     const lastGeoRef = checklist.flatMap(i => i.evidence).find(e => e.geoRef)?.geoRef;
//     const gpsDB: GpsCoords = lastGeoRef
//       ? { lat: lastGeoRef.lat, lon: lastGeoRef.lon, precision: lastGeoRef.precision }
//       : { lat: null, lon: null, precision: '--' };

//     if (reporteParaEditar?.id) {
//       await actualizarReporte(reporteParaEditar.id.toString(), fd, checklistParaDB as any, gpsDB, {});
//       alert('¡Reporte actualizado!');
//     } else {
//       await crearReporte(fd, checklistParaDB as any, gpsDB, {});
//       alert('¡Reporte guardado!');
//     }
//   }, [formData, sectorPersonalizado, tramoPersonalizado, checklist, reporteParaEditar]);

//   // ── Procesar y añadir a cola ───────────────────────────
//   const procesarFormularioActual = useCallback(async () => {
//     try {
//       await guardarCuestionario();
//       addToQueue({
//         categoria:    formData.categoria,
//         formData:     { ...formData },
//         checklist:    checklist.map(item => ({
//           ...item,
//           observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//           geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//         })) as any,
//         gps:          gpsVista,
//         fotos:        {},
//         mapImage:     null,
//         fechaCaptura: new Date(),
//       });
//       const opcion = await mostrarOpcionesPostGuardado();
//       if (opcion === 'otro_mismo' || opcion === 'generar_ahora') limpiarFormulario();
//     } catch (err) {
//       console.error(err);
//       alert('Error al procesar el formulario.');
//     }
//   }, [addToQueue, checklist, formData, gpsVista, guardarCuestionario, limpiarFormulario]);

//   // ── PDF local rápido ───────────────────────────────────
//   const generarPDFLocal = useCallback(async () => {
//     const doc    = new jsPDF('p', 'mm', 'a4');
//     const pageW  = doc.internal.pageSize.getWidth();
//     const pageH  = doc.internal.pageSize.getHeight();
//     const margin = 12;
//     const folio  = `REV-${formData.categoria.slice(0, 3).toUpperCase()}-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 900 + 100)}`;
//     const sector = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramo  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;

//     let y = 18;
//     doc.setFont('helvetica', 'bold').setFontSize(12);
//     doc.text(`REPORTE ${formData.categoria} – CIP ACAPULCO-COYUCA`, margin, y);
//     y += 4; doc.setLineWidth(0.5).line(margin, y, pageW - margin, y); y += 6;
//     doc.setFont('helvetica', 'normal').setFontSize(9);
//     doc.text(`Folio: ${folio}   Sector: ${sector}   Tramo: ${tramo}`, margin, y); y += 5;
//     doc.setFont('helvetica', 'bold').text(`Sub-tipo: ${formData.subTipo}   Mantenimiento: ${formData.tipoMantenimiento}`, margin, y);
//     doc.setFont('helvetica', 'normal'); y += 8;

//     const rows: any[] = [];
//     checklist.forEach(item => {
//       item.evidence.forEach((ev, ei) => {
//         rows.push([
//           ei === 0 ? String(item.id) : '',
//           ei === 0 ? item.pregunta   : `↳ Incidencia ${ei + 1}`,
//           ev.geoRef?.lat ?? '',
//           ev.geoRef?.lon ?? '',
//           ev.observation || '',
//           { content: '', photo: ev.photo },
//         ]);
//       });
//     });

//     let imgAlias = 0;
//     autoTable(doc, {
//       startY: y,
//       margin: { left: margin, right: margin },
//       head: [[
//         { content: 'No.',  styles: { halign: 'center' } },
//         { content: 'Concepto / Incidencia' },
//         { content: 'Lat',  styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Lon',  styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Observaciones' },
//         { content: 'Foto', styles: { halign: 'center' } },
//       ]],
//       body: rows,
//       theme: 'grid',
//       styles:     { fontSize: 7.5, cellPadding: 2, valign: 'middle', overflow: 'linebreak', lineWidth: 0.2 },
//       headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
//       columnStyles: {
//         0: { cellWidth: 10, halign: 'center' },
//         1: { cellWidth: 62 },
//         2: { cellWidth: 22, halign: 'center', fontSize: 7 },
//         3: { cellWidth: 22, halign: 'center', fontSize: 7 },
//         4: { cellWidth: 42 },
//         5: { cellWidth: 28, halign: 'center' },
//       },
//       didDrawCell: (data: any) => {
//         if (data.section === 'body' && data.column.index === 5 && data.cell.raw?.photo) {
//           try {
//             const foto = data.cell.raw.photo as string;
//             if (typeof foto !== 'string' || !foto.startsWith('data:')) return;
//             const fmt   = foto.startsWith('data:image/png') ? 'PNG' : 'JPEG';
//             const p     = doc.getImageProperties(foto);
//             const maxW  = 24;
//             const maxH  = data.cell.height - 2;
//             const ratio = Math.min(maxW / p.width, maxH / p.height);
//             doc.addImage(
//               foto, fmt,
//               data.cell.x + (maxW - p.width  * ratio) / 2 + 1,
//               data.cell.y + (data.cell.height - p.height * ratio) / 2,
//               p.width * ratio, p.height * ratio,
//               `img_${imgAlias++}`, 'FAST'
//             );
//           } catch { /* imagen inválida */ }
//         }
//       },
//       rowPageBreak: 'avoid',
//     });

//     for (let i = 1; i <= doc.getNumberOfPages(); i++) {
//       doc.setPage(i);
//       doc.saveGraphicsState();
//       doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
//       doc.addImage('/logo_fonatur.png', 'PNG', (pageW - 130) / 2, (pageH - 38) / 2, 130, 38);
//       doc.restoreGraphicsState();
//     }
//     doc.save(`${folio}.pdf`);
//   }, [checklist, formData, sectorPersonalizado, tramoPersonalizado]);

//   // ═══════════════════════════════════════════════════════
//   //  RENDER
//   // ═══════════════════════════════════════════════════════
//   const itemActual    = checklist[preguntaActual];
//   const subtipos      = Object.keys(CATALOGO[formData.categoria] ?? {});
//   const tieneSubtipos = subtipos.length > 1;
//   const totalItems    = checklist.length;
//   const geoRefs       = checklist.flatMap(i => i.evidence).filter(e => e.geoRef).length;
//   const fotos         = checklist.flatMap(i => i.evidence).filter(e => e.photo).length;
//   const conEvidencia  = checklist.filter(i => i.evidence.some(e => e.observation || e.geoRef || e.photo)).length;

//   return (
//     <div className="min-h-screen bg-[#eef2f6] font-sans text-gray-700">
//       <div className="max-w-5xl mx-auto">

//         {/* ── HEADER ───────────────────────────────────────── */}
//         <header className="bg-[#285C4D] text-white shadow-lg pt-6 px-6 flex flex-col">
//           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-5">
//             <div>
//               <h1 className="text-xl font-extrabold tracking-wide uppercase">
//                 Reporte de Mantenimiento — CIP Acapulco-Coyuca
//               </h1>
//               <p className="text-white/70 text-xs mt-0.5">Selecciona categoría y sub-tipo para cargar el cuestionario</p>
//             </div>
//             <div className="text-xs font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">{currentTime}</div>
//           </div>
//           <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
//             {CATEGORIAS.map(cat => (
//               <button key={cat} onClick={() => handleCategoriaChange(cat)}
//                 className={`flex-shrink-0 px-3 py-2.5 rounded-t-xl font-bold text-[11px] transition-colors whitespace-nowrap ${
//                   formData.categoria === cat ? 'bg-[#eef2f6] text-gray-800' : 'bg-black/20 text-white/80 hover:bg-black/30'
//                 }`}>
//                 {cat}
//               </button>
//             ))}
//           </div>
//         </header>

//         {/* ── Sub-tipo tabs ─────────────────────────────────── */}
//         {tieneSubtipos && (
//           <div className="bg-white border-b border-gray-100 px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide shadow-sm">
//             {subtipos.map(sub => (
//               <button key={sub} onClick={() => handleSubTipoChange(sub)}
//                 className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
//                   formData.subTipo === sub
//                     ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
//                     : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
//                 }`}>
//                 {sub}
//               </button>
//             ))}
//           </div>
//         )}
//         {!tieneSubtipos && subtipos.length === 1 && (
//           <div className="px-6 py-2.5 border-b border-gray-100 bg-white shadow-sm">
//             <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-gray-800">{formData.subTipo}</span>
//           </div>
//         )}

//         <div className="p-4 sm:p-5 space-y-4">

//           {/* ── DATOS GENERALES ──────────────────────────────── */}
//           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
//             <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Sector</label>
//                 <select value={formData.sector}
//                   onChange={e => setFormData(prev => ({ ...prev, sector: e.target.value, Tramo: '' }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-[#e67e22] text-sm focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30">
//                   <option value="">Seleccionar</option>
//                   {Object.keys(TRAMOS_POR_SECTOR).map(s => <option key={s} value={s}>{s}</option>)}
//                 </select>
//                 {formData.sector === 'Otro' && (
//                   <input type="text" placeholder="Sector..." value={sectorPersonalizado}
//                     onChange={e => setSectorPersonalizado(e.target.value)}
//                     className="mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 )}
//               </div>
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tramo</label>
//                 {formData.sector === 'Otro' ? (
//                   <input type="text" placeholder="Tramo..." value={tramoPersonalizado}
//                     onChange={e => setTramoPersonalizado(e.target.value)}
//                     className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 ) : (
//                   <select value={formData.Tramo}
//                     onChange={e => setFormData(prev => ({ ...prev, Tramo: e.target.value }))}
//                     disabled={!formData.sector}
//                     className="px-3 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-50">
//                     <option value="">Seleccionar</option>
//                     {(TRAMOS_POR_SECTOR[formData.sector] || []).map(t => <option key={t} value={t}>{t}</option>)}
//                   </select>
//                 )}
//               </div>
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Acceso a playa</label>
//                 <input type="text" placeholder="Acceso" value={formData.accesoPublico}
//                   onChange={e => setFormData(prev => ({ ...prev, accesoPublico: e.target.value }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
//               </div>
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tipo mantenimiento</label>
//                 <select value={formData.tipoMantenimiento}
//                   onChange={e => setFormData(prev => ({ ...prev, tipoMantenimiento: e.target.value }))}
//                   className={`px-3 py-2 rounded-xl border font-bold text-sm ${
//                     formData.tipoMantenimiento === 'Urgente'
//                       ? 'bg-red-50 border-red-200 text-red-600'
//                       : 'bg-slate-50 border-slate-200 text-gray-700'
//                   }`}>
//                   <option value="">Seleccionar</option>
//                   <option value="Urgente">🚨 Urgente</option>
//                   <option value="Ordinario">📋 Ordinario</option>
//                   <option value="Programable">🗓️ Programable</option>
//                 </select>
//               </div>
//             </div>
//           </div>

//           {/* ── GRID PRINCIPAL ───────────────────────────────── */}
//           <div className="grid lg:grid-cols-3 gap-4">

//             {/* ── WIZARD ────────────────────────────────────── */}
//             <div className="lg:col-span-2 space-y-3">

//               {/* Progreso */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
//                 <div className="flex justify-between items-center mb-2">
//                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{formData.subTipo}</span>
//                   <div className="flex gap-2 text-[11px]">
//                     <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-gray-700">{conEvidencia}/{totalItems} con evidencia</span>
//                     <span className="text-slate-400">📍{geoRefs} 📷{fotos}</span>
//                   </div>
//                 </div>
//                 <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
//                   <div className="h-1.5 rounded-full transition-all duration-500 bg-emerald-500"
//                     style={{ width: `${totalItems ? (conEvidencia / totalItems) * 100 : 0}%` }} />
//                 </div>
//                 <div className="flex flex-wrap gap-1.5">
//                   {checklist.map((item, idx) => {
//                     const tiene = item.evidence.some(e => e.observation || e.geoRef || e.photo);
//                     return (
//                       <button key={item.id} type="button" onClick={() => setPreguntaActual(idx)}
//                         title={item.pregunta}
//                         className={`w-7 h-7 rounded-full text-[10px] font-bold transition-all border-2 ${
//                           idx === preguntaActual ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
//                         } ${tiene ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
//                         {item.id}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>

//               {/* Tarjeta ítem */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
//                 <span className="inline-block text-[10px] uppercase font-black text-slate-400 tracking-widest bg-slate-100 px-3 py-1 rounded-full mb-3">
//                   {itemActual.seccion}
//                 </span>
//                 <h2 className="text-base font-bold text-slate-800 mb-4 leading-snug">
//                   <span className="text-slate-300 mr-2 font-mono">#{itemActual.id}</span>
//                   {itemActual.pregunta}
//                 </h2>

//                 <div className="border-t border-slate-100 pt-4">
//                   <div className="flex justify-between items-center mb-3">
//                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidencias / Incidencias</h3>
//                     <button onClick={() => addEvidence(itemActual.id)}
//                       className="flex items-center gap-1 text-xs font-bold text-emerald-600 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
//                       <FaPlus size={9} /> Añadir evidencia
//                     </button>
//                   </div>

//                   <div className="space-y-3">
//                     {itemActual.evidence.map(ev => {
//                       const isCapturing  = capturandoGps?.itemId === itemActual.id && capturandoGps?.entryId === ev.id;
//                       const fotoKey      = `${itemActual.id}-${ev.id}`;
//                       const isProcessing = procesandoFotos.has(fotoKey);

//                       return (
//                         <div key={ev.id} className="group relative">
//                           {itemActual.evidence.length > 1 && (
//                             <button onClick={() => removeEvidence(itemActual.id, ev.id)}
//                               className="absolute -right-1 top-3 z-10 w-7 h-7 rounded-full bg-red-500 text-white shadow
//                                          flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
//                               <FaTrash size={10} />
//                             </button>
//                           )}
//                           <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
//                             <div className="grid md:grid-cols-2 gap-3">

//                               {/* Observación + GeoRef */}
//                               <div className="space-y-2">
//                                 <input type="text" placeholder="Observación..."
//                                   value={ev.observation}
//                                   onChange={e => updateObservation(itemActual.id, ev.id, e.target.value)}
//                                   className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />

//                                 {ev.geoRef ? (
//                                   <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between">
//                                     <div className="text-[11px] font-mono text-emerald-700">
//                                       <span className="font-bold">X:</span> {ev.geoRef.lat}<br/>
//                                       <span className="font-bold">Y:</span> {ev.geoRef.lon}
//                                       <span className="ml-2 text-emerald-400">±{ev.geoRef.precision}</span>
//                                     </div>
//                                     <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                       className="text-emerald-400 hover:text-emerald-600 ml-2" title="Recapturar">
//                                       <FaUndo size={10} />
//                                     </button>
//                                   </div>
//                                 ) : isCapturing ? (
//                                   <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-emerald-800 py-2.5 px-3 flex items-center gap-2.5">
//                                     <style>{`
//                                       @keyframes gs{0%{transform:translateY(-100%)}100%{transform:translateY(250%)}}
//                                       @keyframes gr{from{transform:rotate(0)}to{transform:rotate(360deg)}}
//                                       @keyframes gp{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:0;transform:scale(1.8)}}
//                                     `}</style>
//                                     <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
//                                       <div className="w-full h-6 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-500/40 border-b border-emerald-400/50"
//                                         style={{ animation: 'gs 1.3s linear infinite' }} />
//                                     </div>
//                                     <div className="relative w-6 h-6 flex-shrink-0 flex items-center justify-center">
//                                       <div className="absolute inset-0 rounded-full border border-emerald-500/40" style={{ animation: 'gp 1.8s ease-in-out infinite' }} />
//                                       <div className="absolute inset-0.5 rounded-full border-2 border-transparent border-t-emerald-400" style={{ animation: 'gr 0.75s linear infinite' }} />
//                                       <FaCrosshairs className="text-emerald-300 relative z-10 text-[9px]" />
//                                     </div>
//                                     <span className="text-emerald-300 text-[11px] font-bold animate-pulse relative z-10">Triangulando GPS...</span>
//                                     <div className="ml-auto flex items-end gap-[2px] h-4 relative z-10 flex-shrink-0">
//                                       {[0.4, 0.65, 1].map((d, i) => (
//                                         <div key={i} className="w-1 bg-emerald-400 rounded-sm"
//                                           style={{ height: `${40 + i * 25}%`, animation: `gp ${0.8 + i * 0.15}s ease-in-out infinite`, animationDelay: `${d * 0.3}s` }} />
//                                       ))}
//                                     </div>
//                                   </div>
//                                 ) : (
//                                   <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                     className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
//                                     <FaCrosshairs size={10} /> Capturar ubicación exacta
//                                   </button>
//                                 )}
//                               </div>

//                               {/* ── Foto ────────────────────────────────────
//                                   FIX iOS/Safari/Android:
//                                   • SIN onClick que limpie el value — eso
//                                     impedía abrir cámara en iOS Safari.
//                                   • El reset se hace en onChange DESPUÉS de
//                                     capturar la referencia al File.
//                                   • Se pasa File (no el evento) a handlePhotoUpload.
//                                   • isProcessing muestra spinner inmediato.
//                               ──────────────────────────────────────────── */}
//                               <div className="flex flex-col gap-2">
//                                 {isProcessing ? (
//                                   <div className="aspect-video bg-slate-100 rounded-xl flex flex-col items-center justify-center gap-2 border border-slate-200">
//                                     <FaSpinner className="text-emerald-500 animate-spin" size={22} />
//                                     <span className="text-[11px] font-bold text-slate-400">Procesando foto...</span>
//                                   </div>
//                                 ) : ev.photo ? (
//                                   <div className="relative aspect-video bg-white rounded-xl overflow-hidden border border-slate-200">
//                                     <img src={ev.photo} className="w-full h-full object-cover" alt="evidencia" />
//                                     <button
//                                       type="button"
//                                       onClick={() =>
//                                         setChecklist(prev =>
//                                           prev.map(item =>
//                                             item.id === itemActual.id
//                                               ? { ...item, evidence: item.evidence.map(e => e.id === ev.id ? { ...e, photo: null } : e) }
//                                               : item
//                                           )
//                                         )
//                                       }
//                                       className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">
//                                       <FaTrash size={9} />
//                                     </button>
//                                   </div>
//                                 ) : (
//                                   <div className="grid grid-cols-2 gap-2">

//                                     {/* CÁMARA */}
//                                     <label className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors select-none">
//                                       <FaCamera className="text-blue-400" size={16} />
//                                       <span className="text-[10px] font-bold text-blue-500">CÁMARA</span>
//                                       <input
//                                         type="file"
//                                         accept="image/*"
//                                         capture="environment"
//                                         className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
//                                         onChange={e => {
//                                           const file = e.target.files?.[0];
//                                           e.target.value = ''; // reset AQUÍ, no en onClick
//                                           if (file) handlePhotoUpload(file, itemActual.id, ev.id);
//                                         }}
//                                       />
//                                     </label>

//                                     {/* GALERÍA */}
//                                     <label className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors select-none">
//                                       <svg className="text-slate-400" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
//                                         <rect x="3" y="3" width="18" height="18" rx="2" />
//                                         <circle cx="8.5" cy="8.5" r="1.5" />
//                                         <path d="M21 15l-5-5L5 21" />
//                                       </svg>
//                                       <span className="text-[10px] font-bold text-slate-400">GALERÍA</span>
//                                       <input
//                                         type="file"
//                                         accept="image/*"
//                                         className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
//                                         onChange={e => {
//                                           const file = e.target.files?.[0];
//                                           e.target.value = ''; // reset AQUÍ, no en onClick
//                                           if (file) handlePhotoUpload(file, itemActual.id, ev.id);
//                                         }}
//                                       />
//                                     </label>

//                                   </div>
//                                 )}
//                               </div>
//                             </div>
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 </div>

//                 {/* Navegación */}
//                 <div className="flex justify-between mt-5">
//                   <button onClick={() => setPreguntaActual(p => Math.max(0, p - 1))}
//                     disabled={preguntaActual === 0}
//                     className="px-5 py-2 font-bold text-slate-400 hover:text-slate-600 disabled:opacity-30 text-sm transition-colors">
//                     ← Anterior
//                   </button>
//                   <button onClick={() => setPreguntaActual(p => Math.min(checklist.length - 1, p + 1))}
//                     disabled={preguntaActual === checklist.length - 1}
//                     className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-30">
//                     Siguiente →
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {/* ── PANEL LATERAL ─────────────────────────────── */}
//             <div className="space-y-3">
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
//                 <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
//                   <FaMapMarkedAlt className="text-orange-500" size={13} />
//                   <h3 className="font-bold text-slate-600 text-xs uppercase tracking-wide">Geo-referencias</h3>
//                   {geoRefs > 0 && (
//                     <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{geoRefs}</span>
//                   )}
//                 </div>
//                 <div ref={mapRef} className="h-48">
//                   <LeafletMap gps={gpsVista} reportes={[]} georefPins={georefPins} />
//                 </div>
//                 {geoRefs === 0 && (
//                   <p className="text-[11px] text-slate-400 text-center py-2 border-t border-slate-50">
//                     Las geo-refs aparecerán aquí
//                   </p>
//                 )}
//               </div>

//               <button onClick={procesarFormularioActual}
//                 className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm">
//                 <FaFilePdf /> Guardar y añadir a cola PDF
//               </button>
//               <button onClick={() => { if (window.confirm('¿Reiniciar formulario?')) limpiarFormulario(); }}
//                 className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors text-sm">
//                 <FaUndo size={12} /> Reiniciar
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default FormularioUnificado;















// 'use client';

// import { usePDFQueue } from '@/app/context/pdf-queue-context';
// import { mostrarOpcionesPostGuardado } from '@/app/lib/generarPDFCombinado';
// import React, { useState, useRef, useEffect, useCallback } from 'react';
// import {
//   FaCrosshairs, FaCamera, FaMapMarkedAlt,
//   FaFilePdf, FaTrash, FaUndo, FaPlus,
// } from 'react-icons/fa';
// import jsPDF from 'jspdf';
// import 'leaflet/dist/leaflet.css';
// import dynamic from 'next/dynamic';
// import autoTable from 'jspdf-autotable';
// import { crearReporte, actualizarReporte } from '@/app/lib/actions';

// const LeafletMap = dynamic(
//   () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
//   { ssr: false }
// );

// // ═══════════════════════════════════════════════════════════
// //  INTERFACES
// // ═══════════════════════════════════════════════════════════
// interface FormularioProps {
//   reportesIniciales?: any[];
//   reporteParaEditar?: any;
// }
// interface GpsCoords { lat: string | null; lon: string | null; precision: string; }
// interface GeoRef   { lat: string; lon: string; precision: string; timestamp: string; }
// interface EvidenceEntry { id: number; observation: string; geoRef: GeoRef | null; photo: string | null; }
// interface ChecklistItem {
//   id: number; seccion: string; pregunta: string; respuesta: string;
//   evidence: EvidenceEntry[];
//   // compat BD
//   observacion: string; geoRef?: GeoRef | null;
// }
// interface FormData {
//   sector: string; Tramo: string; accesoPublico: string;
//   tipoMantenimiento: string; categoria: string; subTipo: string;
// }
// interface Seccion { titulo: string; items: string[]; }

// // ═══════════════════════════════════════════════════════════
// //  CATÁLOGO UNIFICADO
// //  Estructura: CATALOGO[categoria][subTipo] = Seccion[]
// // ═══════════════════════════════════════════════════════════
// const CATALOGO: Record<string, Record<string, Seccion[]>> = {

//   // ── 1. ALUMBRADO PÚBLICO ─────────────────────────────────
//   'ALUMBRADO PÚBLICO': {
//     'Alumbrado Público Solar': [{
//       titulo: 'ALUMBRADO PÚBLICO SOLAR',
//       items: [
//         'OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?',
//         'LA FOTOCELDA ¿CUMPLE CON SU FUNCIÓN?',
//         'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'INTEGRIDAD DE LUMINARIA',
//         'ESTADO DE POSTE METÁLICO/CONCRETO',
//         'ESTADO DE BASE DE CONCRETO',
//       ],
//     }],
//     'Alumbrado Público Eléctrico': [{
//       titulo: 'ALUMBRADO PÚBLICO ELÉCTRICO',
//       items: [
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//         'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS',
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'EL BRAZO ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'INTEGRIDAD DE LUMINARIA',
//         'ESTADO DE POSTE METÁLICO/CONCRETO',
//         'ESTADO DE BASE DE CONCRETO',
//       ],
//     }],
//     'Luminaria Tipo Cerillo': [{
//       titulo: 'LUMINARIA TIPO CERILLO',
//       items: [
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'ESTADO DE BASE DE CONCRETO',
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//       ],
//     }],
//     'Luminaria Tipo Europea': [{
//       titulo: 'LUMINARIA TIPO EUROPEA',
//       items: [
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'ESTADO DE BASE DE CONCRETO',
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//         'ESTADO DEL ELEMENTO PORTADOR DE LA LUMINARIA (POSTE PIRAMIDAL PREFABRICADO)',
//       ],
//     }],
//     'Otros': [{
//       titulo: 'OTROS – DESCRIPCIÓN LIBRE',
//       items: [
//         'DESCRIPCIÓN DE LA INCIDENCIA',
//       ],
//     }],
//   },

//   // ── 2. ÁREAS VERDES ──────────────────────────────────────
//   'AREAS VERDES': {
//     '1. Poda': [{
//       titulo: '1. PODA',
//       items: [
//         '1.1 DESHIERBE – EN CAMELLÓN EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
//         '1.1 DESHIERBE – EN JARDINERA EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
//         '1.2 CAJETE – EN CAMELLÓN',
//         '1.3 CAJILLO – EN CAMELLONES CON UN ANCHO DE 10 CM Y PROFUNDIDAD DE 12 CM',
//         '1.4 DESORILLE DE ARRIATES/JARDINERA: SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
//         '1.4 DESORILLE DE CAMELLÓN ANCHO 15 CM ± 2 CM; SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
//         '1.5 PODA DE PASTO CON MAQUINARIA A UNA ALTURA PROMEDIO DE 2.5 A 5 CM',
//         '1.6 PODA DE SETOS CUANDO LA GEOMETRÍA DEL ARBUSTO YA NO ES UNIFORME (ARBUSTOS Y PLANTAS DE ORNATO) UTILIZANDO HERRAMIENTA MANUAL Y MECÁNICA',
//         '1.7 PODA DE ÁRBOLES DE 2 A 5 M DE FRONDOSIDAD Y DE 2.00 A 6.00 M DE ALTURA',
//         '1.7 PODA DE ÁRBOLES DE 5.01 M. A 10 DE FRONDOSIDAD Y DE 6.01 A 12.00 M DE ALTURA',
//         '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
//         '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
//         '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
//         '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
//       ],
//     }],
//     '2. Tala': [{
//       titulo: '2. TALA DE ÁRBOLES O PALMERAS',
//       items: [
//         'TALA, TROZA, CARGA Y RETIRO DE ÁRBOLES POR MEDIOS MANUALES BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) HASTA 5.00 M DE ALTURA',
//         'TALA, TROZA, CARGA Y RETIRO DE PALMERAS BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) DE 5.01 A 12.00 M',
//       ],
//     }],
//     '4. Escombro': [{
//       titulo: '4. ESCOMBRO',
//       items: [
//         'ÁREA LIBRE DE CONTAMINACIÓN (TIERRA/CASCAJO, LODOS, EXCRETAS, HIDROCARBUROS, ESCOMBROS)',
//       ],
//     }],
//     '5. Limpieza': [{
//       titulo: '5. LIMPIEZA ÁREAS VERDES',
//       items: [
//         'JARDINERAS/ARRIATES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
//         'CAMELLONES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
//       ],
//     }],
//     '6. Red de riego': [{
//       titulo: '6. RED DE RIEGO',
//       items: [
//         'RED DE RIEGO TAPADA, FUERA DE DIRECCIÓN O CON FUGAS',
//       ],
//     }],
//     '7. Retiro de tocones': [{
//       titulo: '7. RETIRO DE TOCONES',
//       items: [
//         'CORTE A 15 CM DEBAJO DEL NIVEL EXISTENTE DE TOCON. DE HASTA 50 CM DE DIAMETRO',
//       ],
//     }],
//     '8. Fumigación': [{
//       titulo: '8. FUMIGACIÓN',
//       items: [
//         'ESPECIE PRESENTA PLAGA',
//         'ESPECIE PRESENTA HONGO O PUDRICIÓN',
//       ],
//     }],
//     '9. Arriate sin pasto': [{
//       titulo: '9. ARRIATE SIN PASTO (SOLO TIERRA)',
//       items: [
//         'ARRIATE PRESENTA MALEZA O VEGETACIÓN NO DESEADA',
//         'ARRIATE PRESENTA EROSIÓN O SOCAVACIÓN EN LA TIERRA',
//         'ARRIATE REQUIERE NIVELACIÓN O REINTEGRACIÓN DE TIERRA',
//         'TIERRA LIBRE DE RESIDUOS SÓLIDOS (BASURA, ESCOMBRO, PLÁSTICOS)',
//         'ARRIATE SIN ACUMULACIÓN DE AGUA O ENCHARCAMIENTO',
//         'BORDES/GUARNICIONES DEL ARRIATE EN BUEN ESTADO (SIN INVASIÓN A BANQUETA)',
//       ],
//     }],
//   },

//   // ── 3. LIMPIEZA URBANA ────────────────────────────────────
//   'LIMPIEZA URBANA': {
//     'Limpieza General': [{
//       titulo: '1. LIMPIEZA GENERAL',
//       items: [
//         '1.1 BARRIDO',
//         '1.2 LAVADO DE PISO',
//         '1.4 LAVADO DE MUROS',
//       ],
//     }],
//     'Residuos y Contenedores': [{
//       titulo: 'RESIDUOS Y CONTENEDORES',
//       items: [
//         'ÁREA GENERAL LIMPIA DE BASURA VISIBLE A LO LARGO DEL TRAMO',
//         'BANQUETAS BARRIDAS Y LIBRES DE RESIDUOS SÓLIDOS',
//         'CUNETAS LIMPIAS Y SIN OBSTRUCCIONES POR RESIDUOS',
//         'ACUMULACIÓN DE BASURA EN PUNTOS CRÍTICOS (ESQUINAS, ACCESOS, MUROS)',
//         'PLAYA LIMPIA DE RESIDUOS ORGÁNICOS E INORGÁNICOS (SI APLICA)',
//         'ACCESOS A PLAYA O ZONA PÚBLICA LIBRES DE BASURA',
//         'BOTES DE BASURA VACÍOS (NO REBASADOS)',
//         'BOTES Y CONTENEDORES LIMPIOS POR DENTRO Y POR FUERA',
//         'ÁREA ALREDEDOR DEL BOTE (1 METRO) LIBRE DE RESIDUOS',
//         'LIXIVIADOS O DERRAMES ALREDEDOR DE BOTES O CONTENEDORES',
//         'RESIDUOS DISPERSOS DESPUÉS DE LA RECOLECCIÓN',
//         'PODA EN GRAL CADA 6 MESES',
//       ],
//     }],
//     'Canal Pluvial': [{
//       titulo: 'CANAL PLUVIAL',
//       items: [
//         '¿EL CANAL PLUVIAL PRESENTA OBSTRUCCIONES (BASURA, SEDIMENTOS, VEGETACIÓN, LODO, ETC.)?',
//         '¿EL CANAL PLUVIAL PRESENTA DAÑOS ESTRUCTURALES (FISURAS, DESPRENDIMIENTOS, DEFORMACIONES, SOCAVACIONES)?',
//         '¿EL AGUA PUEDE FLUIR LIBREMENTE A TRAVÉS DEL CANAL PLUVIAL?',
//         '¿LOS ACCESOS AL CANAL (TAPAS, REJILLAS, REGISTROS) ESTÁN EN BUEN ESTADO?',
//         '¿EL CANAL PLUVIAL SE ENCUENTRA EN BUENAS CONDICIONES (SIN OBSTRUCCIONES, SIN DAÑO ESTRUCTURAL Y CON FLUJO LIBRE)?',
//         'INDIQUE EL ESTADO ACTUAL DE LA REJILLA PLUVIAL (PUEDE SELECCIONAR MÁS DE UNA OPCIÓN)',
//       ],
//     }],
//   },

//   // ── 4. MOBILIARIO URBANO ──────────────────────────────────
//   'MOBILIARIO URBANO': {
//     '1. Bacheo': [{
//       titulo: '1. BACHEO',
//       items: ['1.1 M2 DAÑADOS'],
//     }],
//     '2. Parabuses': [{
//       titulo: '2. PARABUSES',
//       items: [
//         '2.1 BANDALIZADOS',
//         '2.2 GOLPEADOS',
//         '2.3 OTRO DAÑO',
//       ],
//     }],
//     '3. Tapas de registros': [{
//       titulo: '3. TAPAS DE REGISTROS DE CONCRETO',
//       items: [
//         '3.1 ROTA',
//         '3.2 FALTANTE',
//         '3.3 OTRO DAÑO',
//         '3.4 DE CFE O TELECOMUNICACIONES (IDENTIFICAR PARA REPORTAR)',
//       ],
//     }],
//     '4. Barandales': [{
//       titulo: '4. BARANDALES',
//       items: [
//         '4.1 ACERO INOXIDABLE – TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESALINEADO O DETALLES EN EL ANCLAJE',
//         '4.2 METÁLICO – TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESALINEADO O DETALLES EN EL ANCLAJE',
//       ],
//     }],
//     '5. Señaleticas': [{
//       titulo: '5. SEÑALETICAS',
//       items: [
//         '5.1 TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESPLOME O DETALLES EN EL ANCLAJE',
//       ],
//     }],
//     '6. Balizamiento': [{
//       titulo: '6. BALIZAMIENTO',
//       items: ['6.1 M2 O ML CON BALIZAMIENTO FALTANTE – IDENTIFICAR ELEMENTO'],
//     }],
//     '7. Murales': [{
//       titulo: '7. MURALES',
//       items: ['7.1 DESCRIBIR DETALLES ENCONTRADOS'],
//     }],
//     '8. Bolardos': [{
//       titulo: '8. BOLARDOS',
//       items: ['8.1 BOLARDOS DAÑADOS – IDENTIFICAR EL TIPO DE DAÑO'],
//     }],
//     '9. Figuras lúdicas': [{
//       titulo: '9. FIGURAS LÚDICAS',
//       items: ['9.1 FIGURAS LÚDICAS – IDENTIFICAR EL TIPO DE DAÑO'],
//     }],
//     '10. Postes semáforos': [{
//       titulo: '10. POSTES SEMÁFOROS',
//       items: ['10.1 POSTES – IDENTIFICAR EL TIPO DE DAÑO'],
//     }],
//     // ── FIX: Títulos corregidos (antes: '10. guarnicion') ──
//     '11. Guarnicion': [{
//       titulo: '11. GUARNICION',
//       items: ['Guarnicion dañada'],
//     }],
//     '12. Banqueta': [{
//       titulo: '12. BANQUETA',
//       items: ['Banqueta dañada'],
//     }],
//     '13. Rampa': [{
//       titulo: '13. Rampa',
//       items: [
//         '1. RAMPA ROTA',
//         '2. RAMPA NO CUMPLE PENDIENTE',
//       ],
//     }],
//   },
// };

// // ── Color por categoría ────────────────────────────────────
// const CATEGORIA_COLOR: Record<string, { header: string; tab: string; badge: string }> = {
//   'ALUMBRADO PÚBLICO':  { header: 'from-yellow-600 to-yellow-700',   tab: 'bg-yellow-50  text-yellow-800',  badge: 'bg-yellow-100  text-yellow-700'  },
//   'AREAS VERDES':       { header: 'from-emerald-600 to-emerald-700', tab: 'bg-emerald-50 text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
//   'BARRIDO VIALIDADES': { header: 'from-blue-600 to-blue-700',       tab: 'bg-blue-50    text-blue-800',    badge: 'bg-blue-100    text-blue-700'    },
//   'LIMPIEZA URBANA':    { header: 'from-orange-600 to-orange-700',   tab: 'bg-orange-50  text-orange-800',  badge: 'bg-orange-100  text-orange-700'  },
//   'MOBILIARIO URBANO':  { header: 'from-purple-600 to-purple-700',   tab: 'bg-purple-50  text-purple-800',  badge: 'bg-purple-100  text-purple-700'  },
// };

// const TRAMOS_POR_SECTOR: Record<string, string[]> = {
//   'Barra de Coyuca':      ['Sendero-Seguro-Barra Coyuca'],
//   'Pie de la Cuesta':     ['Sendero-seguro-Pie de la cuesta'],
//   'Barrios Historicos':   ['Caleta-caletilla', 'Sendero-Costera-antigua', 'Corredor Zocalo-quebrada', 'Corredor zocalo-fuerte'],
//   'Acapulco Tradicional': ['Sendero-Tadeo-arredondo', 'Sendero-cinerio-hornitos', 'Michoacan', 'Av. Universidad', 'Dr. Ignacio chavez'],
//   'Acapulco Dorado':      ['Costa azul'],
//   'Las Brisas':           [''],
//   'Puerto Márquez':       ['Sendero-Puerto-Marquez'],
//   'Acapulco Diamante':    ['Av. Costera Palmas'],
//   'Otro':                 [''],
// };

// // ── Helpers ────────────────────────────────────────────────
// const emptyEntry = (): EvidenceEntry => ({ id: Date.now(), observation: '', geoRef: null, photo: null });

// const buildChecklist = (categoria: string, subTipo: string): ChecklistItem[] => {
//   const secciones = CATALOGO[categoria]?.[subTipo] ?? [];
//   let counter = 1;
//   return secciones.flatMap(sec =>
//     sec.items.map(pregunta => ({
//       id: counter++,
//       seccion: sec.titulo,
//       pregunta,
//       respuesta: '',
//       observacion: '',
//       geoRef: null,
//       evidence: [emptyEntry()],
//     }))
//   );
// };

// const CATEGORIAS = Object.keys(CATALOGO);

// // ═══════════════════════════════════════════════════════════
// //  COMPONENTE PRINCIPAL
// // ═══════════════════════════════════════════════════════════
// const FormularioUnificado: React.FC<FormularioProps> = ({ reporteParaEditar }) => {
//   const { addToQueue } = usePDFQueue();
//   const mapRef        = useRef<HTMLDivElement>(null);
//   const geoRefWatchId = useRef<number | null>(null);

//   const [currentTime,         setCurrentTime]         = useState('');
//   const [preguntaActual,      setPreguntaActual]       = useState(0);
//   const [sectorPersonalizado, setSectorPersonalizado]  = useState('');
//   const [tramoPersonalizado,  setTramoPersonalizado]   = useState('');
//   const [capturandoGps, setCapturandoGps] = useState<{ itemId: number; entryId: number } | null>(null);

//   const [gps, setGps] = useState<GpsCoords>({
//     lat: reporteParaEditar?.latitud ? String(reporteParaEditar.latitud) : null,
//     lon: reporteParaEditar?.longitud ? String(reporteParaEditar.longitud) : null,
//     precision: '--',
//   });

//   const catInicial     = reporteParaEditar?.categoria ?? 'ALUMBRADO PÚBLICO';
//   const subtiposInic   = Object.keys(CATALOGO[catInicial] ?? {});
//   const subTipoInicial = reporteParaEditar?.subTipo ?? subtiposInic[0] ?? '';

//   const [formData, setFormData] = useState<FormData>({
//     sector:            reporteParaEditar?.sector            ?? '',
//     Tramo:             reporteParaEditar?.tramo             ?? '',
//     accesoPublico:     reporteParaEditar?.acceso_publico    ?? '',
//     tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
//     categoria:         catInicial,
//     subTipo:           subTipoInicial,
//   });

//   const [checklist, setChecklist] = useState<ChecklistItem[]>(
//     buildChecklist(catInicial, subTipoInicial)
//   );

//   // ── Geo-pins para el mapa ──────────────────────────────
//   const georefPins = React.useMemo(() =>
//     checklist.flatMap(item =>
//       item.evidence.filter(ev => ev.geoRef).map((ev, ei) => ({
//         lat: ev.geoRef!.lat, lon: ev.geoRef!.lon,
//         label: item.evidence.length > 1 ? `${item.id}.${ei + 1}` : String(item.id),
//         pregunta: item.pregunta, observation: ev.observation, cumple: item.respuesta,
//       }))
//     )
//   , [checklist]);

//   const gpsVista: GpsCoords = React.useMemo(() =>
//     georefPins.length > 0
//       ? { lat: georefPins[georefPins.length - 1].lat, lon: georefPins[georefPins.length - 1].lon, precision: '--' }
//       : { lat: null, lon: null, precision: '--' }
//   , [georefPins]);

//   // ── Efectos ────────────────────────────────────────────
//   useEffect(() => {
//     const tick = () => setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
//     tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
//   }, []);

//   useEffect(() => {
//     import('leaflet').then(L => {
//       delete (L.Icon.Default.prototype as any)._getIconUrl;
//       L.Icon.Default.mergeOptions({
//         iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//         iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//         shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
//       });
//     });
//   }, []);

//   useEffect(() => {
//     return () => {
//       if (geoRefWatchId.current !== null) navigator.geolocation.clearWatch(geoRefWatchId.current);
//     };
//   }, []);

//   // ── Cargar datos para edición ──────────────────────────
//   useEffect(() => {
//     if (reporteParaEditar) {
//       setFormData({
//         sector:            reporteParaEditar.sector            || '',
//         Tramo:             reporteParaEditar.tramo             || '',
//         accesoPublico:     reporteParaEditar.acceso_publico    || '',
//         tipoMantenimiento: reporteParaEditar.tipo_mantenimiento || '',
//         categoria:         reporteParaEditar.categoria         || 'ALUMBRADO PÚBLICO',
//         subTipo:           reporteParaEditar.sub_tipo          || '',
//       });
//       if (reporteParaEditar.checklist) {
//         setChecklist(reporteParaEditar.checklist);
//       }
//       if (reporteParaEditar.latitud && reporteParaEditar.longitud) {
//         setGps({
//           lat:       String(reporteParaEditar.latitud),
//           lon:       String(reporteParaEditar.longitud),
//           precision: 'Recuperado de BD',
//         });
//       }
//     }
//   }, [reporteParaEditar]);

//   // ── Cambio de categoría ────────────────────────────────
//   const handleCategoriaChange = useCallback((nuevaCat: string) => {
//     const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
//     if (hayEvidencias && !window.confirm('Cambiar categoría borrará las evidencias actuales. ¿Continuar?')) return;
//     const subtipo = Object.keys(CATALOGO[nuevaCat] ?? {})[0] ?? '';
//     setFormData(prev => ({ ...prev, categoria: nuevaCat, subTipo: subtipo }));
//     setChecklist(buildChecklist(nuevaCat, subtipo));
//     setPreguntaActual(0);
//   }, [checklist]);

//   // ── Cambio de sub-tipo ─────────────────────────────────
//   const handleSubTipoChange = useCallback((nuevoSub: string) => {
//     const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
//     if (hayEvidencias && !window.confirm('Cambiar el tipo borrará las evidencias actuales. ¿Continuar?')) return;
//     setFormData(prev => ({ ...prev, subTipo: nuevoSub }));
//     setChecklist(buildChecklist(formData.categoria, nuevoSub));
//     setPreguntaActual(0);
//   }, [checklist, formData.categoria]);

//   // ── GPS por evidencia ──────────────────────────────────
//   const capturarGeoRef = useCallback((itemId: number, entryId: number) => {
//     if (!navigator.geolocation) {
//       alert('Tu dispositivo no soporta GPS. Activa la ubicación e inténtalo de nuevo.');
//       return;
//     }
//     if (geoRefWatchId.current !== null) {
//       navigator.geolocation.clearWatch(geoRefWatchId.current);
//       geoRefWatchId.current = null;
//     }
//     setCapturandoGps({ itemId, entryId });

//     const timeoutId = setTimeout(() => {
//       if (geoRefWatchId.current !== null) {
//         navigator.geolocation.clearWatch(geoRefWatchId.current);
//         geoRefWatchId.current = null;
//       }
//       setCapturandoGps(null);
//       alert(
//         'No se pudo obtener la ubicación en 30 segundos.\n\n' +
//         'Verifica que:\n' +
//         '• El GPS del teléfono esté activado\n' +
//         '• La app tenga permiso de ubicación\n' +
//         '• Estés al aire libre o con señal\n\n' +
//         'Puedes intentarlo de nuevo.'
//       );
//     }, 30_000);

//     geoRefWatchId.current = navigator.geolocation.watchPosition(
//       ({ coords: { latitude, longitude, accuracy } }) => {
//         clearTimeout(timeoutId);
//         const timestamp = new Date().toLocaleTimeString('es-MX', {
//           hour: '2-digit', minute: '2-digit', second: '2-digit',
//         });
//         setChecklist(prev =>
//           prev.map(item =>
//             item.id === itemId
//               ? {
//                   ...item,
//                   evidence: item.evidence.map(ev =>
//                     ev.id === entryId
//                       ? {
//                           ...ev,
//                           geoRef: {
//                             lat:       latitude.toFixed(6),
//                             lon:       longitude.toFixed(6),
//                             precision: `${accuracy.toFixed(1)}m`,
//                             timestamp,
//                           },
//                         }
//                       : ev
//                   ),
//                 }
//               : item
//           )
//         );
//         if (geoRefWatchId.current !== null) {
//           navigator.geolocation.clearWatch(geoRefWatchId.current);
//           geoRefWatchId.current = null;
//         }
//         setCapturandoGps(null);
//       },
//       (error) => {
//         clearTimeout(timeoutId);
//         if (geoRefWatchId.current !== null) {
//           navigator.geolocation.clearWatch(geoRefWatchId.current);
//           geoRefWatchId.current = null;
//         }
//         setCapturandoGps(null);
//         const mensajes: Record<number, string> = {
//           1: 'Permiso de ubicación denegado. Ve a Ajustes > Permisos y activa la ubicación para esta app.',
//           2: 'No se pudo determinar la ubicación. Asegúrate de estar al aire libre.',
//           3: 'Tiempo de espera agotado. Intenta de nuevo en un lugar con mejor señal.',
//         };
//         alert(mensajes[error.code] ?? `Error de GPS (código ${error.code}). Intenta de nuevo.`);
//       },
//       { enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 }
//     );
//   }, []);

//   // ── Evidencia helpers ──────────────────────────────────
//   const addEvidence = useCallback((itemId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: [...item.evidence, emptyEntry()] } : item
//     ));
//   }, []);

//   const removeEvidence = useCallback((itemId: number, entryId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.filter(e => e.id !== entryId) } : item
//     ));
//   }, []);

//   const updateObservation = useCallback((itemId: number, entryId: number, val: string) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId
//         ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, observation: val } : e) }
//         : item
//     ));
//   }, []);

//   const handlePhotoUpload = useCallback(
//     async (e: React.ChangeEvent<HTMLInputElement>, itemId: number, entryId: number) => {
//       const file = e.target.files?.[0];
//       if (!file) return;
//       if (!file.type.startsWith('image/')) {
//         alert('El archivo seleccionado no es una imagen válida.');
//         return;
//       }
//       const objectUrl = URL.createObjectURL(file);
//       try {
//         let exifRotation = 1;
//         try {
//           const buffer = await file.arrayBuffer();
//           const view   = new DataView(buffer);
//           if (view.getUint16(0) === 0xFFD8) {
//             let offset = 2;
//             while (offset < view.byteLength - 2) {
//               const marker = view.getUint16(offset);
//               offset += 2;
//               if (marker === 0xFFE1) {
//                 const exifLen  = view.getUint16(offset);
//                 const exifData = new DataView(buffer, offset + 2, exifLen - 2);
//                 const littleE  = exifData.getUint16(6) === 0x4949;
//                 const dirOffset = exifData.getUint32(10, littleE) + 6;
//                 const numEntries = exifData.getUint16(dirOffset, littleE);
//                 for (let i = 0; i < numEntries; i++) {
//                   const entryOffset = dirOffset + 2 + i * 12;
//                   if (exifData.getUint16(entryOffset, littleE) === 0x0112) {
//                     exifRotation = exifData.getUint16(entryOffset + 8, littleE);
//                     break;
//                   }
//                 }
//                 break;
//               }
//               if ((marker & 0xFF00) !== 0xFF00) break;
//               offset += view.getUint16(offset);
//             }
//           }
//         } catch { /* EXIF no disponible */ }

//         await new Promise<void>((resolve, reject) => {
//           const img = new Image();
//           img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('No se pudo cargar la imagen.')); };
//           img.onload = () => {
//             try {
//               const needsSwap = exifRotation >= 5 && exifRotation <= 8;
//               const maxDim    = 1200;
//               const srcW      = img.width;
//               const srcH      = img.height;
//               const longSide  = Math.max(srcW, srcH);
//               const scale     = longSide > maxDim ? maxDim / longSide : 1;
//               const dstW      = Math.round((needsSwap ? srcH : srcW) * scale);
//               const dstH      = Math.round((needsSwap ? srcW : srcH) * scale);
//               const canvas    = document.createElement('canvas');
//               canvas.width    = dstW;
//               canvas.height   = dstH;
//               const ctx = canvas.getContext('2d');
//               if (!ctx) { reject(new Error('No se pudo crear contexto de canvas.')); return; }
//               ctx.save();
//               ctx.translate(dstW / 2, dstH / 2);
//               switch (exifRotation) {
//                 case 2: ctx.scale(-1,  1);             break;
//                 case 3: ctx.rotate(Math.PI);           break;
//                 case 4: ctx.scale( 1, -1);             break;
//                 case 5: ctx.rotate(-Math.PI / 2); ctx.scale(-1, 1); break;
//                 case 6: ctx.rotate( Math.PI / 2);      break;
//                 case 7: ctx.rotate( Math.PI / 2); ctx.scale(-1, 1); break;
//                 case 8: ctx.rotate(-Math.PI / 2);      break;
//               }
//               ctx.drawImage(img, -srcW * scale / 2, -srcH * scale / 2, srcW * scale, srcH * scale);
//               ctx.restore();
//               const b64 = canvas.toDataURL('image/jpeg', 0.82);
//               setChecklist(prev =>
//                 prev.map(item =>
//                   item.id === itemId
//                     ? { ...item, evidence: item.evidence.map(ev => ev.id === entryId ? { ...ev, photo: b64 } : ev) }
//                     : item
//                 )
//               );
//               resolve();
//             } catch (drawErr) {
//               reject(drawErr);
//             } finally {
//               URL.revokeObjectURL(objectUrl);
//             }
//           };
//           img.src = objectUrl;
//         });
//       } catch (err) {
//         URL.revokeObjectURL(objectUrl);
//         console.error('[handlePhotoUpload]', err);
//         alert('No se pudo procesar la imagen. Intenta con otra foto.');
//       }
//     },
//     []
//   );

//   const limpiarFormulario = useCallback(() => {
//     setChecklist(buildChecklist(formData.categoria, formData.subTipo));
//     setPreguntaActual(0);
//   }, [formData.categoria, formData.subTipo]);

//   // ── Guardar en BD ──────────────────────────────────────
//   const guardarCuestionario = useCallback(async () => {
//     const sectorFinal = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramoFinal  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;
//     const fd = { ...formData, sector: sectorFinal, Tramo: tramoFinal };

//     // ── FIX: mapear checklist SIN fotos para el JSONB (evita payload gigante)
//     // Las fotos se guardan únicamente en la tabla `evidencias`
//     const checklistParaDB = checklist.map(item => ({
//       ...item,
//       observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//       geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//       // Mantener evidence completo (con foto) para que insertarEvidencias las guarde
//       evidence:    item.evidence,
//     }));

//     const lastGeoRef = checklist.flatMap(i => i.evidence).find(e => e.geoRef)?.geoRef;
//     const gpsDB: GpsCoords = lastGeoRef
//       ? { lat: lastGeoRef.lat, lon: lastGeoRef.lon, precision: lastGeoRef.precision }
//       : { lat: null, lon: null, precision: '--' };

//     if (reporteParaEditar?.id) {
//       await actualizarReporte(reporteParaEditar.id.toString(), fd, checklistParaDB as any, gpsDB, {});
//       alert('¡Reporte actualizado!');
//     } else {
//       await crearReporte(fd, checklistParaDB as any, gpsDB, {});
//       alert('¡Reporte guardado!');
//     }
//   }, [formData, sectorPersonalizado, tramoPersonalizado, checklist, reporteParaEditar]);

//   // ── Procesar y añadir a cola ───────────────────────────
//   const procesarFormularioActual = useCallback(async () => {
//     try {
//       await guardarCuestionario();
//       addToQueue({
//         categoria: formData.categoria,
//         formData:  { ...formData },
//         checklist: checklist.map(item => ({
//           ...item,
//           observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//           geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//         })) as any,
//         gps:          gpsVista,
//         fotos:        {},
//         mapImage:     null,
//         fechaCaptura: new Date(),
//       });
//       const opcion = await mostrarOpcionesPostGuardado();
//       if (opcion === 'otro_mismo' || opcion === 'generar_ahora') limpiarFormulario();
//     } catch (err) {
//       console.error(err);
//       alert('Error al procesar el formulario.');
//     }
//   }, [addToQueue, checklist, formData, gpsVista, guardarCuestionario, limpiarFormulario]);

//   // ── PDF local rápido ───────────────────────────────────
//   const generarPDFLocal = useCallback(async () => {
//     const doc   = new jsPDF('p', 'mm', 'a4');
//     const pageW = doc.internal.pageSize.getWidth();
//     const pageH = doc.internal.pageSize.getHeight();
//     const margin = 12;
//     const folio  = `REV-${formData.categoria.slice(0, 3).toUpperCase()}-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 900 + 100)}`;
//     const sector = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramo  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;

//     let y = 18;
//     doc.setFont('helvetica', 'bold').setFontSize(12);
//     doc.text(`REPORTE ${formData.categoria} – CIP ACAPULCO-COYUCA`, margin, y);
//     y += 4; doc.setLineWidth(0.5).line(margin, y, pageW - margin, y); y += 6;
//     doc.setFont('helvetica', 'normal').setFontSize(9);
//     doc.text(`Folio: ${folio}   Sector: ${sector}   Tramo: ${tramo}`, margin, y); y += 5;
//     doc.setFont('helvetica', 'bold').text(`Sub-tipo: ${formData.subTipo}   Mantenimiento: ${formData.tipoMantenimiento}`, margin, y);
//     doc.setFont('helvetica', 'normal'); y += 8;

//     const rows: any[] = [];
//     checklist.forEach(item => {
//       item.evidence.forEach((ev, ei) => {
//         rows.push([
//           ei === 0 ? String(item.id) : '',
//           ei === 0 ? item.pregunta   : `↳ Incidencia ${ei + 1}`,
//           ev.geoRef?.lat ?? '',
//           ev.geoRef?.lon ?? '',
//           ev.observation || '',
//           { content: '', photo: ev.photo },
//         ]);
//       });
//     });

//     let _localImgAlias = 0;
//     autoTable(doc, {
//       startY: y,
//       margin: { left: margin, right: margin },
//       head: [[
//         { content: 'No.',      styles: { halign: 'center' } },
//         { content: 'Concepto / Incidencia' },
//         { content: 'Lat',      styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Lon',      styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Observaciones' },
//         { content: 'Foto',     styles: { halign: 'center' } },
//       ]],
//       body: rows,
//       theme: 'grid',
//       styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle', overflow: 'linebreak', lineWidth: 0.2 },
//       headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
//       columnStyles: {
//         0: { cellWidth: 10, halign: 'center' },
//         1: { cellWidth: 62 },
//         2: { cellWidth: 22, halign: 'center', fontSize: 7 },
//         3: { cellWidth: 22, halign: 'center', fontSize: 7 },
//         4: { cellWidth: 42 },
//         5: { cellWidth: 28, halign: 'center' },
//       },
//       didDrawCell: (data: any) => {
//         if (data.section === 'body' && data.column.index === 5 && data.cell.raw?.photo) {
//           try {
//             const foto = data.cell.raw.photo as string;
//             if (typeof foto !== 'string' || !foto.startsWith('data:')) return;
//             const fmt  = foto.startsWith('data:image/png') ? 'PNG' : 'JPEG';
//             const p    = doc.getImageProperties(foto);
//             const maxW = 24;
//             const maxH = data.cell.height - 2;
//             const ratio = Math.min(maxW / p.width, maxH / p.height);
//             const dw   = p.width  * ratio;
//             const dh   = p.height * ratio;
//             doc.addImage(
//               foto, fmt,
//               data.cell.x + (maxW - dw) / 2 + 1,
//               data.cell.y + (data.cell.height - dh) / 2,
//               dw, dh,
//               `local_img_${_localImgAlias++}`,
//               'FAST'
//             );
//           } catch { /* imagen inválida */ }
//         }
//       },
//       rowPageBreak: 'avoid',
//     });

//     for (let i = 1; i <= doc.getNumberOfPages(); i++) {
//       doc.setPage(i); doc.saveGraphicsState();
//       doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
//       doc.addImage('/logo_fonatur.png', 'PNG', (pageW - 130) / 2, (pageH - 38) / 2, 130, 38);
//       doc.restoreGraphicsState();
//     }
//     doc.save(`${folio}.pdf`);
//   }, [checklist, formData, sectorPersonalizado, tramoPersonalizado]);

//   // ═══════════════════════════════════════════════════════
//   //  RENDER
//   // ═══════════════════════════════════════════════════════
//   const itemActual    = checklist[preguntaActual];
//   const subtipos      = Object.keys(CATALOGO[formData.categoria] ?? {});
//   const tieneSubtipos = subtipos.length > 1;

//   const totalItems   = checklist.length;
//   const geoRefs      = checklist.flatMap(i => i.evidence).filter(e => e.geoRef).length;
//   const fotos        = checklist.flatMap(i => i.evidence).filter(e => e.photo).length;
//   const conEvidencia = checklist.filter(i => i.evidence.some(e => e.observation || e.geoRef || e.photo)).length;

//   return (
//     <div className="min-h-screen bg-[#eef2f6] font-sans text-gray-700">
//       <div className="max-w-5xl mx-auto">

//         {/* ── HEADER ───────────────────────────────────────── */}
//         <header className="bg-[#285C4D] text-white shadow-lg pt-6 px-6 flex flex-col">
//           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-5">
//             <div>
//               <h1 className="text-xl font-extrabold tracking-wide uppercase">
//                 Reporte de Mantenimiento — CIP Acapulco-Coyuca
//               </h1>
//               <p className="text-white/70 text-xs mt-0.5">Selecciona categoría y sub-tipo para cargar el cuestionario</p>
//             </div>
//             <div className="text-xs font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
//               {currentTime}
//             </div>
//           </div>
//           <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
//             {CATEGORIAS.map(cat => (
//               <button key={cat} onClick={() => handleCategoriaChange(cat)}
//                 className={`flex-shrink-0 px-3 py-2.5 rounded-t-xl font-bold text-[11px] transition-colors whitespace-nowrap ${
//                   formData.categoria === cat
//                     ? 'bg-[#eef2f6] text-gray-800'
//                     : 'bg-black/20 text-white/80 hover:bg-black/30'
//                 }`}>
//                 {cat}
//               </button>
//             ))}
//           </div>
//         </header>

//         {/* ── Sub-tipo tabs ─────────────────────────────────── */}
//         {tieneSubtipos && (
//           <div className="bg-white border-b border-gray-100 px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide shadow-sm">
//             {subtipos.map(sub => (
//               <button key={sub} onClick={() => handleSubTipoChange(sub)}
//                 className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
//                   formData.subTipo === sub
//                     ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
//                     : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
//                 }`}>
//                 {sub}
//               </button>
//             ))}
//           </div>
//         )}
//         {!tieneSubtipos && subtipos.length === 1 && (
//           <div className="px-6 py-2.5 border-b border-gray-100 bg-white shadow-sm">
//             <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-gray-800">
//               {formData.subTipo}
//             </span>
//           </div>
//         )}

//         <div className="p-4 sm:p-5 space-y-4">

//           {/* ── DATOS GENERALES ──────────────────────────────── */}
//           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
//             <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Sector</label>
//                 <select value={formData.sector}
//                   onChange={e => setFormData(prev => ({ ...prev, sector: e.target.value, Tramo: '' }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-[#e67e22] text-sm focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30">
//                   <option value="">Seleccionar</option>
//                   {Object.keys(TRAMOS_POR_SECTOR).map(s => <option key={s} value={s}>{s}</option>)}
//                 </select>
//                 {formData.sector === 'Otro' && (
//                   <input type="text" placeholder="Sector..." value={sectorPersonalizado}
//                     onChange={e => setSectorPersonalizado(e.target.value)}
//                     className="mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 )}
//               </div>

//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tramo</label>
//                 {formData.sector === 'Otro' ? (
//                   <input type="text" placeholder="Tramo..." value={tramoPersonalizado}
//                     onChange={e => setTramoPersonalizado(e.target.value)}
//                     className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 ) : (
//                   <select value={formData.Tramo}
//                     onChange={e => setFormData(prev => ({ ...prev, Tramo: e.target.value }))}
//                     disabled={!formData.sector}
//                     className="px-3 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-50">
//                     <option value="">Seleccionar</option>
//                     {(TRAMOS_POR_SECTOR[formData.sector] || []).map(t => <option key={t} value={t}>{t}</option>)}
//                   </select>
//                 )}
//               </div>

//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Acceso a playa</label>
//                 <input type="text" placeholder="Acceso" value={formData.accesoPublico}
//                   onChange={e => setFormData(prev => ({ ...prev, accesoPublico: e.target.value }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
//               </div>

//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tipo mantenimiento</label>
//                 <select value={formData.tipoMantenimiento}
//                   onChange={e => setFormData(prev => ({ ...prev, tipoMantenimiento: e.target.value }))}
//                   className={`px-3 py-2 rounded-xl border font-bold text-sm ${
//                     formData.tipoMantenimiento === 'Urgente'
//                       ? 'bg-red-50 border-red-200 text-red-600'
//                       : 'bg-slate-50 border-slate-200 text-gray-700'
//                   }`}>
//                   <option value="">Seleccionar</option>
//                   <option value="Urgente">🚨 Urgente</option>
//                   <option value="Ordinario">📋 Ordinario</option>
//                   <option value="Programable">🗓️ Programable</option>
//                 </select>
//               </div>
//             </div>
//           </div>

//           {/* ── GRID PRINCIPAL ───────────────────────────────── */}
//           <div className="grid lg:grid-cols-3 gap-4">

//             {/* ── WIZARD ────────────────────────────────────── */}
//             <div className="lg:col-span-2 space-y-3">

//               {/* Progreso */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
//                 <div className="flex justify-between items-center mb-2">
//                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{formData.subTipo}</span>
//                   <div className="flex gap-2 text-[11px]">
//                     <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-gray-700">{conEvidencia}/{totalItems} con evidencia</span>
//                     <span className="text-slate-400">📍{geoRefs} 📷{fotos}</span>
//                   </div>
//                 </div>
//                 <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
//                   <div
//                     className="h-1.5 rounded-full transition-all duration-500 bg-emerald-500"
//                     style={{ width: `${totalItems ? (conEvidencia / totalItems) * 100 : 0}%` }}
//                   />
//                 </div>
//                 <div className="flex flex-wrap gap-1.5">
//                   {checklist.map((item, idx) => {
//                     const tiene = item.evidence.some(e => e.observation || e.geoRef || e.photo);
//                     return (
//                       <button key={item.id} type="button" onClick={() => setPreguntaActual(idx)}
//                         title={item.pregunta}
//                         className={`w-7 h-7 rounded-full text-[10px] font-bold transition-all border-2 ${
//                           idx === preguntaActual ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
//                         } ${tiene ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
//                         {item.id}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>

//               {/* Tarjeta ítem */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
//                 <span className="inline-block text-[10px] uppercase font-black text-slate-400 tracking-widest bg-slate-100 px-3 py-1 rounded-full mb-3">
//                   {itemActual.seccion}
//                 </span>
//                 <h2 className="text-base font-bold text-slate-800 mb-4 leading-snug">
//                   <span className="text-slate-300 mr-2 font-mono">#{itemActual.id}</span>
//                   {itemActual.pregunta}
//                 </h2>

//                 <div className="border-t border-slate-100 pt-4">
//                   <div className="flex justify-between items-center mb-3">
//                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidencias / Incidencias</h3>
//                     <button onClick={() => addEvidence(itemActual.id)}
//                       className="flex items-center gap-1 text-xs font-bold text-emerald-600 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
//                       <FaPlus size={9} /> Añadir evidencia
//                     </button>
//                   </div>

//                   <div className="space-y-3">
//                     {itemActual.evidence.map(ev => {
//                       const isCapturing = capturandoGps?.itemId === itemActual.id && capturandoGps?.entryId === ev.id;
//                       return (
//                         <div key={ev.id} className="group relative">
//                           {itemActual.evidence.length > 1 && (
//                             <button onClick={() => removeEvidence(itemActual.id, ev.id)}
//                               className="absolute -right-1 top-3 z-10 w-7 h-7 rounded-full bg-red-500 text-white shadow
//                                          flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
//                               <FaTrash size={10} />
//                             </button>
//                           )}
//                           <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
//                             <div className="grid md:grid-cols-2 gap-3">
//                               {/* Observación + GeoRef */}
//                               <div className="space-y-2">
//                                 <input type="text" placeholder="Observación..."
//                                   value={ev.observation}
//                                   onChange={e => updateObservation(itemActual.id, ev.id, e.target.value)}
//                                   className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />

//                                 {ev.geoRef ? (
//                                   <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between">
//                                     <div className="text-[11px] font-mono text-emerald-700">
//                                       <span className="font-bold">X:</span> {ev.geoRef.lat}<br/>
//                                       <span className="font-bold">Y:</span> {ev.geoRef.lon}
//                                       <span className="ml-2 text-emerald-400">±{ev.geoRef.precision}</span>
//                                     </div>
//                                     <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                       className="text-emerald-400 hover:text-emerald-600 ml-2" title="Recapturar">
//                                       <FaUndo size={10} />
//                                     </button>
//                                   </div>
//                                 ) : isCapturing ? (
//                                   <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-emerald-800 py-2.5 px-3 flex items-center gap-2.5">
//                                     <style>{`
//                                       @keyframes gs{0%{transform:translateY(-100%)}100%{transform:translateY(250%)}}
//                                       @keyframes gr{from{transform:rotate(0)}to{transform:rotate(360deg)}}
//                                       @keyframes gp{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:0;transform:scale(1.8)}}
//                                     `}</style>
//                                     <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
//                                       <div className="w-full h-6 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-500/40 border-b border-emerald-400/50"
//                                         style={{ animation: 'gs 1.3s linear infinite' }} />
//                                     </div>
//                                     <div className="relative w-6 h-6 flex-shrink-0 flex items-center justify-center">
//                                       <div className="absolute inset-0 rounded-full border border-emerald-500/40" style={{ animation: 'gp 1.8s ease-in-out infinite' }} />
//                                       <div className="absolute inset-0.5 rounded-full border-2 border-transparent border-t-emerald-400" style={{ animation: 'gr 0.75s linear infinite' }} />
//                                       <FaCrosshairs className="text-emerald-300 relative z-10 text-[9px]" />
//                                     </div>
//                                     <span className="text-emerald-300 text-[11px] font-bold animate-pulse relative z-10">Triangulando GPS...</span>
//                                     <div className="ml-auto flex items-end gap-[2px] h-4 relative z-10 flex-shrink-0">
//                                       {[0.4, 0.65, 1].map((d, i) => (
//                                         <div key={i} className="w-1 bg-emerald-400 rounded-sm"
//                                           style={{ height: `${40 + i * 25}%`, animation: `gp ${0.8 + i * 0.15}s ease-in-out infinite`, animationDelay: `${d * 0.3}s` }} />
//                                       ))}
//                                     </div>
//                                   </div>
//                                 ) : (
//                                   <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                     className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
//                                     <FaCrosshairs size={10} /> Capturar ubicación exacta
//                                   </button>
//                                 )}
//                               </div>

//                               {/* Foto */}
//                               <div className="flex flex-col gap-2">
//                                 {ev.photo ? (
//                                   <div className="relative aspect-video bg-white rounded-xl overflow-hidden border border-slate-200">
//                                     <img src={ev.photo} className="w-full h-full object-cover" alt="evidencia" />
//                                     <button
//                                       type="button"
//                                       onClick={() =>
//                                         setChecklist(prev =>
//                                           prev.map(item =>
//                                             item.id === itemActual.id
//                                               ? { ...item, evidence: item.evidence.map(e => e.id === ev.id ? { ...e, photo: null } : e) }
//                                               : item
//                                           )
//                                         )
//                                       }
//                                       className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">
//                                       <FaTrash size={9} />
//                                     </button>
//                                   </div>
//                                 ) : (
//                                   <div className="grid grid-cols-2 gap-2">
//                                     <label className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">
//                                       <FaCamera className="text-blue-400" size={16} />
//                                       <span className="text-[10px] font-bold text-blue-500">CÁMARA</span>
//                                       <input
//                                         type="file" accept="image/*" capture="environment"
//                                         className="absolute inset-0 opacity-0 cursor-pointer"
//                                         onChange={e => handlePhotoUpload(e, itemActual.id, ev.id)}
//                                         onClick={e => { (e.target as HTMLInputElement).value = ''; }}
//                                       />
//                                     </label>
//                                     <label className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
//                                       <svg className="text-slate-400" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
//                                         <rect x="3" y="3" width="18" height="18" rx="2" />
//                                         <circle cx="8.5" cy="8.5" r="1.5" />
//                                         <path d="M21 15l-5-5L5 21" />
//                                       </svg>
//                                       <span className="text-[10px] font-bold text-slate-400">GALERÍA</span>
//                                       <input
//                                         type="file" accept="image/*"
//                                         className="absolute inset-0 opacity-0 cursor-pointer"
//                                         onChange={e => handlePhotoUpload(e, itemActual.id, ev.id)}
//                                         onClick={e => { (e.target as HTMLInputElement).value = ''; }}
//                                       />
//                                     </label>
//                                   </div>
//                                 )}
//                               </div>
//                             </div>
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 </div>

//                 {/* Navegación */}
//                 <div className="flex justify-between mt-5">
//                   <button onClick={() => setPreguntaActual(p => Math.max(0, p - 1))}
//                     disabled={preguntaActual === 0}
//                     className="px-5 py-2 font-bold text-slate-400 hover:text-slate-600 disabled:opacity-30 text-sm transition-colors">
//                     ← Anterior
//                   </button>
//                   <button onClick={() => setPreguntaActual(p => Math.min(checklist.length - 1, p + 1))}
//                     disabled={preguntaActual === checklist.length - 1}
//                     className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-30">
//                     Siguiente →
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {/* ── PANEL LATERAL ─────────────────────────────── */}
//             <div className="space-y-3">
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
//                 <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
//                   <FaMapMarkedAlt className="text-orange-500" size={13} />
//                   <h3 className="font-bold text-slate-600 text-xs uppercase tracking-wide">Geo-referencias</h3>
//                   {geoRefs > 0 && (
//                     <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{geoRefs}</span>
//                   )}
//                 </div>
//                 <div ref={mapRef} className="h-48">
//                   <LeafletMap gps={gpsVista} reportes={[]} georefPins={georefPins} />
//                 </div>
//                 {geoRefs === 0 && (
//                   <p className="text-[11px] text-slate-400 text-center py-2 border-t border-slate-50">
//                     Las geo-refs aparecerán aquí
//                   </p>
//                 )}
//               </div>

//               <button onClick={procesarFormularioActual}
//                 className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm">
//                 <FaFilePdf /> Guardar y añadir a cola PDF
//               </button>
//               <button onClick={() => { if (window.confirm('¿Reiniciar formulario?')) limpiarFormulario(); }}
//                 className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors text-sm">
//                 <FaUndo size={12} /> Reiniciar
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default FormularioUnificado;















// 'use client';

// import { usePDFQueue } from '@/app/context/pdf-queue-context';
// import { mostrarOpcionesPostGuardado } from '@/app/lib/generarPDFCombinado';
// import React, { useState, useRef, useEffect, useCallback } from 'react';
// import {
//   FaCrosshairs, FaCamera, FaMapMarkedAlt,
//   FaFilePdf, FaTrash, FaUndo, FaPlus,
// } from 'react-icons/fa';
// import jsPDF from 'jspdf';
// import 'leaflet/dist/leaflet.css';
// import dynamic from 'next/dynamic';
// import autoTable from 'jspdf-autotable';
// import { crearReporte, actualizarReporte } from '@/app/lib/actions';

// const LeafletMap = dynamic(
//   () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
//   { ssr: false }
// );

// // ═══════════════════════════════════════════════════════════
// //  INTERFACES
// // ═══════════════════════════════════════════════════════════
// interface FormularioProps {
//   reportesIniciales?: any[];
//   reporteParaEditar?: any;
// }
// interface GpsCoords { lat: string | null; lon: string | null; precision: string; }
// interface GeoRef   { lat: string; lon: string; precision: string; timestamp: string; }
// interface EvidenceEntry { id: number; observation: string; geoRef: GeoRef | null; photo: string | null; }
// interface ChecklistItem {
//   id: number; seccion: string; pregunta: string; respuesta: string;
//   evidence: EvidenceEntry[];
//   // compat BD
//   observacion: string; geoRef?: GeoRef | null;
// }
// interface FormData {
//   sector: string; Tramo: string; accesoPublico: string;
//   tipoMantenimiento: string; categoria: string; subTipo: string;
// }
// interface Seccion { titulo: string; items: string[]; }

// // ═══════════════════════════════════════════════════════════
// //  CATÁLOGO UNIFICADO
// //  Estructura: CATALOGO[categoria][subTipo] = Seccion[]
// // ═══════════════════════════════════════════════════════════
// const CATALOGO: Record<string, Record<string, Seccion[]>> = {

//   // ── 1. ALUMBRADO PÚBLICO ─────────────────────────────────
//   'ALUMBRADO PÚBLICO': {
//     'Alumbrado Público Solar': [{
//       titulo: 'ALUMBRADO PÚBLICO SOLAR',
//       items: [
//         'OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?',
//         'LA FOTOCELDA ¿CUMPLE CON SU FUNCIÓN?',
//         'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'INTEGRIDAD DE LUMINARIA',
//         'ESTADO DE POSTE METÁLICO/CONCRETO',
//         'ESTADO DE BASE DE CONCRETO',
//       ],
//     }],
//     'Alumbrado Público Eléctrico': [{
//       titulo: 'ALUMBRADO PÚBLICO ELÉCTRICO',
//       items: [
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//         'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS',
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'EL BRAZO ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'INTEGRIDAD DE LUMINARIA',
//         'ESTADO DE POSTE METÁLICO/CONCRETO',
//         'ESTADO DE BASE DE CONCRETO',
//       ],
//     }],
//     'Luminaria Tipo Cerillo': [{
//       titulo: 'LUMINARIA TIPO CERILLO',
//       items: [
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'ESTADO DE BASE DE CONCRETO',
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//       ],
//     }],
//     'Luminaria Tipo Europea': [{
//       titulo: 'LUMINARIA TIPO EUROPEA',
//       items: [
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'ESTADO DE BASE DE CONCRETO',
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//         'ESTADO DEL ELEMENTO PORTADOR DE LA LUMINARIA (POSTE PIRAMIDAL PREFABRICADO)',
//       ],
//     }],
//     'Otros': [
//       {
//         titulo: '5.1 PARABUSES',
//         items: [
//           'PARABUSES',
//           '¿EL SISTEMA DE ILUMINACIÓN ENCIENDE CORRECTAMENTE?',
//           '¿LA ILUMINACIÓN SE MANTIENE ESTABLE (SIN PARPADEOS)?',
//           '¿LOS LED ALCANZAN SU BRILLO NORMAL?',
//           '¿EL TEMPORIZADOR O FOTOCELDA ACTIVA EL ENCENDIDO EN EL HORARIO ADECUADO?',
//           '¿NO HAY CABLES EXPUESTOS O DAÑADOS?',
//           '¿EL PARABÚS ESTÁ LIMPIO EN LA ZONA DEL LUMINARIO?',
//         ],
//       },
//       {
//         titulo: '6 PROYECTOR LED',
//         items: [
//           '¿EL PROYECTOR LED ENCIENDE CORRECTAMENTE?',
//           '¿EL PROYECTOR MANTIENE ILUMINACIÓN ESTABLE (SIN PARPADEOS)?',
//           '¿EL PROYECTOR ENCIENDE EN EL HORARIO CORRECTO (SI USA FOTOCELDA / TEMPORIZADOR)?',
//           '¿EL FUSIBLE Y/O INTERRUPTOR ESTÁN EN BUEN ESTADO?',
//           '¿HAY CABLES EXPUESTOS, CORTADOS O SULFATADOS?',
//           '¿LA CARCASA DEL PROYECTOR NO PRESENTA GOLPES NI DEFORMACIONES?',
//           '¿NO HAY HUMEDAD O AGUA DENTRO DEL PROYECTOR?',
//           '¿EL ÁREA ALREDEDOR ESTÁ LIBRE DE BASURA, NIDOS O INSECTOS?',
//         ],
//       },
//       {
//         titulo: '7 PROYECTOR SPOT',
//         items: [
//           '¿EL SPOT ENCIENDE CORRECTAMENTE?',
//           '¿EL SPOT MANTIENE ILUMINACIÓN ESTABLE (SIN PARPADEOS)?',
//           '¿ENCIENDE EN EL HORARIO CORRECTO (SI USA FOTOCELDA / TEMPORIZADOR)?',
//           '¿EL FUSIBLE Y/O INTERRUPTOR ESTÁN EN BUEN ESTADO?',
//           '¿HAY CABLES EXPUESTOS, CORTADOS O SULFATADOS?',
//           '¿PRESENTA GOLPES NI DEFORMACIONES?',
//           '¿HAY HUMEDAD O AGUA DENTRO DEL PROYECTOR?',
//           '¿EL ÁREA ALREDEDOR ESTÁ LIBRE DE BASURA?',
//         ],
//       },
//       {
//         titulo: '8 LUMINARIAS EMPOTRABLES FRAGATA',
//         items: [
//           '¿ENCIENDE CORRECTAMENTE?',
//           '¿ENCIENDE EN EL HORARIO CORRECTO (SI USA FOTOCELDA / TEMPORIZADOR)?',
//           '¿EL FUSIBLE Y/O INTERRUPTOR ESTÁN EN BUEN ESTADO?',
//           '¿HAY CABLES EXPUESTOS, CORTADOS O SULFATADOS?',
//           '¿EL ÁREA ALREDEDOR ESTÁ LIBRE DE BASURA?',
//         ],
//       },
//     ],
//   },

//   // ── 2. ÁREAS VERDES ──────────────────────────────────────
//   'AREAS VERDES': {
//     '1. Poda': [{
//       titulo: '1. PODA',
//       items: [
//         '1.1 DESHIERBE – EN CAMELLÓN EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
//         '1.1 DESHIERBE – EN JARDINERA EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
//         '1.2 CAJETE – EN CAMELLÓN',
//         '1.3 CAJILLO – EN CAMELLONES CON UN ANCHO DE 10 CM Y PROFUNDIDAD DE 12 CM',
//         '1.4 DESORILLE DE ARRIATES/JARDINERA: SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
//         '1.4 DESORILLE DE CAMELLÓN ANCHO 15 CM ± 2 CM; SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
//         '1.5 PODA DE PASTO CON MAQUINARIA A UNA ALTURA PROMEDIO DE 2.5 A 5 CM',
//         '1.6 PODA DE SETOS CUANDO LA GEOMETRÍA DEL ARBUSTO YA NO ES UNIFORME (ARBUSTOS Y PLANTAS DE ORNATO) UTILIZANDO HERRAMIENTA MANUAL Y MECÁNICA',
//         '1.7 PODA DE ÁRBOLES DE 2 A 5 M DE FRONDOSIDAD Y DE 2.00 A 6.00 M DE ALTURA',
//         '1.7 PODA DE ÁRBOLES DE 5.01 M. A 10 DE FRONDOSIDAD Y DE 6.01 A 12.00 M DE ALTURA',
//         '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
//         '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
//         '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
//         '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
//       ],
//     }],
//     '2. Tala': [{
//       titulo: '2. TALA DE ÁRBOLES O PALMERAS',
//       items: [
//         'TALA, TROZA, CARGA Y RETIRO DE ÁRBOLES POR MEDIOS MANUALES BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) HASTA 5.00 M DE ALTURA',
//         'TALA, TROZA, CARGA Y RETIRO DE PALMERAS BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) DE 5.01 A 12.00 M',
//       ],
//     }],
//     '4. Escombro': [{
//       titulo: '4. ESCOMBRO',
//       items: [
//         'ÁREA LIBRE DE CONTAMINACIÓN (TIERRA/CASCAJO, LODOS, EXCRETAS, HIDROCARBUROS, ESCOMBROS)',
//       ],
//     }],
//     '5. Limpieza': [{
//       titulo: '5. LIMPIEZA ÁREAS VERDES',
//       items: [
//         'JARDINERAS/ARRIATES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
//         'CAMELLONES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
//       ],
//     }],
//     '6. Red de riego': [{
//       titulo: '6. RED DE RIEGO',
//       items: [
//         'RED DE RIEGO TAPADA, FUERA DE DIRECCIÓN O CON FUGAS',
//       ],
//     }],
//     '7. Retiro de tocones': [{
//       titulo: '7. RETIRO DE TOCONES',
//       items: [
//         'CORTE A 15 CM DEBAJO DEL NIVEL EXISTENTE DE TOCON. DE HASTA 50 CM DE DIAMETRO',
//       ],
//     }],
//     '8. Fumigación': [{
//       titulo: '8. FUMIGACIÓN',
//       items: [
//         'ESPECIE PRESENTA PLAGA',
//         'ESPECIE PRESENTA HONGO O PUDRICIÓN',
//       ],
//     }],
//   },

//   // ── 3. LIMPIEZA URBANA ────────────────────────────────────
//   'LIMPIEZA URBANA': {
//     'Limpieza General': [{
//       titulo: '1. LIMPIEZA GENERAL',
//       items: [
//         '1.1 BARRIDO',
//         '1.2 LAVADO DE PISO',
//         '1.4 LAVADO DE MUROS',
//       ],
//     }],
//     'Residuos y Contenedores': [{
//       titulo: 'RESIDUOS Y CONTENEDORES',
//       items: [
//         'ÁREA GENERAL LIMPIA DE BASURA VISIBLE A LO LARGO DEL TRAMO',
//         'BANQUETAS BARRIDAS Y LIBRES DE RESIDUOS SÓLIDOS',
//         'CUNETAS LIMPIAS Y SIN OBSTRUCCIONES POR RESIDUOS',
//         'ACUMULACIÓN DE BASURA EN PUNTOS CRÍTICOS (ESQUINAS, ACCESOS, MUROS)',
//         'PLAYA LIMPIA DE RESIDUOS ORGÁNICOS E INORGÁNICOS (SI APLICA)',
//         'ACCESOS A PLAYA O ZONA PÚBLICA LIBRES DE BASURA',
//         'BOTES DE BASURA VACÍOS (NO REBASADOS)',
//         'BOTES Y CONTENEDORES LIMPIOS POR DENTRO Y POR FUERA',
//         'ÁREA ALREDEDOR DEL BOTE (1 METRO) LIBRE DE RESIDUOS',
//         'LIXIVIADOS O DERRAMES ALREDEDOR DE BOTES O CONTENEDORES',
//         'RESIDUOS DISPERSOS DESPUÉS DE LA RECOLECCIÓN',
//         'PODA EN GRAL CADA 6 MESES',
//       ],
//     }],
//     'Canal Pluvial': [{
//       titulo: 'CANAL PLUVIAL',
//       items: [
//         '¿EL CANAL PLUVIAL PRESENTA OBSTRUCCIONES (BASURA, SEDIMENTOS, VEGETACIÓN, LODO, ETC.)?',
//         '¿EL CANAL PLUVIAL PRESENTA DAÑOS ESTRUCTURALES (FISURAS, DESPRENDIMIENTOS, DEFORMACIONES, SOCAVACIONES)?',
//         '¿EL AGUA PUEDE FLUIR LIBREMENTE A TRAVÉS DEL CANAL PLUVIAL?',
//         '¿LOS ACCESOS AL CANAL (TAPAS, REJILLAS, REGISTROS) ESTÁN EN BUEN ESTADO?',
//         '¿EL CANAL PLUVIAL SE ENCUENTRA EN BUENAS CONDICIONES (SIN OBSTRUCCIONES, SIN DAÑO ESTRUCTURAL Y CON FLUJO LIBRE)?',
//         'INDIQUE EL ESTADO ACTUAL DE LA REJILLA PLUVIAL (PUEDE SELECCIONAR MÁS DE UNA OPCIÓN)',
//       ],
//     }],
//   },

//   // ── 4. MOBILIARIO URBANO ──────────────────────────────────
//   'MOBILIARIO URBANO': {
//     '1. Bacheo': [{
//       titulo: '1. BACHEO',
//       items: ['1.1 M2 DAÑADOS'],
//     }],
//     '2. Parabuses': [{
//       titulo: '2. PARABUSES',
//       items: [
//         '2.1 BANDALIZADOS',
//         '2.2 GOLPEADOS',
//         '2.3 OTRO DAÑO',
//       ],
//     }],
//     '3. Tapas de registros': [{
//       titulo: '3. TAPAS DE REGISTROS DE CONCRETO',
//       items: [
//         '3.1 ROTA',
//         '3.2 FALTANTE',
//         '3.3 OTRO DAÑO',
//         '3.4 DE CFE O TELECOMUNICACIONES (IDENTIFICAR PARA REPORTAR)',
//       ],
//     }],
//     '4. Barandales': [{
//       titulo: '4. BARANDALES',
//       items: [
//         '4.1 ACERO INOXIDABLE – TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESALINEADO O DETALLES EN EL ANCLAJE',
//         '4.2 METÁLICO – TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESALINEADO O DETALLES EN EL ANCLAJE',
//       ],
//     }],
//     '5. Señaleticas': [{
//       titulo: '5. SEÑALETICAS',
//       items: [
//         '5.1 TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESPLOME O DETALLES EN EL ANCLAJE',
//       ],
//     }],
//     '6. Balizamiento': [{
//       titulo: '6. BALIZAMIENTO',
//       items: ['6.1 M2 O ML CON BALIZAMIENTO FALTANTE – IDENTIFICAR ELEMENTO'],
//     }],
//     '7. Murales': [{
//       titulo: '7. MURALES',
//       items: ['7.1 DESCRIBIR DETALLES ENCONTRADOS'],
//     }],
//     '8. Bolardos': [{
//       titulo: '8. BOLARDOS',
//       items: ['8.1 BOLARDOS DAÑADOS – IDENTIFICAR EL TIPO DE DAÑO'],
//     }],
//     '9. Figuras lúdicas': [{
//       titulo: '9. FIGURAS LÚDICAS',
//       items: ['9.1 FIGURAS LÚDICAS – IDENTIFICAR EL TIPO DE DAÑO'],
//     }],
//     '10. Postes semáforos': [{
//       titulo: '10. POSTES SEMÁFOROS',
//       items: ['10.1 POSTES – IDENTIFICAR EL TIPO DE DAÑO'],
//     }],
//     // ── FIX: Títulos corregidos (antes: '10. guarnicion') ──
//     '11. Guarnicion': [{
//       titulo: '11. GUARNICION',
//       items: ['Guarnicion dañada'],
//     }],
//     '12. Banqueta': [{
//       titulo: '12. BANQUETA',
//       items: ['Banqueta dañada'],
//     }],
//       '13.Muro ': [{
//       titulo: '13. Muro',
//       items: ['Muro dañado'],
//     }],
//   },
// };

// // ── Color por categoría ────────────────────────────────────
// const CATEGORIA_COLOR: Record<string, { header: string; tab: string; badge: string }> = {
//   'ALUMBRADO PÚBLICO':  { header: 'from-yellow-600 to-yellow-700',   tab: 'bg-yellow-50  text-yellow-800',  badge: 'bg-yellow-100  text-yellow-700'  },
//   'AREAS VERDES':       { header: 'from-emerald-600 to-emerald-700', tab: 'bg-emerald-50 text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
//   'BARRIDO VIALIDADES': { header: 'from-blue-600 to-blue-700',       tab: 'bg-blue-50    text-blue-800',    badge: 'bg-blue-100    text-blue-700'    },
//   'LIMPIEZA URBANA':    { header: 'from-orange-600 to-orange-700',   tab: 'bg-orange-50  text-orange-800',  badge: 'bg-orange-100  text-orange-700'  },
//   'MOBILIARIO URBANO':  { header: 'from-purple-600 to-purple-700',   tab: 'bg-purple-50  text-purple-800',  badge: 'bg-purple-100  text-purple-700'  },
// };

// const TRAMOS_POR_SECTOR: Record<string, string[]> = {
//   'Barra de Coyuca':      ['Sendero-Seguro-Barra Coyuca'],
//   'Pie de la Cuesta':     ['Sendero-seguro-Pie de la cuesta'],
//   'Barrios Historicos':   ['Caleta-caletilla', 'Sendero-Costera-antigua', 'Corredor Zocalo-quebrada', 'Corredor zocalo-fuerte'],
//   'Acapulco Tradicional': ['Sendero-Tadeo-arredondo', 'Sendero-cinerio-hornitos', 'Michoacan', 'Av. Universidad', 'Dr. Ignacio chavez'],
//   'Acapulco Dorado':      ['Costa azul'],
//   'Las Brisas':           [''],
//   'Puerto Márquez':       ['Sendero-Puerto-Marquez'],
//   'Acapulco Diamante':    ['Av. Costera Palmas'],
//   'Otro':                 [''],
// };

// // ── Helpers ────────────────────────────────────────────────
// const emptyEntry = (): EvidenceEntry => ({ id: Date.now(), observation: '', geoRef: null, photo: null });

// const buildChecklist = (categoria: string, subTipo: string): ChecklistItem[] => {
//   const secciones = CATALOGO[categoria]?.[subTipo] ?? [];
//   let counter = 1;
//   return secciones.flatMap(sec =>
//     sec.items.map(pregunta => ({
//       id: counter++,
//       seccion: sec.titulo,
//       pregunta,
//       respuesta: '',
//       observacion: '',
//       geoRef: null,
//       evidence: [emptyEntry()],
//     }))
//   );
// };

// const CATEGORIAS = Object.keys(CATALOGO);

// // ═══════════════════════════════════════════════════════════
// //  COMPONENTE PRINCIPAL
// // ═══════════════════════════════════════════════════════════
// const FormularioUnificado: React.FC<FormularioProps> = ({ reporteParaEditar }) => {
//   const { addToQueue } = usePDFQueue();
//   const mapRef        = useRef<HTMLDivElement>(null);
//   const geoRefWatchId = useRef<number | null>(null);

//   const [currentTime,         setCurrentTime]         = useState('');
//   const [preguntaActual,      setPreguntaActual]       = useState(0);
//   const [sectorPersonalizado, setSectorPersonalizado]  = useState('');
//   const [tramoPersonalizado,  setTramoPersonalizado]   = useState('');
//   const [capturandoGps, setCapturandoGps] = useState<{ itemId: number; entryId: number } | null>(null);

//   const [gps, setGps] = useState<GpsCoords>({
//     lat: reporteParaEditar?.latitud ? String(reporteParaEditar.latitud) : null,
//     lon: reporteParaEditar?.longitud ? String(reporteParaEditar.longitud) : null,
//     precision: '--',
//   });

//   const catInicial     = reporteParaEditar?.categoria ?? 'ALUMBRADO PÚBLICO';
//   const subtiposInic   = Object.keys(CATALOGO[catInicial] ?? {});
//   const subTipoInicial = reporteParaEditar?.subTipo ?? subtiposInic[0] ?? '';

//   const [formData, setFormData] = useState<FormData>({
//     sector:            reporteParaEditar?.sector            ?? '',
//     Tramo:             reporteParaEditar?.tramo             ?? '',
//     accesoPublico:     reporteParaEditar?.acceso_publico    ?? '',
//     tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
//     categoria:         catInicial,
//     subTipo:           subTipoInicial,
//   });

//   const [checklist, setChecklist] = useState<ChecklistItem[]>(
//     buildChecklist(catInicial, subTipoInicial)
//   );

//   // ── Geo-pins para el mapa ──────────────────────────────
//   const georefPins = React.useMemo(() =>
//     checklist.flatMap(item =>
//       item.evidence.filter(ev => ev.geoRef).map((ev, ei) => ({
//         lat: ev.geoRef!.lat, lon: ev.geoRef!.lon,
//         label: item.evidence.length > 1 ? `${item.id}.${ei + 1}` : String(item.id),
//         pregunta: item.pregunta, observation: ev.observation, cumple: item.respuesta,
//       }))
//     )
//   , [checklist]);

//   const gpsVista: GpsCoords = React.useMemo(() =>
//     georefPins.length > 0
//       ? { lat: georefPins[georefPins.length - 1].lat, lon: georefPins[georefPins.length - 1].lon, precision: '--' }
//       : { lat: null, lon: null, precision: '--' }
//   , [georefPins]);

//   // ── Efectos ────────────────────────────────────────────
//   useEffect(() => {
//     const tick = () => setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
//     tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
//   }, []);

//   useEffect(() => {
//     import('leaflet').then(L => {
//       delete (L.Icon.Default.prototype as any)._getIconUrl;
//       L.Icon.Default.mergeOptions({
//         iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//         iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//         shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
//       });
//     });
//   }, []);

//   useEffect(() => {
//     return () => {
//       if (geoRefWatchId.current !== null) navigator.geolocation.clearWatch(geoRefWatchId.current);
//     };
//   }, []);

//   // ── Cargar datos para edición ──────────────────────────
//   useEffect(() => {
//     if (reporteParaEditar) {
//       setFormData({
//         sector:            reporteParaEditar.sector            || '',
//         Tramo:             reporteParaEditar.tramo             || '',
//         accesoPublico:     reporteParaEditar.acceso_publico    || '',
//         tipoMantenimiento: reporteParaEditar.tipo_mantenimiento || '',
//         categoria:         reporteParaEditar.categoria         || 'ALUMBRADO PÚBLICO',
//         subTipo:           reporteParaEditar.sub_tipo          || '',
//       });
//       if (reporteParaEditar.checklist) {
//         setChecklist(reporteParaEditar.checklist);
//       }
//       if (reporteParaEditar.latitud && reporteParaEditar.longitud) {
//         setGps({
//           lat:       String(reporteParaEditar.latitud),
//           lon:       String(reporteParaEditar.longitud),
//           precision: 'Recuperado de BD',
//         });
//       }
//     }
//   }, [reporteParaEditar]);

//   // ── Cambio de categoría ────────────────────────────────
//   const handleCategoriaChange = useCallback((nuevaCat: string) => {
//     const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
//     if (hayEvidencias && !window.confirm('Cambiar categoría borrará las evidencias actuales. ¿Continuar?')) return;
//     const subtipo = Object.keys(CATALOGO[nuevaCat] ?? {})[0] ?? '';
//     setFormData(prev => ({ ...prev, categoria: nuevaCat, subTipo: subtipo }));
//     setChecklist(buildChecklist(nuevaCat, subtipo));
//     setPreguntaActual(0);
//   }, [checklist]);

//   // ── Cambio de sub-tipo ─────────────────────────────────
//   const handleSubTipoChange = useCallback((nuevoSub: string) => {
//     const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
//     if (hayEvidencias && !window.confirm('Cambiar el tipo borrará las evidencias actuales. ¿Continuar?')) return;
//     setFormData(prev => ({ ...prev, subTipo: nuevoSub }));
//     setChecklist(buildChecklist(formData.categoria, nuevoSub));
//     setPreguntaActual(0);
//   }, [checklist, formData.categoria]);

//   // ── GPS por evidencia ──────────────────────────────────
//   const capturarGeoRef = useCallback((itemId: number, entryId: number) => {
//     if (!navigator.geolocation) {
//       alert('Tu dispositivo no soporta GPS. Activa la ubicación e inténtalo de nuevo.');
//       return;
//     }
//     if (geoRefWatchId.current !== null) {
//       navigator.geolocation.clearWatch(geoRefWatchId.current);
//       geoRefWatchId.current = null;
//     }
//     setCapturandoGps({ itemId, entryId });

//     const timeoutId = setTimeout(() => {
//       if (geoRefWatchId.current !== null) {
//         navigator.geolocation.clearWatch(geoRefWatchId.current);
//         geoRefWatchId.current = null;
//       }
//       setCapturandoGps(null);
//       alert(
//         'No se pudo obtener la ubicación en 30 segundos.\n\n' +
//         'Verifica que:\n' +
//         '• El GPS del teléfono esté activado\n' +
//         '• La app tenga permiso de ubicación\n' +
//         '• Estés al aire libre o con señal\n\n' +
//         'Puedes intentarlo de nuevo.'
//       );
//     }, 30_000);

//     geoRefWatchId.current = navigator.geolocation.watchPosition(
//       ({ coords: { latitude, longitude, accuracy } }) => {
//         clearTimeout(timeoutId);
//         const timestamp = new Date().toLocaleTimeString('es-MX', {
//           hour: '2-digit', minute: '2-digit', second: '2-digit',
//         });
//         setChecklist(prev =>
//           prev.map(item =>
//             item.id === itemId
//               ? {
//                   ...item,
//                   evidence: item.evidence.map(ev =>
//                     ev.id === entryId
//                       ? {
//                           ...ev,
//                           geoRef: {
//                             lat:       latitude.toFixed(6),
//                             lon:       longitude.toFixed(6),
//                             precision: `${accuracy.toFixed(1)}m`,
//                             timestamp,
//                           },
//                         }
//                       : ev
//                   ),
//                 }
//               : item
//           )
//         );
//         if (geoRefWatchId.current !== null) {
//           navigator.geolocation.clearWatch(geoRefWatchId.current);
//           geoRefWatchId.current = null;
//         }
//         setCapturandoGps(null);
//       },
//       (error) => {
//         clearTimeout(timeoutId);
//         if (geoRefWatchId.current !== null) {
//           navigator.geolocation.clearWatch(geoRefWatchId.current);
//           geoRefWatchId.current = null;
//         }
//         setCapturandoGps(null);
//         const mensajes: Record<number, string> = {
//           1: 'Permiso de ubicación denegado. Ve a Ajustes > Permisos y activa la ubicación para esta app.',
//           2: 'No se pudo determinar la ubicación. Asegúrate de estar al aire libre.',
//           3: 'Tiempo de espera agotado. Intenta de nuevo en un lugar con mejor señal.',
//         };
//         alert(mensajes[error.code] ?? `Error de GPS (código ${error.code}). Intenta de nuevo.`);
//       },
//       { enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 }
//     );
//   }, []);

//   // ── Evidencia helpers ──────────────────────────────────
//   const addEvidence = useCallback((itemId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: [...item.evidence, emptyEntry()] } : item
//     ));
//   }, []);

//   const removeEvidence = useCallback((itemId: number, entryId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.filter(e => e.id !== entryId) } : item
//     ));
//   }, []);

//   const updateObservation = useCallback((itemId: number, entryId: number, val: string) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId
//         ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, observation: val } : e) }
//         : item
//     ));
//   }, []);

//   const handlePhotoUpload = useCallback(
//     async (e: React.ChangeEvent<HTMLInputElement>, itemId: number, entryId: number) => {
//       const file = e.target.files?.[0];
//       if (!file) return;
//       if (!file.type.startsWith('image/')) {
//         alert('El archivo seleccionado no es una imagen válida.');
//         return;
//       }
//       const objectUrl = URL.createObjectURL(file);
//       try {
//         let exifRotation = 1;
//         try {
//           const buffer = await file.arrayBuffer();
//           const view   = new DataView(buffer);
//           if (view.getUint16(0) === 0xFFD8) {
//             let offset = 2;
//             while (offset < view.byteLength - 2) {
//               const marker = view.getUint16(offset);
//               offset += 2;
//               if (marker === 0xFFE1) {
//                 const exifLen  = view.getUint16(offset);
//                 const exifData = new DataView(buffer, offset + 2, exifLen - 2);
//                 const littleE  = exifData.getUint16(6) === 0x4949;
//                 const dirOffset = exifData.getUint32(10, littleE) + 6;
//                 const numEntries = exifData.getUint16(dirOffset, littleE);
//                 for (let i = 0; i < numEntries; i++) {
//                   const entryOffset = dirOffset + 2 + i * 12;
//                   if (exifData.getUint16(entryOffset, littleE) === 0x0112) {
//                     exifRotation = exifData.getUint16(entryOffset + 8, littleE);
//                     break;
//                   }
//                 }
//                 break;
//               }
//               if ((marker & 0xFF00) !== 0xFF00) break;
//               offset += view.getUint16(offset);
//             }
//           }
//         } catch { /* EXIF no disponible */ }

//         await new Promise<void>((resolve, reject) => {
//           const img = new Image();
//           img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('No se pudo cargar la imagen.')); };
//           img.onload = () => {
//             try {
//               const needsSwap = exifRotation >= 5 && exifRotation <= 8;
//               const maxDim    = 1200;
//               const srcW      = img.width;
//               const srcH      = img.height;
//               const longSide  = Math.max(srcW, srcH);
//               const scale     = longSide > maxDim ? maxDim / longSide : 1;
//               const dstW      = Math.round((needsSwap ? srcH : srcW) * scale);
//               const dstH      = Math.round((needsSwap ? srcW : srcH) * scale);
//               const canvas    = document.createElement('canvas');
//               canvas.width    = dstW;
//               canvas.height   = dstH;
//               const ctx = canvas.getContext('2d');
//               if (!ctx) { reject(new Error('No se pudo crear contexto de canvas.')); return; }
//               ctx.save();
//               ctx.translate(dstW / 2, dstH / 2);
//               switch (exifRotation) {
//                 case 2: ctx.scale(-1,  1);             break;
//                 case 3: ctx.rotate(Math.PI);           break;
//                 case 4: ctx.scale( 1, -1);             break;
//                 case 5: ctx.rotate(-Math.PI / 2); ctx.scale(-1, 1); break;
//                 case 6: ctx.rotate( Math.PI / 2);      break;
//                 case 7: ctx.rotate( Math.PI / 2); ctx.scale(-1, 1); break;
//                 case 8: ctx.rotate(-Math.PI / 2);      break;
//               }
//               ctx.drawImage(img, -srcW * scale / 2, -srcH * scale / 2, srcW * scale, srcH * scale);
//               ctx.restore();
//               const b64 = canvas.toDataURL('image/jpeg', 0.82);
//               setChecklist(prev =>
//                 prev.map(item =>
//                   item.id === itemId
//                     ? { ...item, evidence: item.evidence.map(ev => ev.id === entryId ? { ...ev, photo: b64 } : ev) }
//                     : item
//                 )
//               );
//               resolve();
//             } catch (drawErr) {
//               reject(drawErr);
//             } finally {
//               URL.revokeObjectURL(objectUrl);
//             }
//           };
//           img.src = objectUrl;
//         });
//       } catch (err) {
//         URL.revokeObjectURL(objectUrl);
//         console.error('[handlePhotoUpload]', err);
//         alert('No se pudo procesar la imagen. Intenta con otra foto.');
//       }
//     },
//     []
//   );

//   const limpiarFormulario = useCallback(() => {
//     setChecklist(buildChecklist(formData.categoria, formData.subTipo));
//     setPreguntaActual(0);
//   }, [formData.categoria, formData.subTipo]);

//   // ── Guardar en BD ──────────────────────────────────────
//   const guardarCuestionario = useCallback(async () => {
//     const sectorFinal = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramoFinal  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;
//     const fd = { ...formData, sector: sectorFinal, Tramo: tramoFinal };

//     // ── FIX: mapear checklist SIN fotos para el JSONB (evita payload gigante)
//     // Las fotos se guardan únicamente en la tabla `evidencias`
//     const checklistParaDB = checklist.map(item => ({
//       ...item,
//       observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//       geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//       // Mantener evidence completo (con foto) para que insertarEvidencias las guarde
//       evidence:    item.evidence,
//     }));

//     const lastGeoRef = checklist.flatMap(i => i.evidence).find(e => e.geoRef)?.geoRef;
//     const gpsDB: GpsCoords = lastGeoRef
//       ? { lat: lastGeoRef.lat, lon: lastGeoRef.lon, precision: lastGeoRef.precision }
//       : { lat: null, lon: null, precision: '--' };

//     if (reporteParaEditar?.id) {
//       await actualizarReporte(reporteParaEditar.id.toString(), fd, checklistParaDB as any, gpsDB, {});
//       alert('¡Reporte actualizado!');
//     } else {
//       await crearReporte(fd, checklistParaDB as any, gpsDB, {});
//       alert('¡Reporte guardado!');
//     }
//   }, [formData, sectorPersonalizado, tramoPersonalizado, checklist, reporteParaEditar]);

//   // ── Procesar y añadir a cola ───────────────────────────
//   const procesarFormularioActual = useCallback(async () => {
//     try {
//       await guardarCuestionario();
//       addToQueue({
//         categoria: formData.categoria,
//         formData:  { ...formData },
//         checklist: checklist.map(item => ({
//           ...item,
//           observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//           geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//         })) as any,
//         gps:          gpsVista,
//         fotos:        {},
//         mapImage:     null,
//         fechaCaptura: new Date(),
//       });
//       const opcion = await mostrarOpcionesPostGuardado();
//       if (opcion === 'otro_mismo' || opcion === 'generar_ahora') limpiarFormulario();
//     } catch (err) {
//       console.error(err);
//       alert('Error al procesar el formulario.');
//     }
//   }, [addToQueue, checklist, formData, gpsVista, guardarCuestionario, limpiarFormulario]);

//   // ── PDF local rápido ───────────────────────────────────
//   const generarPDFLocal = useCallback(async () => {
//     const doc   = new jsPDF('p', 'mm', 'a4');
//     const pageW = doc.internal.pageSize.getWidth();
//     const pageH = doc.internal.pageSize.getHeight();
//     const margin = 12;
//     const folio  = `REV-${formData.categoria.slice(0, 3).toUpperCase()}-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 900 + 100)}`;
//     const sector = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramo  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;

//     let y = 18;
//     doc.setFont('helvetica', 'bold').setFontSize(12);
//     doc.text(`REPORTE ${formData.categoria} – CIP ACAPULCO-COYUCA`, margin, y);
//     y += 4; doc.setLineWidth(0.5).line(margin, y, pageW - margin, y); y += 6;
//     doc.setFont('helvetica', 'normal').setFontSize(9);
//     doc.text(`Folio: ${folio}   Sector: ${sector}   Tramo: ${tramo}`, margin, y); y += 5;
//     doc.setFont('helvetica', 'bold').text(`Sub-tipo: ${formData.subTipo}   Mantenimiento: ${formData.tipoMantenimiento}`, margin, y);
//     doc.setFont('helvetica', 'normal'); y += 8;

//     const rows: any[] = [];
//     checklist.forEach(item => {
//       item.evidence.forEach((ev, ei) => {
//         rows.push([
//           ei === 0 ? String(item.id) : '',
//           ei === 0 ? item.pregunta   : `↳ Incidencia ${ei + 1}`,
//           ev.geoRef?.lat ?? '',
//           ev.geoRef?.lon ?? '',
//           ev.observation || '',
//           { content: '', photo: ev.photo },
//         ]);
//       });
//     });

//     let _localImgAlias = 0;
//     autoTable(doc, {
//       startY: y,
//       margin: { left: margin, right: margin },
//       head: [[
//         { content: 'No.',      styles: { halign: 'center' } },
//         { content: 'Concepto / Incidencia' },
//         { content: 'Lat',      styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Lon',      styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Observaciones' },
//         { content: 'Foto',     styles: { halign: 'center' } },
//       ]],
//       body: rows,
//       theme: 'grid',
//       styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle', overflow: 'linebreak', lineWidth: 0.2 },
//       headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
//       columnStyles: {
//         0: { cellWidth: 10, halign: 'center' },
//         1: { cellWidth: 62 },
//         2: { cellWidth: 22, halign: 'center', fontSize: 7 },
//         3: { cellWidth: 22, halign: 'center', fontSize: 7 },
//         4: { cellWidth: 42 },
//         5: { cellWidth: 28, halign: 'center' },
//       },
//       didDrawCell: (data: any) => {
//         if (data.section === 'body' && data.column.index === 5 && data.cell.raw?.photo) {
//           try {
//             const foto = data.cell.raw.photo as string;
//             if (typeof foto !== 'string' || !foto.startsWith('data:')) return;
//             const fmt  = foto.startsWith('data:image/png') ? 'PNG' : 'JPEG';
//             const p    = doc.getImageProperties(foto);
//             const maxW = 24;
//             const maxH = data.cell.height - 2;
//             const ratio = Math.min(maxW / p.width, maxH / p.height);
//             const dw   = p.width  * ratio;
//             const dh   = p.height * ratio;
//             doc.addImage(
//               foto, fmt,
//               data.cell.x + (maxW - dw) / 2 + 1,
//               data.cell.y + (data.cell.height - dh) / 2,
//               dw, dh,
//               `local_img_${_localImgAlias++}`,
//               'FAST'
//             );
//           } catch { /* imagen inválida */ }
//         }
//       },
//       rowPageBreak: 'avoid',
//     });

//     for (let i = 1; i <= doc.getNumberOfPages(); i++) {
//       doc.setPage(i); doc.saveGraphicsState();
//       doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
//       doc.addImage('/logo_fonatur.png', 'PNG', (pageW - 130) / 2, (pageH - 38) / 2, 130, 38);
//       doc.restoreGraphicsState();
//     }
//     doc.save(`${folio}.pdf`);
//   }, [checklist, formData, sectorPersonalizado, tramoPersonalizado]);

//   // ═══════════════════════════════════════════════════════
//   //  RENDER
//   // ═══════════════════════════════════════════════════════
//   const itemActual    = checklist[preguntaActual];
//   const subtipos      = Object.keys(CATALOGO[formData.categoria] ?? {});
//   const tieneSubtipos = subtipos.length > 1;

//   const totalItems   = checklist.length;
//   const geoRefs      = checklist.flatMap(i => i.evidence).filter(e => e.geoRef).length;
//   const fotos        = checklist.flatMap(i => i.evidence).filter(e => e.photo).length;
//   const conEvidencia = checklist.filter(i => i.evidence.some(e => e.observation || e.geoRef || e.photo)).length;

//   return (
//     <div className="min-h-screen bg-[#eef2f6] font-sans text-gray-700">
//       <div className="max-w-5xl mx-auto">

//         {/* ── HEADER ───────────────────────────────────────── */}
//         <header className="bg-[#285C4D] text-white shadow-lg pt-6 px-6 flex flex-col">
//           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-5">
//             <div>
//               <h1 className="text-xl font-extrabold tracking-wide uppercase">
//                 Reporte de Mantenimiento — CIP Acapulco-Coyuca
//               </h1>
//               <p className="text-white/70 text-xs mt-0.5">Selecciona categoría y sub-tipo para cargar el cuestionario</p>
//             </div>
//             <div className="text-xs font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
//               {currentTime}
//             </div>
//           </div>
//           <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
//             {CATEGORIAS.map(cat => (
//               <button key={cat} onClick={() => handleCategoriaChange(cat)}
//                 className={`flex-shrink-0 px-3 py-2.5 rounded-t-xl font-bold text-[11px] transition-colors whitespace-nowrap ${
//                   formData.categoria === cat
//                     ? 'bg-[#eef2f6] text-gray-800'
//                     : 'bg-black/20 text-white/80 hover:bg-black/30'
//                 }`}>
//                 {cat}
//               </button>
//             ))}
//           </div>
//         </header>

//         {/* ── Sub-tipo tabs ─────────────────────────────────── */}
//         {tieneSubtipos && (
//           <div className="bg-white border-b border-gray-100 px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide shadow-sm">
//             {subtipos.map(sub => (
//               <button key={sub} onClick={() => handleSubTipoChange(sub)}
//                 className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
//                   formData.subTipo === sub
//                     ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
//                     : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
//                 }`}>
//                 {sub}
//               </button>
//             ))}
//           </div>
//         )}
//         {!tieneSubtipos && subtipos.length === 1 && (
//           <div className="px-6 py-2.5 border-b border-gray-100 bg-white shadow-sm">
//             <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-gray-800">
//               {formData.subTipo}
//             </span>
//           </div>
//         )}

//         <div className="p-4 sm:p-5 space-y-4">

//           {/* ── DATOS GENERALES ──────────────────────────────── */}
//           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
//             <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Sector</label>
//                 <select value={formData.sector}
//                   onChange={e => setFormData(prev => ({ ...prev, sector: e.target.value, Tramo: '' }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-[#e67e22] text-sm focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30">
//                   <option value="">Seleccionar</option>
//                   {Object.keys(TRAMOS_POR_SECTOR).map(s => <option key={s} value={s}>{s}</option>)}
//                 </select>
//                 {formData.sector === 'Otro' && (
//                   <input type="text" placeholder="Sector..." value={sectorPersonalizado}
//                     onChange={e => setSectorPersonalizado(e.target.value)}
//                     className="mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 )}
//               </div>

//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tramo</label>
//                 {formData.sector === 'Otro' ? (
//                   <input type="text" placeholder="Tramo..." value={tramoPersonalizado}
//                     onChange={e => setTramoPersonalizado(e.target.value)}
//                     className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 ) : (
//                   <select value={formData.Tramo}
//                     onChange={e => setFormData(prev => ({ ...prev, Tramo: e.target.value }))}
//                     disabled={!formData.sector}
//                     className="px-3 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-50">
//                     <option value="">Seleccionar</option>
//                     {(TRAMOS_POR_SECTOR[formData.sector] || []).map(t => <option key={t} value={t}>{t}</option>)}
//                   </select>
//                 )}
//               </div>

//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Acceso a playa</label>
//                 <input type="text" placeholder="Acceso" value={formData.accesoPublico}
//                   onChange={e => setFormData(prev => ({ ...prev, accesoPublico: e.target.value }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
//               </div>

//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tipo mantenimiento</label>
//                 <select value={formData.tipoMantenimiento}
//                   onChange={e => setFormData(prev => ({ ...prev, tipoMantenimiento: e.target.value }))}
//                   className={`px-3 py-2 rounded-xl border font-bold text-sm ${
//                     formData.tipoMantenimiento === 'Urgente'
//                       ? 'bg-red-50 border-red-200 text-red-600'
//                       : 'bg-slate-50 border-slate-200 text-gray-700'
//                   }`}>
//                   <option value="">Seleccionar</option>
//                   <option value="Urgente">🚨 Urgente</option>
//                   <option value="Ordinario">📋 Ordinario</option>
//                   <option value="Programable">🗓️ Programable</option>
//                 </select>
//               </div>
//             </div>
//           </div>

//           {/* ── GRID PRINCIPAL ───────────────────────────────── */}
//           <div className="grid lg:grid-cols-3 gap-4">

//             {/* ── WIZARD ────────────────────────────────────── */}
//             <div className="lg:col-span-2 space-y-3">

//               {/* Progreso */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
//                 <div className="flex justify-between items-center mb-2">
//                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{formData.subTipo}</span>
//                   <div className="flex gap-2 text-[11px]">
//                     <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-gray-700">{conEvidencia}/{totalItems} con evidencia</span>
//                     <span className="text-slate-400">📍{geoRefs} 📷{fotos}</span>
//                   </div>
//                 </div>
//                 <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
//                   <div
//                     className="h-1.5 rounded-full transition-all duration-500 bg-emerald-500"
//                     style={{ width: `${totalItems ? (conEvidencia / totalItems) * 100 : 0}%` }}
//                   />
//                 </div>
//                 <div className="flex flex-wrap gap-1.5">
//                   {checklist.map((item, idx) => {
//                     const tiene = item.evidence.some(e => e.observation || e.geoRef || e.photo);
//                     return (
//                       <button key={item.id} type="button" onClick={() => setPreguntaActual(idx)}
//                         title={item.pregunta}
//                         className={`w-7 h-7 rounded-full text-[10px] font-bold transition-all border-2 ${
//                           idx === preguntaActual ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
//                         } ${tiene ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
//                         {item.id}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>

//               {/* Tarjeta ítem */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
//                 <span className="inline-block text-[10px] uppercase font-black text-slate-400 tracking-widest bg-slate-100 px-3 py-1 rounded-full mb-3">
//                   {itemActual.seccion}
//                 </span>
//                 <h2 className="text-base font-bold text-slate-800 mb-4 leading-snug">
//                   <span className="text-slate-300 mr-2 font-mono">#{itemActual.id}</span>
//                   {itemActual.pregunta}
//                 </h2>

//                 <div className="border-t border-slate-100 pt-4">
//                   <div className="flex justify-between items-center mb-3">
//                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidencias / Incidencias</h3>
//                     <button onClick={() => addEvidence(itemActual.id)}
//                       className="flex items-center gap-1 text-xs font-bold text-emerald-600 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
//                       <FaPlus size={9} /> Añadir evidencia
//                     </button>
//                   </div>

//                   <div className="space-y-3">
//                     {itemActual.evidence.map(ev => {
//                       const isCapturing = capturandoGps?.itemId === itemActual.id && capturandoGps?.entryId === ev.id;
//                       return (
//                         <div key={ev.id} className="group relative">
//                           {itemActual.evidence.length > 1 && (
//                             <button onClick={() => removeEvidence(itemActual.id, ev.id)}
//                               className="absolute -right-1 top-3 z-10 w-7 h-7 rounded-full bg-red-500 text-white shadow
//                                          flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
//                               <FaTrash size={10} />
//                             </button>
//                           )}
//                           <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
//                             <div className="grid md:grid-cols-2 gap-3">
//                               {/* Observación + GeoRef */}
//                               <div className="space-y-2">
//                                 <input type="text" placeholder="Observación..."
//                                   value={ev.observation}
//                                   onChange={e => updateObservation(itemActual.id, ev.id, e.target.value)}
//                                   className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />

//                                 {ev.geoRef ? (
//                                   <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between">
//                                     <div className="text-[11px] font-mono text-emerald-700">
//                                       <span className="font-bold">X:</span> {ev.geoRef.lat}<br/>
//                                       <span className="font-bold">Y:</span> {ev.geoRef.lon}
//                                       <span className="ml-2 text-emerald-400">±{ev.geoRef.precision}</span>
//                                     </div>
//                                     <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                       className="text-emerald-400 hover:text-emerald-600 ml-2" title="Recapturar">
//                                       <FaUndo size={10} />
//                                     </button>
//                                   </div>
//                                 ) : isCapturing ? (
//                                   <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-emerald-800 py-2.5 px-3 flex items-center gap-2.5">
//                                     <style>{`
//                                       @keyframes gs{0%{transform:translateY(-100%)}100%{transform:translateY(250%)}}
//                                       @keyframes gr{from{transform:rotate(0)}to{transform:rotate(360deg)}}
//                                       @keyframes gp{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:0;transform:scale(1.8)}}
//                                     `}</style>
//                                     <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
//                                       <div className="w-full h-6 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-500/40 border-b border-emerald-400/50"
//                                         style={{ animation: 'gs 1.3s linear infinite' }} />
//                                     </div>
//                                     <div className="relative w-6 h-6 flex-shrink-0 flex items-center justify-center">
//                                       <div className="absolute inset-0 rounded-full border border-emerald-500/40" style={{ animation: 'gp 1.8s ease-in-out infinite' }} />
//                                       <div className="absolute inset-0.5 rounded-full border-2 border-transparent border-t-emerald-400" style={{ animation: 'gr 0.75s linear infinite' }} />
//                                       <FaCrosshairs className="text-emerald-300 relative z-10 text-[9px]" />
//                                     </div>
//                                     <span className="text-emerald-300 text-[11px] font-bold animate-pulse relative z-10">Triangulando GPS...</span>
//                                     <div className="ml-auto flex items-end gap-[2px] h-4 relative z-10 flex-shrink-0">
//                                       {[0.4, 0.65, 1].map((d, i) => (
//                                         <div key={i} className="w-1 bg-emerald-400 rounded-sm"
//                                           style={{ height: `${40 + i * 25}%`, animation: `gp ${0.8 + i * 0.15}s ease-in-out infinite`, animationDelay: `${d * 0.3}s` }} />
//                                       ))}
//                                     </div>
//                                   </div>
//                                 ) : (
//                                   <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                     className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
//                                     <FaCrosshairs size={10} /> Capturar ubicación exacta
//                                   </button>
//                                 )}
//                               </div>

//                               {/* Foto */}
//                               <div className="flex flex-col gap-2">
//                                 {ev.photo ? (
//                                   <div className="relative aspect-video bg-white rounded-xl overflow-hidden border border-slate-200">
//                                     <img src={ev.photo} className="w-full h-full object-cover" alt="evidencia" />
//                                     <button
//                                       type="button"
//                                       onClick={() =>
//                                         setChecklist(prev =>
//                                           prev.map(item =>
//                                             item.id === itemActual.id
//                                               ? { ...item, evidence: item.evidence.map(e => e.id === ev.id ? { ...e, photo: null } : e) }
//                                               : item
//                                           )
//                                         )
//                                       }
//                                       className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">
//                                       <FaTrash size={9} />
//                                     </button>
//                                   </div>
//                                 ) : (
//                                   <div className="grid grid-cols-2 gap-2">
//                                     <label className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">
//                                       <FaCamera className="text-blue-400" size={16} />
//                                       <span className="text-[10px] font-bold text-blue-500">CÁMARA</span>
//                                       <input
//                                         type="file" accept="image/*" capture="environment"
//                                         className="absolute inset-0 opacity-0 cursor-pointer"
//                                         onChange={e => handlePhotoUpload(e, itemActual.id, ev.id)}
//                                         onClick={e => { (e.target as HTMLInputElement).value = ''; }}
//                                       />
//                                     </label>
//                                     <label className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
//                                       <svg className="text-slate-400" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
//                                         <rect x="3" y="3" width="18" height="18" rx="2" />
//                                         <circle cx="8.5" cy="8.5" r="1.5" />
//                                         <path d="M21 15l-5-5L5 21" />
//                                       </svg>
//                                       <span className="text-[10px] font-bold text-slate-400">GALERÍA</span>
//                                       <input
//                                         type="file" accept="image/*"
//                                         className="absolute inset-0 opacity-0 cursor-pointer"
//                                         onChange={e => handlePhotoUpload(e, itemActual.id, ev.id)}
//                                         onClick={e => { (e.target as HTMLInputElement).value = ''; }}
//                                       />
//                                     </label>
//                                   </div>
//                                 )}
//                               </div>
//                             </div>
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 </div>

//                 {/* Navegación */}
//                 <div className="flex justify-between mt-5">
//                   <button onClick={() => setPreguntaActual(p => Math.max(0, p - 1))}
//                     disabled={preguntaActual === 0}
//                     className="px-5 py-2 font-bold text-slate-400 hover:text-slate-600 disabled:opacity-30 text-sm transition-colors">
//                     ← Anterior
//                   </button>
//                   <button onClick={() => setPreguntaActual(p => Math.min(checklist.length - 1, p + 1))}
//                     disabled={preguntaActual === checklist.length - 1}
//                     className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-30">
//                     Siguiente →
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {/* ── PANEL LATERAL ─────────────────────────────── */}
//             <div className="space-y-3">
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
//                 <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
//                   <FaMapMarkedAlt className="text-orange-500" size={13} />
//                   <h3 className="font-bold text-slate-600 text-xs uppercase tracking-wide">Geo-referencias</h3>
//                   {geoRefs > 0 && (
//                     <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{geoRefs}</span>
//                   )}
//                 </div>
//                 <div ref={mapRef} className="h-48">
//                   <LeafletMap gps={gpsVista} reportes={[]} georefPins={georefPins} />
//                 </div>
//                 {geoRefs === 0 && (
//                   <p className="text-[11px] text-slate-400 text-center py-2 border-t border-slate-50">
//                     Las geo-refs aparecerán aquí
//                   </p>
//                 )}
//               </div>

//               <button onClick={procesarFormularioActual}
//                 className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm">
//                 <FaFilePdf /> Guardar y añadir a cola PDF
//               </button>
//               <button onClick={() => { if (window.confirm('¿Reiniciar formulario?')) limpiarFormulario(); }}
//                 className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors text-sm">
//                 <FaUndo size={12} /> Reiniciar
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default FormularioUnificado;














// 'use client';

// import { usePDFQueue } from '@/app/context/pdf-queue-context';
// import { mostrarOpcionesPostGuardado } from '@/app/lib/generarPDFCombinado';
// import React, { useState, useRef, useEffect, useCallback } from 'react';
// import {
//   FaCrosshairs, FaCamera, FaMapMarkedAlt,
//   FaFilePdf, FaTrash, FaUndo, FaPlus,
// } from 'react-icons/fa';
// import jsPDF from 'jspdf';
// import 'leaflet/dist/leaflet.css';
// import dynamic from 'next/dynamic';
// import autoTable from 'jspdf-autotable';
// import { crearReporte, actualizarReporte } from '@/app/lib/actions';

// const LeafletMap = dynamic(
//   () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
//   { ssr: false }
// );

// // ═══════════════════════════════════════════════════════════
// //  INTERFACES
// // ═══════════════════════════════════════════════════════════
// interface FormularioProps {
//   reportesIniciales?: any[];
//   reporteParaEditar?: any;
// }
// interface GpsCoords { lat: string | null; lon: string | null; precision: string; }
// interface GeoRef   { lat: string; lon: string; precision: string; timestamp: string; }
// interface EvidenceEntry { id: number; observation: string; geoRef: GeoRef | null; photo: string | null; }
// interface ChecklistItem {
//   id: number; seccion: string; pregunta: string; respuesta: string;
//   evidence: EvidenceEntry[];
//   // compat BD
//   observacion: string; geoRef?: GeoRef | null;
// }
// interface FormData {
//   sector: string; Tramo: string; accesoPublico: string;
//   tipoMantenimiento: string; categoria: string; subTipo: string;
// }
// interface Seccion { titulo: string; items: string[]; }

// // ═══════════════════════════════════════════════════════════
// //  CATÁLOGO UNIFICADO
// //  Estructura: CATALOGO[categoria][subTipo] = Seccion[]
// // ═══════════════════════════════════════════════════════════
// const CATALOGO: Record<string, Record<string, Seccion[]>> = {

//   // ── 1. ALUMBRADO PÚBLICO ─────────────────────────────────
//   'ALUMBRADO PÚBLICO': {
//     'Alumbrado Público Solar': [{
//       titulo: 'ALUMBRADO PÚBLICO SOLAR',
//       items: [
//         'OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?',
//         'LA FOTOCELDA ¿CUMPLE CON SU FUNCIÓN?',
//         'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'INTEGRIDAD DE LUMINARIA',
//         'ESTADO DE POSTE METÁLICO/CONCRETO',
//         'ESTADO DE BASE DE CONCRETO',
//       ],
//     }],
//     'Alumbrado Público Eléctrico': [{
//       titulo: 'ALUMBRADO PÚBLICO ELÉCTRICO',
//       items: [
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//         'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS',
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'EL BRAZO ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'INTEGRIDAD DE LUMINARIA',
//         'ESTADO DE POSTE METÁLICO/CONCRETO',
//         'ESTADO DE BASE DE CONCRETO',
//       ],
//     }],
//     'Luminaria Tipo Cerillo': [{
//       titulo: 'LUMINARIA TIPO CERILLO',
//       items: [
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'ESTADO DE BASE DE CONCRETO',
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//       ],
//     }],
//     'Luminaria Tipo Europea': [{
//       titulo: 'LUMINARIA TIPO EUROPEA',
//       items: [
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'ESTADO DE BASE DE CONCRETO',
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//         'ESTADO DEL ELEMENTO PORTADOR DE LA LUMINARIA (POSTE PIRAMIDAL PREFABRICADO)',
//       ],
//     }],
//     'Otros': [
//       {
//         titulo: '5.1 PARABUSES',
//         items: [
//           'PARABUSES',
//           '¿EL SISTEMA DE ILUMINACIÓN ENCIENDE CORRECTAMENTE?',
//           '¿LA ILUMINACIÓN SE MANTIENE ESTABLE (SIN PARPADEOS)?',
//           '¿LOS LED ALCANZAN SU BRILLO NORMAL?',
//           '¿EL TEMPORIZADOR O FOTOCELDA ACTIVA EL ENCENDIDO EN EL HORARIO ADECUADO?',
//           '¿NO HAY CABLES EXPUESTOS O DAÑADOS?',
//           '¿EL PARABÚS ESTÁ LIMPIO EN LA ZONA DEL LUMINARIO?',
//         ],
//       },
//       {
//         titulo: '6 PROYECTOR LED',
//         items: [
//           '¿EL PROYECTOR LED ENCIENDE CORRECTAMENTE?',
//           '¿EL PROYECTOR MANTIENE ILUMINACIÓN ESTABLE (SIN PARPADEOS)?',
//           '¿EL PROYECTOR ENCIENDE EN EL HORARIO CORRECTO (SI USA FOTOCELDA / TEMPORIZADOR)?',
//           '¿EL FUSIBLE Y/O INTERRUPTOR ESTÁN EN BUEN ESTADO?',
//           '¿HAY CABLES EXPUESTOS, CORTADOS O SULFATADOS?',
//           '¿LA CARCASA DEL PROYECTOR NO PRESENTA GOLPES NI DEFORMACIONES?',
//           '¿NO HAY HUMEDAD O AGUA DENTRO DEL PROYECTOR?',
//           '¿EL ÁREA ALREDEDOR ESTÁ LIBRE DE BASURA, NIDOS O INSECTOS?',
//         ],
//       },
//       {
//         titulo: '7 PROYECTOR SPOT',
//         items: [
//           '¿EL SPOT ENCIENDE CORRECTAMENTE?',
//           '¿EL SPOT MANTIENE ILUMINACIÓN ESTABLE (SIN PARPADEOS)?',
//           '¿ENCIENDE EN EL HORARIO CORRECTO (SI USA FOTOCELDA / TEMPORIZADOR)?',
//           '¿EL FUSIBLE Y/O INTERRUPTOR ESTÁN EN BUEN ESTADO?',
//           '¿HAY CABLES EXPUESTOS, CORTADOS O SULFATADOS?',
//           '¿PRESENTA GOLPES NI DEFORMACIONES?',
//           '¿HAY HUMEDAD O AGUA DENTRO DEL PROYECTOR?',
//           '¿EL ÁREA ALREDEDOR ESTÁ LIBRE DE BASURA?',
//         ],
//       },
//       {
//         titulo: '8 LUMINARIAS EMPOTRABLES FRAGATA',
//         items: [
//           '¿ENCIENDE CORRECTAMENTE?',
//           '¿ENCIENDE EN EL HORARIO CORRECTO (SI USA FOTOCELDA / TEMPORIZADOR)?',
//           '¿EL FUSIBLE Y/O INTERRUPTOR ESTÁN EN BUEN ESTADO?',
//           '¿HAY CABLES EXPUESTOS, CORTADOS O SULFATADOS?',
//           '¿EL ÁREA ALREDEDOR ESTÁ LIBRE DE BASURA?',
//         ],
//       },
//     ],
//   },

//   // ── 2. ÁREAS VERDES ──────────────────────────────────────
//   // Cada sección es un sub-tipo independiente → aparecen como tabs
//   'AREAS VERDES': {
//     '1. Poda': [{
//       titulo: '1. PODA',
//       items: [
//         '1.1 DESHIERBE – EN CAMELLÓN EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
//         '1.1 DESHIERBE – EN JARDINERA EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
//         '1.2 CAJETE – EN CAMELLÓN',
//         '1.3 CAJILLO – EN CAMELLONES CON UN ANCHO DE 10 CM Y PROFUNDIDAD DE 12 CM',
//         '1.4 DESORILLE DE ARRIATES/JARDINERA: SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
//         '1.4 DESORILLE DE CAMELLÓN ANCHO 15 CM ± 2 CM; SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
//         '1.5 PODA DE PASTO CON MAQUINARIA A UNA ALTURA PROMEDIO DE 2.5 A 5 CM',
//         '1.6 PODA DE SETOS CUANDO LA GEOMETRÍA DEL ARBUSTO YA NO ES UNIFORME (ARBUSTOS Y PLANTAS DE ORNATO) UTILIZANDO HERRAMIENTA MANUAL Y MECÁNICA',
//         '1.7 PODA DE ÁRBOLES DE 2 A 5 M DE FRONDOSIDAD Y DE 2.00 A 6.00 M DE ALTURA',
//         '1.7 PODA DE ÁRBOLES DE 5.01 M. A 10 DE FRONDOSIDAD Y DE 6.01 A 12.00 M DE ALTURA',
//         '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
//         '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
//         '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
//         '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
//       ],
//     }],
//     '2. Tala': [{
//       titulo: '2. TALA DE ÁRBOLES O PALMERAS',
//       items: [
//         'TALA, TROZA, CARGA Y RETIRO DE ÁRBOLES POR MEDIOS MANUALES BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) HASTA 5.00 M DE ALTURA',
//         'TALA, TROZA, CARGA Y RETIRO DE PALMERAS BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) DE 5.01 A 12.00 M',
//       ],
//     }],
//     '4. Escombro': [{
//       titulo: '4. ESCOMBRO',
//       items: [
//         'ÁREA LIBRE DE CONTAMINACIÓN (TIERRA/CASCAJO, LODOS, EXCRETAS, HIDROCARBUROS, ESCOMBROS)',
//       ],
//     }],
//     '5. Limpieza': [{
//       titulo: '5. LIMPIEZA ÁREAS VERDES',
//       items: [
//         'JARDINERAS/ARRIATES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
//         'CAMELLONES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
//       ],
//     }],
//     '6. Red de riego': [{
//       titulo: '6. RED DE RIEGO',
//       items: [
//         'RED DE RIEGO TAPADA, FUERA DE DIRECCIÓN O CON FUGAS',
//       ],
//     }],
//     '7. Retiro de tocones': [{
//       titulo: '7. RETIRO DE TOCONES',
//       items: [
//         'CORTE A 15 CM DEBAJO DEL NIVEL EXISTENTE DE TOCON. DE HASTA 50 CM DE DIAMETRO',
//       ],
//     }],
//     '8. Fumigación': [{
//       titulo: '8. FUMIGACIÓN',
//       items: [
//         'ESPECIE PRESENTA PLAGA',
//         'ESPECIE PRESENTA HONGO O PUDRICIÓN',
//       ],
//     }],
//   },

//   // ── 3. BARRIDO VIALIDADES ─────────────────────────────────
//   // 'BARRIDO VIALIDADES': {
//   //   'Barrido de Vialidades': [{
//   //     titulo: 'BARRIDO DE VIALIDADES',
//   //     items: [
//   //       'BARRIDO MANUAL DE VIALIDADES',
//   //       'BARRIDO MANUAL DE BANQUETAS',
//   //       'BARRIDO MANUAL DE CUNETAS',
//   //       'BARRIDO MANUAL DE ANDADORES',
//   //       'BARRIDO MANUAL DE CAMELLONES (SOLO SUPERFICIE DURA)',
//   //       'BARRIDO MANUAL EN PARQUES O PLAZOLETAS (SOLO ÁREAS DURAS)',
//   //       'BARRIDO MECÁNICO CON BARREDORA EN VIALIDADES PRINCIPALES',
//   //       'ACOPIO Y RECOLECCIÓN DEL MATERIAL PRODUCTO DEL BARRIDO EN PUNTOS DESIGNADOS',
//   //     ],
//   //   }],
//   // },

//   // ── 4. LIMPIEZA URBANA ────────────────────────────────────
//   'LIMPIEZA URBANA': {
//     'Limpieza General': [{
//       titulo: '1. LIMPIEZA GENERAL',
//       items: [
//         '1.1 BARRIDO',
//         '1.2 LAVADO DE PISO',
//         '1.4 LAVADO DE MUROS',
//       ],
//     }],
//     'Residuos y Contenedores': [{
//       titulo: 'RESIDUOS Y CONTENEDORES',
//       items: [
//         'ÁREA GENERAL LIMPIA DE BASURA VISIBLE A LO LARGO DEL TRAMO',
//         'BANQUETAS BARRIDAS Y LIBRES DE RESIDUOS SÓLIDOS',
//         'CUNETAS LIMPIAS Y SIN OBSTRUCCIONES POR RESIDUOS',
//         'ACUMULACIÓN DE BASURA EN PUNTOS CRÍTICOS (ESQUINAS, ACCESOS, MUROS)',
//         'PLAYA LIMPIA DE RESIDUOS ORGÁNICOS E INORGÁNICOS (SI APLICA)',
//         'ACCESOS A PLAYA O ZONA PÚBLICA LIBRES DE BASURA',
//         'BOTES DE BASURA VACÍOS (NO REBASADOS)',
//         'BOTES Y CONTENEDORES LIMPIOS POR DENTRO Y POR FUERA',
//         'ÁREA ALREDEDOR DEL BOTE (1 METRO) LIBRE DE RESIDUOS',
//         'LIXIVIADOS O DERRAMES ALREDEDOR DE BOTES O CONTENEDORES',
//         'RESIDUOS DISPERSOS DESPUÉS DE LA RECOLECCIÓN',
//         'PODA EN GRAL CADA 6 MESES',
//       ],
//     }],
//     'Canal Pluvial': [{
//       titulo: 'CANAL PLUVIAL',
//       items: [
//         '¿EL CANAL PLUVIAL PRESENTA OBSTRUCCIONES (BASURA, SEDIMENTOS, VEGETACIÓN, LODO, ETC.)?',
//         '¿EL CANAL PLUVIAL PRESENTA DAÑOS ESTRUCTURALES (FISURAS, DESPRENDIMIENTOS, DEFORMACIONES, SOCAVACIONES)?',
//         '¿EL AGUA PUEDE FLUIR LIBREMENTE A TRAVÉS DEL CANAL PLUVIAL?',
//         '¿LOS ACCESOS AL CANAL (TAPAS, REJILLAS, REGISTROS) ESTÁN EN BUEN ESTADO?',
//         '¿EL CANAL PLUVIAL SE ENCUENTRA EN BUENAS CONDICIONES (SIN OBSTRUCCIONES, SIN DAÑO ESTRUCTURAL Y CON FLUJO LIBRE)?',
//         'INDIQUE EL ESTADO ACTUAL DE LA REJILLA PLUVIAL (PUEDE SELECCIONAR MÁS DE UNA OPCIÓN)',
//       ],
//     }],
//   },

//   // ── 5. MOBILIARIO URBANO ──────────────────────────────────
//   // Cada sección es un sub-tipo independiente → aparecen como tabs
//   'MOBILIARIO URBANO': {
//     '1. Bacheo': [{
//       titulo: '1. BACHEO',
//       items: ['1.1 M2 DAÑADOS'],
//     }],
//     '2. Parabuses': [{
//       titulo: '2. PARABUSES',
//       items: [
//         '2.1 BANDALIZADOS',
//         '2.2 GOLPEADOS',
//         '2.3 OTRO DAÑO',
//       ],
//     }],
//     '3. Tapas de registros': [{
//       titulo: '3. TAPAS DE REGISTROS DE CONCRETO',
//       items: [
//         '3.1 ROTA',
//         '3.2 FALTANTE',
//         '3.3 OTRO DAÑO',
//         '3.4 DE CFE O TELECOMUNICACIONES (IDENTIFICAR PARA REPORTAR)',
//       ],
//     }],
//     '4. Barandales': [{
//       titulo: '4. BARANDALES',
//       items: [
//         '4.1 ACERO INOXIDABLE – TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESALINEADO O DETALLES EN EL ANCLAJE',
//         '4.2 METÁLICO – TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESALINEADO O DETALLES EN EL ANCLAJE',
//       ],
//     }],
//     '5. Señaleticas': [{
//       titulo: '5. SEÑALETICAS',
//       items: [
//         '5.1 TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESPLOME O DETALLES EN EL ANCLAJE',
//       ],
//     }],
//     '6. Balizamiento': [{
//       titulo: '6. BALIZAMIENTO',
//       items: ['6.1 M2 O ML CON BALIZAMIENTO FALTANTE – IDENTIFICAR ELEMENTO'],
//     }],
//     '7. Murales': [{
//       titulo: '7. MURALES',
//       items: ['7.1 DESCRIBIR DETALLES ENCONTRADOS'],
//     }],
//     '8. Bolardos': [{
//       titulo: '8. BOLARDOS',
//       items: ['8.1 BOLARDOS DAÑADOS – IDENTIFICAR EL TIPO DE DAÑO'],
//     }],
//     '9. Figuras lúdicas': [{
//       titulo: '9. FIGURAS LÚDICAS',
//       items: ['9.1 FIGURAS LÚDICAS – IDENTIFICAR EL TIPO DE DAÑO'],
//     }],
//     '10. Postes semáforos': [{
//       titulo: '10. POSTES SEMÁFOROS',
//       items: ['10.1 POSTES – IDENTIFICAR EL TIPO DE DAÑO'],
//     }],
//     '11. Guarnicion': [{
//       titulo: '10. guarnicion',
//       items: ['Guarnicion dañada'],
//     }],
//      '12. Banqueta': [{
//       titulo: '12. Banqueta',
//       items: ['Banqueta dañada'],
//     }],
//   },
// };

// // ── Color por categoría ────────────────────────────────────
// const CATEGORIA_COLOR: Record<string, { header: string; tab: string; badge: string }> = {
//   'ALUMBRADO PÚBLICO':  { header: 'from-yellow-600 to-yellow-700',   tab: 'bg-yellow-50  text-yellow-800',  badge: 'bg-yellow-100  text-yellow-700'  },
//   'AREAS VERDES':       { header: 'from-emerald-600 to-emerald-700', tab: 'bg-emerald-50 text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
//   'BARRIDO VIALIDADES': { header: 'from-blue-600 to-blue-700',       tab: 'bg-blue-50    text-blue-800',    badge: 'bg-blue-100    text-blue-700'    },
//   'LIMPIEZA URBANA':    { header: 'from-orange-600 to-orange-700',   tab: 'bg-orange-50  text-orange-800',  badge: 'bg-orange-100  text-orange-700'  },
//   'MOBILIARIO URBANO':  { header: 'from-purple-600 to-purple-700',   tab: 'bg-purple-50  text-purple-800',  badge: 'bg-purple-100  text-purple-700'  },
// };

// const TRAMOS_POR_SECTOR: Record<string, string[]> = {
//   'Barra de Coyuca':      ['Sendero-Seguro-Barra Coyuca'],
//   'Pie de la Cuesta':     ['Sendero-seguro-Pie de la cuesta'],
//   'Barrios Historicos':   ['Caleta-caletilla', 'Sendero-Costera-antigua', 'Corredor Zocalo-quebrada', 'Corredor zocalo-fuerte'],
//   'Acapulco Tradicional': ['Sendero-Tadeo-arredondo', 'Sendero-cinerio-hornitos', 'Michoacan', 'Av. Universidad', 'Dr. Ignacio chavez'],
//   'Acapulco Dorado':      ['Costa azul'],
//   'Las Brisas':           [''],
//   'Puerto Márquez':       ['Sendero-Puerto-Marquez'],
//   'Acapulco Diamante':    ['Av. Costera Palmas'],
//   'Otro':                 [''],
// };

// // ── Helpers ────────────────────────────────────────────────
// // Usa Date.now() como ID único — evita colisiones al borrar y re-añadir evidencias
// const emptyEntry = (): EvidenceEntry => ({ id: Date.now(), observation: '', geoRef: null, photo: null });

// const buildChecklist = (categoria: string, subTipo: string): ChecklistItem[] => {
//   const secciones = CATALOGO[categoria]?.[subTipo] ?? [];
//   let counter = 1;
//   return secciones.flatMap(sec =>
//     sec.items.map(pregunta => ({
//       id: counter++,
//       seccion: sec.titulo,
//       pregunta,
//       respuesta: '',
//       observacion: '',
//       geoRef: null,
//       evidence: [emptyEntry()],
//     }))
//   );
// };

// const CATEGORIAS = Object.keys(CATALOGO);

// // ═══════════════════════════════════════════════════════════
// //  COMPONENTE PRINCIPAL
// // ═══════════════════════════════════════════════════════════
// const FormularioUnificado: React.FC<FormularioProps> = ({ reporteParaEditar }) => {
//   const { addToQueue } = usePDFQueue();
//   const mapRef        = useRef<HTMLDivElement>(null);
//   const geoRefWatchId = useRef<number | null>(null);

//   const [currentTime,         setCurrentTime]         = useState('');
//   const [preguntaActual,      setPreguntaActual]       = useState(0);
//   const [sectorPersonalizado, setSectorPersonalizado]  = useState('');
//   const [tramoPersonalizado,  setTramoPersonalizado]   = useState('');
//   const [capturandoGps, setCapturandoGps] = useState<{ itemId: number; entryId: number } | null>(null);


//   const [gps, setGps] = useState<GpsCoords>({ 
//   lat: reporteParaEditar?.latitud ? String(reporteParaEditar.latitud) : null, 
//   lon: reporteParaEditar?.longitud ? String(reporteParaEditar.longitud) : null, 
//   precision: '--' 
// });

//   const catInicial    = reporteParaEditar?.categoria ?? 'ALUMBRADO PÚBLICO';
//   const subtiposInic  = Object.keys(CATALOGO[catInicial] ?? {});
//   const subTipoInicial = reporteParaEditar?.subTipo ?? subtiposInic[0] ?? '';

//   const [formData, setFormData] = useState<FormData>({
//     sector:            reporteParaEditar?.sector            ?? '',
//     Tramo:             reporteParaEditar?.tramo             ?? '',
//     accesoPublico:     reporteParaEditar?.acceso_publico    ?? '',
//     tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
//     categoria:         catInicial,
//     subTipo:           subTipoInicial,
//   });

//   const [checklist, setChecklist] = useState<ChecklistItem[]>(
//     buildChecklist(catInicial, subTipoInicial)
//   );

//   // ── Geo-pins para el mapa ──────────────────────────────
//   const georefPins = React.useMemo(() =>
//     checklist.flatMap(item =>
//       item.evidence.filter(ev => ev.geoRef).map((ev, ei) => ({
//         lat: ev.geoRef!.lat, lon: ev.geoRef!.lon,
//         label: item.evidence.length > 1 ? `${item.id}.${ei + 1}` : String(item.id),
//         pregunta: item.pregunta, observation: ev.observation, cumple: item.respuesta,
//       }))
//     )
//   , [checklist]);

//   const gpsVista: GpsCoords = React.useMemo(() =>
//     georefPins.length > 0
//       ? { lat: georefPins[georefPins.length - 1].lat, lon: georefPins[georefPins.length - 1].lon, precision: '--' }
//       : { lat: null, lon: null, precision: '--' }
//   , [georefPins]);

//   // ── Efectos ────────────────────────────────────────────
//   useEffect(() => {
//     const tick = () => setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
//     tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
//   }, []);

//   useEffect(() => {
//     import('leaflet').then(L => {
//       delete (L.Icon.Default.prototype as any)._getIconUrl;
//       L.Icon.Default.mergeOptions({
//         iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//         iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//         shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
//       });
//     });
//   }, []);

//   useEffect(() => {
//     return () => { if (geoRefWatchId.current !== null) navigator.geolocation.clearWatch(geoRefWatchId.current); };
//   }, []);

//   // ── Cambio de categoría ────────────────────────────────
//   const handleCategoriaChange = useCallback((nuevaCat: string) => {
//     const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
//     if (hayEvidencias && !window.confirm('Cambiar categoría borrará las evidencias actuales. ¿Continuar?')) return;
//     const subtipo = Object.keys(CATALOGO[nuevaCat] ?? {})[0] ?? '';
//     setFormData(prev => ({ ...prev, categoria: nuevaCat, subTipo: subtipo }));
//     setChecklist(buildChecklist(nuevaCat, subtipo));
//     setPreguntaActual(0);
//   }, [checklist]);

//   // ── Cambio de sub-tipo ─────────────────────────────────
//   const handleSubTipoChange = useCallback((nuevoSub: string) => {
//     const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
//     if (hayEvidencias && !window.confirm('Cambiar el tipo borrará las evidencias actuales. ¿Continuar?')) return;
//     setFormData(prev => ({ ...prev, subTipo: nuevoSub }));
//     setChecklist(buildChecklist(formData.categoria, nuevoSub));
//     setPreguntaActual(0);
//   }, [checklist, formData.categoria]);

//   // ── GPS por evidencia ──────────────────────────────────
//   // const capturarGeoRef = useCallback((itemId: number, entryId: number) => {
//   //   if (!navigator.geolocation) return alert('GPS no soportado.');
//   //   setCapturandoGps({ itemId, entryId });
//   //   geoRefWatchId.current = navigator.geolocation.watchPosition(
//   //     ({ coords: { latitude, longitude, accuracy } }) => {
//   //       const timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
//   //       setChecklist(prev => prev.map(item =>
//   //         item.id === itemId ? {
//   //           ...item,
//   //           evidence: item.evidence.map(e => e.id === entryId
//   //             ? { ...e, geoRef: { lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m`, timestamp } }
//   //             : e)
//   //         } : item
//   //       ));
//   //       if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; }
//   //       setCapturandoGps(null);
//   //     },
//   //     () => { setCapturandoGps(null); alert('No se pudo obtener la ubicación.'); },
//   //     { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
//   //   );
//   //   setTimeout(() => {
//   //     if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; setCapturandoGps(null); }
//   //   }, 12000);
//   // }, []);
//   const capturarGeoRef = useCallback((itemId: number, entryId: number) => {
//   if (!navigator.geolocation) {
//     alert('Tu dispositivo no soporta GPS. Activa la ubicación e inténtalo de nuevo.');
//     return;
//   }

//   // Limpiar watcher anterior si lo hubiera (evita race condition)
//   if (geoRefWatchId.current !== null) {
//     navigator.geolocation.clearWatch(geoRefWatchId.current);
//     geoRefWatchId.current = null;
//   }

//   setCapturandoGps({ itemId, entryId });

//   // Timer de respaldo — cancela si no hay señal en 30 s
//   const timeoutId = setTimeout(() => {
//     if (geoRefWatchId.current !== null) {
//       navigator.geolocation.clearWatch(geoRefWatchId.current);
//       geoRefWatchId.current = null;
//     }
//     setCapturandoGps(null);
//     alert(
//       'No se pudo obtener la ubicación en 30 segundos.\n\n' +
//       'Verifica que:\n' +
//       '• El GPS del teléfono esté activado\n' +
//       '• La app tenga permiso de ubicación\n' +
//       '• Estés al aire libre o con señal\n\n' +
//       'Puedes intentarlo de nuevo.'
//     );
//   }, 30_000);

//   geoRefWatchId.current = navigator.geolocation.watchPosition(
//     ({ coords: { latitude, longitude, accuracy } }) => {
//       clearTimeout(timeoutId);

//       const timestamp = new Date().toLocaleTimeString('es-MX', {
//         hour: '2-digit', minute: '2-digit', second: '2-digit',
//       });

//       setChecklist(prev =>
//         prev.map(item =>
//           item.id === itemId
//             ? {
//                 ...item,
//                 evidence: item.evidence.map(ev =>
//                   ev.id === entryId
//                     ? {
//                         ...ev,
//                         geoRef: {
//                           lat:       latitude.toFixed(6),
//                           lon:       longitude.toFixed(6),
//                           precision: `${accuracy.toFixed(1)}m`,
//                           timestamp,
//                         },
//                       }
//                     : ev
//                 ),
//               }
//             : item
//         )
//       );

//       if (geoRefWatchId.current !== null) {
//         navigator.geolocation.clearWatch(geoRefWatchId.current);
//         geoRefWatchId.current = null;
//       }
//       setCapturandoGps(null);
//     },
//     (error) => {
//       clearTimeout(timeoutId);
//       if (geoRefWatchId.current !== null) {
//         navigator.geolocation.clearWatch(geoRefWatchId.current);
//         geoRefWatchId.current = null;
//       }
//       setCapturandoGps(null);

//       const mensajes: Record<number, string> = {
//         1: 'Permiso de ubicación denegado. Ve a Ajustes > Permisos y activa la ubicación para esta app.',
//         2: 'No se pudo determinar la ubicación. Asegúrate de estar al aire libre.',
//         3: 'Tiempo de espera agotado. Intenta de nuevo en un lugar con mejor señal.',
//       };
//       alert(mensajes[error.code] ?? `Error de GPS (código ${error.code}). Intenta de nuevo.`);
//     },
//     {
//       enableHighAccuracy: true,
//       timeout:            30_000, // ✅ FIX: 30s (antes 12s) — redes móviles son lentas
//       maximumAge:         0,
//     }
//   );
// }, []);

//   // ── Efectos ────────────────────────────────────────────

// // 1. ESTE ES EL QUE TE FALTA: Cargar datos para edición
// useEffect(() => {
//   if (reporteParaEditar) {
//     // Llenamos los datos generales del formulario
//     setFormData({
//       sector: reporteParaEditar.sector || '',
//       Tramo: reporteParaEditar.tramo || '',
//       accesoPublico: reporteParaEditar.acceso_publico || '',
//       tipoMantenimiento: reporteParaEditar.tipo_mantenimiento || '',
//       categoria: reporteParaEditar.categoria || 'ALUMBRADO PÚBLICO',
//       subTipo: reporteParaEditar.sub_tipo || '',
//     });

//     // Cargamos el checklist con las evidencias ya guardadas
//     if (reporteParaEditar.checklist) {
//       setChecklist(reporteParaEditar.checklist);
//     }
    
//     // Si manejas un estado para el GPS general del reporte
//     if (reporteParaEditar.latitud && reporteParaEditar.longitud) {
//       setGps({
//         lat: String(reporteParaEditar.latitud),
//         lon: String(reporteParaEditar.longitud),
//         precision: 'Recuperado de BD'
//       });
//     }
//   }
// }, [reporteParaEditar]); // Se dispara cuando el ID de edición cambia o llega el objeto

//   // ── Evidencia helpers ──────────────────────────────────
//   const addEvidence = useCallback((itemId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: [...item.evidence, emptyEntry()] } : item
//     ));
//   }, []);

//   const removeEvidence = useCallback((itemId: number, entryId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.filter(e => e.id !== entryId) } : item
//     ));
//   }, []);

//   const updateObservation = useCallback((itemId: number, entryId: number, val: string) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, observation: val } : e) } : item
//     ));
//   }, []);

//   // const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, itemId: number, entryId: number) => {
//   //   const file = e.target.files?.[0];
//   //   if (!file) return;
//   //   const img = new Image();
//   //   img.onload = () => {
//   //     const ratio = Math.min(900 / img.width, 1);
//   //     const canvas = document.createElement('canvas');
//   //     canvas.width = img.width * ratio; canvas.height = img.height * ratio;
//   //     canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
//   //     const b64 = canvas.toDataURL('image/jpeg', 0.82);
//   //     setChecklist(prev => prev.map(item =>
//   //       item.id === itemId ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, photo: b64 } : e) } : item
//   //     ));
//   //   };
//   //   img.src = URL.createObjectURL(file);
//   // }, []);
//   const handlePhotoUpload = useCallback(
//   async (
//     e: React.ChangeEvent<HTMLInputElement>,
//     itemId: number,
//     entryId: number,
//   ) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     // Validar que sea imagen
//     if (!file.type.startsWith('image/')) {
//       alert('El archivo seleccionado no es una imagen válida.');
//       return;
//     }

//     const objectUrl = URL.createObjectURL(file);

//     try {
//       // ── Leer orientación EXIF (fotos de cámara móvil) ─────────────────
//       // En iOS/Android la foto llega rotada; el ángulo correcto está en EXIF.
//       let exifRotation = 1; // 1 = sin rotación
//       try {
//         const buffer     = await file.arrayBuffer();
//         const view       = new DataView(buffer);
//         // Solo JPEG tiene marcador SOI (0xFFD8)
//         if (view.getUint16(0) === 0xFFD8) {
//           let offset = 2;
//           while (offset < view.byteLength - 2) {
//             const marker = view.getUint16(offset);
//             offset += 2;
//             if (marker === 0xFFE1) { // APP1 = EXIF
//               const exifLen  = view.getUint16(offset);
//               const exifData = new DataView(buffer, offset + 2, exifLen - 2);
//               const littleE  = exifData.getUint16(6) === 0x4949; // 'II' = little-endian
//               const dirOffset = exifData.getUint32(10, littleE) + 6;
//               const numEntries = exifData.getUint16(dirOffset, littleE);
//               for (let i = 0; i < numEntries; i++) {
//                 const entryOffset = dirOffset + 2 + i * 12;
//                 if (exifData.getUint16(entryOffset, littleE) === 0x0112) {
//                   exifRotation = exifData.getUint16(entryOffset + 8, littleE);
//                   break;
//                 }
//               }
//               break;
//             }
//             if ((marker & 0xFF00) !== 0xFF00) break;
//             offset += view.getUint16(offset);
//           }
//         }
//       } catch { /* EXIF no disponible — continuar sin rotación */ }

//       // ── Dibujar en canvas con corrección de orientación ───────────────
//       await new Promise<void>((resolve, reject) => {
//         const img = new Image();

//         img.onerror = () => {
//           URL.revokeObjectURL(objectUrl);
//           reject(new Error('No se pudo cargar la imagen.'));
//         };

//         img.onload = () => {
//           try {
//             // Determinar si hay rotación de 90° o 270°
//             const needsSwap = exifRotation >= 5 && exifRotation <= 8;
//             const maxDim    = 1200; // px máximos — más alto que antes para mejor calidad PDF
//             const srcW      = img.width;
//             const srcH      = img.height;
//             const longSide  = Math.max(srcW, srcH);
//             const scale     = longSide > maxDim ? maxDim / longSide : 1;
//             const dstW      = Math.round((needsSwap ? srcH : srcW) * scale);
//             const dstH      = Math.round((needsSwap ? srcW : srcH) * scale);

//             const canvas = document.createElement('canvas');
//             canvas.width  = dstW;
//             canvas.height = dstH;

//             const ctx = canvas.getContext('2d');
//             if (!ctx) {
//               reject(new Error('No se pudo crear contexto de canvas.'));
//               return;
//             }

//             // Aplicar transformación EXIF
//             ctx.save();
//             ctx.translate(dstW / 2, dstH / 2);
//             switch (exifRotation) {
//               case 2: ctx.scale(-1,  1);             break;
//               case 3: ctx.rotate(Math.PI);           break;
//               case 4: ctx.scale( 1, -1);             break;
//               case 5: ctx.rotate(-Math.PI / 2); ctx.scale(-1, 1); break;
//               case 6: ctx.rotate( Math.PI / 2);      break;
//               case 7: ctx.rotate( Math.PI / 2); ctx.scale(-1, 1); break;
//               case 8: ctx.rotate(-Math.PI / 2);      break;
//               default: break; // 1 = sin transformación
//             }
//             ctx.drawImage(img, -srcW * scale / 2, -srcH * scale / 2, srcW * scale, srcH * scale);
//             ctx.restore();

//             // Exportar a JPEG (0.82 = buena calidad/tamaño)
//             const b64 = canvas.toDataURL('image/jpeg', 0.82);

//             setChecklist(prev =>
//               prev.map(item =>
//                 item.id === itemId
//                   ? {
//                       ...item,
//                       evidence: item.evidence.map(ev =>
//                         ev.id === entryId ? { ...ev, photo: b64 } : ev
//                       ),
//                     }
//                   : item
//               )
//             );
//             resolve();
//           } catch (drawErr) {
//             reject(drawErr);
//           } finally {
//             URL.revokeObjectURL(objectUrl); // ✅ FIX: limpiar memoria
//           }
//         };

//         img.src = objectUrl;
//       });
//     } catch (err) {
//       URL.revokeObjectURL(objectUrl); // asegurar limpieza en error
//       console.error('[handlePhotoUpload]', err);
//       alert('No se pudo procesar la imagen. Intenta con otra foto.');
//     }
//   },
//   [] // sin deps — solo usa setChecklist que es estable
// );

//   const limpiarFormulario = useCallback(() => {
//     setChecklist(buildChecklist(formData.categoria, formData.subTipo));
//     setPreguntaActual(0);
//   }, [formData.categoria, formData.subTipo]);

//   // ── Guardar en BD ──────────────────────────────────────
//   const guardarCuestionario = useCallback(async () => {
//     const sectorFinal = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramoFinal  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;
//     const fd = { ...formData, sector: sectorFinal, Tramo: tramoFinal };
//     const checklistDB = checklist.map(item => ({
//       ...item,
//       observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//       geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//     }));
//     const lastGeoRef = checklist.flatMap(i => i.evidence).find(e => e.geoRef)?.geoRef;
//     const gpsDB: GpsCoords = lastGeoRef
//       ? { lat: lastGeoRef.lat, lon: lastGeoRef.lon, precision: lastGeoRef.precision }
//       : { lat: null, lon: null, precision: '--' };
//     if (reporteParaEditar?.id) {
//       await actualizarReporte(reporteParaEditar.id.toString(), fd, checklistDB as any, gpsDB, {});
//       alert('¡Reporte actualizado!');
//     } else {
//       await crearReporte(fd, checklistDB as any, gpsDB, {});
//       alert('¡Reporte guardado!');
//     }
//   }, [formData, sectorPersonalizado, tramoPersonalizado, checklist, reporteParaEditar]);

//   // ── Procesar y añadir a cola ───────────────────────────
//   const procesarFormularioActual = useCallback(async () => {
//     try {
//       await guardarCuestionario();
//       addToQueue({
//         categoria: formData.categoria,
//         formData:  { ...formData },
//         checklist: checklist.map(item => ({
//           ...item,
//           observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//           geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//         })) as any,
//         gps:          gpsVista,
//         fotos:        {},
//         mapImage:     null,
//         fechaCaptura: new Date(),
//       });
//       const opcion = await mostrarOpcionesPostGuardado();
//       if (opcion === 'otro_mismo' || opcion === 'generar_ahora') limpiarFormulario();
//     } catch (err) { console.error(err); alert('Error al procesar el formulario.'); }
//   }, [addToQueue, checklist, formData, gpsVista, guardarCuestionario, limpiarFormulario]);

//   // ── PDF local rápido ───────────────────────────────────
//   const generarPDFLocal = useCallback(async () => {
//     const doc       = new jsPDF('p', 'mm', 'a4');
//     const pageW     = doc.internal.pageSize.getWidth();
//     const pageH     = doc.internal.pageSize.getHeight();
//     const margin    = 12;
//     const folio     = `REV-${formData.categoria.slice(0, 3).toUpperCase()}-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 900 + 100)}`;
//     const sector    = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramo     = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;

//     let y = 18;
//     doc.setFont('helvetica', 'bold').setFontSize(12);
//     doc.text(`REPORTE ${formData.categoria} – CIP ACAPULCO-COYUCA`, margin, y);
//     y += 4; doc.setLineWidth(0.5).line(margin, y, pageW - margin, y); y += 6;
//     doc.setFont('helvetica', 'normal').setFontSize(9);
//     doc.text(`Folio: ${folio}   Sector: ${sector}   Tramo: ${tramo}`, margin, y); y += 5;
//     doc.setFont('helvetica', 'bold').text(`Sub-tipo: ${formData.subTipo}   Mantenimiento: ${formData.tipoMantenimiento}`, margin, y);
//     doc.setFont('helvetica', 'normal'); y += 8;

//     const rows: any[] = [];
//     checklist.forEach(item => {
//       item.evidence.forEach((ev, ei) => {
//         rows.push([
//           ei === 0 ? String(item.id) : '',
//           ei === 0 ? item.pregunta   : `↳ Incidencia ${ei + 1}`,
//           ev.geoRef?.lat ?? '',
//           ev.geoRef?.lon ?? '',
//           ev.observation || '',
//           { content: '', photo: ev.photo },
//         ]);
//       });
//     });

//      let _localImgAlias = 0;
 
//     autoTable(doc, {
//       startY: y,
//       margin: { left: margin, right: margin },
//       head: [[
//         { content: 'No.',      styles: { halign: 'center' } },
//         { content: 'Concepto / Incidencia' },
//         { content: 'Lat',      styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Lon',      styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Observaciones' },
//         { content: 'Foto',     styles: { halign: 'center' } },
//       ]],
//       body: rows,
//       theme: 'grid',
//       styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle', overflow: 'linebreak', lineWidth: 0.2 },
//       headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
//       columnStyles: {
//         0: { cellWidth: 10, halign: 'center' },
//         1: { cellWidth: 62 },
//         2: { cellWidth: 22, halign: 'center', fontSize: 7 },
//         3: { cellWidth: 22, halign: 'center', fontSize: 7 },
//         4: { cellWidth: 42 },
//         5: { cellWidth: 28, halign: 'center' },
//       },
//       didDrawCell: (data: any) => {
//         if (data.section === 'body' && data.column.index === 5 && data.cell.raw?.photo) {
//           try {
//             const foto = data.cell.raw.photo as string;
//             if (typeof foto !== 'string' || !foto.startsWith('data:')) return;
//             const fmt   = foto.startsWith('data:image/png') ? 'PNG' : 'JPEG';
//             const p     = doc.getImageProperties(foto);
//             const maxW  = 24;
//             const maxH  = data.cell.height - 2;
//             const ratio = Math.min(maxW / p.width, maxH / p.height);
//             const dw    = p.width  * ratio;
//             const dh    = p.height * ratio;
//             doc.addImage(
//               foto, fmt,
//               data.cell.x + (maxW - dw) / 2 + 1,
//               data.cell.y + (data.cell.height - dh) / 2,
//               dw, dh,
//               `local_img_${_localImgAlias++}`,
//               'FAST'
//             );
//           } catch { /* imagen inválida */ }
//         }
//       },
//       rowPageBreak: 'avoid',
//     });

//     // Marca de agua
//     for (let i = 1; i <= doc.getNumberOfPages(); i++) {
//       doc.setPage(i); doc.saveGraphicsState();
//       doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
//       doc.addImage('/logo_fonatur.png', 'PNG', (pageW - 130) / 2, (pageH - 38) / 2, 130, 38);
//       doc.restoreGraphicsState();
//     }
//     doc.save(`${folio}.pdf`);
//   }, [checklist, formData, sectorPersonalizado, tramoPersonalizado]);

//   // ═══════════════════════════════════════════════════════
//   //  RENDER
//   // ═══════════════════════════════════════════════════════
//   const itemActual   = checklist[preguntaActual];
//   const subtipos     = Object.keys(CATALOGO[formData.categoria] ?? {});
//   const tieneSubtipos = subtipos.length > 1;
//   const color        = CATEGORIA_COLOR[formData.categoria] ?? CATEGORIA_COLOR['ALUMBRADO PÚBLICO'];

//   const totalItems  = checklist.length;
//   const geoRefs     = checklist.flatMap(i => i.evidence).filter(e => e.geoRef).length;
//   const fotos       = checklist.flatMap(i => i.evidence).filter(e => e.photo).length;
//   const conEvidencia = checklist.filter(i => i.evidence.some(e => e.observation || e.geoRef || e.photo)).length;

//   return (
//     <div className="min-h-screen bg-[#eef2f6] font-sans text-gray-700">
//       <div className="max-w-5xl mx-auto">

//         {/* ── HEADER con tabs de categoría ─────────────────── */}
//         <header className="bg-[#285C4D] text-white shadow-lg pt-6 px-6 flex flex-col">
//           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-5">
//             <div>
//               <h1 className="text-xl font-extrabold tracking-wide uppercase">
//                 Reporte de Mantenimiento — CIP Acapulco-Coyuca
//               </h1>
//               <p className="text-white/70 text-xs mt-0.5">Selecciona categoría y sub-tipo para cargar el cuestionario</p>
//             </div>
//             <div className="text-xs font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
//               {currentTime}
//             </div>
//           </div>

//           {/* Tabs de categoría */}
//           <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
//             {CATEGORIAS.map(cat => (
//               <button key={cat} onClick={() => handleCategoriaChange(cat)}
//                 className={`flex-shrink-0 px-3 py-2.5 rounded-t-xl font-bold text-[11px] transition-colors whitespace-nowrap ${
//                   formData.categoria === cat
//                     ? 'bg-[#eef2f6] text-gray-800'
//                     : 'bg-black/20 text-white/80 hover:bg-black/30'
//                 }`}>
//                 {cat}
//               </button>
//             ))}
//           </div>
//         </header>

//         {/* ── Sub-tipo (solo si la categoría tiene varios) ─── */}
//         {tieneSubtipos && (
//           <div className="bg-white border-b border-gray-100 px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide shadow-sm">
//             {subtipos.map(sub => (
//               <button key={sub} onClick={() => handleSubTipoChange(sub)}
//                 className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
//                   formData.subTipo === sub
//                     ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
//                     : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
//                 }`}>
//                 {sub}
//               </button>
//             ))}
//           </div>
//         )}

//         {/* ── Sub-tipo como select en mobile o categorías sin subtabs ── */}
//         {!tieneSubtipos && subtipos.length === 1 && (
//           <div className={`px-6 py-2.5 border-b border-gray-100 bg-white shadow-sm`}>
//             <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-gray-800">
//               {formData.subTipo}
//             </span>
//           </div>
//         )}

//         <div className="p-4 sm:p-5 space-y-4">

//           {/* ── DATOS GENERALES ──────────────────────────────── */}
//           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
//             <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
//               {/* Sector */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Sector</label>
//                 <select value={formData.sector}
//                   onChange={e => setFormData(prev => ({ ...prev, sector: e.target.value, Tramo: '' }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-[#e67e22] text-sm focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30">
//                   <option value="">Seleccionar</option>
//                   {Object.keys(TRAMOS_POR_SECTOR).map(s => <option key={s} value={s}>{s}</option>)}
//                 </select>
//                 {formData.sector === 'Otro' && (
//                   <input type="text" placeholder="Sector..." value={sectorPersonalizado}
//                     onChange={e => setSectorPersonalizado(e.target.value)}
//                     className="mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 )}
//               </div>

//               {/* Tramo */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tramo</label>
//                 {formData.sector === 'Otro' ? (
//                   <input type="text" placeholder="Tramo..." value={tramoPersonalizado}
//                     onChange={e => setTramoPersonalizado(e.target.value)}
//                     className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 ) : (
//                   <select value={formData.Tramo}
//                     onChange={e => setFormData(prev => ({ ...prev, Tramo: e.target.value }))}
//                     disabled={!formData.sector}
//                     className="px-3 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-50">
//                     <option value="">Seleccionar</option>
//                     {(TRAMOS_POR_SECTOR[formData.sector] || []).map(t => <option key={t} value={t}>{t}</option>)}
//                   </select>
//                 )}
//               </div>

//               {/* Acceso */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Acceso a playa</label>
//                 <input type="text" placeholder="Acceso" value={formData.accesoPublico}
//                   onChange={e => setFormData(prev => ({ ...prev, accesoPublico: e.target.value }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
//               </div>

//               {/* Tipo mantenimiento */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tipo mantenimiento</label>
//                 <select value={formData.tipoMantenimiento}
//                   onChange={e => setFormData(prev => ({ ...prev, tipoMantenimiento: e.target.value }))}
//                   className={`px-3 py-2 rounded-xl border font-bold text-sm ${
//                     formData.tipoMantenimiento === 'Urgente'
//                       ? 'bg-red-50 border-red-200 text-red-600'
//                       : 'bg-slate-50 border-slate-200 text-gray-700'
//                   }`}>
//                   <option value="">Seleccionar</option>
//                   <option value="Urgente">🚨 Urgente</option>
//                   <option value="Ordinario">📋 Ordinario</option>
//                   <option value="Programable">🗓️ Programable</option>
//                 </select>
//               </div>
//             </div>
//           </div>

//           {/* ── GRID PRINCIPAL ───────────────────────────────── */}
//           <div className="grid lg:grid-cols-3 gap-4">

//             {/* ── WIZARD (2/3) ──────────────────────────────── */}
//             <div className="lg:col-span-2 space-y-3">

//               {/* Progreso + mini-mapa */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
//                 <div className="flex justify-between items-center mb-2">
//                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{formData.subTipo}</span>
//                   <div className="flex gap-2 text-[11px]">
//                     <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-gray-700">{conEvidencia}/{totalItems} con evidencia</span>
//                     <span className="text-slate-400">📍{geoRefs} 📷{fotos}</span>
//                   </div>
//                 </div>
//                 <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
//                   <div
//                     className="h-1.5 rounded-full transition-all duration-500 bg-emerald-500"
//                     style={{ width: `${totalItems ? (conEvidencia / totalItems) * 100 : 0}%` }}
//                   />
//                 </div>
//                 {/* Mini mapa de ítems */}
//                 <div className="flex flex-wrap gap-1.5">
//                   {checklist.map((item, idx) => {
//                     const tiene = item.evidence.some(e => e.observation || e.geoRef || e.photo);
//                     return (
//                       <button key={item.id} type="button" onClick={() => setPreguntaActual(idx)}
//                         title={item.pregunta}
//                         className={`w-7 h-7 rounded-full text-[10px] font-bold transition-all border-2 ${
//                           idx === preguntaActual ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
//                         } ${tiene ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
//                         {item.id}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>

//               {/* Tarjeta de ítem */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
//                 {/* Sección badge */}
//                 <span className="inline-block text-[10px] uppercase font-black text-slate-400 tracking-widest bg-slate-100 px-3 py-1 rounded-full mb-3">
//                   {itemActual.seccion}
//                 </span>

//                 <h2 className="text-base font-bold text-slate-800 mb-4 leading-snug">
//                   <span className="text-slate-300 mr-2 font-mono">#{itemActual.id}</span>
//                   {itemActual.pregunta}
//                 </h2>

//                 {/* Evidencias */}
//                 <div className="border-t border-slate-100 pt-4">
//                   <div className="flex justify-between items-center mb-3">
//                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidencias / Incidencias</h3>
//                     <button onClick={() => addEvidence(itemActual.id)}
//                       className="flex items-center gap-1 text-xs font-bold text-emerald-600 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
//                       <FaPlus size={9} /> Añadir evidencia
//                     </button>
//                   </div>

//                   <div className="space-y-3">
//                     {itemActual.evidence.map(ev => {
//                       const isCapturing = capturandoGps?.itemId === itemActual.id && capturandoGps?.entryId === ev.id;
//                       return (
//                         <div key={ev.id} className="group relative">
//                           {itemActual.evidence.length > 1 && (
//                             <button onClick={() => removeEvidence(itemActual.id, ev.id)}
//                               className="absolute -right-1 top-3 z-10 w-7 h-7 rounded-full bg-red-500 text-white shadow
//                                          flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
//                               <FaTrash size={10} />
//                             </button>
//                           )}
//                           <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
//                             <div className="grid md:grid-cols-2 gap-3">
//                               {/* Observación + GeoRef */}
//                               <div className="space-y-2">
//                                 <input type="text" placeholder="Observación..."
//                                   value={ev.observation}
//                                   onChange={e => updateObservation(itemActual.id, ev.id, e.target.value)}
//                                   className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />

//                                 {ev.geoRef ? (
//                                   <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between">
//                                     <div className="text-[11px] font-mono text-emerald-700">
//                                       <span className="font-bold">X:</span> {ev.geoRef.lat}<br/>
//                                       <span className="font-bold">Y:</span> {ev.geoRef.lon}
//                                       <span className="ml-2 text-emerald-400">±{ev.geoRef.precision}</span>
//                                     </div>
//                                     <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                       className="text-emerald-400 hover:text-emerald-600 ml-2" title="Recapturar">
//                                       <FaUndo size={10} />
//                                     </button>
//                                   </div>
//                                 ) : isCapturing ? (
//                                   <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-emerald-800 py-2.5 px-3 flex items-center gap-2.5">
//                                     <style>{`
//                                       @keyframes gs{0%{transform:translateY(-100%)}100%{transform:translateY(250%)}}
//                                       @keyframes gr{from{transform:rotate(0)}to{transform:rotate(360deg)}}
//                                       @keyframes gp{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:0;transform:scale(1.8)}}
//                                     `}</style>
//                                     <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
//                                       <div className="w-full h-6 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-500/40 border-b border-emerald-400/50"
//                                         style={{ animation: 'gs 1.3s linear infinite' }} />
//                                     </div>
//                                     <div className="relative w-6 h-6 flex-shrink-0 flex items-center justify-center">
//                                       <div className="absolute inset-0 rounded-full border border-emerald-500/40" style={{ animation: 'gp 1.8s ease-in-out infinite' }} />
//                                       <div className="absolute inset-0.5 rounded-full border-2 border-transparent border-t-emerald-400" style={{ animation: 'gr 0.75s linear infinite' }} />
//                                       <FaCrosshairs className="text-emerald-300 relative z-10 text-[9px]" />
//                                     </div>
//                                     <span className="text-emerald-300 text-[11px] font-bold animate-pulse relative z-10">Triangulando GPS...</span>
//                                     <div className="ml-auto flex items-end gap-[2px] h-4 relative z-10 flex-shrink-0">
//                                       {[0.4, 0.65, 1].map((d, i) => (
//                                         <div key={i} className="w-1 bg-emerald-400 rounded-sm"
//                                           style={{ height: `${40 + i * 25}%`, animation: `gp ${0.8 + i * 0.15}s ease-in-out infinite`, animationDelay: `${d * 0.3}s` }} />
//                                       ))}
//                                     </div>
//                                   </div>
//                                 ) : (
//                                   <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                     className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
//                                     <FaCrosshairs size={10} /> Capturar ubicación exacta
//                                   </button>
//                                 )}
//                               </div>

//                               {/* Foto */}
//                        <div className="flex flex-col gap-2">
//     {ev.photo ? (
//       <div className="relative aspect-video bg-white rounded-xl overflow-hidden border border-slate-200">
//         <img src={ev.photo} className="w-full h-full object-cover" alt="evidencia" />
//         <button
//           type="button"
//           onClick={() =>
//             setChecklist(prev =>
//               prev.map(item =>
//                 item.id === itemActual.id
//                   ? {
//                       ...item,
//                       evidence: item.evidence.map(e =>
//                         e.id === ev.id ? { ...e, photo: null } : e
//                       ),
//                     }
//                   : item
//               )
//             )
//           }
//           className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
//         >
//           <FaTrash size={9} />
//         </button>
//       </div>
//     ) : (
//       <div className="grid grid-cols-2 gap-2">
//           {/* Botón CÁMARA — abre cámara directamente  */}
//         <label className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">
//           <FaCamera className="text-blue-400" size={16} />
//           <span className="text-[10px] font-bold text-blue-500">CÁMARA</span>
//           <input
//             type="file"
//             accept="image/*"
//             capture="environment"
//             className="absolute inset-0 opacity-0 cursor-pointer"
//             onChange={e => handlePhotoUpload(e, itemActual.id, ev.id)}
//             onClick={e => { (e.target as HTMLInputElement).value = ''; }}
//           />
//         </label>

//           {/* Botón GALERÍA — abre galería de fotos */}
//         <label className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
//           <svg className="text-slate-400" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
//             <rect x="3" y="3" width="18" height="18" rx="2" />
//             <circle cx="8.5" cy="8.5" r="1.5" />
//             <path d="M21 15l-5-5L5 21" />
//           </svg>
//           <span className="text-[10px] font-bold text-slate-400">GALERÍA</span>
//           <input
//             type="file"
//             accept="image/*"
//             className="absolute inset-0 opacity-0 cursor-pointer"
//             onChange={e => handlePhotoUpload(e, itemActual.id, ev.id)}
//             onClick={e => { (e.target as HTMLInputElement).value = ''; }}
//           />
//         </label>
//       </div>
//     )}
//   </div>
//                             </div>
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 </div>

//                 {/* Navegación */}
//                 <div className="flex justify-between mt-5">
//                   <button onClick={() => setPreguntaActual(p => Math.max(0, p - 1))}
//                     disabled={preguntaActual === 0}
//                     className="px-5 py-2 font-bold text-slate-400 hover:text-slate-600 disabled:opacity-30 text-sm transition-colors">
//                     ← Anterior
//                   </button>
//                   <button onClick={() => setPreguntaActual(p => Math.min(checklist.length - 1, p + 1))}
//                     disabled={preguntaActual === checklist.length - 1}
//                     className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-30">
//                     Siguiente →
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {/* ── PANEL LATERAL: Mapa + Acciones ───────────────── */}
//             <div className="space-y-3">
//               {/* Mapa */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
//                 <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
//                   <FaMapMarkedAlt className="text-orange-500" size={13} />
//                   <h3 className="font-bold text-slate-600 text-xs uppercase tracking-wide">Geo-referencias</h3>
//                   {geoRefs > 0 && (
//                     <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{geoRefs}</span>
//                   )}
//                 </div>
//                 <div ref={mapRef} className="h-48">
//                   <LeafletMap gps={gpsVista} reportes={[]} georefPins={georefPins} />
//                 </div>
//                 {geoRefs === 0 && (
//                   <p className="text-[11px] text-slate-400 text-center py-2 border-t border-slate-50">
//                     Las geo-refs aparecerán aquí
//                   </p>
//                 )}
//               </div>

//               {/* Acciones */}
//               <button onClick={procesarFormularioActual}
//                 className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm">
//                 <FaFilePdf /> Guardar y añadir a cola PDF
//               </button>
//               {/* <button onClick={generarPDFLocal}
//                 className="w-full py-3 bg-slate-800 text-white rounded-2xl font-bold shadow flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors text-sm">
//                 <FaFilePdf className="text-slate-400" /> Vista previa PDF
//               </button> */}
//               <button onClick={() => { if (window.confirm('¿Reiniciar formulario?')) limpiarFormulario(); }}
//                 className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors text-sm">
//                 <FaUndo size={12} /> Reiniciar
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default FormularioUnificado;













// 'use client';

// import { usePDFQueue } from '@/app/context/pdf-queue-context';
// import { mostrarOpcionesPostGuardado } from '@/app/lib/generarPDFCombinado';
// import React, { useState, useRef, useEffect, useCallback } from 'react';
// import {
//   FaCrosshairs, FaCamera, FaMapMarkedAlt,
//   FaFilePdf, FaTrash, FaUndo, FaPlus,
// } from 'react-icons/fa';
// import jsPDF from 'jspdf';
// import 'leaflet/dist/leaflet.css';
// import dynamic from 'next/dynamic';
// import autoTable from 'jspdf-autotable';
// import { crearReporte, actualizarReporte } from '@/app/lib/actions';

// const LeafletMap = dynamic(
//   () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
//   { ssr: false }
// );

// // ═══════════════════════════════════════════════════════════
// //  INTERFACES
// // ═══════════════════════════════════════════════════════════
// interface FormularioProps {
//   reportesIniciales?: any[];
//   reporteParaEditar?: any;
// }
// interface GpsCoords { lat: string | null; lon: string | null; precision: string; }
// interface GeoRef   { lat: string; lon: string; precision: string; timestamp: string; }
// interface EvidenceEntry { id: number; observation: string; geoRef: GeoRef | null; photo: string | null; }
// interface ChecklistItem {
//   id: number; seccion: string; pregunta: string; respuesta: string;
//   evidence: EvidenceEntry[];
//   // compat BD
//   observacion: string; geoRef?: GeoRef | null;
// }
// interface FormData {
//   sector: string; Tramo: string; accesoPublico: string;
//   tipoMantenimiento: string; categoria: string; subTipo: string;
// }
// interface Seccion { titulo: string; items: string[]; }

// // ═══════════════════════════════════════════════════════════
// //  CATÁLOGO UNIFICADO
// //  Estructura: CATALOGO[categoria][subTipo] = Seccion[]
// // ═══════════════════════════════════════════════════════════
// const CATALOGO: Record<string, Record<string, Seccion[]>> = {

//   // ── 1. ALUMBRADO PÚBLICO ─────────────────────────────────
//   'ALUMBRADO PÚBLICO': {
//     'Alumbrado Público Solar': [{
//       titulo: 'ALUMBRADO PÚBLICO SOLAR',
//       items: [
//         'OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?',
//         'LA FOTOCELDA ¿CUMPLE CON SU FUNCIÓN?',
//         'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'INTEGRIDAD DE LUMINARIA',
//         'ESTADO DE POSTE METÁLICO/CONCRETO',
//         'ESTADO DE BASE DE CONCRETO',
//       ],
//     }],
//     'Alumbrado Público Eléctrico': [{
//       titulo: 'ALUMBRADO PÚBLICO ELÉCTRICO',
//       items: [
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//         'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS',
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'EL BRAZO ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'INTEGRIDAD DE LUMINARIA',
//         'ESTADO DE POSTE METÁLICO/CONCRETO',
//         'ESTADO DE BASE DE CONCRETO',
//       ],
//     }],
//     'Luminaria Tipo Cerillo': [{
//       titulo: 'LUMINARIA TIPO CERILLO',
//       items: [
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'ESTADO DE BASE DE CONCRETO',
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//       ],
//     }],
//     'Luminaria Tipo Europea': [{
//       titulo: 'LUMINARIA TIPO EUROPEA',
//       items: [
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'ESTADO DE BASE DE CONCRETO',
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//         'ESTADO DEL ELEMENTO PORTADOR DE LA LUMINARIA (POSTE PIRAMIDAL PREFABRICADO)',
//       ],
//     }],
//     'Otros': [
//       {
//         titulo: '5.1 PARABUSES',
//         items: [
//           'PARABUSES',
//           '¿EL SISTEMA DE ILUMINACIÓN ENCIENDE CORRECTAMENTE?',
//           '¿LA ILUMINACIÓN SE MANTIENE ESTABLE (SIN PARPADEOS)?',
//           '¿LOS LED ALCANZAN SU BRILLO NORMAL?',
//           '¿EL TEMPORIZADOR O FOTOCELDA ACTIVA EL ENCENDIDO EN EL HORARIO ADECUADO?',
//           '¿NO HAY CABLES EXPUESTOS O DAÑADOS?',
//           '¿EL PARABÚS ESTÁ LIMPIO EN LA ZONA DEL LUMINARIO?',
//         ],
//       },
//       {
//         titulo: '6 PROYECTOR LED',
//         items: [
//           '¿EL PROYECTOR LED ENCIENDE CORRECTAMENTE?',
//           '¿EL PROYECTOR MANTIENE ILUMINACIÓN ESTABLE (SIN PARPADEOS)?',
//           '¿EL PROYECTOR ENCIENDE EN EL HORARIO CORRECTO (SI USA FOTOCELDA / TEMPORIZADOR)?',
//           '¿EL FUSIBLE Y/O INTERRUPTOR ESTÁN EN BUEN ESTADO?',
//           '¿HAY CABLES EXPUESTOS, CORTADOS O SULFATADOS?',
//           '¿LA CARCASA DEL PROYECTOR NO PRESENTA GOLPES NI DEFORMACIONES?',
//           '¿NO HAY HUMEDAD O AGUA DENTRO DEL PROYECTOR?',
//           '¿EL ÁREA ALREDEDOR ESTÁ LIBRE DE BASURA, NIDOS O INSECTOS?',
//         ],
//       },
//       {
//         titulo: '7 PROYECTOR SPOT',
//         items: [
//           '¿EL SPOT ENCIENDE CORRECTAMENTE?',
//           '¿EL SPOT MANTIENE ILUMINACIÓN ESTABLE (SIN PARPADEOS)?',
//           '¿ENCIENDE EN EL HORARIO CORRECTO (SI USA FOTOCELDA / TEMPORIZADOR)?',
//           '¿EL FUSIBLE Y/O INTERRUPTOR ESTÁN EN BUEN ESTADO?',
//           '¿HAY CABLES EXPUESTOS, CORTADOS O SULFATADOS?',
//           '¿PRESENTA GOLPES NI DEFORMACIONES?',
//           '¿HAY HUMEDAD O AGUA DENTRO DEL PROYECTOR?',
//           '¿EL ÁREA ALREDEDOR ESTÁ LIBRE DE BASURA?',
//         ],
//       },
//       {
//         titulo: '8 LUMINARIAS EMPOTRABLES FRAGATA',
//         items: [
//           '¿ENCIENDE CORRECTAMENTE?',
//           '¿ENCIENDE EN EL HORARIO CORRECTO (SI USA FOTOCELDA / TEMPORIZADOR)?',
//           '¿EL FUSIBLE Y/O INTERRUPTOR ESTÁN EN BUEN ESTADO?',
//           '¿HAY CABLES EXPUESTOS, CORTADOS O SULFATADOS?',
//           '¿EL ÁREA ALREDEDOR ESTÁ LIBRE DE BASURA?',
//         ],
//       },
//     ],
//   },

//   // ── 2. ÁREAS VERDES ──────────────────────────────────────
//   // Cada sección es un sub-tipo independiente → aparecen como tabs
//   'AREAS VERDES': {
//     '1. Poda': [{
//       titulo: '1. PODA',
//       items: [
//         '1.1 DESHIERBE – EN CAMELLÓN EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
//         '1.1 DESHIERBE – EN JARDINERA EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
//         '1.2 CAJETE – EN CAMELLÓN',
//         '1.3 CAJILLO – EN CAMELLONES CON UN ANCHO DE 10 CM Y PROFUNDIDAD DE 12 CM',
//         '1.4 DESORILLE DE ARRIATES/JARDINERA: SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
//         '1.4 DESORILLE DE CAMELLÓN ANCHO 15 CM ± 2 CM; SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
//         '1.5 PODA DE PASTO CON MAQUINARIA A UNA ALTURA PROMEDIO DE 2.5 A 5 CM',
//         '1.6 PODA DE SETOS CUANDO LA GEOMETRÍA DEL ARBUSTO YA NO ES UNIFORME (ARBUSTOS Y PLANTAS DE ORNATO) UTILIZANDO HERRAMIENTA MANUAL Y MECÁNICA',
//         '1.7 PODA DE ÁRBOLES DE 2 A 5 M DE FRONDOSIDAD Y DE 2.00 A 6.00 M DE ALTURA',
//         '1.7 PODA DE ÁRBOLES DE 5.01 M. A 10 DE FRONDOSIDAD Y DE 6.01 A 12.00 M DE ALTURA',
//         '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
//         '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
//         '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
//         '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
//       ],
//     }],
//     '2. Tala': [{
//       titulo: '2. TALA DE ÁRBOLES O PALMERAS',
//       items: [
//         'TALA, TROZA, CARGA Y RETIRO DE ÁRBOLES POR MEDIOS MANUALES BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) HASTA 5.00 M DE ALTURA',
//         'TALA, TROZA, CARGA Y RETIRO DE PALMERAS BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) DE 5.01 A 12.00 M',
//       ],
//     }],
//     '4. Escombro': [{
//       titulo: '4. ESCOMBRO',
//       items: [
//         'ÁREA LIBRE DE CONTAMINACIÓN (TIERRA/CASCAJO, LODOS, EXCRETAS, HIDROCARBUROS, ESCOMBROS)',
//       ],
//     }],
//     '5. Limpieza': [{
//       titulo: '5. LIMPIEZA ÁREAS VERDES',
//       items: [
//         'JARDINERAS/ARRIATES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
//         'CAMELLONES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
//       ],
//     }],
//     '6. Red de riego': [{
//       titulo: '6. RED DE RIEGO',
//       items: [
//         'RED DE RIEGO TAPADA, FUERA DE DIRECCIÓN O CON FUGAS',
//       ],
//     }],
//     '7. Retiro de tocones': [{
//       titulo: '7. RETIRO DE TOCONES',
//       items: [
//         'CORTE A 15 CM DEBAJO DEL NIVEL EXISTENTE DE TOCON. DE HASTA 50 CM DE DIAMETRO',
//       ],
//     }],
//     '8. Fumigación': [{
//       titulo: '8. FUMIGACIÓN',
//       items: [
//         'ESPECIE PRESENTA PLAGA',
//         'ESPECIE PRESENTA HONGO O PUDRICIÓN',
//       ],
//     }],
//   },

//   // ── 3. BARRIDO VIALIDADES ─────────────────────────────────
//   // 'BARRIDO VIALIDADES': {
//   //   'Barrido de Vialidades': [{
//   //     titulo: 'BARRIDO DE VIALIDADES',
//   //     items: [
//   //       'BARRIDO MANUAL DE VIALIDADES',
//   //       'BARRIDO MANUAL DE BANQUETAS',
//   //       'BARRIDO MANUAL DE CUNETAS',
//   //       'BARRIDO MANUAL DE ANDADORES',
//   //       'BARRIDO MANUAL DE CAMELLONES (SOLO SUPERFICIE DURA)',
//   //       'BARRIDO MANUAL EN PARQUES O PLAZOLETAS (SOLO ÁREAS DURAS)',
//   //       'BARRIDO MECÁNICO CON BARREDORA EN VIALIDADES PRINCIPALES',
//   //       'ACOPIO Y RECOLECCIÓN DEL MATERIAL PRODUCTO DEL BARRIDO EN PUNTOS DESIGNADOS',
//   //     ],
//   //   }],
//   // },

//   // ── 4. LIMPIEZA URBANA ────────────────────────────────────
//   'LIMPIEZA URBANA': {
//     'Limpieza General': [{
//       titulo: '1. LIMPIEZA GENERAL',
//       items: [
//         '1.1 BARRIDO',
//         '1.2 LAVADO DE PISO',
//         '1.4 LAVADO DE MUROS',
//       ],
//     }],
//     'Residuos y Contenedores': [{
//       titulo: 'RESIDUOS Y CONTENEDORES',
//       items: [
//         'ÁREA GENERAL LIMPIA DE BASURA VISIBLE A LO LARGO DEL TRAMO',
//         'BANQUETAS BARRIDAS Y LIBRES DE RESIDUOS SÓLIDOS',
//         'CUNETAS LIMPIAS Y SIN OBSTRUCCIONES POR RESIDUOS',
//         'ACUMULACIÓN DE BASURA EN PUNTOS CRÍTICOS (ESQUINAS, ACCESOS, MUROS)',
//         'PLAYA LIMPIA DE RESIDUOS ORGÁNICOS E INORGÁNICOS (SI APLICA)',
//         'ACCESOS A PLAYA O ZONA PÚBLICA LIBRES DE BASURA',
//         'BOTES DE BASURA VACÍOS (NO REBASADOS)',
//         'BOTES Y CONTENEDORES LIMPIOS POR DENTRO Y POR FUERA',
//         'ÁREA ALREDEDOR DEL BOTE (1 METRO) LIBRE DE RESIDUOS',
//         'LIXIVIADOS O DERRAMES ALREDEDOR DE BOTES O CONTENEDORES',
//         'RESIDUOS DISPERSOS DESPUÉS DE LA RECOLECCIÓN',
//         'PODA EN GRAL CADA 6 MESES',
//       ],
//     }],
//     'Canal Pluvial': [{
//       titulo: 'CANAL PLUVIAL',
//       items: [
//         '¿EL CANAL PLUVIAL PRESENTA OBSTRUCCIONES (BASURA, SEDIMENTOS, VEGETACIÓN, LODO, ETC.)?',
//         '¿EL CANAL PLUVIAL PRESENTA DAÑOS ESTRUCTURALES (FISURAS, DESPRENDIMIENTOS, DEFORMACIONES, SOCAVACIONES)?',
//         '¿EL AGUA PUEDE FLUIR LIBREMENTE A TRAVÉS DEL CANAL PLUVIAL?',
//         '¿LOS ACCESOS AL CANAL (TAPAS, REJILLAS, REGISTROS) ESTÁN EN BUEN ESTADO?',
//         '¿EL CANAL PLUVIAL SE ENCUENTRA EN BUENAS CONDICIONES (SIN OBSTRUCCIONES, SIN DAÑO ESTRUCTURAL Y CON FLUJO LIBRE)?',
//         'INDIQUE EL ESTADO ACTUAL DE LA REJILLA PLUVIAL (PUEDE SELECCIONAR MÁS DE UNA OPCIÓN)',
//       ],
//     }],
//   },

//   // ── 5. MOBILIARIO URBANO ──────────────────────────────────
//   // Cada sección es un sub-tipo independiente → aparecen como tabs
//   'MOBILIARIO URBANO': {
//     '1. Bacheo': [{
//       titulo: '1. BACHEO',
//       items: ['1.1 M2 DAÑADOS'],
//     }],
//     '2. Parabuses': [{
//       titulo: '2. PARABUSES',
//       items: [
//         '2.1 BANDALIZADOS',
//         '2.2 GOLPEADOS',
//         '2.3 OTRO DAÑO',
//       ],
//     }],
//     '3. Tapas de registros': [{
//       titulo: '3. TAPAS DE REGISTROS DE CONCRETO',
//       items: [
//         '3.1 ROTA',
//         '3.2 FALTANTE',
//         '3.3 OTRO DAÑO',
//         '3.4 DE CFE O TELECOMUNICACIONES (IDENTIFICAR PARA REPORTAR)',
//       ],
//     }],
//     '4. Barandales': [{
//       titulo: '4. BARANDALES',
//       items: [
//         '4.1 ACERO INOXIDABLE – TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESALINEADO O DETALLES EN EL ANCLAJE',
//         '4.2 METÁLICO – TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESALINEADO O DETALLES EN EL ANCLAJE',
//       ],
//     }],
//     '5. Señaleticas': [{
//       titulo: '5. SEÑALETICAS',
//       items: [
//         '5.1 TIENE DETALLES EN SU ESTADO GENERAL, CORROSIÓN, DEFORMACIONES, DESPLOME O DETALLES EN EL ANCLAJE',
//       ],
//     }],
//     '6. Balizamiento': [{
//       titulo: '6. BALIZAMIENTO',
//       items: ['6.1 M2 O ML CON BALIZAMIENTO FALTANTE – IDENTIFICAR ELEMENTO'],
//     }],
//     '7. Murales': [{
//       titulo: '7. MURALES',
//       items: ['7.1 DESCRIBIR DETALLES ENCONTRADOS'],
//     }],
//     '8. Bolardos': [{
//       titulo: '8. BOLARDOS',
//       items: ['8.1 BOLARDOS DAÑADOS – IDENTIFICAR EL TIPO DE DAÑO'],
//     }],
//     '9. Figuras lúdicas': [{
//       titulo: '9. FIGURAS LÚDICAS',
//       items: ['9.1 FIGURAS LÚDICAS – IDENTIFICAR EL TIPO DE DAÑO'],
//     }],
//     '10. Postes semáforos': [{
//       titulo: '10. POSTES SEMÁFOROS',
//       items: ['10.1 POSTES – IDENTIFICAR EL TIPO DE DAÑO'],
//     }],
//   },
// };

// // ── Color por categoría ────────────────────────────────────
// const CATEGORIA_COLOR: Record<string, { header: string; tab: string; badge: string }> = {
//   'ALUMBRADO PÚBLICO':  { header: 'from-yellow-600 to-yellow-700',   tab: 'bg-yellow-50  text-yellow-800',  badge: 'bg-yellow-100  text-yellow-700'  },
//   'AREAS VERDES':       { header: 'from-emerald-600 to-emerald-700', tab: 'bg-emerald-50 text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
//   'BARRIDO VIALIDADES': { header: 'from-blue-600 to-blue-700',       tab: 'bg-blue-50    text-blue-800',    badge: 'bg-blue-100    text-blue-700'    },
//   'LIMPIEZA URBANA':    { header: 'from-orange-600 to-orange-700',   tab: 'bg-orange-50  text-orange-800',  badge: 'bg-orange-100  text-orange-700'  },
//   'MOBILIARIO URBANO':  { header: 'from-purple-600 to-purple-700',   tab: 'bg-purple-50  text-purple-800',  badge: 'bg-purple-100  text-purple-700'  },
// };

// const TRAMOS_POR_SECTOR: Record<string, string[]> = {
//   'Barra de Coyuca':      ['Sendero-Seguro-Barra Coyuca'],
//   'Pie de la Cuesta':     ['Sendero-seguro-Pie de la cuesta'],
//   'Barrios Historicos':   ['Caleta-caletilla', 'Sendero-Costera-antigua', 'Corredor Zocalo-quebrada', 'Corredor zocalo-fuerte'],
//   'Acapulco Tradicional': ['Sendero-Tadeo-arredondo', 'Sendero-cinerio-hornitos', 'Michoacan', 'Av. Universidad', 'Dr. Ignacio chavez'],
//   'Acapulco Dorado':      ['Costa azul'],
//   'Las Brisas':           [''],
//   'Puerto Márquez':       ['Sendero-Puerto-Marquez'],
//   'Acapulco Diamante':    ['Av. Costera Palmas'],
//   'Otro':                 [''],
// };

// // ── Helpers ────────────────────────────────────────────────
// // Usa Date.now() como ID único — evita colisiones al borrar y re-añadir evidencias
// const emptyEntry = (): EvidenceEntry => ({ id: Date.now(), observation: '', geoRef: null, photo: null });

// const buildChecklist = (categoria: string, subTipo: string): ChecklistItem[] => {
//   const secciones = CATALOGO[categoria]?.[subTipo] ?? [];
//   let counter = 1;
//   return secciones.flatMap(sec =>
//     sec.items.map(pregunta => ({
//       id: counter++,
//       seccion: sec.titulo,
//       pregunta,
//       respuesta: '',
//       observacion: '',
//       geoRef: null,
//       evidence: [emptyEntry()],
//     }))
//   );
// };

// const CATEGORIAS = Object.keys(CATALOGO);

// // ═══════════════════════════════════════════════════════════
// //  COMPONENTE PRINCIPAL
// // ═══════════════════════════════════════════════════════════
// const FormularioUnificado: React.FC<FormularioProps> = ({ reporteParaEditar }) => {
//   const { addToQueue } = usePDFQueue();
//   const mapRef        = useRef<HTMLDivElement>(null);
//   const geoRefWatchId = useRef<number | null>(null);

//   const [currentTime,         setCurrentTime]         = useState('');
//   const [preguntaActual,      setPreguntaActual]       = useState(0);
//   const [sectorPersonalizado, setSectorPersonalizado]  = useState('');
//   const [tramoPersonalizado,  setTramoPersonalizado]   = useState('');
//   const [capturandoGps, setCapturandoGps] = useState<{ itemId: number; entryId: number } | null>(null);


//   const [gps, setGps] = useState<GpsCoords>({ 
//   lat: reporteParaEditar?.latitud ? String(reporteParaEditar.latitud) : null, 
//   lon: reporteParaEditar?.longitud ? String(reporteParaEditar.longitud) : null, 
//   precision: '--' 
// });

//   const catInicial    = reporteParaEditar?.categoria ?? 'ALUMBRADO PÚBLICO';
//   const subtiposInic  = Object.keys(CATALOGO[catInicial] ?? {});
//   const subTipoInicial = reporteParaEditar?.subTipo ?? subtiposInic[0] ?? '';

//   const [formData, setFormData] = useState<FormData>({
//     sector:            reporteParaEditar?.sector            ?? '',
//     Tramo:             reporteParaEditar?.tramo             ?? '',
//     accesoPublico:     reporteParaEditar?.acceso_publico    ?? '',
//     tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
//     categoria:         catInicial,
//     subTipo:           subTipoInicial,
//   });

//   const [checklist, setChecklist] = useState<ChecklistItem[]>(
//     buildChecklist(catInicial, subTipoInicial)
//   );

//   // ── Geo-pins para el mapa ──────────────────────────────
//   const georefPins = React.useMemo(() =>
//     checklist.flatMap(item =>
//       item.evidence.filter(ev => ev.geoRef).map((ev, ei) => ({
//         lat: ev.geoRef!.lat, lon: ev.geoRef!.lon,
//         label: item.evidence.length > 1 ? `${item.id}.${ei + 1}` : String(item.id),
//         pregunta: item.pregunta, observation: ev.observation, cumple: item.respuesta,
//       }))
//     )
//   , [checklist]);

//   const gpsVista: GpsCoords = React.useMemo(() =>
//     georefPins.length > 0
//       ? { lat: georefPins[georefPins.length - 1].lat, lon: georefPins[georefPins.length - 1].lon, precision: '--' }
//       : { lat: null, lon: null, precision: '--' }
//   , [georefPins]);

//   // ── Efectos ────────────────────────────────────────────
//   useEffect(() => {
//     const tick = () => setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
//     tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
//   }, []);

//   useEffect(() => {
//     import('leaflet').then(L => {
//       delete (L.Icon.Default.prototype as any)._getIconUrl;
//       L.Icon.Default.mergeOptions({
//         iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//         iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//         shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
//       });
//     });
//   }, []);

//   useEffect(() => {
//     return () => { if (geoRefWatchId.current !== null) navigator.geolocation.clearWatch(geoRefWatchId.current); };
//   }, []);

//   // ── Cambio de categoría ────────────────────────────────
//   const handleCategoriaChange = useCallback((nuevaCat: string) => {
//     const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
//     if (hayEvidencias && !window.confirm('Cambiar categoría borrará las evidencias actuales. ¿Continuar?')) return;
//     const subtipo = Object.keys(CATALOGO[nuevaCat] ?? {})[0] ?? '';
//     setFormData(prev => ({ ...prev, categoria: nuevaCat, subTipo: subtipo }));
//     setChecklist(buildChecklist(nuevaCat, subtipo));
//     setPreguntaActual(0);
//   }, [checklist]);

//   // ── Cambio de sub-tipo ─────────────────────────────────
//   const handleSubTipoChange = useCallback((nuevoSub: string) => {
//     const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
//     if (hayEvidencias && !window.confirm('Cambiar el tipo borrará las evidencias actuales. ¿Continuar?')) return;
//     setFormData(prev => ({ ...prev, subTipo: nuevoSub }));
//     setChecklist(buildChecklist(formData.categoria, nuevoSub));
//     setPreguntaActual(0);
//   }, [checklist, formData.categoria]);

//   // ── GPS por evidencia ──────────────────────────────────
//   // const capturarGeoRef = useCallback((itemId: number, entryId: number) => {
//   //   if (!navigator.geolocation) return alert('GPS no soportado.');
//   //   setCapturandoGps({ itemId, entryId });
//   //   geoRefWatchId.current = navigator.geolocation.watchPosition(
//   //     ({ coords: { latitude, longitude, accuracy } }) => {
//   //       const timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
//   //       setChecklist(prev => prev.map(item =>
//   //         item.id === itemId ? {
//   //           ...item,
//   //           evidence: item.evidence.map(e => e.id === entryId
//   //             ? { ...e, geoRef: { lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m`, timestamp } }
//   //             : e)
//   //         } : item
//   //       ));
//   //       if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; }
//   //       setCapturandoGps(null);
//   //     },
//   //     () => { setCapturandoGps(null); alert('No se pudo obtener la ubicación.'); },
//   //     { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
//   //   );
//   //   setTimeout(() => {
//   //     if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; setCapturandoGps(null); }
//   //   }, 12000);
//   // }, []);
//   const capturarGeoRef = useCallback((itemId: number, entryId: number) => {
//   if (!navigator.geolocation) {
//     alert('Tu dispositivo no soporta GPS. Activa la ubicación e inténtalo de nuevo.');
//     return;
//   }

//   // Limpiar watcher anterior si lo hubiera (evita race condition)
//   if (geoRefWatchId.current !== null) {
//     navigator.geolocation.clearWatch(geoRefWatchId.current);
//     geoRefWatchId.current = null;
//   }

//   setCapturandoGps({ itemId, entryId });

//   // Timer de respaldo — cancela si no hay señal en 30 s
//   const timeoutId = setTimeout(() => {
//     if (geoRefWatchId.current !== null) {
//       navigator.geolocation.clearWatch(geoRefWatchId.current);
//       geoRefWatchId.current = null;
//     }
//     setCapturandoGps(null);
//     alert(
//       'No se pudo obtener la ubicación en 30 segundos.\n\n' +
//       'Verifica que:\n' +
//       '• El GPS del teléfono esté activado\n' +
//       '• La app tenga permiso de ubicación\n' +
//       '• Estés al aire libre o con señal\n\n' +
//       'Puedes intentarlo de nuevo.'
//     );
//   }, 30_000);

//   geoRefWatchId.current = navigator.geolocation.watchPosition(
//     ({ coords: { latitude, longitude, accuracy } }) => {
//       clearTimeout(timeoutId);

//       const timestamp = new Date().toLocaleTimeString('es-MX', {
//         hour: '2-digit', minute: '2-digit', second: '2-digit',
//       });

//       setChecklist(prev =>
//         prev.map(item =>
//           item.id === itemId
//             ? {
//                 ...item,
//                 evidence: item.evidence.map(ev =>
//                   ev.id === entryId
//                     ? {
//                         ...ev,
//                         geoRef: {
//                           lat:       latitude.toFixed(6),
//                           lon:       longitude.toFixed(6),
//                           precision: `${accuracy.toFixed(1)}m`,
//                           timestamp,
//                         },
//                       }
//                     : ev
//                 ),
//               }
//             : item
//         )
//       );

//       if (geoRefWatchId.current !== null) {
//         navigator.geolocation.clearWatch(geoRefWatchId.current);
//         geoRefWatchId.current = null;
//       }
//       setCapturandoGps(null);
//     },
//     (error) => {
//       clearTimeout(timeoutId);
//       if (geoRefWatchId.current !== null) {
//         navigator.geolocation.clearWatch(geoRefWatchId.current);
//         geoRefWatchId.current = null;
//       }
//       setCapturandoGps(null);

//       const mensajes: Record<number, string> = {
//         1: 'Permiso de ubicación denegado. Ve a Ajustes > Permisos y activa la ubicación para esta app.',
//         2: 'No se pudo determinar la ubicación. Asegúrate de estar al aire libre.',
//         3: 'Tiempo de espera agotado. Intenta de nuevo en un lugar con mejor señal.',
//       };
//       alert(mensajes[error.code] ?? `Error de GPS (código ${error.code}). Intenta de nuevo.`);
//     },
//     {
//       enableHighAccuracy: true,
//       timeout:            30_000, // ✅ FIX: 30s (antes 12s) — redes móviles son lentas
//       maximumAge:         0,
//     }
//   );
// }, []);

//   // ── Efectos ────────────────────────────────────────────

// // 1. ESTE ES EL QUE TE FALTA: Cargar datos para edición
// useEffect(() => {
//   if (reporteParaEditar) {
//     // Llenamos los datos generales del formulario
//     setFormData({
//       sector: reporteParaEditar.sector || '',
//       Tramo: reporteParaEditar.tramo || '',
//       accesoPublico: reporteParaEditar.acceso_publico || '',
//       tipoMantenimiento: reporteParaEditar.tipo_mantenimiento || '',
//       categoria: reporteParaEditar.categoria || 'ALUMBRADO PÚBLICO',
//       subTipo: reporteParaEditar.sub_tipo || '',
//     });

//     // Cargamos el checklist con las evidencias ya guardadas
//     if (reporteParaEditar.checklist) {
//       setChecklist(reporteParaEditar.checklist);
//     }
    
//     // Si manejas un estado para el GPS general del reporte
//     if (reporteParaEditar.latitud && reporteParaEditar.longitud) {
//       setGps({
//         lat: String(reporteParaEditar.latitud),
//         lon: String(reporteParaEditar.longitud),
//         precision: 'Recuperado de BD'
//       });
//     }
//   }
// }, [reporteParaEditar]); // Se dispara cuando el ID de edición cambia o llega el objeto

//   // ── Evidencia helpers ──────────────────────────────────
//   const addEvidence = useCallback((itemId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: [...item.evidence, emptyEntry()] } : item
//     ));
//   }, []);

//   const removeEvidence = useCallback((itemId: number, entryId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.filter(e => e.id !== entryId) } : item
//     ));
//   }, []);

//   const updateObservation = useCallback((itemId: number, entryId: number, val: string) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, observation: val } : e) } : item
//     ));
//   }, []);

//   // const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, itemId: number, entryId: number) => {
//   //   const file = e.target.files?.[0];
//   //   if (!file) return;
//   //   const img = new Image();
//   //   img.onload = () => {
//   //     const ratio = Math.min(900 / img.width, 1);
//   //     const canvas = document.createElement('canvas');
//   //     canvas.width = img.width * ratio; canvas.height = img.height * ratio;
//   //     canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
//   //     const b64 = canvas.toDataURL('image/jpeg', 0.82);
//   //     setChecklist(prev => prev.map(item =>
//   //       item.id === itemId ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, photo: b64 } : e) } : item
//   //     ));
//   //   };
//   //   img.src = URL.createObjectURL(file);
//   // }, []);
//   const handlePhotoUpload = useCallback(
//   async (
//     e: React.ChangeEvent<HTMLInputElement>,
//     itemId: number,
//     entryId: number,
//   ) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     // Validar que sea imagen
//     if (!file.type.startsWith('image/')) {
//       alert('El archivo seleccionado no es una imagen válida.');
//       return;
//     }

//     const objectUrl = URL.createObjectURL(file);

//     try {
//       // ── Leer orientación EXIF (fotos de cámara móvil) ─────────────────
//       // En iOS/Android la foto llega rotada; el ángulo correcto está en EXIF.
//       let exifRotation = 1; // 1 = sin rotación
//       try {
//         const buffer     = await file.arrayBuffer();
//         const view       = new DataView(buffer);
//         // Solo JPEG tiene marcador SOI (0xFFD8)
//         if (view.getUint16(0) === 0xFFD8) {
//           let offset = 2;
//           while (offset < view.byteLength - 2) {
//             const marker = view.getUint16(offset);
//             offset += 2;
//             if (marker === 0xFFE1) { // APP1 = EXIF
//               const exifLen  = view.getUint16(offset);
//               const exifData = new DataView(buffer, offset + 2, exifLen - 2);
//               const littleE  = exifData.getUint16(6) === 0x4949; // 'II' = little-endian
//               const dirOffset = exifData.getUint32(10, littleE) + 6;
//               const numEntries = exifData.getUint16(dirOffset, littleE);
//               for (let i = 0; i < numEntries; i++) {
//                 const entryOffset = dirOffset + 2 + i * 12;
//                 if (exifData.getUint16(entryOffset, littleE) === 0x0112) {
//                   exifRotation = exifData.getUint16(entryOffset + 8, littleE);
//                   break;
//                 }
//               }
//               break;
//             }
//             if ((marker & 0xFF00) !== 0xFF00) break;
//             offset += view.getUint16(offset);
//           }
//         }
//       } catch { /* EXIF no disponible — continuar sin rotación */ }

//       // ── Dibujar en canvas con corrección de orientación ───────────────
//       await new Promise<void>((resolve, reject) => {
//         const img = new Image();

//         img.onerror = () => {
//           URL.revokeObjectURL(objectUrl);
//           reject(new Error('No se pudo cargar la imagen.'));
//         };

//         img.onload = () => {
//           try {
//             // Determinar si hay rotación de 90° o 270°
//             const needsSwap = exifRotation >= 5 && exifRotation <= 8;
//             const maxDim    = 1200; // px máximos — más alto que antes para mejor calidad PDF
//             const srcW      = img.width;
//             const srcH      = img.height;
//             const longSide  = Math.max(srcW, srcH);
//             const scale     = longSide > maxDim ? maxDim / longSide : 1;
//             const dstW      = Math.round((needsSwap ? srcH : srcW) * scale);
//             const dstH      = Math.round((needsSwap ? srcW : srcH) * scale);

//             const canvas = document.createElement('canvas');
//             canvas.width  = dstW;
//             canvas.height = dstH;

//             const ctx = canvas.getContext('2d');
//             if (!ctx) {
//               reject(new Error('No se pudo crear contexto de canvas.'));
//               return;
//             }

//             // Aplicar transformación EXIF
//             ctx.save();
//             ctx.translate(dstW / 2, dstH / 2);
//             switch (exifRotation) {
//               case 2: ctx.scale(-1,  1);             break;
//               case 3: ctx.rotate(Math.PI);           break;
//               case 4: ctx.scale( 1, -1);             break;
//               case 5: ctx.rotate(-Math.PI / 2); ctx.scale(-1, 1); break;
//               case 6: ctx.rotate( Math.PI / 2);      break;
//               case 7: ctx.rotate( Math.PI / 2); ctx.scale(-1, 1); break;
//               case 8: ctx.rotate(-Math.PI / 2);      break;
//               default: break; // 1 = sin transformación
//             }
//             ctx.drawImage(img, -srcW * scale / 2, -srcH * scale / 2, srcW * scale, srcH * scale);
//             ctx.restore();

//             // Exportar a JPEG (0.82 = buena calidad/tamaño)
//             const b64 = canvas.toDataURL('image/jpeg', 0.82);

//             setChecklist(prev =>
//               prev.map(item =>
//                 item.id === itemId
//                   ? {
//                       ...item,
//                       evidence: item.evidence.map(ev =>
//                         ev.id === entryId ? { ...ev, photo: b64 } : ev
//                       ),
//                     }
//                   : item
//               )
//             );
//             resolve();
//           } catch (drawErr) {
//             reject(drawErr);
//           } finally {
//             URL.revokeObjectURL(objectUrl); // ✅ FIX: limpiar memoria
//           }
//         };

//         img.src = objectUrl;
//       });
//     } catch (err) {
//       URL.revokeObjectURL(objectUrl); // asegurar limpieza en error
//       console.error('[handlePhotoUpload]', err);
//       alert('No se pudo procesar la imagen. Intenta con otra foto.');
//     }
//   },
//   [] // sin deps — solo usa setChecklist que es estable
// );

//   const limpiarFormulario = useCallback(() => {
//     setChecklist(buildChecklist(formData.categoria, formData.subTipo));
//     setPreguntaActual(0);
//   }, [formData.categoria, formData.subTipo]);

//   // ── Guardar en BD ──────────────────────────────────────
//   const guardarCuestionario = useCallback(async () => {
//     const sectorFinal = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramoFinal  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;
//     const fd = { ...formData, sector: sectorFinal, Tramo: tramoFinal };
//     const checklistDB = checklist.map(item => ({
//       ...item,
//       observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//       geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//     }));
//     const lastGeoRef = checklist.flatMap(i => i.evidence).find(e => e.geoRef)?.geoRef;
//     const gpsDB: GpsCoords = lastGeoRef
//       ? { lat: lastGeoRef.lat, lon: lastGeoRef.lon, precision: lastGeoRef.precision }
//       : { lat: null, lon: null, precision: '--' };
//     if (reporteParaEditar?.id) {
//       await actualizarReporte(reporteParaEditar.id.toString(), fd, checklistDB as any, gpsDB, {});
//       alert('¡Reporte actualizado!');
//     } else {
//       await crearReporte(fd, checklistDB as any, gpsDB, {});
//       alert('¡Reporte guardado!');
//     }
//   }, [formData, sectorPersonalizado, tramoPersonalizado, checklist, reporteParaEditar]);

//   // ── Procesar y añadir a cola ───────────────────────────
//   const procesarFormularioActual = useCallback(async () => {
//     try {
//       await guardarCuestionario();
//       addToQueue({
//         categoria: formData.categoria,
//         formData:  { ...formData },
//         checklist: checklist.map(item => ({
//           ...item,
//           observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//           geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//         })) as any,
//         gps:          gpsVista,
//         fotos:        {},
//         mapImage:     null,
//         fechaCaptura: new Date(),
//       });
//       const opcion = await mostrarOpcionesPostGuardado();
//       if (opcion === 'otro_mismo' || opcion === 'generar_ahora') limpiarFormulario();
//     } catch (err) { console.error(err); alert('Error al procesar el formulario.'); }
//   }, [addToQueue, checklist, formData, gpsVista, guardarCuestionario, limpiarFormulario]);

//   // ── PDF local rápido ───────────────────────────────────
//   const generarPDFLocal = useCallback(async () => {
//     const doc       = new jsPDF('p', 'mm', 'a4');
//     const pageW     = doc.internal.pageSize.getWidth();
//     const pageH     = doc.internal.pageSize.getHeight();
//     const margin    = 12;
//     const folio     = `REV-${formData.categoria.slice(0, 3).toUpperCase()}-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 900 + 100)}`;
//     const sector    = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramo     = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;

//     let y = 18;
//     doc.setFont('helvetica', 'bold').setFontSize(12);
//     doc.text(`REPORTE ${formData.categoria} – CIP ACAPULCO-COYUCA`, margin, y);
//     y += 4; doc.setLineWidth(0.5).line(margin, y, pageW - margin, y); y += 6;
//     doc.setFont('helvetica', 'normal').setFontSize(9);
//     doc.text(`Folio: ${folio}   Sector: ${sector}   Tramo: ${tramo}`, margin, y); y += 5;
//     doc.setFont('helvetica', 'bold').text(`Sub-tipo: ${formData.subTipo}   Mantenimiento: ${formData.tipoMantenimiento}`, margin, y);
//     doc.setFont('helvetica', 'normal'); y += 8;

//     const rows: any[] = [];
//     checklist.forEach(item => {
//       item.evidence.forEach((ev, ei) => {
//         rows.push([
//           ei === 0 ? String(item.id) : '',
//           ei === 0 ? item.pregunta   : `↳ Incidencia ${ei + 1}`,
//           ev.geoRef?.lat ?? '',
//           ev.geoRef?.lon ?? '',
//           ev.observation || '',
//           { content: '', photo: ev.photo },
//         ]);
//       });
//     });

//     autoTable(doc, {
//       startY: y,
//       margin: { left: margin, right: margin },
//       head: [[
//         { content: 'No.',      styles: { halign: 'center' } },
//         { content: 'Concepto / Incidencia' },
//         { content: 'Lat',      styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Lon',      styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Observaciones' },
//         { content: 'Foto',     styles: { halign: 'center' } },
//       ]],
//       body: rows,
//       theme: 'grid',
//       styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle', overflow: 'linebreak', lineWidth: 0.2 },
//       headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
//       columnStyles: {
//         0: { cellWidth: 10, halign: 'center' },
//         1: { cellWidth: 62 },
//         2: { cellWidth: 22, halign: 'center', fontSize: 7 },
//         3: { cellWidth: 22, halign: 'center', fontSize: 7 },
//         4: { cellWidth: 42 },
//         5: { cellWidth: 28, halign: 'center' },
//       },
//       didDrawCell: (data: any) => {
//         if (data.section === 'body' && data.column.index === 5 && data.cell.raw?.photo) {
//           try {
//             const p = doc.getImageProperties(data.cell.raw.photo);
//             const maxW = 24, maxH = data.cell.height - 2;
//             const ratio = Math.min(maxW / p.width, maxH / p.height);
//             const dw = p.width * ratio, dh = p.height * ratio;
//             doc.addImage(data.cell.raw.photo, 'JPEG',
//               data.cell.x + (maxW - dw) / 2 + 1,
//               data.cell.y + (data.cell.height - dh) / 2,
//               dw, dh, `ev-${data.row.index}`, 'FAST');
//           } catch { /* imagen inválida */ }
//         }
//       },
//       rowPageBreak: 'avoid',
//     });

//     // Marca de agua
//     for (let i = 1; i <= doc.getNumberOfPages(); i++) {
//       doc.setPage(i); doc.saveGraphicsState();
//       doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
//       doc.addImage('/logo_fonatur.png', 'PNG', (pageW - 130) / 2, (pageH - 38) / 2, 130, 38);
//       doc.restoreGraphicsState();
//     }
//     doc.save(`${folio}.pdf`);
//   }, [checklist, formData, sectorPersonalizado, tramoPersonalizado]);

//   // ═══════════════════════════════════════════════════════
//   //  RENDER
//   // ═══════════════════════════════════════════════════════
//   const itemActual   = checklist[preguntaActual];
//   const subtipos     = Object.keys(CATALOGO[formData.categoria] ?? {});
//   const tieneSubtipos = subtipos.length > 1;
//   const color        = CATEGORIA_COLOR[formData.categoria] ?? CATEGORIA_COLOR['ALUMBRADO PÚBLICO'];

//   const totalItems  = checklist.length;
//   const geoRefs     = checklist.flatMap(i => i.evidence).filter(e => e.geoRef).length;
//   const fotos       = checklist.flatMap(i => i.evidence).filter(e => e.photo).length;
//   const conEvidencia = checklist.filter(i => i.evidence.some(e => e.observation || e.geoRef || e.photo)).length;

//   return (
//     <div className="min-h-screen bg-[#eef2f6] font-sans text-gray-700">
//       <div className="max-w-5xl mx-auto">

//         {/* ── HEADER con tabs de categoría ─────────────────── */}
//         <header className="bg-[#285C4D] text-white shadow-lg pt-6 px-6 flex flex-col">
//           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-5">
//             <div>
//               <h1 className="text-xl font-extrabold tracking-wide uppercase">
//                 Reporte de Mantenimiento — CIP Acapulco-Coyuca
//               </h1>
//               <p className="text-white/70 text-xs mt-0.5">Selecciona categoría y sub-tipo para cargar el cuestionario</p>
//             </div>
//             <div className="text-xs font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
//               {currentTime}
//             </div>
//           </div>

//           {/* Tabs de categoría */}
//           <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
//             {CATEGORIAS.map(cat => (
//               <button key={cat} onClick={() => handleCategoriaChange(cat)}
//                 className={`flex-shrink-0 px-3 py-2.5 rounded-t-xl font-bold text-[11px] transition-colors whitespace-nowrap ${
//                   formData.categoria === cat
//                     ? 'bg-[#eef2f6] text-gray-800'
//                     : 'bg-black/20 text-white/80 hover:bg-black/30'
//                 }`}>
//                 {cat}
//               </button>
//             ))}
//           </div>
//         </header>

//         {/* ── Sub-tipo (solo si la categoría tiene varios) ─── */}
//         {tieneSubtipos && (
//           <div className="bg-white border-b border-gray-100 px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide shadow-sm">
//             {subtipos.map(sub => (
//               <button key={sub} onClick={() => handleSubTipoChange(sub)}
//                 className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
//                   formData.subTipo === sub
//                     ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
//                     : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
//                 }`}>
//                 {sub}
//               </button>
//             ))}
//           </div>
//         )}

//         {/* ── Sub-tipo como select en mobile o categorías sin subtabs ── */}
//         {!tieneSubtipos && subtipos.length === 1 && (
//           <div className={`px-6 py-2.5 border-b border-gray-100 bg-white shadow-sm`}>
//             <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-gray-800">
//               {formData.subTipo}
//             </span>
//           </div>
//         )}

//         <div className="p-4 sm:p-5 space-y-4">

//           {/* ── DATOS GENERALES ──────────────────────────────── */}
//           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
//             <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
//               {/* Sector */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Sector</label>
//                 <select value={formData.sector}
//                   onChange={e => setFormData(prev => ({ ...prev, sector: e.target.value, Tramo: '' }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-[#e67e22] text-sm focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30">
//                   <option value="">Seleccionar</option>
//                   {Object.keys(TRAMOS_POR_SECTOR).map(s => <option key={s} value={s}>{s}</option>)}
//                 </select>
//                 {formData.sector === 'Otro' && (
//                   <input type="text" placeholder="Sector..." value={sectorPersonalizado}
//                     onChange={e => setSectorPersonalizado(e.target.value)}
//                     className="mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 )}
//               </div>

//               {/* Tramo */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tramo</label>
//                 {formData.sector === 'Otro' ? (
//                   <input type="text" placeholder="Tramo..." value={tramoPersonalizado}
//                     onChange={e => setTramoPersonalizado(e.target.value)}
//                     className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 ) : (
//                   <select value={formData.Tramo}
//                     onChange={e => setFormData(prev => ({ ...prev, Tramo: e.target.value }))}
//                     disabled={!formData.sector}
//                     className="px-3 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-50">
//                     <option value="">Seleccionar</option>
//                     {(TRAMOS_POR_SECTOR[formData.sector] || []).map(t => <option key={t} value={t}>{t}</option>)}
//                   </select>
//                 )}
//               </div>

//               {/* Acceso */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Acceso a playa</label>
//                 <input type="text" placeholder="Acceso" value={formData.accesoPublico}
//                   onChange={e => setFormData(prev => ({ ...prev, accesoPublico: e.target.value }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
//               </div>

//               {/* Tipo mantenimiento */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tipo mantenimiento</label>
//                 <select value={formData.tipoMantenimiento}
//                   onChange={e => setFormData(prev => ({ ...prev, tipoMantenimiento: e.target.value }))}
//                   className={`px-3 py-2 rounded-xl border font-bold text-sm ${
//                     formData.tipoMantenimiento === 'Urgente'
//                       ? 'bg-red-50 border-red-200 text-red-600'
//                       : 'bg-slate-50 border-slate-200 text-gray-700'
//                   }`}>
//                   <option value="">Seleccionar</option>
//                   <option value="Urgente">🚨 Urgente</option>
//                   <option value="Ordinario">📋 Ordinario</option>
//                   <option value="Programable">🗓️ Programable</option>
//                 </select>
//               </div>
//             </div>
//           </div>

//           {/* ── GRID PRINCIPAL ───────────────────────────────── */}
//           <div className="grid lg:grid-cols-3 gap-4">

//             {/* ── WIZARD (2/3) ──────────────────────────────── */}
//             <div className="lg:col-span-2 space-y-3">

//               {/* Progreso + mini-mapa */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
//                 <div className="flex justify-between items-center mb-2">
//                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{formData.subTipo}</span>
//                   <div className="flex gap-2 text-[11px]">
//                     <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-gray-700">{conEvidencia}/{totalItems} con evidencia</span>
//                     <span className="text-slate-400">📍{geoRefs} 📷{fotos}</span>
//                   </div>
//                 </div>
//                 <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
//                   <div
//                     className="h-1.5 rounded-full transition-all duration-500 bg-emerald-500"
//                     style={{ width: `${totalItems ? (conEvidencia / totalItems) * 100 : 0}%` }}
//                   />
//                 </div>
//                 {/* Mini mapa de ítems */}
//                 <div className="flex flex-wrap gap-1.5">
//                   {checklist.map((item, idx) => {
//                     const tiene = item.evidence.some(e => e.observation || e.geoRef || e.photo);
//                     return (
//                       <button key={item.id} type="button" onClick={() => setPreguntaActual(idx)}
//                         title={item.pregunta}
//                         className={`w-7 h-7 rounded-full text-[10px] font-bold transition-all border-2 ${
//                           idx === preguntaActual ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
//                         } ${tiene ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
//                         {item.id}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>

//               {/* Tarjeta de ítem */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
//                 {/* Sección badge */}
//                 <span className="inline-block text-[10px] uppercase font-black text-slate-400 tracking-widest bg-slate-100 px-3 py-1 rounded-full mb-3">
//                   {itemActual.seccion}
//                 </span>

//                 <h2 className="text-base font-bold text-slate-800 mb-4 leading-snug">
//                   <span className="text-slate-300 mr-2 font-mono">#{itemActual.id}</span>
//                   {itemActual.pregunta}
//                 </h2>

//                 {/* Evidencias */}
//                 <div className="border-t border-slate-100 pt-4">
//                   <div className="flex justify-between items-center mb-3">
//                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidencias / Incidencias</h3>
//                     <button onClick={() => addEvidence(itemActual.id)}
//                       className="flex items-center gap-1 text-xs font-bold text-emerald-600 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
//                       <FaPlus size={9} /> Añadir evidencia
//                     </button>
//                   </div>

//                   <div className="space-y-3">
//                     {itemActual.evidence.map(ev => {
//                       const isCapturing = capturandoGps?.itemId === itemActual.id && capturandoGps?.entryId === ev.id;
//                       return (
//                         <div key={ev.id} className="group relative">
//                           {itemActual.evidence.length > 1 && (
//                             <button onClick={() => removeEvidence(itemActual.id, ev.id)}
//                               className="absolute -right-1 top-3 z-10 w-7 h-7 rounded-full bg-red-500 text-white shadow
//                                          flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
//                               <FaTrash size={10} />
//                             </button>
//                           )}
//                           <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
//                             <div className="grid md:grid-cols-2 gap-3">
//                               {/* Observación + GeoRef */}
//                               <div className="space-y-2">
//                                 <input type="text" placeholder="Observación..."
//                                   value={ev.observation}
//                                   onChange={e => updateObservation(itemActual.id, ev.id, e.target.value)}
//                                   className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />

//                                 {ev.geoRef ? (
//                                   <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between">
//                                     <div className="text-[11px] font-mono text-emerald-700">
//                                       <span className="font-bold">X:</span> {ev.geoRef.lat}<br/>
//                                       <span className="font-bold">Y:</span> {ev.geoRef.lon}
//                                       <span className="ml-2 text-emerald-400">±{ev.geoRef.precision}</span>
//                                     </div>
//                                     <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                       className="text-emerald-400 hover:text-emerald-600 ml-2" title="Recapturar">
//                                       <FaUndo size={10} />
//                                     </button>
//                                   </div>
//                                 ) : isCapturing ? (
//                                   <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-emerald-800 py-2.5 px-3 flex items-center gap-2.5">
//                                     <style>{`
//                                       @keyframes gs{0%{transform:translateY(-100%)}100%{transform:translateY(250%)}}
//                                       @keyframes gr{from{transform:rotate(0)}to{transform:rotate(360deg)}}
//                                       @keyframes gp{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:0;transform:scale(1.8)}}
//                                     `}</style>
//                                     <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
//                                       <div className="w-full h-6 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-500/40 border-b border-emerald-400/50"
//                                         style={{ animation: 'gs 1.3s linear infinite' }} />
//                                     </div>
//                                     <div className="relative w-6 h-6 flex-shrink-0 flex items-center justify-center">
//                                       <div className="absolute inset-0 rounded-full border border-emerald-500/40" style={{ animation: 'gp 1.8s ease-in-out infinite' }} />
//                                       <div className="absolute inset-0.5 rounded-full border-2 border-transparent border-t-emerald-400" style={{ animation: 'gr 0.75s linear infinite' }} />
//                                       <FaCrosshairs className="text-emerald-300 relative z-10 text-[9px]" />
//                                     </div>
//                                     <span className="text-emerald-300 text-[11px] font-bold animate-pulse relative z-10">Triangulando GPS...</span>
//                                     <div className="ml-auto flex items-end gap-[2px] h-4 relative z-10 flex-shrink-0">
//                                       {[0.4, 0.65, 1].map((d, i) => (
//                                         <div key={i} className="w-1 bg-emerald-400 rounded-sm"
//                                           style={{ height: `${40 + i * 25}%`, animation: `gp ${0.8 + i * 0.15}s ease-in-out infinite`, animationDelay: `${d * 0.3}s` }} />
//                                       ))}
//                                     </div>
//                                   </div>
//                                 ) : (
//                                   <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                     className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
//                                     <FaCrosshairs size={10} /> Capturar ubicación exacta
//                                   </button>
//                                 )}
//                               </div>

//                               {/* Foto */}
//                               <div className="relative aspect-video bg-white rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors">
//                                 {ev.photo ? (
//                                   <>
//                                     <img src={ev.photo} className="w-full h-full object-cover" alt="evidencia" />
//                                     <button type="button"
//                                       onClick={() => setChecklist(prev => prev.map(item =>
//                                         item.id === itemActual.id
//                                           ? { ...item, evidence: item.evidence.map(e => e.id === ev.id ? { ...e, photo: null } : e) }
//                                           : item
//                                       ))}
//                                       className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">
//                                       <FaTrash size={9} />
//                                     </button>
//                                   </>
//                                 ) : (
//                                   <>
//                                     <FaCamera className="text-slate-300 mb-1" size={16} />
//                                     <span className="text-[10px] font-bold text-slate-400">SUBIR FOTO</span>
//                                   </>
//                                 )}
//                                 <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
//                                   onChange={e => handlePhotoUpload(e, itemActual.id, ev.id)}
//                                   onClick={e => { (e.target as HTMLInputElement).value = ''; }} />
//                               </div>
//                             </div>
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 </div>

//                 {/* Navegación */}
//                 <div className="flex justify-between mt-5">
//                   <button onClick={() => setPreguntaActual(p => Math.max(0, p - 1))}
//                     disabled={preguntaActual === 0}
//                     className="px-5 py-2 font-bold text-slate-400 hover:text-slate-600 disabled:opacity-30 text-sm transition-colors">
//                     ← Anterior
//                   </button>
//                   <button onClick={() => setPreguntaActual(p => Math.min(checklist.length - 1, p + 1))}
//                     disabled={preguntaActual === checklist.length - 1}
//                     className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-30">
//                     Siguiente →
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {/* ── PANEL LATERAL: Mapa + Acciones ───────────────── */}
//             <div className="space-y-3">
//               {/* Mapa */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
//                 <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
//                   <FaMapMarkedAlt className="text-orange-500" size={13} />
//                   <h3 className="font-bold text-slate-600 text-xs uppercase tracking-wide">Geo-referencias</h3>
//                   {geoRefs > 0 && (
//                     <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{geoRefs}</span>
//                   )}
//                 </div>
//                 <div ref={mapRef} className="h-48">
//                   <LeafletMap gps={gpsVista} reportes={[]} georefPins={georefPins} />
//                 </div>
//                 {geoRefs === 0 && (
//                   <p className="text-[11px] text-slate-400 text-center py-2 border-t border-slate-50">
//                     Las geo-refs aparecerán aquí
//                   </p>
//                 )}
//               </div>

//               {/* Acciones */}
//               <button onClick={procesarFormularioActual}
//                 className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm">
//                 <FaFilePdf /> Guardar y añadir a cola PDF
//               </button>
//               <button onClick={generarPDFLocal}
//                 className="w-full py-3 bg-slate-800 text-white rounded-2xl font-bold shadow flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors text-sm">
//                 <FaFilePdf className="text-slate-400" /> Vista previa PDF
//               </button>
//               <button onClick={() => { if (window.confirm('¿Reiniciar formulario?')) limpiarFormulario(); }}
//                 className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors text-sm">
//                 <FaUndo size={12} /> Reiniciar
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default FormularioUnificado;
















// 'use client';

// import { usePDFQueue } from '@/app/context/pdf-queue-context';
// import { mostrarOpcionesPostGuardado } from '@/app/lib/generarPDFCombinado';
// import React, { useState, useRef, useEffect, useCallback } from 'react';
// import {
//   FaCrosshairs, FaCamera, FaMapMarkedAlt,
//   FaFilePdf, FaTrash, FaUndo, FaPlus,
// } from 'react-icons/fa';
// import jsPDF from 'jspdf';
// import 'leaflet/dist/leaflet.css';
// import dynamic from 'next/dynamic';
// import autoTable from 'jspdf-autotable';
// import { crearReporte, actualizarReporte } from '@/app/lib/actions';

// const LeafletMap = dynamic(
//   () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
//   { ssr: false }
// );

// // ═══════════════════════════════════════════════════════════
// //  INTERFACES
// // ═══════════════════════════════════════════════════════════
// interface FormularioProps {
//   reportesIniciales?: any[];
//   reporteParaEditar?: any;
// }
// interface GpsCoords { lat: string | null; lon: string | null; precision: string; }
// interface GeoRef   { lat: string; lon: string; precision: string; timestamp: string; }
// interface EvidenceEntry { id: number; observation: string; geoRef: GeoRef | null; photo: string | null; }
// interface ChecklistItem {
//   id: number; seccion: string; pregunta: string; respuesta: string;
//   evidence: EvidenceEntry[];
//   // compat BD
//   observacion: string; geoRef?: GeoRef | null;
// }
// interface FormData {
//   sector: string; Tramo: string; accesoPublico: string;
//   tipoMantenimiento: string; categoria: string; subTipo: string;
// }
// interface Seccion { titulo: string; items: string[]; }

// // ═══════════════════════════════════════════════════════════
// //  CATÁLOGO UNIFICADO
// //  Estructura: CATALOGO[categoria][subTipo] = Seccion[]
// // ═══════════════════════════════════════════════════════════
// const CATALOGO: Record<string, Record<string, Seccion[]>> = {

//   // ── 1. ALUMBRADO PÚBLICO ─────────────────────────────────
//   'ALUMBRADO PÚBLICO': {
//     'Alumbrado Público Solar': [{
//       titulo: 'ALUMBRADO PÚBLICO SOLAR',
//       items: [
//         'OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?',
//         'LA FOTOCELDA ¿CUMPLE CON SU FUNCIÓN?',
//         'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'INTEGRIDAD DE LUMINARIA',
//         'ESTADO DE POSTE METÁLICO/CONCRETO',
//         'ESTADO DE BASE DE CONCRETO',
//       ],
//     }],
//     'Alumbrado Público Eléctrico': [{
//       titulo: 'ALUMBRADO PÚBLICO ELÉCTRICO',
//       items: [
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//         'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS',
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'EL BRAZO ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'INTEGRIDAD DE LUMINARIA',
//         'ESTADO DE POSTE METÁLICO/CONCRETO',
//         'ESTADO DE BASE DE CONCRETO',
//       ],
//     }],
//     'Luminaria Tipo Cerillo': [{
//       titulo: 'LUMINARIA TIPO CERILLO',
//       items: [
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'ESTADO DE BASE DE CONCRETO',
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//       ],
//     }],
//     'Luminaria Tipo Europea': [{
//       titulo: 'LUMINARIA TIPO EUROPEA',
//       items: [
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'ESTADO DE BASE DE CONCRETO',
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//         'ESTADO DEL ELEMENTO PORTADOR DE LA LUMINARIA (POSTE PIRAMIDAL PREFABRICADO)',
//       ],
//     }],
//     'Otros': [{
//       titulo: 'OTROS',
//       items: [
//         'PARABUSES',
//         'PROYECTOR LED',
//         'PROYECTOR SPOT',
//         'LUMINARIAS EMPOTRABLES FRAGATA',
//       ],
//     }],
//   },

//   // ── 2. ÁREAS VERDES ──────────────────────────────────────
//   // Cada sección es un sub-tipo independiente → aparecen como tabs
//   'AREAS VERDES': {
//     '1. Poda': [{
//       titulo: '1. PODA',
//       items: [
//         '1.1 DESHIERBE – EN CAMELLÓN EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
//         '1.1 DESHIERBE – EN JARDINERA EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
//         '1.2 CAJETE – EN CAMELLÓN',
//         '1.3 CAJILLO – EN CAMELLONES CON UN ANCHO DE 10 CM Y PROFUNDIDAD DE 12 CM',
//         '1.4 DESORILLE DE ARRIATES/JARDINERA: SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
//         '1.4 DESORILLE DE CAMELLÓN ANCHO 15 CM ± 2 CM; SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
//         '1.5 PODA DE PASTO CON MAQUINARIA A UNA ALTURA PROMEDIO DE 2.5 A 5 CM',
//         '1.6 PODA DE SETOS CUANDO LA GEOMETRÍA DEL ARBUSTO YA NO ES UNIFORME (ARBUSTOS Y PLANTAS DE ORNATO) UTILIZANDO HERRAMIENTA MANUAL Y MECÁNICA',
//         '1.7 PODA DE ÁRBOLES DE 2 A 5 M DE FRONDOSIDAD Y DE 2.00 A 6.00 M DE ALTURA',
//         '1.7 PODA DE ÁRBOLES DE 5.01 M. A 10 DE FRONDOSIDAD Y DE 6.01 A 12.00 M DE ALTURA',
//         '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
//         '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
//         '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
//         '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
//       ],
//     }],
//     '2. Tala': [{
//       titulo: '2. TALA DE ÁRBOLES O PALMERAS',
//       items: [
//         'TALA, TROZA, CARGA Y RETIRO DE ÁRBOLES POR MEDIOS MANUALES BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) HASTA 5.00 M DE ALTURA',
//         'TALA, TROZA, CARGA Y RETIRO DE PALMERAS BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) DE 5.01 A 12.00 M',
//       ],
//     }],
//     '4. Escombro': [{
//       titulo: '4. ESCOMBRO',
//       items: [
//         'ÁREA LIBRE DE CONTAMINACIÓN (TIERRA/CASCAJO, LODOS, EXCRETAS, HIDROCARBUROS, ESCOMBROS)',
//       ],
//     }],
//     '5. Limpieza': [{
//       titulo: '5. LIMPIEZA ÁREAS VERDES',
//       items: [
//         'JARDINERAS/ARRIATES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
//         'CAMELLONES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
//       ],
//     }],
//     '6. Red de riego': [{
//       titulo: '6. RED DE RIEGO',
//       items: [
//         'RED DE RIEGO TAPADA, FUERA DE DIRECCIÓN O CON FUGAS',
//       ],
//     }],
//     '7. Retiro de tocones': [{
//       titulo: '7. RETIRO DE TOCONES',
//       items: [
//         'CORTE A 15 CM DEBAJO DEL NIVEL EXISTENTE DE TOCON. DE HASTA 50 CM DE DIAMETRO',
//       ],
//     }],
//     '8. Fumigación': [{
//       titulo: '8. FUMIGACIÓN',
//       items: [
//         'ESPECIE PRESENTA PLAGA',
//         'ESPECIE PRESENTA HONGO O PUDRICIÓN',
//       ],
//     }],
//   },

//   // ── 3. BARRIDO VIALIDADES ─────────────────────────────────
//   // 'BARRIDO VIALIDADES': {
//   //   'Barrido de Vialidades': [{
//   //     titulo: 'BARRIDO DE VIALIDADES',
//   //     items: [
//   //       'BARRIDO MANUAL DE VIALIDADES',
//   //       'BARRIDO MANUAL DE BANQUETAS',
//   //       'BARRIDO MANUAL DE CUNETAS',
//   //       'BARRIDO MANUAL DE ANDADORES',
//   //       'BARRIDO MANUAL DE CAMELLONES (SOLO SUPERFICIE DURA)',
//   //       'BARRIDO MANUAL EN PARQUES O PLAZOLETAS (SOLO ÁREAS DURAS)',
//   //       'BARRIDO MECÁNICO CON BARREDORA EN VIALIDADES PRINCIPALES',
//   //       'ACOPIO Y RECOLECCIÓN DEL MATERIAL PRODUCTO DEL BARRIDO EN PUNTOS DESIGNADOS',
//   //     ],
//   //   }],
//   // },

//   // ── 4. LIMPIEZA URBANA ────────────────────────────────────
//   'LIMPIEZA URBANA': {
//     'Limpieza Urbana': [{
//       titulo: 'LIMPIEZA URBANA',
//       items: [
//         'ÁREA GENERAL LIMPIA DE BASURA VISIBLE A LO LARGO DEL TRAMO',
//         'BANQUETAS BARRIDAS Y LIBRES DE RESIDUOS SOLIDOS',
//         'CUNETAS LIMPIAS Y SIN OBSTRUCCIONES POR RESIDUOS',
//         'ACUMULACIÓN DE BASURA EN PUNTOS CRÍTICOS (ESQUINAS, ACCESOS, MUROS)',
//         'PLAYA LIMPIA DE RESIDUOS ORGÁNICOS E INORGÁNICOS (SI APLICA)',
//         'ACCESOS A PLAYA O ZONA PÚBLICA LIBRES DE BASURA',
//         'BOTES DE BASURA VACÍOS (NO REBASADOS)',
//         'BOTES Y CONTENEDORES LIMPIOS POR DENTRO Y POR FUERA',
//         'ÁREA ALREDEDOR DEL BOTE (1 METRO) LIBRE DE RESIDUOS',
//         'LIXIVIADOS O DERRAMES ALREDEDOR DE BOTES O CONTENEDORES',
//         'RESIDUOS DISPERSOS DESPUÉS DE LA RECOLECCIÓN',
//         'PODA EN GRAL CADA 6 MESES',
//         '¿EL CANAL PLUVIAL PRESENTA OBSTRUCCIONES (BASURA, SEDIMENTOS, VEGETACIÓN, LODO, ETC.)?',
//         '¿EL CANAL PLUVIAL PRESENTA DAÑOS ESTRUCTURALES (FISURAS, DESPRENDIMIENTOS, DEFORMACIONES, SOCAVACIONES)?',
//         '¿EL AGUA PUEDE FLUIR LIBREMENTE A TRAVÉS DEL CANAL PLUVIAL?',
//         '¿LOS ACCESOS AL CANAL (TAPAS, REJILLAS, REGISTROS) ESTÁN EN BUEN ESTADO?',
//         '¿EL CANAL PLUVIAL SE ENCUENTRA EN BUENAS CONDICIONES (SIN OBSTRUCCIONES, SIN DAÑO ESTRUCTURAL Y CON FLUJO LIBRE)?',
//         'INDIQUE EL ESTADO ACTUAL DE LA REJILLA PLUVIAL (PUEDE SELECCIONAR MÁS DE UNA OPCIÓN)',
//       ],
//     }],
//   },

//   // ── 5. MOBILIARIO URBANO ──────────────────────────────────
//   'MOBILIARIO URBANO': {
//     'Mobiliario Urbano': [{
//       titulo: 'MOBILIARIO URBANO',
//       items: [
//         'BACHEO DE CALLE (M2)',
//         'REPARACIÓN DE BANQUETA (ML)',
//         'MANTENIMIENTO DE PARABUSES',
//         'SUSTITUCIÓN DE TAPAS DE CONCRETO DIFERENTES EMPRESAS (TELECOMUNICACIONES, CFE Y ALUMBRADO)',
//         '¿EL BARANDAL (ACERO INOXIDABLE O ACERO NORMAL) SE ENCUENTRA EN BUEN ESTADO GENERAL, SIN CORROSIÓN, SIN DEFORMACIONES, BIEN ALINEADO Y FIRMEMENTE ANCLADO?',
//         '¿EL BARANDAL CUMPLE CON LA ALTURA Y LOS CRITERIOS DE SEGURIDAD, SIN TRAMOS FALTANTES O DAÑADOS?',
//         'ESTADO DE SEÑALETICAS',
//         'BALIZADO DE CALLE',
//         'ESTADO DE MURALES',
//         'ESTADO DEL BOLARDO',
//         'FIGURAS LÚDICAS',
//         'MANTENIMIENTO DE POSTE DE SEMÁFORO',
//         'MANTENIMIENTO DE RAMPAS',
//       ],
//     }],
//   },
// };

// // ── Color por categoría ────────────────────────────────────
// const CATEGORIA_COLOR: Record<string, { header: string; tab: string; badge: string }> = {
//   'ALUMBRADO PÚBLICO':  { header: 'from-yellow-600 to-yellow-700',   tab: 'bg-yellow-50  text-yellow-800',  badge: 'bg-yellow-100  text-yellow-700'  },
//   'AREAS VERDES':       { header: 'from-emerald-600 to-emerald-700', tab: 'bg-emerald-50 text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
//   'BARRIDO VIALIDADES': { header: 'from-blue-600 to-blue-700',       tab: 'bg-blue-50    text-blue-800',    badge: 'bg-blue-100    text-blue-700'    },
//   'LIMPIEZA URBANA':    { header: 'from-orange-600 to-orange-700',   tab: 'bg-orange-50  text-orange-800',  badge: 'bg-orange-100  text-orange-700'  },
//   'MOBILIARIO URBANO':  { header: 'from-purple-600 to-purple-700',   tab: 'bg-purple-50  text-purple-800',  badge: 'bg-purple-100  text-purple-700'  },
// };

// const TRAMOS_POR_SECTOR: Record<string, string[]> = {
//   'Barra de Coyuca':      ['Sendero-Seguro-Barra Coyuca'],
//   'Pie de la Cuesta':     ['Sendero-seguro-Pie de la cuesta'],
//   'Barrios Historicos':   ['Caleta-caletilla', 'Sendero-Costera-antigua', 'Corredor Zocalo-quebrada', 'Corredor zocalo-fuerte'],
//   'Acapulco Tradicional': ['Sendero-Tadeo-arredondo', 'Sendero-cinerio-hornitos', 'Michoacan', 'Av. Universidad', 'Dr. Ignacio chavez'],
//   'Acapulco Dorado':      ['Costa azul'],
//   'Las Brisas':           [''],
//   'Puerto Márquez':       ['Sendero-Puerto-Marquez'],
//   'Acapulco Diamante':    ['Av. Costera Palmas'],
//   'Otro':                 [''],
// };

// // ── Helpers ────────────────────────────────────────────────
// // Usa Date.now() como ID único — evita colisiones al borrar y re-añadir evidencias
// const emptyEntry = (): EvidenceEntry => ({ id: Date.now(), observation: '', geoRef: null, photo: null });

// const buildChecklist = (categoria: string, subTipo: string): ChecklistItem[] => {
//   const secciones = CATALOGO[categoria]?.[subTipo] ?? [];
//   let counter = 1;
//   return secciones.flatMap(sec =>
//     sec.items.map(pregunta => ({
//       id: counter++,
//       seccion: sec.titulo,
//       pregunta,
//       respuesta: '',
//       observacion: '',
//       geoRef: null,
//       evidence: [emptyEntry()],
//     }))
//   );
// };

// const CATEGORIAS = Object.keys(CATALOGO);

// // ═══════════════════════════════════════════════════════════
// //  COMPONENTE PRINCIPAL
// // ═══════════════════════════════════════════════════════════
// const FormularioUnificado: React.FC<FormularioProps> = ({ reporteParaEditar }) => {
//   const { addToQueue } = usePDFQueue();
//   const mapRef        = useRef<HTMLDivElement>(null);
//   const geoRefWatchId = useRef<number | null>(null);

//   const [currentTime,         setCurrentTime]         = useState('');
//   const [preguntaActual,      setPreguntaActual]       = useState(0);
//   const [sectorPersonalizado, setSectorPersonalizado]  = useState('');
//   const [tramoPersonalizado,  setTramoPersonalizado]   = useState('');
//   const [capturandoGps, setCapturandoGps] = useState<{ itemId: number; entryId: number } | null>(null);

//   const catInicial    = reporteParaEditar?.categoria ?? 'ALUMBRADO PÚBLICO';
//   const subtiposInic  = Object.keys(CATALOGO[catInicial] ?? {});
//   const subTipoInicial = reporteParaEditar?.subTipo ?? subtiposInic[0] ?? '';

//   const [formData, setFormData] = useState<FormData>({
//     sector:            reporteParaEditar?.sector            ?? '',
//     Tramo:             reporteParaEditar?.tramo             ?? '',
//     accesoPublico:     reporteParaEditar?.acceso_publico    ?? '',
//     tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
//     categoria:         catInicial,
//     subTipo:           subTipoInicial,
//   });

//   const [checklist, setChecklist] = useState<ChecklistItem[]>(
//     buildChecklist(catInicial, subTipoInicial)
//   );

//   // ── Geo-pins para el mapa ──────────────────────────────
//   const georefPins = React.useMemo(() =>
//     checklist.flatMap(item =>
//       item.evidence.filter(ev => ev.geoRef).map((ev, ei) => ({
//         lat: ev.geoRef!.lat, lon: ev.geoRef!.lon,
//         label: item.evidence.length > 1 ? `${item.id}.${ei + 1}` : String(item.id),
//         pregunta: item.pregunta, observation: ev.observation, cumple: item.respuesta,
//       }))
//     )
//   , [checklist]);

//   const gpsVista: GpsCoords = React.useMemo(() =>
//     georefPins.length > 0
//       ? { lat: georefPins[georefPins.length - 1].lat, lon: georefPins[georefPins.length - 1].lon, precision: '--' }
//       : { lat: null, lon: null, precision: '--' }
//   , [georefPins]);

//   // ── Efectos ────────────────────────────────────────────
//   useEffect(() => {
//     const tick = () => setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
//     tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
//   }, []);

//   useEffect(() => {
//     import('leaflet').then(L => {
//       delete (L.Icon.Default.prototype as any)._getIconUrl;
//       L.Icon.Default.mergeOptions({
//         iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//         iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//         shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
//       });
//     });
//   }, []);

//   useEffect(() => {
//     return () => { if (geoRefWatchId.current !== null) navigator.geolocation.clearWatch(geoRefWatchId.current); };
//   }, []);

//   // ── Cambio de categoría ────────────────────────────────
//   const handleCategoriaChange = useCallback((nuevaCat: string) => {
//     const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
//     if (hayEvidencias && !window.confirm('Cambiar categoría borrará las evidencias actuales. ¿Continuar?')) return;
//     const subtipo = Object.keys(CATALOGO[nuevaCat] ?? {})[0] ?? '';
//     setFormData(prev => ({ ...prev, categoria: nuevaCat, subTipo: subtipo }));
//     setChecklist(buildChecklist(nuevaCat, subtipo));
//     setPreguntaActual(0);
//   }, [checklist]);

//   // ── Cambio de sub-tipo ─────────────────────────────────
//   const handleSubTipoChange = useCallback((nuevoSub: string) => {
//     const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
//     if (hayEvidencias && !window.confirm('Cambiar el tipo borrará las evidencias actuales. ¿Continuar?')) return;
//     setFormData(prev => ({ ...prev, subTipo: nuevoSub }));
//     setChecklist(buildChecklist(formData.categoria, nuevoSub));
//     setPreguntaActual(0);
//   }, [checklist, formData.categoria]);

//   // ── GPS por evidencia ──────────────────────────────────
//   const capturarGeoRef = useCallback((itemId: number, entryId: number) => {
//     if (!navigator.geolocation) return alert('GPS no soportado.');
//     setCapturandoGps({ itemId, entryId });
//     geoRefWatchId.current = navigator.geolocation.watchPosition(
//       ({ coords: { latitude, longitude, accuracy } }) => {
//         const timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
//         setChecklist(prev => prev.map(item =>
//           item.id === itemId ? {
//             ...item,
//             evidence: item.evidence.map(e => e.id === entryId
//               ? { ...e, geoRef: { lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m`, timestamp } }
//               : e)
//           } : item
//         ));
//         if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; }
//         setCapturandoGps(null);
//       },
//       () => { setCapturandoGps(null); alert('No se pudo obtener la ubicación.'); },
//       { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
//     );
//     setTimeout(() => {
//       if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; setCapturandoGps(null); }
//     }, 12000);
//   }, []);

//   // ── Evidencia helpers ──────────────────────────────────
//   const addEvidence = useCallback((itemId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: [...item.evidence, emptyEntry()] } : item
//     ));
//   }, []);

//   const removeEvidence = useCallback((itemId: number, entryId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.filter(e => e.id !== entryId) } : item
//     ));
//   }, []);

//   const updateObservation = useCallback((itemId: number, entryId: number, val: string) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, observation: val } : e) } : item
//     ));
//   }, []);

//   const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, itemId: number, entryId: number) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     const img = new Image();
//     img.onload = () => {
//       const ratio = Math.min(900 / img.width, 1);
//       const canvas = document.createElement('canvas');
//       canvas.width = img.width * ratio; canvas.height = img.height * ratio;
//       canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
//       const b64 = canvas.toDataURL('image/jpeg', 0.82);
//       setChecklist(prev => prev.map(item =>
//         item.id === itemId ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, photo: b64 } : e) } : item
//       ));
//     };
//     img.src = URL.createObjectURL(file);
//   }, []);

//   const limpiarFormulario = useCallback(() => {
//     setChecklist(buildChecklist(formData.categoria, formData.subTipo));
//     setPreguntaActual(0);
//   }, [formData.categoria, formData.subTipo]);

//   // ── Guardar en BD ──────────────────────────────────────
//   const guardarCuestionario = useCallback(async () => {
//     const sectorFinal = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramoFinal  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;
//     const fd = { ...formData, sector: sectorFinal, Tramo: tramoFinal };
//     const checklistDB = checklist.map(item => ({
//       ...item,
//       observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//       geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//     }));
//     const lastGeoRef = checklist.flatMap(i => i.evidence).find(e => e.geoRef)?.geoRef;
//     const gpsDB: GpsCoords = lastGeoRef
//       ? { lat: lastGeoRef.lat, lon: lastGeoRef.lon, precision: lastGeoRef.precision }
//       : { lat: null, lon: null, precision: '--' };
//     if (reporteParaEditar?.id) {
//       await actualizarReporte(reporteParaEditar.id.toString(), fd, checklistDB as any, gpsDB, {});
//       alert('¡Reporte actualizado!');
//     } else {
//       await crearReporte(fd, checklistDB as any, gpsDB, {});
//       alert('¡Reporte guardado!');
//     }
//   }, [formData, sectorPersonalizado, tramoPersonalizado, checklist, reporteParaEditar]);

//   // ── Procesar y añadir a cola ───────────────────────────
//   const procesarFormularioActual = useCallback(async () => {
//     try {
//       await guardarCuestionario();
//       addToQueue({
//         categoria: formData.categoria,
//         formData:  { ...formData },
//         checklist: checklist.map(item => ({
//           ...item,
//           observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//           geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//         })) as any,
//         gps:          gpsVista,
//         fotos:        {},
//         mapImage:     null,
//         fechaCaptura: new Date(),
//       });
//       const opcion = await mostrarOpcionesPostGuardado();
//       if (opcion === 'otro_mismo' || opcion === 'generar_ahora') limpiarFormulario();
//     } catch (err) { console.error(err); alert('Error al procesar el formulario.'); }
//   }, [addToQueue, checklist, formData, gpsVista, guardarCuestionario, limpiarFormulario]);

//   // ── PDF local rápido ───────────────────────────────────
//   const generarPDFLocal = useCallback(async () => {
//     const doc       = new jsPDF('p', 'mm', 'a4');
//     const pageW     = doc.internal.pageSize.getWidth();
//     const pageH     = doc.internal.pageSize.getHeight();
//     const margin    = 12;
//     const folio     = `REV-${formData.categoria.slice(0, 3).toUpperCase()}-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 900 + 100)}`;
//     const sector    = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramo     = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;

//     let y = 18;
//     doc.setFont('helvetica', 'bold').setFontSize(12);
//     doc.text(`REPORTE ${formData.categoria} – CIP ACAPULCO-COYUCA`, margin, y);
//     y += 4; doc.setLineWidth(0.5).line(margin, y, pageW - margin, y); y += 6;
//     doc.setFont('helvetica', 'normal').setFontSize(9);
//     doc.text(`Folio: ${folio}   Sector: ${sector}   Tramo: ${tramo}`, margin, y); y += 5;
//     doc.setFont('helvetica', 'bold').text(`Sub-tipo: ${formData.subTipo}   Mantenimiento: ${formData.tipoMantenimiento}`, margin, y);
//     doc.setFont('helvetica', 'normal'); y += 8;

//     const rows: any[] = [];
//     checklist.forEach(item => {
//       item.evidence.forEach((ev, ei) => {
//         rows.push([
//           ei === 0 ? String(item.id) : '',
//           ei === 0 ? item.pregunta   : `↳ Incidencia ${ei + 1}`,
//           ev.geoRef?.lat ?? '',
//           ev.geoRef?.lon ?? '',
//           ev.observation || '',
//           { content: '', photo: ev.photo },
//         ]);
//       });
//     });

//     autoTable(doc, {
//       startY: y,
//       margin: { left: margin, right: margin },
//       head: [[
//         { content: 'No.',      styles: { halign: 'center' } },
//         { content: 'Concepto / Incidencia' },
//         { content: 'Lat',      styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Lon',      styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Observaciones' },
//         { content: 'Foto',     styles: { halign: 'center' } },
//       ]],
//       body: rows,
//       theme: 'grid',
//       styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle', overflow: 'linebreak', lineWidth: 0.2 },
//       headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
//       columnStyles: {
//         0: { cellWidth: 10, halign: 'center' },
//         1: { cellWidth: 62 },
//         2: { cellWidth: 22, halign: 'center', fontSize: 7 },
//         3: { cellWidth: 22, halign: 'center', fontSize: 7 },
//         4: { cellWidth: 42 },
//         5: { cellWidth: 28, halign: 'center' },
//       },
//       didDrawCell: (data: any) => {
//         if (data.section === 'body' && data.column.index === 5 && data.cell.raw?.photo) {
//           try {
//             const p = doc.getImageProperties(data.cell.raw.photo);
//             const maxW = 24, maxH = data.cell.height - 2;
//             const ratio = Math.min(maxW / p.width, maxH / p.height);
//             const dw = p.width * ratio, dh = p.height * ratio;
//             doc.addImage(data.cell.raw.photo, 'JPEG',
//               data.cell.x + (maxW - dw) / 2 + 1,
//               data.cell.y + (data.cell.height - dh) / 2,
//               dw, dh, `ev-${data.row.index}`, 'FAST');
//           } catch { /* imagen inválida */ }
//         }
//       },
//       rowPageBreak: 'avoid',
//     });

//     // Marca de agua
//     for (let i = 1; i <= doc.getNumberOfPages(); i++) {
//       doc.setPage(i); doc.saveGraphicsState();
//       doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
//       doc.addImage('/logo_fonatur.png', 'PNG', (pageW - 130) / 2, (pageH - 38) / 2, 130, 38);
//       doc.restoreGraphicsState();
//     }
//     doc.save(`${folio}.pdf`);
//   }, [checklist, formData, sectorPersonalizado, tramoPersonalizado]);

//   // ═══════════════════════════════════════════════════════
//   //  RENDER
//   // ═══════════════════════════════════════════════════════
//   const itemActual   = checklist[preguntaActual];
//   const subtipos     = Object.keys(CATALOGO[formData.categoria] ?? {});
//   const tieneSubtipos = subtipos.length > 1;
//   const color        = CATEGORIA_COLOR[formData.categoria] ?? CATEGORIA_COLOR['ALUMBRADO PÚBLICO'];

//   const totalItems  = checklist.length;
//   const geoRefs     = checklist.flatMap(i => i.evidence).filter(e => e.geoRef).length;
//   const fotos       = checklist.flatMap(i => i.evidence).filter(e => e.photo).length;
//   const conEvidencia = checklist.filter(i => i.evidence.some(e => e.observation || e.geoRef || e.photo)).length;

//   return (
//     <div className="min-h-screen bg-[#eef2f6] font-sans text-gray-700">
//       <div className="max-w-5xl mx-auto">

//         {/* ── HEADER con tabs de categoría ─────────────────── */}
//         <header className="bg-[#285C4D] text-white shadow-lg pt-6 px-6 flex flex-col">
//           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-5">
//             <div>
//               <h1 className="text-xl font-extrabold tracking-wide uppercase">
//                 Reporte de Mantenimiento — CIP Acapulco-Coyuca
//               </h1>
//               <p className="text-white/70 text-xs mt-0.5">Selecciona categoría y sub-tipo para cargar el cuestionario</p>
//             </div>
//             <div className="text-xs font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
//               {currentTime}
//             </div>
//           </div>

//           {/* Tabs de categoría */}
//           <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
//             {CATEGORIAS.map(cat => (
//               <button key={cat} onClick={() => handleCategoriaChange(cat)}
//                 className={`flex-shrink-0 px-3 py-2.5 rounded-t-xl font-bold text-[11px] transition-colors whitespace-nowrap ${
//                   formData.categoria === cat
//                     ? 'bg-[#eef2f6] text-gray-800'
//                     : 'bg-black/20 text-white/80 hover:bg-black/30'
//                 }`}>
//                 {cat}
//               </button>
//             ))}
//           </div>
//         </header>

//         {/* ── Sub-tipo (solo si la categoría tiene varios) ─── */}
//         {tieneSubtipos && (
//           <div className="bg-white border-b border-gray-100 px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide shadow-sm">
//             {subtipos.map(sub => (
//               <button key={sub} onClick={() => handleSubTipoChange(sub)}
//                 className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
//                   formData.subTipo === sub
//                     ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
//                     : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
//                 }`}>
//                 {sub}
//               </button>
//             ))}
//           </div>
//         )}

//         {/* ── Sub-tipo como select en mobile o categorías sin subtabs ── */}
//         {!tieneSubtipos && subtipos.length === 1 && (
//           <div className={`px-6 py-2.5 border-b border-gray-100 bg-white shadow-sm`}>
//             <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-gray-800">
//               {formData.subTipo}
//             </span>
//           </div>
//         )}

//         <div className="p-4 sm:p-5 space-y-4">

//           {/* ── DATOS GENERALES ──────────────────────────────── */}
//           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
//             <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
//               {/* Sector */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Sector</label>
//                 <select value={formData.sector}
//                   onChange={e => setFormData(prev => ({ ...prev, sector: e.target.value, Tramo: '' }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-[#e67e22] text-sm focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30">
//                   <option value="">Seleccionar</option>
//                   {Object.keys(TRAMOS_POR_SECTOR).map(s => <option key={s} value={s}>{s}</option>)}
//                 </select>
//                 {formData.sector === 'Otro' && (
//                   <input type="text" placeholder="Sector..." value={sectorPersonalizado}
//                     onChange={e => setSectorPersonalizado(e.target.value)}
//                     className="mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 )}
//               </div>

//               {/* Tramo */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tramo</label>
//                 {formData.sector === 'Otro' ? (
//                   <input type="text" placeholder="Tramo..." value={tramoPersonalizado}
//                     onChange={e => setTramoPersonalizado(e.target.value)}
//                     className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 ) : (
//                   <select value={formData.Tramo}
//                     onChange={e => setFormData(prev => ({ ...prev, Tramo: e.target.value }))}
//                     disabled={!formData.sector}
//                     className="px-3 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-50">
//                     <option value="">Seleccionar</option>
//                     {(TRAMOS_POR_SECTOR[formData.sector] || []).map(t => <option key={t} value={t}>{t}</option>)}
//                   </select>
//                 )}
//               </div>

//               {/* Acceso */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Acceso a playa</label>
//                 <input type="text" placeholder="Acceso" value={formData.accesoPublico}
//                   onChange={e => setFormData(prev => ({ ...prev, accesoPublico: e.target.value }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
//               </div>

//               {/* Tipo mantenimiento */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tipo mantenimiento</label>
//                 <select value={formData.tipoMantenimiento}
//                   onChange={e => setFormData(prev => ({ ...prev, tipoMantenimiento: e.target.value }))}
//                   className={`px-3 py-2 rounded-xl border font-bold text-sm ${
//                     formData.tipoMantenimiento === 'Urgente'
//                       ? 'bg-red-50 border-red-200 text-red-600'
//                       : 'bg-slate-50 border-slate-200 text-gray-700'
//                   }`}>
//                   <option value="">Seleccionar</option>
//                   <option value="Urgente">🚨 Urgente</option>
//                   <option value="Ordinario">📋 Ordinario</option>
//                   <option value="Programable">🗓️ Programable</option>
//                 </select>
//               </div>
//             </div>
//           </div>

//           {/* ── GRID PRINCIPAL ───────────────────────────────── */}
//           <div className="grid lg:grid-cols-3 gap-4">

//             {/* ── WIZARD (2/3) ──────────────────────────────── */}
//             <div className="lg:col-span-2 space-y-3">

//               {/* Progreso + mini-mapa */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
//                 <div className="flex justify-between items-center mb-2">
//                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{formData.subTipo}</span>
//                   <div className="flex gap-2 text-[11px]">
//                     <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-gray-700">{conEvidencia}/{totalItems} con evidencia</span>
//                     <span className="text-slate-400">📍{geoRefs} 📷{fotos}</span>
//                   </div>
//                 </div>
//                 <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
//                   <div
//                     className="h-1.5 rounded-full transition-all duration-500 bg-emerald-500"
//                     style={{ width: `${totalItems ? (conEvidencia / totalItems) * 100 : 0}%` }}
//                   />
//                 </div>
//                 {/* Mini mapa de ítems */}
//                 <div className="flex flex-wrap gap-1.5">
//                   {checklist.map((item, idx) => {
//                     const tiene = item.evidence.some(e => e.observation || e.geoRef || e.photo);
//                     return (
//                       <button key={item.id} type="button" onClick={() => setPreguntaActual(idx)}
//                         title={item.pregunta}
//                         className={`w-7 h-7 rounded-full text-[10px] font-bold transition-all border-2 ${
//                           idx === preguntaActual ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
//                         } ${tiene ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
//                         {item.id}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>

//               {/* Tarjeta de ítem */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
//                 {/* Sección badge */}
//                 <span className="inline-block text-[10px] uppercase font-black text-slate-400 tracking-widest bg-slate-100 px-3 py-1 rounded-full mb-3">
//                   {itemActual.seccion}
//                 </span>

//                 <h2 className="text-base font-bold text-slate-800 mb-4 leading-snug">
//                   <span className="text-slate-300 mr-2 font-mono">#{itemActual.id}</span>
//                   {itemActual.pregunta}
//                 </h2>

//                 {/* Evidencias */}
//                 <div className="border-t border-slate-100 pt-4">
//                   <div className="flex justify-between items-center mb-3">
//                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidencias / Incidencias</h3>
//                     <button onClick={() => addEvidence(itemActual.id)}
//                       className="flex items-center gap-1 text-xs font-bold text-emerald-600 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
//                       <FaPlus size={9} /> Añadir evidencia
//                     </button>
//                   </div>

//                   <div className="space-y-3">
//                     {itemActual.evidence.map(ev => {
//                       const isCapturing = capturandoGps?.itemId === itemActual.id && capturandoGps?.entryId === ev.id;
//                       return (
//                         <div key={ev.id} className="group relative">
//                           {itemActual.evidence.length > 1 && (
//                             <button onClick={() => removeEvidence(itemActual.id, ev.id)}
//                               className="absolute -right-1 top-3 z-10 w-7 h-7 rounded-full bg-red-500 text-white shadow
//                                          flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
//                               <FaTrash size={10} />
//                             </button>
//                           )}
//                           <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
//                             <div className="grid md:grid-cols-2 gap-3">
//                               {/* Observación + GeoRef */}
//                               <div className="space-y-2">
//                                 <input type="text" placeholder="Observación..."
//                                   value={ev.observation}
//                                   onChange={e => updateObservation(itemActual.id, ev.id, e.target.value)}
//                                   className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />

//                                 {ev.geoRef ? (
//                                   <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between">
//                                     <div className="text-[11px] font-mono text-emerald-700">
//                                       <span className="font-bold">X:</span> {ev.geoRef.lat}<br/>
//                                       <span className="font-bold">Y:</span> {ev.geoRef.lon}
//                                       <span className="ml-2 text-emerald-400">±{ev.geoRef.precision}</span>
//                                     </div>
//                                     <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                       className="text-emerald-400 hover:text-emerald-600 ml-2" title="Recapturar">
//                                       <FaUndo size={10} />
//                                     </button>
//                                   </div>
//                                 ) : isCapturing ? (
//                                   <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-emerald-800 py-2.5 px-3 flex items-center gap-2.5">
//                                     <style>{`
//                                       @keyframes gs{0%{transform:translateY(-100%)}100%{transform:translateY(250%)}}
//                                       @keyframes gr{from{transform:rotate(0)}to{transform:rotate(360deg)}}
//                                       @keyframes gp{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:0;transform:scale(1.8)}}
//                                     `}</style>
//                                     <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
//                                       <div className="w-full h-6 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-500/40 border-b border-emerald-400/50"
//                                         style={{ animation: 'gs 1.3s linear infinite' }} />
//                                     </div>
//                                     <div className="relative w-6 h-6 flex-shrink-0 flex items-center justify-center">
//                                       <div className="absolute inset-0 rounded-full border border-emerald-500/40" style={{ animation: 'gp 1.8s ease-in-out infinite' }} />
//                                       <div className="absolute inset-0.5 rounded-full border-2 border-transparent border-t-emerald-400" style={{ animation: 'gr 0.75s linear infinite' }} />
//                                       <FaCrosshairs className="text-emerald-300 relative z-10 text-[9px]" />
//                                     </div>
//                                     <span className="text-emerald-300 text-[11px] font-bold animate-pulse relative z-10">Triangulando GPS...</span>
//                                     <div className="ml-auto flex items-end gap-[2px] h-4 relative z-10 flex-shrink-0">
//                                       {[0.4, 0.65, 1].map((d, i) => (
//                                         <div key={i} className="w-1 bg-emerald-400 rounded-sm"
//                                           style={{ height: `${40 + i * 25}%`, animation: `gp ${0.8 + i * 0.15}s ease-in-out infinite`, animationDelay: `${d * 0.3}s` }} />
//                                       ))}
//                                     </div>
//                                   </div>
//                                 ) : (
//                                   <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                     className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
//                                     <FaCrosshairs size={10} /> Capturar ubicación exacta
//                                   </button>
//                                 )}
//                               </div>

//                               {/* Foto */}
//                               <div className="relative aspect-video bg-white rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors">
//                                 {ev.photo ? (
//                                   <>
//                                     <img src={ev.photo} className="w-full h-full object-cover" alt="evidencia" />
//                                     <button type="button"
//                                       onClick={() => setChecklist(prev => prev.map(item =>
//                                         item.id === itemActual.id
//                                           ? { ...item, evidence: item.evidence.map(e => e.id === ev.id ? { ...e, photo: null } : e) }
//                                           : item
//                                       ))}
//                                       className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">
//                                       <FaTrash size={9} />
//                                     </button>
//                                   </>
//                                 ) : (
//                                   <>
//                                     <FaCamera className="text-slate-300 mb-1" size={16} />
//                                     <span className="text-[10px] font-bold text-slate-400">SUBIR FOTO</span>
//                                   </>
//                                 )}
//                                 <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
//                                   onChange={e => handlePhotoUpload(e, itemActual.id, ev.id)}
//                                   onClick={e => { (e.target as HTMLInputElement).value = ''; }} />
//                               </div>
//                             </div>
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 </div>

//                 {/* Navegación */}
//                 <div className="flex justify-between mt-5">
//                   <button onClick={() => setPreguntaActual(p => Math.max(0, p - 1))}
//                     disabled={preguntaActual === 0}
//                     className="px-5 py-2 font-bold text-slate-400 hover:text-slate-600 disabled:opacity-30 text-sm transition-colors">
//                     ← Anterior
//                   </button>
//                   <button onClick={() => setPreguntaActual(p => Math.min(checklist.length - 1, p + 1))}
//                     disabled={preguntaActual === checklist.length - 1}
//                     className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-30">
//                     Siguiente →
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {/* ── PANEL LATERAL: Mapa + Acciones ───────────────── */}
//             <div className="space-y-3">
//               {/* Mapa */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
//                 <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
//                   <FaMapMarkedAlt className="text-orange-500" size={13} />
//                   <h3 className="font-bold text-slate-600 text-xs uppercase tracking-wide">Geo-referencias</h3>
//                   {geoRefs > 0 && (
//                     <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{geoRefs}</span>
//                   )}
//                 </div>
//                 <div ref={mapRef} className="h-48">
//                   <LeafletMap gps={gpsVista} reportes={[]} georefPins={georefPins} />
//                 </div>
//                 {geoRefs === 0 && (
//                   <p className="text-[11px] text-slate-400 text-center py-2 border-t border-slate-50">
//                     Las geo-refs aparecerán aquí
//                   </p>
//                 )}
//               </div>

//               {/* Acciones */}
//               <button onClick={procesarFormularioActual}
//                 className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm">
//                 <FaFilePdf /> Guardar y añadir a cola PDF
//               </button>
//               <button onClick={generarPDFLocal}
//                 className="w-full py-3 bg-slate-800 text-white rounded-2xl font-bold shadow flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors text-sm">
//                 <FaFilePdf className="text-slate-400" /> Vista previa PDF
//               </button>
//               <button onClick={() => { if (window.confirm('¿Reiniciar formulario?')) limpiarFormulario(); }}
//                 className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors text-sm">
//                 <FaUndo size={12} /> Reiniciar
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default FormularioUnificado;










// 'use client';

// import { usePDFQueue } from '@/app/context/pdf-queue-context';
// import { mostrarOpcionesPostGuardado } from '@/app/lib/generarPDFCombinado';
// import React, { useState, useRef, useEffect, useCallback } from 'react';
// import {
//   FaCrosshairs, FaCamera, FaMapMarkedAlt,
//   FaFilePdf, FaTrash, FaUndo, FaPlus,
// } from 'react-icons/fa';
// import jsPDF from 'jspdf';
// import 'leaflet/dist/leaflet.css';
// import dynamic from 'next/dynamic';
// import autoTable from 'jspdf-autotable';
// import { crearReporte, actualizarReporte } from '@/app/lib/actions';

// const LeafletMap = dynamic(
//   () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
//   { ssr: false }
// );

// // ═══════════════════════════════════════════════════════════
// //  INTERFACES
// // ═══════════════════════════════════════════════════════════
// interface FormularioProps {
//   reportesIniciales?: any[];
//   reporteParaEditar?: any;
// }
// interface GpsCoords { lat: string | null; lon: string | null; precision: string; }
// interface GeoRef   { lat: string; lon: string; precision: string; timestamp: string; }
// interface EvidenceEntry { id: number; observation: string; geoRef: GeoRef | null; photo: string | null; }
// interface ChecklistItem {
//   id: number; seccion: string; pregunta: string; respuesta: string;
//   evidence: EvidenceEntry[];
//   // compat BD
//   observacion: string; geoRef?: GeoRef | null;
// }
// interface FormData {
//   sector: string; Tramo: string; accesoPublico: string;
//   tipoMantenimiento: string; categoria: string; subTipo: string;
// }
// interface Seccion { titulo: string; items: string[]; }

// // ═══════════════════════════════════════════════════════════
// //  CATÁLOGO UNIFICADO
// //  Estructura: CATALOGO[categoria][subTipo] = Seccion[]
// // ═══════════════════════════════════════════════════════════
// const CATALOGO: Record<string, Record<string, Seccion[]>> = {

//   // ── 1. ALUMBRADO PÚBLICO ─────────────────────────────────
//   'ALUMBRADO PÚBLICO': {
//     'Alumbrado Público Solar': [{
//       titulo: 'ALUMBRADO PÚBLICO SOLAR',
//       items: [
//         'OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?',
//         'LA FOTOCELDA ¿CUMPLE CON SU FUNCIÓN?',
//         'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'INTEGRIDAD DE LUMINARIA',
//         'ESTADO DE POSTE METÁLICO/CONCRETO',
//         'ESTADO DE BASE DE CONCRETO',
//       ],
//     }],
//     'Alumbrado Público Eléctrico': [{
//       titulo: 'ALUMBRADO PÚBLICO ELÉCTRICO',
//       items: [
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//         'EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS',
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'EL BRAZO ¿SE ENCUENTRA EN BUENAS CONDICIONES?',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'INTEGRIDAD DE LUMINARIA',
//         'ESTADO DE POSTE METÁLICO/CONCRETO',
//         'ESTADO DE BASE DE CONCRETO',
//       ],
//     }],
//     'Luminaria Tipo Cerillo': [{
//       titulo: 'LUMINARIA TIPO CERILLO',
//       items: [
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'ESTADO DE BASE DE CONCRETO',
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//       ],
//     }],
//     'Luminaria Tipo Europea': [{
//       titulo: 'LUMINARIA TIPO EUROPEA',
//       items: [
//         'REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS',
//         'LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN',
//         'ESTADO DE BASE DE CONCRETO',
//         'FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?',
//         'ESTADO DEL ELEMENTO PORTADOR DE LA LUMINARIA (POSTE PIRAMIDAL PREFABRICADO)',
//       ],
//     }],
//     'Otros': [{
//       titulo: 'OTROS',
//       items: [
//         'PARABUSES',
//         'PROYECTOR LED',
//         'PROYECTOR SPOT',
//         'LUMINARIAS EMPOTRABLES FRAGATA',
//       ],
//     }],
//   },

//   // ── 2. ÁREAS VERDES ──────────────────────────────────────
//   'AREAS VERDES': {
//     'Áreas Verdes': [
//       {
//         titulo: '1. PODA',
//         items: [
//           '1.1 DESHIERBE – EN CAMELLÓN EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
//           '1.1 DESHIERBE – EN JARDINERA EVITANDO LA PROLIFERACIÓN DE MALEZA NOCIVA',
//           '1.2 CAJETE – EN CAMELLÓN',
//           '1.3 CAJILLO – EN CAMELLONES CON UN ANCHO DE 10 CM Y PROFUNDIDAD DE 12 CM',
//           '1.4 DESORILLE DE ARRIATES/JARDINERA: SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
//           '1.4 DESORILLE DE CAMELLÓN ANCHO 15 CM ± 2 CM; SIN INVASIÓN A GUARNICIÓNES/BANQUETAS',
//           '1.5 PODA DE PASTO CON MAQUINARIA A UNA ALTURA PROMEDIO DE 2.5 A 5 CM',
//           '1.6 PODA DE SETOS CUANDO LA GEOMETRÍA DEL ARBUSTO YA NO ES UNIFORME (ARBUSTOS Y PLANTAS DE ORNATO) UTILIZANDO HERRAMIENTA MANUAL Y MECÁNICA',
//           '1.7 PODA DE ÁRBOLES DE 2 A 5 M DE FRONDOSIDAD Y DE 2.00 A 6.00 M DE ALTURA',
//           '1.7 PODA DE ÁRBOLES DE 5.01 M. A 10 DE FRONDOSIDAD Y DE 6.01 A 12.00 M DE ALTURA',
//           '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
//           '1.8 DESPALAPE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
//           '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE HASTA 6.00 M',
//           '1.9 DESCOQUE DE PALMERAS CON UNA ALTURA DE 6.01 A 12 M',
//         ],
//       },
//       {
//         titulo: '2. TALA DE ÁRBOLES O PALMERAS',
//         items: [
//           'TALA, TROZA, CARGA Y RETIRO DE ÁRBOLES POR MEDIOS MANUALES BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) HASTA 5.00 M DE ALTURA',
//           'TALA, TROZA, CARGA Y RETIRO DE PALMERAS BAJO CUALQUIER CONDICIÓN (FENÓMENOS NATURALES, RIESGO AL PEATÓN O ESPECIE MUERTA) DE 5.01 A 12.00 M',
//         ],
//       },
//       {
//         titulo: '4. ESCOMBRO',
//         items: [
//           'ÁREA LIBRE DE CONTAMINACIÓN (TIERRA/CASCAJO, LODOS, EXCRETAS, HIDROCARBUROS, ESCOMBROS)',
//         ],
//       },
//       {
//         titulo: '5. LIMPIEZA ÁREAS VERDES',
//         items: [
//           'JARDINERAS/ARRIATES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
//           'CAMELLONES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO)',
//         ],
//       },
//       {
//         titulo: '6. RED DE RIEGO',
//         items: [
//           'RED DE RIEGO TAPADA, FUERA DE DIRECCIÓN O CON FUGAS',
//         ],
//       },
//       {
//         titulo: '7. RETIRO DE TOCONES',
//         items: [
//           'CORTE A 15 CM DEBAJO DEL NIVEL EXISTENTE DE TOCON. DE HASTA 50 CM DE DIAMETRO',
//         ],
//       },
//       {
//         titulo: '8. FUMIGACIÓN',
//         items: [
//           'ESPECIE PRESENTA PLAGA',
//           'ESPECIE PRESENTA HONGO O PUDRICIÓN',
//         ],
//       },
//     ],
//   },

//   // ── 3. BARRIDO VIALIDADES ─────────────────────────────────
//   'BARRIDO VIALIDADES': {
//     'Barrido de Vialidades': [{
//       titulo: 'BARRIDO DE VIALIDADES',
//       items: [
//         'BARRIDO MANUAL DE VIALIDADES',
//         'BARRIDO MANUAL DE BANQUETAS',
//         'BARRIDO MANUAL DE CUNETAS',
//         'BARRIDO MANUAL DE ANDADORES',
//         'BARRIDO MANUAL DE CAMELLONES (SOLO SUPERFICIE DURA)',
//         'BARRIDO MANUAL EN PARQUES O PLAZOLETAS (SOLO ÁREAS DURAS)',
//         'BARRIDO MECÁNICO CON BARREDORA EN VIALIDADES PRINCIPALES',
//         'ACOPIO Y RECOLECCIÓN DEL MATERIAL PRODUCTO DEL BARRIDO EN PUNTOS DESIGNADOS',
//       ],
//     }],
//   },

//   // ── 4. LIMPIEZA URBANA ────────────────────────────────────
//   'LIMPIEZA URBANA': {
//     'Limpieza Urbana': [{
//       titulo: 'LIMPIEZA URBANA',
//       items: [
//         'ÁREA GENERAL LIMPIA DE BASURA VISIBLE A LO LARGO DEL TRAMO',
//         'BANQUETAS BARRIDAS Y LIBRES DE RESIDUOS SOLIDOS',
//         'CUNETAS LIMPIAS Y SIN OBSTRUCCIONES POR RESIDUOS',
//         'ACUMULACIÓN DE BASURA EN PUNTOS CRÍTICOS (ESQUINAS, ACCESOS, MUROS)',
//         'PLAYA LIMPIA DE RESIDUOS ORGÁNICOS E INORGÁNICOS (SI APLICA)',
//         'ACCESOS A PLAYA O ZONA PÚBLICA LIBRES DE BASURA',
//         'BOTES DE BASURA VACÍOS (NO REBASADOS)',
//         'BOTES Y CONTENEDORES LIMPIOS POR DENTRO Y POR FUERA',
//         'ÁREA ALREDEDOR DEL BOTE (1 METRO) LIBRE DE RESIDUOS',
//         'LIXIVIADOS O DERRAMES ALREDEDOR DE BOTES O CONTENEDORES',
//         'RESIDUOS DISPERSOS DESPUÉS DE LA RECOLECCIÓN',
//         'PODA EN GRAL CADA 6 MESES',
//         '¿EL CANAL PLUVIAL PRESENTA OBSTRUCCIONES (BASURA, SEDIMENTOS, VEGETACIÓN, LODO, ETC.)?',
//         '¿EL CANAL PLUVIAL PRESENTA DAÑOS ESTRUCTURALES (FISURAS, DESPRENDIMIENTOS, DEFORMACIONES, SOCAVACIONES)?',
//         '¿EL AGUA PUEDE FLUIR LIBREMENTE A TRAVÉS DEL CANAL PLUVIAL?',
//         '¿LOS ACCESOS AL CANAL (TAPAS, REJILLAS, REGISTROS) ESTÁN EN BUEN ESTADO?',
//         '¿EL CANAL PLUVIAL SE ENCUENTRA EN BUENAS CONDICIONES (SIN OBSTRUCCIONES, SIN DAÑO ESTRUCTURAL Y CON FLUJO LIBRE)?',
//         'INDIQUE EL ESTADO ACTUAL DE LA REJILLA PLUVIAL (PUEDE SELECCIONAR MÁS DE UNA OPCIÓN)',
//       ],
//     }],
//   },

//   // ── 5. MOBILIARIO URBANO ──────────────────────────────────
//   'MOBILIARIO URBANO': {
//     'Mobiliario Urbano': [{
//       titulo: 'MOBILIARIO URBANO',
//       items: [
//         'BACHEO DE CALLE (M2)',
//         'REPARACIÓN DE BANQUETA (ML)',
//         'MANTENIMIENTO DE PARABUSES',
//         'SUSTITUCIÓN DE TAPAS DE CONCRETO DIFERENTES EMPRESAS (TELECOMUNICACIONES, CFE Y ALUMBRADO)',
//         '¿EL BARANDAL (ACERO INOXIDABLE O ACERO NORMAL) SE ENCUENTRA EN BUEN ESTADO GENERAL, SIN CORROSIÓN, SIN DEFORMACIONES, BIEN ALINEADO Y FIRMEMENTE ANCLADO?',
//         '¿EL BARANDAL CUMPLE CON LA ALTURA Y LOS CRITERIOS DE SEGURIDAD, SIN TRAMOS FALTANTES O DAÑADOS?',
//         'ESTADO DE SEÑALETICAS',
//         'BALIZADO DE CALLE',
//         'ESTADO DE MURALES',
//         'ESTADO DEL BOLARDO',
//         'FIGURAS LÚDICAS',
//         'MANTENIMIENTO DE POSTE DE SEMÁFORO',
//         'MANTENIMIENTO DE RAMPAS',
//       ],
//     }],
//   },
// };

// // ── Color por categoría ────────────────────────────────────
// const CATEGORIA_COLOR: Record<string, { header: string; tab: string; badge: string }> = {
//   'ALUMBRADO PÚBLICO':  { header: 'from-yellow-600 to-yellow-700',   tab: 'bg-yellow-50  text-yellow-800',  badge: 'bg-yellow-100  text-yellow-700'  },
//   'AREAS VERDES':       { header: 'from-emerald-600 to-emerald-700', tab: 'bg-emerald-50 text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
//   'BARRIDO VIALIDADES': { header: 'from-blue-600 to-blue-700',       tab: 'bg-blue-50    text-blue-800',    badge: 'bg-blue-100    text-blue-700'    },
//   'LIMPIEZA URBANA':    { header: 'from-orange-600 to-orange-700',   tab: 'bg-orange-50  text-orange-800',  badge: 'bg-orange-100  text-orange-700'  },
//   'MOBILIARIO URBANO':  { header: 'from-purple-600 to-purple-700',   tab: 'bg-purple-50  text-purple-800',  badge: 'bg-purple-100  text-purple-700'  },
// };

// const TRAMOS_POR_SECTOR: Record<string, string[]> = {
//   'Barra de Coyuca':      ['Sendero-Seguro-Barra Coyuca'],
//   'Pie de la Cuesta':     ['Sendero-seguro-Pie de la cuesta'],
//   'Barrios Historicos':   ['Caleta-caletilla', 'Sendero-Costera-antigua', 'Corredor Zocalo-quebrada', 'Corredor zocalo-fuerte'],
//   'Acapulco Tradicional': ['Sendero-Tadeo-arredondo', 'Sendero-cinerio-hornitos', 'Michoacan', 'Av. Universidad', 'Dr. Ignacio chavez'],
//   'Acapulco Dorado':      ['Costa azul'],
//   'Las Brisas':           [''],
//   'Puerto Márquez':       ['Sendero-Puerto-Marquez'],
//   'Acapulco Diamante':    ['Av. Costera Palmas'],
//   'Otro':                 [''],
// };

// // ── Helpers ────────────────────────────────────────────────
// const emptyEntry = (id: number): EvidenceEntry => ({ id, observation: '', geoRef: null, photo: null });

// const buildChecklist = (categoria: string, subTipo: string): ChecklistItem[] => {
//   const secciones = CATALOGO[categoria]?.[subTipo] ?? [];
//   let counter = 1;
//   return secciones.flatMap(sec =>
//     sec.items.map(pregunta => ({
//       id: counter++,
//       seccion: sec.titulo,
//       pregunta,
//       respuesta: '',
//       observacion: '',
//       geoRef: null,
//       evidence: [emptyEntry(1)],
//     }))
//   );
// };

// const CATEGORIAS = Object.keys(CATALOGO);

// // ═══════════════════════════════════════════════════════════
// //  COMPONENTE PRINCIPAL
// // ═══════════════════════════════════════════════════════════
// const FormularioUnificado: React.FC<FormularioProps> = ({ reporteParaEditar }) => {
//   const { addToQueue } = usePDFQueue();
//   const mapRef        = useRef<HTMLDivElement>(null);
//   const geoRefWatchId = useRef<number | null>(null);

//   const [currentTime,         setCurrentTime]         = useState('');
//   const [preguntaActual,      setPreguntaActual]       = useState(0);
//   const [sectorPersonalizado, setSectorPersonalizado]  = useState('');
//   const [tramoPersonalizado,  setTramoPersonalizado]   = useState('');
//   const [capturandoGps, setCapturandoGps] = useState<{ itemId: number; entryId: number } | null>(null);

//   const catInicial    = reporteParaEditar?.categoria ?? 'ALUMBRADO PÚBLICO';
//   const subtiposInic  = Object.keys(CATALOGO[catInicial] ?? {});
//   const subTipoInicial = reporteParaEditar?.subTipo ?? subtiposInic[0] ?? '';

//   const [formData, setFormData] = useState<FormData>({
//     sector:            reporteParaEditar?.sector            ?? '',
//     Tramo:             reporteParaEditar?.tramo             ?? '',
//     accesoPublico:     reporteParaEditar?.acceso_publico    ?? '',
//     tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
//     categoria:         catInicial,
//     subTipo:           subTipoInicial,
//   });

//   const [checklist, setChecklist] = useState<ChecklistItem[]>(
//     buildChecklist(catInicial, subTipoInicial)
//   );

//   // ── Geo-pins para el mapa ──────────────────────────────
//   const georefPins = React.useMemo(() =>
//     checklist.flatMap(item =>
//       item.evidence.filter(ev => ev.geoRef).map((ev, ei) => ({
//         lat: ev.geoRef!.lat, lon: ev.geoRef!.lon,
//         label: item.evidence.length > 1 ? `${item.id}.${ei + 1}` : String(item.id),
//         pregunta: item.pregunta, observation: ev.observation, cumple: item.respuesta,
//       }))
//     )
//   , [checklist]);

//   const gpsVista: GpsCoords = React.useMemo(() =>
//     georefPins.length > 0
//       ? { lat: georefPins[georefPins.length - 1].lat, lon: georefPins[georefPins.length - 1].lon, precision: '--' }
//       : { lat: null, lon: null, precision: '--' }
//   , [georefPins]);

//   // ── Efectos ────────────────────────────────────────────
//   useEffect(() => {
//     const tick = () => setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
//     tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
//   }, []);

//   useEffect(() => {
//     import('leaflet').then(L => {
//       delete (L.Icon.Default.prototype as any)._getIconUrl;
//       L.Icon.Default.mergeOptions({
//         iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//         iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//         shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
//       });
//     });
//   }, []);

//   useEffect(() => {
//     return () => { if (geoRefWatchId.current !== null) navigator.geolocation.clearWatch(geoRefWatchId.current); };
//   }, []);

//   // ── Cambio de categoría ────────────────────────────────
//   const handleCategoriaChange = useCallback((nuevaCat: string) => {
//     const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
//     if (hayEvidencias && !window.confirm('Cambiar categoría borrará las evidencias actuales. ¿Continuar?')) return;
//     const subtipo = Object.keys(CATALOGO[nuevaCat] ?? {})[0] ?? '';
//     setFormData(prev => ({ ...prev, categoria: nuevaCat, subTipo: subtipo }));
//     setChecklist(buildChecklist(nuevaCat, subtipo));
//     setPreguntaActual(0);
//   }, [checklist]);

//   // ── Cambio de sub-tipo ─────────────────────────────────
//   const handleSubTipoChange = useCallback((nuevoSub: string) => {
//     const hayEvidencias = checklist.some(i => i.evidence.some(e => e.observation || e.geoRef || e.photo));
//     if (hayEvidencias && !window.confirm('Cambiar el tipo borrará las evidencias actuales. ¿Continuar?')) return;
//     setFormData(prev => ({ ...prev, subTipo: nuevoSub }));
//     setChecklist(buildChecklist(formData.categoria, nuevoSub));
//     setPreguntaActual(0);
//   }, [checklist, formData.categoria]);

//   // ── GPS por evidencia ──────────────────────────────────
//   const capturarGeoRef = useCallback((itemId: number, entryId: number) => {
//     if (!navigator.geolocation) return alert('GPS no soportado.');
//     setCapturandoGps({ itemId, entryId });
//     geoRefWatchId.current = navigator.geolocation.watchPosition(
//       ({ coords: { latitude, longitude, accuracy } }) => {
//         const timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
//         setChecklist(prev => prev.map(item =>
//           item.id === itemId ? {
//             ...item,
//             evidence: item.evidence.map(e => e.id === entryId
//               ? { ...e, geoRef: { lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m`, timestamp } }
//               : e)
//           } : item
//         ));
//         if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; }
//         setCapturandoGps(null);
//       },
//       () => { setCapturandoGps(null); alert('No se pudo obtener la ubicación.'); },
//       { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
//     );
//     setTimeout(() => {
//       if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; setCapturandoGps(null); }
//     }, 12000);
//   }, []);

//   // ── Evidencia helpers ──────────────────────────────────
//   const addEvidence = useCallback((itemId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: [...item.evidence, emptyEntry(item.evidence.length + 1)] } : item
//     ));
//   }, []);

//   const removeEvidence = useCallback((itemId: number, entryId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.filter(e => e.id !== entryId) } : item
//     ));
//   }, []);

//   const updateObservation = useCallback((itemId: number, entryId: number, val: string) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, observation: val } : e) } : item
//     ));
//   }, []);

//   const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, itemId: number, entryId: number) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     const img = new Image();
//     img.onload = () => {
//       const ratio = Math.min(900 / img.width, 1);
//       const canvas = document.createElement('canvas');
//       canvas.width = img.width * ratio; canvas.height = img.height * ratio;
//       canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
//       const b64 = canvas.toDataURL('image/jpeg', 0.82);
//       setChecklist(prev => prev.map(item =>
//         item.id === itemId ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, photo: b64 } : e) } : item
//       ));
//     };
//     img.src = URL.createObjectURL(file);
//   }, []);

//   const limpiarFormulario = useCallback(() => {
//     setChecklist(buildChecklist(formData.categoria, formData.subTipo));
//     setPreguntaActual(0);
//   }, [formData.categoria, formData.subTipo]);

//   // ── Guardar en BD ──────────────────────────────────────
//   const guardarCuestionario = useCallback(async () => {
//     const sectorFinal = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramoFinal  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;
//     const fd = { ...formData, sector: sectorFinal, Tramo: tramoFinal };
//     const checklistDB = checklist.map(item => ({
//       ...item,
//       observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//       geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//     }));
//     const lastGeoRef = checklist.flatMap(i => i.evidence).find(e => e.geoRef)?.geoRef;
//     const gpsDB: GpsCoords = lastGeoRef
//       ? { lat: lastGeoRef.lat, lon: lastGeoRef.lon, precision: lastGeoRef.precision }
//       : { lat: null, lon: null, precision: '--' };
//     if (reporteParaEditar?.id) {
//       await actualizarReporte(reporteParaEditar.id.toString(), fd, checklistDB as any, gpsDB, {});
//       alert('¡Reporte actualizado!');
//     } else {
//       await crearReporte(fd, checklistDB as any, gpsDB, {});
//       alert('¡Reporte guardado!');
//     }
//   }, [formData, sectorPersonalizado, tramoPersonalizado, checklist, reporteParaEditar]);

//   // ── Procesar y añadir a cola ───────────────────────────
//   const procesarFormularioActual = useCallback(async () => {
//     try {
//       await guardarCuestionario();
//       addToQueue({
//         categoria: formData.categoria,
//         formData:  { ...formData },
//         checklist: checklist.map(item => ({
//           ...item,
//           observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//           geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//         })) as any,
//         gps:          gpsVista,
//         fotos:        {},
//         mapImage:     null,
//         fechaCaptura: new Date(),
//       });
//       const opcion = await mostrarOpcionesPostGuardado();
//       if (opcion === 'otro_mismo' || opcion === 'generar_ahora') limpiarFormulario();
//     } catch (err) { console.error(err); alert('Error al procesar el formulario.'); }
//   }, [addToQueue, checklist, formData, gpsVista, guardarCuestionario, limpiarFormulario]);

//   // ── PDF local rápido ───────────────────────────────────
//   const generarPDFLocal = useCallback(async () => {
//     const doc       = new jsPDF('p', 'mm', 'a4');
//     const pageW     = doc.internal.pageSize.getWidth();
//     const pageH     = doc.internal.pageSize.getHeight();
//     const margin    = 12;
//     const folio     = `REV-${formData.categoria.slice(0, 3).toUpperCase()}-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 900 + 100)}`;
//     const sector    = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramo     = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;

//     let y = 18;
//     doc.setFont('helvetica', 'bold').setFontSize(12);
//     doc.text(`REPORTE ${formData.categoria} – CIP ACAPULCO-COYUCA`, margin, y);
//     y += 4; doc.setLineWidth(0.5).line(margin, y, pageW - margin, y); y += 6;
//     doc.setFont('helvetica', 'normal').setFontSize(9);
//     doc.text(`Folio: ${folio}   Sector: ${sector}   Tramo: ${tramo}`, margin, y); y += 5;
//     doc.setFont('helvetica', 'bold').text(`Sub-tipo: ${formData.subTipo}   Mantenimiento: ${formData.tipoMantenimiento}`, margin, y);
//     doc.setFont('helvetica', 'normal'); y += 8;

//     const rows: any[] = [];
//     checklist.forEach(item => {
//       item.evidence.forEach((ev, ei) => {
//         rows.push([
//           ei === 0 ? String(item.id) : '',
//           ei === 0 ? item.pregunta   : `↳ Incidencia ${ei + 1}`,
//           ev.geoRef?.lat ?? '',
//           ev.geoRef?.lon ?? '',
//           ev.observation || '',
//           { content: '', photo: ev.photo },
//         ]);
//       });
//     });

//     autoTable(doc, {
//       startY: y,
//       margin: { left: margin, right: margin },
//       head: [[
//         { content: 'No.',      styles: { halign: 'center' } },
//         { content: 'Concepto / Incidencia' },
//         { content: 'Lat',      styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Lon',      styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Observaciones' },
//         { content: 'Foto',     styles: { halign: 'center' } },
//       ]],
//       body: rows,
//       theme: 'grid',
//       styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle', overflow: 'linebreak', lineWidth: 0.2 },
//       headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
//       columnStyles: {
//         0: { cellWidth: 10, halign: 'center' },
//         1: { cellWidth: 62 },
//         2: { cellWidth: 22, halign: 'center', fontSize: 7 },
//         3: { cellWidth: 22, halign: 'center', fontSize: 7 },
//         4: { cellWidth: 42 },
//         5: { cellWidth: 28, halign: 'center' },
//       },
//       didDrawCell: (data: any) => {
//         if (data.section === 'body' && data.column.index === 5 && data.cell.raw?.photo) {
//           try {
//             const p = doc.getImageProperties(data.cell.raw.photo);
//             const maxW = 24, maxH = data.cell.height - 2;
//             const ratio = Math.min(maxW / p.width, maxH / p.height);
//             const dw = p.width * ratio, dh = p.height * ratio;
//             doc.addImage(data.cell.raw.photo, 'JPEG',
//               data.cell.x + (maxW - dw) / 2 + 1,
//               data.cell.y + (data.cell.height - dh) / 2,
//               dw, dh, `ev-${data.row.index}`, 'FAST');
//           } catch { /* imagen inválida */ }
//         }
//       },
//       rowPageBreak: 'avoid',
//     });

//     // Marca de agua
//     for (let i = 1; i <= doc.getNumberOfPages(); i++) {
//       doc.setPage(i); doc.saveGraphicsState();
//       doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
//       doc.addImage('/logo_fonatur.png', 'PNG', (pageW - 130) / 2, (pageH - 38) / 2, 130, 38);
//       doc.restoreGraphicsState();
//     }
//     doc.save(`${folio}.pdf`);
//   }, [checklist, formData, sectorPersonalizado, tramoPersonalizado]);

//   // ═══════════════════════════════════════════════════════
//   //  RENDER
//   // ═══════════════════════════════════════════════════════
//   const itemActual   = checklist[preguntaActual];
//   const subtipos     = Object.keys(CATALOGO[formData.categoria] ?? {});
//   const tieneSubtipos = subtipos.length > 1;
//   const color        = CATEGORIA_COLOR[formData.categoria] ?? CATEGORIA_COLOR['ALUMBRADO PÚBLICO'];

//   const totalItems  = checklist.length;
//   const geoRefs     = checklist.flatMap(i => i.evidence).filter(e => e.geoRef).length;
//   const fotos       = checklist.flatMap(i => i.evidence).filter(e => e.photo).length;
//   const conEvidencia = checklist.filter(i => i.evidence.some(e => e.observation || e.geoRef || e.photo)).length;

//   return (
//     <div className="min-h-screen bg-[#eef2f6] font-sans text-gray-700">
//       <div className="max-w-5xl mx-auto">

//         {/* ── HEADER con tabs de categoría ─────────────────── */}
//         <header className={`bg-gradient-to-r ${color.header} text-white shadow-lg pt-6 px-6 flex flex-col`}>
//           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-5">
//             <div>
//               <h1 className="text-xl font-extrabold tracking-wide uppercase">
//                 Reporte de Mantenimiento — CIP Acapulco-Coyuca
//               </h1>
//               <p className="text-white/70 text-xs mt-0.5">Selecciona categoría y sub-tipo para cargar el cuestionario</p>
//             </div>
//             <div className="text-xs font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
//               {currentTime}
//             </div>
//           </div>

//           {/* Tabs de categoría */}
//           <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
//             {CATEGORIAS.map(cat => (
//               <button key={cat} onClick={() => handleCategoriaChange(cat)}
//                 className={`flex-shrink-0 px-3 py-2.5 rounded-t-xl font-bold text-[11px] transition-colors whitespace-nowrap ${
//                   formData.categoria === cat
//                     ? 'bg-[#eef2f6] text-gray-800'
//                     : 'bg-black/20 text-white/80 hover:bg-black/30'
//                 }`}>
//                 {cat}
//               </button>
//             ))}
//           </div>
//         </header>

//         {/* ── Sub-tipo (solo si la categoría tiene varios) ─── */}
//         {tieneSubtipos && (
//           <div className="bg-white border-b border-gray-100 px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide shadow-sm">
//             {subtipos.map(sub => (
//               <button key={sub} onClick={() => handleSubTipoChange(sub)}
//                 className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
//                   formData.subTipo === sub
//                     ? color.tab + ' shadow-sm'
//                     : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
//                 }`}>
//                 {sub}
//               </button>
//             ))}
//           </div>
//         )}

//         {/* ── Sub-tipo como select en mobile o categorías sin subtabs ── */}
//         {!tieneSubtipos && subtipos.length === 1 && (
//           <div className={`px-6 py-2.5 border-b border-gray-100 bg-white shadow-sm`}>
//             <span className={`text-xs font-bold px-3 py-1 rounded-full ${color.badge}`}>
//               {formData.subTipo}
//             </span>
//           </div>
//         )}

//         <div className="p-4 sm:p-5 space-y-4">

//           {/* ── DATOS GENERALES ──────────────────────────────── */}
//           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
//             <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
//               {/* Sector */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Sector</label>
//                 <select value={formData.sector}
//                   onChange={e => setFormData(prev => ({ ...prev, sector: e.target.value, Tramo: '' }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-[#e67e22] text-sm focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30">
//                   <option value="">Seleccionar</option>
//                   {Object.keys(TRAMOS_POR_SECTOR).map(s => <option key={s} value={s}>{s}</option>)}
//                 </select>
//                 {formData.sector === 'Otro' && (
//                   <input type="text" placeholder="Sector..." value={sectorPersonalizado}
//                     onChange={e => setSectorPersonalizado(e.target.value)}
//                     className="mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 )}
//               </div>

//               {/* Tramo */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tramo</label>
//                 {formData.sector === 'Otro' ? (
//                   <input type="text" placeholder="Tramo..." value={tramoPersonalizado}
//                     onChange={e => setTramoPersonalizado(e.target.value)}
//                     className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 ) : (
//                   <select value={formData.Tramo}
//                     onChange={e => setFormData(prev => ({ ...prev, Tramo: e.target.value }))}
//                     disabled={!formData.sector}
//                     className="px-3 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-50">
//                     <option value="">Seleccionar</option>
//                     {(TRAMOS_POR_SECTOR[formData.sector] || []).map(t => <option key={t} value={t}>{t}</option>)}
//                   </select>
//                 )}
//               </div>

//               {/* Acceso */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Acceso a playa</label>
//                 <input type="text" placeholder="Acceso" value={formData.accesoPublico}
//                   onChange={e => setFormData(prev => ({ ...prev, accesoPublico: e.target.value }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
//               </div>

//               {/* Tipo mantenimiento */}
//               <div className="flex flex-col gap-1">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tipo mantenimiento</label>
//                 <select value={formData.tipoMantenimiento}
//                   onChange={e => setFormData(prev => ({ ...prev, tipoMantenimiento: e.target.value }))}
//                   className={`px-3 py-2 rounded-xl border font-bold text-sm ${
//                     formData.tipoMantenimiento === 'Urgente'
//                       ? 'bg-red-50 border-red-200 text-red-600'
//                       : 'bg-slate-50 border-slate-200 text-gray-700'
//                   }`}>
//                   <option value="">Seleccionar</option>
//                   <option value="Urgente">🚨 Urgente</option>
//                   <option value="Ordinario">📋 Ordinario</option>
//                   <option value="Programable">🗓️ Programable</option>
//                 </select>
//               </div>
//             </div>
//           </div>

//           {/* ── GRID PRINCIPAL ───────────────────────────────── */}
//           <div className="grid lg:grid-cols-3 gap-4">

//             {/* ── WIZARD (2/3) ──────────────────────────────── */}
//             <div className="lg:col-span-2 space-y-3">

//               {/* Progreso + mini-mapa */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
//                 <div className="flex justify-between items-center mb-2">
//                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{formData.subTipo}</span>
//                   <div className="flex gap-2 text-[11px]">
//                     <span className={`px-2 py-0.5 rounded-full font-bold ${color.badge}`}>{conEvidencia}/{totalItems} con evidencia</span>
//                     <span className="text-slate-400">📍{geoRefs} 📷{fotos}</span>
//                   </div>
//                 </div>
//                 <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
//                   <div
//                     className="h-1.5 rounded-full transition-all duration-500 bg-emerald-500"
//                     style={{ width: `${totalItems ? (conEvidencia / totalItems) * 100 : 0}%` }}
//                   />
//                 </div>
//                 {/* Mini mapa de ítems */}
//                 <div className="flex flex-wrap gap-1.5">
//                   {checklist.map((item, idx) => {
//                     const tiene = item.evidence.some(e => e.observation || e.geoRef || e.photo);
//                     return (
//                       <button key={item.id} type="button" onClick={() => setPreguntaActual(idx)}
//                         title={item.pregunta}
//                         className={`w-7 h-7 rounded-full text-[10px] font-bold transition-all border-2 ${
//                           idx === preguntaActual ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
//                         } ${tiene ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
//                         {item.id}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>

//               {/* Tarjeta de ítem */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
//                 {/* Sección badge */}
//                 <span className="inline-block text-[10px] uppercase font-black text-slate-400 tracking-widest bg-slate-100 px-3 py-1 rounded-full mb-3">
//                   {itemActual.seccion}
//                 </span>

//                 <h2 className="text-base font-bold text-slate-800 mb-4 leading-snug">
//                   <span className="text-slate-300 mr-2 font-mono">#{itemActual.id}</span>
//                   {itemActual.pregunta}
//                 </h2>

//                 {/* Evidencias */}
//                 <div className="border-t border-slate-100 pt-4">
//                   <div className="flex justify-between items-center mb-3">
//                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidencias / Incidencias</h3>
//                     <button onClick={() => addEvidence(itemActual.id)}
//                       className="flex items-center gap-1 text-xs font-bold text-emerald-600 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
//                       <FaPlus size={9} /> Añadir evidencia
//                     </button>
//                   </div>

//                   <div className="space-y-3">
//                     {itemActual.evidence.map(ev => {
//                       const isCapturing = capturandoGps?.itemId === itemActual.id && capturandoGps?.entryId === ev.id;
//                       return (
//                         <div key={ev.id} className="group relative">
//                           {itemActual.evidence.length > 1 && (
//                             <button onClick={() => removeEvidence(itemActual.id, ev.id)}
//                               className="absolute -right-1 top-3 z-10 w-7 h-7 rounded-full bg-red-500 text-white shadow
//                                          flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
//                               <FaTrash size={10} />
//                             </button>
//                           )}
//                           <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
//                             <div className="grid md:grid-cols-2 gap-3">
//                               {/* Observación + GeoRef */}
//                               <div className="space-y-2">
//                                 <input type="text" placeholder="Observación..."
//                                   value={ev.observation}
//                                   onChange={e => updateObservation(itemActual.id, ev.id, e.target.value)}
//                                   className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />

//                                 {ev.geoRef ? (
//                                   <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between">
//                                     <div className="text-[11px] font-mono text-emerald-700">
//                                       <span className="font-bold">X:</span> {ev.geoRef.lat}<br/>
//                                       <span className="font-bold">Y:</span> {ev.geoRef.lon}
//                                       <span className="ml-2 text-emerald-400">±{ev.geoRef.precision}</span>
//                                     </div>
//                                     <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                       className="text-emerald-400 hover:text-emerald-600 ml-2" title="Recapturar">
//                                       <FaUndo size={10} />
//                                     </button>
//                                   </div>
//                                 ) : isCapturing ? (
//                                   <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-emerald-800 py-2.5 px-3 flex items-center gap-2.5">
//                                     <style>{`
//                                       @keyframes gs{0%{transform:translateY(-100%)}100%{transform:translateY(250%)}}
//                                       @keyframes gr{from{transform:rotate(0)}to{transform:rotate(360deg)}}
//                                       @keyframes gp{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:0;transform:scale(1.8)}}
//                                     `}</style>
//                                     <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
//                                       <div className="w-full h-6 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-500/40 border-b border-emerald-400/50"
//                                         style={{ animation: 'gs 1.3s linear infinite' }} />
//                                     </div>
//                                     <div className="relative w-6 h-6 flex-shrink-0 flex items-center justify-center">
//                                       <div className="absolute inset-0 rounded-full border border-emerald-500/40" style={{ animation: 'gp 1.8s ease-in-out infinite' }} />
//                                       <div className="absolute inset-0.5 rounded-full border-2 border-transparent border-t-emerald-400" style={{ animation: 'gr 0.75s linear infinite' }} />
//                                       <FaCrosshairs className="text-emerald-300 relative z-10 text-[9px]" />
//                                     </div>
//                                     <span className="text-emerald-300 text-[11px] font-bold animate-pulse relative z-10">Triangulando GPS...</span>
//                                     <div className="ml-auto flex items-end gap-[2px] h-4 relative z-10 flex-shrink-0">
//                                       {[0.4, 0.65, 1].map((d, i) => (
//                                         <div key={i} className="w-1 bg-emerald-400 rounded-sm"
//                                           style={{ height: `${40 + i * 25}%`, animation: `gp ${0.8 + i * 0.15}s ease-in-out infinite`, animationDelay: `${d * 0.3}s` }} />
//                                       ))}
//                                     </div>
//                                   </div>
//                                 ) : (
//                                   <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                     className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
//                                     <FaCrosshairs size={10} /> Capturar ubicación exacta
//                                   </button>
//                                 )}
//                               </div>

//                               {/* Foto */}
//                               <div className="relative aspect-video bg-white rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors">
//                                 {ev.photo ? (
//                                   <>
//                                     <img src={ev.photo} className="w-full h-full object-cover" alt="evidencia" />
//                                     <button type="button"
//                                       onClick={() => setChecklist(prev => prev.map(item =>
//                                         item.id === itemActual.id
//                                           ? { ...item, evidence: item.evidence.map(e => e.id === ev.id ? { ...e, photo: null } : e) }
//                                           : item
//                                       ))}
//                                       className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">
//                                       <FaTrash size={9} />
//                                     </button>
//                                   </>
//                                 ) : (
//                                   <>
//                                     <FaCamera className="text-slate-300 mb-1" size={16} />
//                                     <span className="text-[10px] font-bold text-slate-400">SUBIR FOTO</span>
//                                   </>
//                                 )}
//                                 <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
//                                   onChange={e => handlePhotoUpload(e, itemActual.id, ev.id)}
//                                   onClick={e => { (e.target as HTMLInputElement).value = ''; }} />
//                               </div>
//                             </div>
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 </div>

//                 {/* Navegación */}
//                 <div className="flex justify-between mt-5">
//                   <button onClick={() => setPreguntaActual(p => Math.max(0, p - 1))}
//                     disabled={preguntaActual === 0}
//                     className="px-5 py-2 font-bold text-slate-400 hover:text-slate-600 disabled:opacity-30 text-sm transition-colors">
//                     ← Anterior
//                   </button>
//                   <button onClick={() => setPreguntaActual(p => Math.min(checklist.length - 1, p + 1))}
//                     disabled={preguntaActual === checklist.length - 1}
//                     className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-30">
//                     Siguiente →
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {/* ── PANEL LATERAL: Mapa + Acciones ───────────────── */}
//             <div className="space-y-3">
//               {/* Mapa */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
//                 <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
//                   <FaMapMarkedAlt className="text-orange-500" size={13} />
//                   <h3 className="font-bold text-slate-600 text-xs uppercase tracking-wide">Geo-referencias</h3>
//                   {geoRefs > 0 && (
//                     <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{geoRefs}</span>
//                   )}
//                 </div>
//                 <div ref={mapRef} className="h-48">
//                   <LeafletMap gps={gpsVista} reportes={[]} georefPins={georefPins} />
//                 </div>
//                 {geoRefs === 0 && (
//                   <p className="text-[11px] text-slate-400 text-center py-2 border-t border-slate-50">
//                     Las geo-refs aparecerán aquí
//                   </p>
//                 )}
//               </div>

//               {/* Acciones */}
//               <button onClick={procesarFormularioActual}
//                 className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm">
//                 <FaFilePdf /> Guardar y añadir a cola PDF
//               </button>
//               <button onClick={generarPDFLocal}
//                 className="w-full py-3 bg-slate-800 text-white rounded-2xl font-bold shadow flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors text-sm">
//                 <FaFilePdf className="text-slate-400" /> Vista previa PDF
//               </button>
//               <button onClick={() => { if (window.confirm('¿Reiniciar formulario?')) limpiarFormulario(); }}
//                 className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors text-sm">
//                 <FaUndo size={12} /> Reiniciar
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default FormularioUnificado;








// 'use client';

// import { usePDFQueue } from '@/app/context/pdf-queue-context';
// import React, { useState, useRef, useEffect, useCallback } from 'react';
// import {
//   FaCrosshairs, FaCamera, FaFolderOpen, FaMapMarkedAlt,
//   FaFilePdf, FaTrash, FaUndo, FaPlus, FaChevronDown, FaChevronUp
// } from 'react-icons/fa';
// import jsPDF from 'jspdf';
// import 'leaflet/dist/leaflet.css';
// import dynamic from 'next/dynamic';
// import autoTable from 'jspdf-autotable';
// import { crearReporte, actualizarReporte } from '@/app/lib/actions';

// const LeafletMap = dynamic(
//   () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
//   { ssr: false }
// );

// // ═══════════════════════════════════════════════════════════
// //  INTERFACES
// // ═══════════════════════════════════════════════════════════
// interface FormularioProps {
//   reportesIniciales?: any[];
//   reporteParaEditar?: any;
// }
// interface GpsCoords { lat: string | null; lon: string | null; precision: string; }
// interface FormData {
//   id: string; sector: string; Tramo: string; accesoPublico: string;
//   tipoMantenimiento: string; categoria: string; tipoAlumbrado: string;
// }
// interface GeoRef { lat: string; lon: string; precision: string; timestamp: string; }

// interface EvidenceEntry {
//   id: number;
//   observation: string;
//   geoRef: GeoRef | null;
//   photo: string | null;
// }

// interface ChecklistItem {
//   id: number;
//   seccion: string;
//   pregunta: string;
//   respuesta: string;
//   evidence: EvidenceEntry[];
//   // Compat DB
//   observacion: string;
//   geoRef?: GeoRef | null;
// }

// // ═══════════════════════════════════════════════════════════
// //  SECCIONES POR TIPO (imagen 3)
// // ═══════════════════════════════════════════════════════════
// interface Seccion { titulo: string; items: string[]; }

// const SECCIONES_POR_TIPO: Record<string, Seccion[]> = {
//   "Alumbrado Público Solar": [{
//     titulo: "ALUMBRADO PÚBLICO SOLAR",
//     items: [
//       "OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?",
//       "LA FOTOCELDA ¿CUMPLE CON SU FUNCIÓN?",
//       "EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?",
//       "LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN",
//       "INTEGRIDAD DE LUMINARIA",
//       "ESTADO DE POSTE METÁLICO/CONCRETO",
//       "ESTADO DE BASE DE CONCRETO",
//     ],
//   }],
//   "Alumbrado Público Eléctrico": [{
//     titulo: "ALUMBRADO PÚBLICO ELÉCTRICO",
//     items: [
//       "FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?",
//       "EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?",
//       "ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS",
//       "REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS",
//       "EL BRAZO ¿SE ENCUENTRA EN BUENAS CONDICIONES?",
//       "LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN",
//       "INTEGRIDAD DE LUMINARIA",
//       "ESTADO DE POSTE METÁLICO/CONCRETO",
//       "ESTADO DE BASE DE CONCRETO",
//     ],
//   }],
//   "Luminaria Tipo Cerillo": [{
//     titulo: "LUMINARIA TIPO CERILLO",
//     items: [
//       "REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS",
//       "LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN",
//       "ESTADO DE BASE DE CONCRETO",
//       "FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?",
//     ],
//   }],
//   "Luminaria Tipo Europea": [{
//     titulo: "LUMINARIA TIPO EUROPEA",
//     items: [
//       "REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS",
//       "LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN",
//       "ESTADO DE BASE DE CONCRETO",
//       "FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?",
//       "ESTADO DEL ELEMENTO PORTADOR DE LA LUMINARIA (POSTE PIRAMIDAL PREFABRICADO)",
//     ],
//   }],
//   "Otros": [{
//     titulo: "OTROS",
//     items: ["PARABUSES", "PROYECTOR LED", "PROYECTOR SPOT", "LUMINARIAS EMPOTRABLES FRAGATA"],
//   }],
// };

// const TRAMOS_POR_SECTOR: Record<string, string[]> = {
//   "Barra de Coyuca":      ["Sendero-Seguro-Barra Coyuca"],
//   "Pie de la Cuesta":     ["Sendero-seguro-Pie de la cuesta"],
//   "Barrios Historicos":   ["Caleta-caletilla", "Sendero-Costera-antigua", "Corredor Zocalo-quebrada", "Corredor zocalo-fuerte"],
//   "Acapulco Tradicional": ["Sendero-Tadeo-arredondo", "Sendero-cinerio-hornitos", "Michoacan", "Av. Universidad", "Dr. Ignacio chavez"],
//   "Acapulco Dorado":      ["Costa azul"],
//   "Las Brisas":           [""],
//   "Puerto Márquez":       ["Sendero-Puerto-Marquez"],
//   "Acapulco Diamante":    ["Av. Costera Palmas"],
//   "Otro":                 [""],
// };

// // ── Helpers ──────────────────────────────────────────────
// const emptyEntry = (id: number): EvidenceEntry => ({ id, observation: '', geoRef: null, photo: null });

// const buildChecklist = (tipo: string): ChecklistItem[] => {
//   const secciones = SECCIONES_POR_TIPO[tipo] ?? [];
//   let counter = 1;
//   return secciones.flatMap(sec =>
//     sec.items.map(pregunta => ({
//       id: counter++,
//       seccion: sec.titulo,
//       pregunta,
//       respuesta: '',
//       observacion: '',
//       geoRef: null,
//       evidence: [emptyEntry(1)],
//     }))
//   );
// };

// function mostrarOpcionesPostGuardado(): Promise<'otro_mismo' | 'otro_distinto' | 'generar_ahora'> {
//   return new Promise(resolve => {
//     if (window.confirm('✅ Guardado.\n\n¿Llenar OTRO del mismo tipo?')) return resolve('otro_mismo');
//     resolve(window.confirm('¿Generar PDF AHORA con la cola actual?') ? 'generar_ahora' : 'otro_distinto');
//   });
// }

// // ═══════════════════════════════════════════════════════════
// //  COMPONENTE
// // ═══════════════════════════════════════════════════════════
// const FormularioAlumbrado: React.FC<FormularioProps> = ({ reporteParaEditar }) => {
//   const { addToQueue } = usePDFQueue();
//   const mapRef        = useRef<HTMLDivElement>(null);
//   const geoRefWatchId = useRef<number | null>(null);

//   const [currentTime,      setCurrentTime]      = useState('');
//   const [preguntaActual,   setPreguntaActual]    = useState(0);
//   const [sectorPersonalizado, setSectorPersonalizado] = useState('');
//   const [tramoPersonalizado,  setTramoPersonalizado]  = useState('');
//   const [capturandoGps,    setCapturandoGps]     = useState<{ itemId: number; entryId: number } | null>(null);

//   const tipoInicial = reporteParaEditar?.tipoAlumbrado ?? 'Alumbrado Público Eléctrico';

//   const [formData, setFormData] = useState<FormData>({
//     id:                reporteParaEditar?.id                ?? '',
//     sector:            reporteParaEditar?.sector            ?? '',
//     Tramo:             reporteParaEditar?.tramo             ?? '',
//     accesoPublico:     reporteParaEditar?.acceso_publico    ?? '',
//     tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
//     categoria:         'ALUMBRADO PÚBLICO',
//     tipoAlumbrado:     tipoInicial,
//   });


//   const [checklist, setChecklist] = useState<ChecklistItem[]>(buildChecklist(tipoInicial));

//   // ── Derivados del checklist — useMemo para que estén disponibles en callbacks ──
//   const georefPins = React.useMemo(() =>
//     checklist.flatMap(item =>
//       item.evidence
//         .filter(ev => ev.geoRef)
//         .map((ev, ei) => ({
//           lat:         ev.geoRef!.lat,
//           lon:         ev.geoRef!.lon,
//           label:       item.evidence.length > 1 ? `${item.id}.${ei + 1}` : String(item.id),
//           pregunta:    item.pregunta,
//           observation: ev.observation,
//           cumple:      item.respuesta,
//         }))
//     )
//   , [checklist]);

//   const gpsVista: GpsCoords = React.useMemo(() =>
//     georefPins.length > 0
//       ? { lat: georefPins[georefPins.length - 1].lat, lon: georefPins[georefPins.length - 1].lon, precision: '--' }
//       : { lat: null, lon: null, precision: '--' }
//   , [georefPins]);


//   useEffect(() => {
//     const tick = () => setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
//     tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
//   }, []);

//   useEffect(() => {
//     import('leaflet').then(L => {
//       delete (L.Icon.Default.prototype as any)._getIconUrl;
//       L.Icon.Default.mergeOptions({
//         iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//         iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//         shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
//       });
//     });
//   }, []);

//   useEffect(() => {
//     return () => { if (geoRefWatchId.current !== null) navigator.geolocation.clearWatch(geoRefWatchId.current); };
//   }, []);

//   // ── Cambio de tipo luminaria (tab) ───────────────────────
//   const handleTipoChange = useCallback((nuevoTipo: string) => {
//     const conEvidencia = checklist.filter(i => i.evidence.some(e => e.observation || e.geoRef || e.photo)).length;
//     if (conEvidencia > 0 && !window.confirm('Cambiar la luminaria borrará las evidencias actuales. ¿Continuar?')) return;
//     setFormData(prev => ({ ...prev, tipoAlumbrado: nuevoTipo }));
//     setChecklist(buildChecklist(nuevoTipo));
//     setPreguntaActual(0);
//   }, [checklist]);

//   // ── GPS por evidencia ────────────────────────────────────
//   const capturarGeoRef = useCallback((itemId: number, entryId: number) => {
//     if (!navigator.geolocation) return alert('GPS no soportado.');
//     setCapturandoGps({ itemId, entryId });
//     geoRefWatchId.current = navigator.geolocation.watchPosition(
//       ({ coords: { latitude, longitude, accuracy } }) => {
//         const timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
//         setChecklist(prev => prev.map(item =>
//           item.id === itemId ? {
//             ...item,
//             evidence: item.evidence.map(e => e.id === entryId
//               ? { ...e, geoRef: { lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m`, timestamp } }
//               : e)
//           } : item
//         ));
//         if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; }
//         setCapturandoGps(null);
//       },
//       () => { setCapturandoGps(null); alert('No se pudo obtener la ubicación.'); },
//       { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
//     );
//     setTimeout(() => {
//       if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; setCapturandoGps(null); }
//     }, 12000);
//   }, []);

//   // ── Evidencia helpers ────────────────────────────────────
//   const addEvidence = useCallback((itemId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: [...item.evidence, emptyEntry(item.evidence.length + 1)] } : item
//     ));
//   }, []);

//   const removeEvidence = useCallback((itemId: number, entryId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.filter(e => e.id !== entryId) } : item
//     ));
//   }, []);

//   const updateObservation = useCallback((itemId: number, entryId: number, val: string) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, observation: val } : e) } : item
//     ));
//   }, []);

//   const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, itemId: number, entryId: number) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     const img = new Image();
//     img.onload = () => {
//       const ratio = Math.min(700 / img.width, 1);
//       const canvas = document.createElement('canvas');
//       canvas.width = img.width * ratio; canvas.height = img.height * ratio;
//       canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
//       const b64 = canvas.toDataURL('image/jpeg', 0.65);
//       setChecklist(prev => prev.map(item =>
//         item.id === itemId ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, photo: b64 } : e) } : item
//       ));
//     };
//     img.src = URL.createObjectURL(file);
//   }, []);

//   const limpiarFormulario = useCallback(() => {
//     setChecklist(buildChecklist(formData.tipoAlumbrado));
//     setPreguntaActual(0);
//   }, [formData.tipoAlumbrado]);

//   // ── Guardar en BD ────────────────────────────────────────
//   const guardarCuestionario = useCallback(async (): Promise<string> => {
//     const sectorFinal = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramoFinal  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;
//     const fd = { ...formData, sector: sectorFinal, Tramo: tramoFinal };
//     // Aplanar evidence al campo observacion para compat DB
//     const checklistDB = checklist.map(item => ({
//       ...item,
//       observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//       geoRef: item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//     }));
//     const lastGeoRef = checklist.flatMap(i => i.evidence).find(e => e.geoRef)?.geoRef;
//     const gpsDB: GpsCoords = lastGeoRef
//       ? { lat: lastGeoRef.lat, lon: lastGeoRef.lon, precision: lastGeoRef.precision }
//       : { lat: null, lon: null, precision: '--' };
//     if (reporteParaEditar?.id) {
//       const id = await actualizarReporte(reporteParaEditar.id.toString(), fd, checklistDB as any, gpsDB, {});
//       alert('¡Reporte actualizado!'); return id;
//     } else {
//       const id = await crearReporte(fd, checklistDB as any, gpsDB, {});
//       alert('¡Reporte guardado!'); return id;
//     }
//   }, [formData, sectorPersonalizado, tramoPersonalizado, checklist, reporteParaEditar]);

//   // ── Procesar ─────────────────────────────────────────────
//   const procesarFormularioActual = useCallback(async () => {
//     // Sin validación de respuesta — el formulario ahora es solo de evidencias
//     try {
//       const reporteId = await guardarCuestionario();
//       addToQueue({
//         id: reporteId, categoria: formData.categoria,
//         formData: { ...formData },
//         checklist: checklist.map(item => ({
//           ...item,
//           observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//           geoRef:      item.evidence.find(e => e.geoRef)?.geoRef ?? null,
//           // ← foto: primera evidencia que tenga foto
//           foto:        item.evidence.find(e => e.photo)?.photo ?? null,
//         })) as any,
//         gps: gpsVista,
//         fotos: {},
//         mapImage: null,
//         fechaCaptura: new Date(),
//       });
//       const opcion = await mostrarOpcionesPostGuardado();
//       if (opcion === 'otro_mismo' || opcion === 'generar_ahora') limpiarFormulario();
//     } catch (err) { console.error(err); alert('Error al procesar el formulario.'); }
//   }, [addToQueue, checklist, formData, gpsVista, guardarCuestionario, limpiarFormulario]);

//   // ── PDF local (descarga directa) ─────────────────────────
//   const generarPDFLocal = useCallback(async () => {
//     const doc        = new jsPDF('p', 'mm', 'a4');
//     const pageWidth  = doc.internal.pageSize.getWidth();
//     const pageHeight = doc.internal.pageSize.getHeight();
//     const margin     = 12;
//     const folio      = `REV-ALU-${new Date().toISOString().slice(0,10)}-${Math.floor(Math.random()*900+100)}`;
//     const sectorFinal = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
//     const tramoFinal  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;

//     // Encabezado
//     let y = 18;
//     doc.setFont('helvetica', 'bold').setFontSize(13);
//     doc.text('REPORTE ALUMBRADO PÚBLICO – CIP ACAPULCO-COYUCA', margin, y);
//     y += 4; doc.setLineWidth(0.5).line(margin, y, pageWidth - margin, y); y += 6;
//     doc.setFont('helvetica', 'normal').setFontSize(9);
//     doc.text(`Folio: ${folio}   Sector: ${sectorFinal}   Tramo: ${tramoFinal}`, margin, y); y += 5;
//     doc.setFont('helvetica', 'bold').text(`Tipo: ${formData.tipoAlumbrado}   Mantenimiento: ${formData.tipoMantenimiento}`, margin, y);
//     doc.setFont('helvetica', 'normal'); y += 8;

//     // Tabla: No | Concepto + Coords | Cumple | NoCumple | Observaciones | Foto
//     const rows: any[] = [];
//     checklist.forEach(item => {
//       item.evidence.forEach((ev, ei) => {
//         const geoX = ev.geoRef ? ev.geoRef.lat : '';
//         const geoY = ev.geoRef ? ev.geoRef.lon : '';
//         rows.push([
//           ei === 0 ? String(item.id) : '',
//           ei === 0 ? item.pregunta : `↳ Incidencia ${ei + 1}`,
//           geoX,
//           geoY,

//           ev.observation || '',
//           { content: '', photo: ev.photo },
//         ]);
//       });
//     });

//     autoTable(doc, {
//       startY: y,
//       margin: { left: margin, right: margin },
//       head: [[
//         { content: 'No.', styles: { halign: 'center' } },
//         { content: 'Concepto / Incidencia', styles: { halign: 'center' } },
//         { content: 'X\n(lat)', styles: { halign: 'center', fontSize: 7 } },
//         { content: 'Y\n(lon)', styles: { halign: 'center', fontSize: 7 } },

//         { content: 'Observaciones', styles: { halign: 'center' } },
//         { content: 'Foto', styles: { halign: 'center' } },
//       ]],
//       body: rows,
//       theme: 'grid',
//       styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle', overflow: 'linebreak', lineWidth: 0.2 },
//       headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
//       columnStyles: {
//         0: { cellWidth: 10, halign: 'center' },
//         1: { cellWidth: 52 },
//         2: { cellWidth: 14, halign: 'center', fontSize: 7 },
//         3: { cellWidth: 14, halign: 'center', fontSize: 7 },
//         4: { cellWidth: 10, halign: 'center', fontSize: 11 },
//         5: { cellWidth: 10, halign: 'center', fontSize: 11 },
//         6: { cellWidth: 42 },
//         7: { cellWidth: 26, halign: 'center' },
//       },
//       didDrawCell: (data: any) => {
//         if (data.section === 'body' && data.column.index === 5 && data.cell.raw?.photo) {
//           try {
//             const p = doc.getImageProperties(data.cell.raw.photo);
//             const maxW = 23, maxH = data.cell.height - 2;
//             const ratio = Math.min(maxW / p.width, maxH / p.height);
//             const dw = p.width * ratio, dh = p.height * ratio;
//             doc.addImage(data.cell.raw.photo, 'JPEG',
//               data.cell.x + (maxW - dw) / 2 + 1,
//               data.cell.y + (data.cell.height - dh) / 2,
//               dw, dh, `ev-${data.row.index}`, 'FAST');
//           } catch { /* imagen inválida */ }
//         }
//       },
//       rowPageBreak: 'avoid',
//     });

//     // Marca de agua
//     for (let i = 1; i <= doc.getNumberOfPages(); i++) {
//       doc.setPage(i); doc.saveGraphicsState();
//       doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
//       doc.addImage('/logo_fonatur.png', 'PNG', (pageWidth - 130) / 2, (pageHeight - 38) / 2, 130, 38);
//       doc.restoreGraphicsState();
//     }
//     doc.save(`${folio}.pdf`);
//   }, [checklist, formData, sectorPersonalizado, tramoPersonalizado]);

//   // ═══════════════════════════════════════════════════════════
//   //  RENDER
//   // ═══════════════════════════════════════════════════════════
//   const itemActual    = checklist[preguntaActual];

//   const tiposLuminaria = Object.keys(SECCIONES_POR_TIPO);
//   const totalItems    = checklist.length;
//   const respondidos   = checklist.filter(i => i.respuesta !== '').length;
//   const incidencias   = checklist.filter(i => i.respuesta === 'NO').length;
//   const geoRefs       = checklist.flatMap(i => i.evidence).filter(e => e.geoRef).length;

//   return (
//     <div className="min-h-screen bg-[#eef2f6] font-sans text-gray-700 py-0">
//       <div className="max-w-5xl mx-auto space-y-0">

//         {/* ── HEADER + TABS (estilo vehículo) ─────────────────── */}
//         <header className="relative bg-emerald-700 text-white rounded-b-none overflow-hidden shadow-lg pt-8 px-8 flex flex-col">
//           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
//             <div>
//               <h1 className="text-2xl font-extrabold tracking-wide uppercase">
//                 Reporte de Mantenimiento – Alumbrado Público
//               </h1>
//               <p className="text-emerald-200 text-sm mt-1">CIP Acapulco-Coyuca</p>
//             </div>
//             <div className="text-right text-xs font-mono bg-black/20 px-4 py-2 rounded-xl border border-white/10">
//               {currentTime}
//             </div>
//           </div>

//           {/* TABS de tipo luminaria */}
//           <div className="flex gap-1.5 overflow-x-auto pb-0 scrollbar-hide">
//             {tiposLuminaria.map(tipo => (
//               <button key={tipo} onClick={() => handleTipoChange(tipo)}
//                 className={`flex-shrink-0 px-4 py-2.5 rounded-t-xl font-bold text-xs transition-colors whitespace-nowrap ${
//                   formData.tipoAlumbrado === tipo
//                     ? 'bg-[#eef2f6] text-emerald-800'
//                     : 'bg-emerald-800/50 text-emerald-100 hover:bg-emerald-600'
//                 }`}>
//                 {tipo}
//               </button>
//             ))}
//           </div>
//         </header>

//         <div className="p-4 sm:p-6 space-y-5">

//           {/* ── DATOS: SECTOR / TRAMO / TIPO MANT ────────────────── */}
//           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
//             <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
//               <div className="flex flex-col gap-1.5">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Sector</label>
//                 <select value={formData.sector} onChange={e => setFormData(prev => ({ ...prev, sector: e.target.value, Tramo: '' }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-[#e67e22] text-sm focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30">
//                   <option value="">Seleccionar</option>
//                   {Object.keys(TRAMOS_POR_SECTOR).map(s => <option key={s} value={s}>{s}</option>)}
//                 </select>
//                 {formData.sector === 'Otro' && (
//                   <input type="text" placeholder="Sector..." value={sectorPersonalizado}
//                     onChange={e => setSectorPersonalizado(e.target.value)} className="mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 )}
//               </div>
//               <div className="flex flex-col gap-1.5">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tramo</label>
//                 {formData.sector === 'Otro' ? (
//                   <input type="text" placeholder="Tramo..." value={tramoPersonalizado}
//                     onChange={e => setTramoPersonalizado(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
//                 ) : (
//                   <select value={formData.Tramo} onChange={e => setFormData(prev => ({ ...prev, Tramo: e.target.value }))}
//                     disabled={!formData.sector} className="px-3 py-2 rounded-xl border border-slate-200 text-sm">
//                     <option value="">Seleccionar</option>
//                     {(TRAMOS_POR_SECTOR[formData.sector] || []).map(t => <option key={t} value={t}>{t}</option>)}
//                   </select>
//                 )}
//               </div>
//               <div className="flex flex-col gap-1.5">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Acceso a playa</label>
//                 <input type="text" placeholder="Acceso" value={formData.accesoPublico}
//                   onChange={e => setFormData(prev => ({ ...prev, accesoPublico: e.target.value }))}
//                   className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
//               </div>
//               <div className="flex flex-col gap-1.5">
//                 <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tipo Mantenimiento</label>
//                 <select value={formData.tipoMantenimiento} onChange={e => setFormData(prev => ({ ...prev, tipoMantenimiento: e.target.value }))}
//                   className={`px-3 py-2 rounded-xl border font-bold text-sm transition-colors ${formData.tipoMantenimiento === 'Urgente' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-gray-700'}`}>
//                   <option value="">Seleccionar</option>
//                   <option value="Urgente">🚨 Urgente</option>
//                   <option value="Ordinario">📋 Ordinario</option>
//                   <option value="Programable">🗓️ Programable</option>
//                 </select>
//               </div>
//             </div>
//           </div>

//           {/* ── GRID PRINCIPAL: WIZARD + MAPA ────────────────────── */}
//           <div className="grid lg:grid-cols-3 gap-5">

//             {/* ── WIZARD (2/3) ────────────────────────────────────── */}
//             <div className="lg:col-span-2 space-y-4">

//               {/* Barra de progreso */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
//                 <div className="flex justify-between items-center mb-2">
//                   <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{formData.tipoAlumbrado}</span>
//                   <span className="text-xs bg-slate-100 px-3 py-1 rounded-full text-slate-500 font-semibold">{respondidos}/{totalItems}</span>
//                 </div>
//                 <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
//                   <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
//                     style={{ width: `${totalItems ? (respondidos / totalItems) * 100 : 0}%` }} />
//                 </div>
//                 <div className="flex flex-wrap gap-3 text-[11px]">
//                   <span className="text-amber-600 font-semibold">📍 {geoRefs} geo-refs</span>
//                   <span className="text-blue-500 font-semibold">📷 {checklist.flatMap(i => i.evidence).filter(e => e.photo).length} fotos</span>
//                   <span className="text-slate-400">{respondidos}/{totalItems} respondidos</span>
//                 </div>

//                 {/* Mini mapa de ítems */}
//                 <div className="flex flex-wrap gap-1.5 mt-3">
//                   {checklist.map((item, idx) => (
//                     <button key={item.id} type="button" onClick={() => setPreguntaActual(idx)}
//                       title={item.pregunta}
//                       className={`w-7 h-7 rounded-full text-[10px] font-bold transition-all border-2 ${
//                         idx === preguntaActual ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
//                       } ${
//                         item.respuesta === 'SI' ? 'bg-emerald-500 border-emerald-500 text-white'
//                         : item.respuesta === 'NO' ? 'bg-red-500 border-red-500 text-white'
//                         : 'bg-white border-gray-200 text-gray-400'
//                       }`}>
//                       {item.id}
//                     </button>
//                   ))}
//                 </div>
//               </div>

//               {/* Tarjeta de pregunta */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
//                 {/* Etiqueta sección */}
//                 <div className="mb-3">
//                   <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest bg-slate-100 px-3 py-1 rounded-full">
//                     {itemActual.seccion}
//                   </span>
//                 </div>

//                 <h2 className="text-lg font-bold text-slate-800 mb-5 leading-snug">
//                   <span className="text-slate-300 mr-2">#{itemActual.id}</span>
//                   {itemActual.pregunta}
//                 </h2>

//                 {/* Evidencias */}
//                 <div className="border-t border-slate-100 pt-5">
//                   <div className="flex justify-between items-center mb-4">
//                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
//                       Evidencias / Incidencias
//                     </h3>
//                     <button onClick={() => addEvidence(itemActual.id)}
//                       className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
//                       <FaPlus size={10} /> Añadir evidencia
//                     </button>
//                   </div>

//                   <div className="space-y-3">
//                     {itemActual.evidence.map((ev) => {
//                       const isCapturing = capturandoGps?.itemId === itemActual.id && capturandoGps?.entryId === ev.id;
//                       return (
//                         <div key={ev.id} className="group relative">
//                           {/* Botón eliminar — deslizable en móvil, visible en hover desktop */}
//                           {itemActual.evidence.length > 1 && (
//                             <button
//                               onClick={() => removeEvidence(itemActual.id, ev.id)}
//                               className="absolute -right-1 top-1/2 -translate-y-1/2 z-10
//                                          w-12 h-12 rounded-full
//                                          bg-red-500 text-white shadow-lg
//                                          flex items-center justify-center
//                                          translate-x-full
//                                          sm:translate-x-full sm:opacity-0 sm:group-hover:opacity-100 sm:group-hover:translate-x-1/2
//                                          active:scale-95 transition-all duration-200
//                                          touch-manipulation">
//                               <FaTrash size={14} />
//                             </button>
//                           )}
//                           <div className={`bg-slate-50 rounded-2xl p-4 border border-slate-100 transition-transform duration-200 ${itemActual.evidence.length > 1 ? 'active:translate-x-[-3rem] sm:active:translate-x-0' : ''}`}>
//                           <div className="grid md:grid-cols-2 gap-3">
//                             {/* Izq: observación + georef */}
//                             <div className="space-y-2.5">
//                               <input type="text" placeholder="Observación..."
//                                 value={ev.observation}
//                                 onChange={e => updateObservation(itemActual.id, ev.id, e.target.value)}
//                                 className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />

//                               {/* GeoRef button */}
//                               {ev.geoRef ? (
//                                 <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between">
//                                   <div className="text-[11px] font-mono text-emerald-700">
//                                     <span className="font-bold">X:</span> {ev.geoRef.lat}<br/>
//                                     <span className="font-bold">Y:</span> {ev.geoRef.lon}
//                                     <span className="ml-2 text-emerald-400">±{ev.geoRef.precision}</span>
//                                   </div>
//                                   <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                     className="text-emerald-400 hover:text-emerald-600 ml-2" title="Recapturar">
//                                     <FaUndo size={11} />
//                                   </button>
//                                 </div>
//                               ) : isCapturing ? (
//                                 // Animación radar mientras captura
//                                 <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-emerald-800 py-2.5 px-3 flex items-center gap-2.5">
//                                   <style>{`
//                                     @keyframes gs{0%{transform:translateY(-100%)}100%{transform:translateY(250%)}}
//                                     @keyframes gr{from{transform:rotate(0)}to{transform:rotate(360deg)}}
//                                     @keyframes gp{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:0;transform:scale(1.8)}}
//                                   `}</style>
//                                   <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
//                                     <div className="w-full h-6 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-500/40 border-b border-emerald-400/50"
//                                       style={{ animation: 'gs 1.3s linear infinite' }} />
//                                   </div>
//                                   <div className="relative w-6 h-6 flex-shrink-0 flex items-center justify-center">
//                                     <div className="absolute inset-0 rounded-full border border-emerald-500/40" style={{ animation: 'gp 1.8s ease-in-out infinite' }} />
//                                     <div className="absolute inset-0.5 rounded-full border-2 border-transparent border-t-emerald-400" style={{ animation: 'gr 0.75s linear infinite' }} />
//                                     <FaCrosshairs className="text-emerald-300 relative z-10 text-[9px]" />
//                                   </div>
//                                   <span className="text-emerald-300 text-[11px] font-bold animate-pulse relative z-10">
//                                     Triangulando GPS...
//                                   </span>
//                                   <div className="ml-auto flex items-end gap-[2px] h-4 relative z-10 flex-shrink-0">
//                                     {[0.4, 0.65, 1].map((d, i) => (
//                                       <div key={i} className="w-1 bg-emerald-400 rounded-sm"
//                                         style={{ height: `${40 + i * 25}%`, animation: `gp ${0.8 + i * 0.15}s ease-in-out infinite`, animationDelay: `${d * 0.3}s` }} />
//                                     ))}
//                                   </div>
//                                 </div>
//                               ) : (
//                                 <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
//                                   className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
//                                   <FaCrosshairs size={11} /> Capturar ubicación exacta
//                                 </button>
//                               )}
//                             </div>

//                             {/* Der: foto */}
//                             <div className="relative aspect-video bg-white rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors">
//                               {ev.photo ? (
//                                 <>
//                                   <img src={ev.photo} className="w-full h-full object-cover" alt="evidencia" />
//                                   <button type="button"
//                                     onClick={() => setChecklist(prev => prev.map(item =>
//                                       item.id === itemActual.id ? { ...item, evidence: item.evidence.map(e => e.id === ev.id ? { ...e, photo: null } : e) } : item
//                                     ))}
//                                     className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">
//                                     <FaTrash size={9} />
//                                   </button>
//                                 </>
//                               ) : (
//                                 <>
//                                   <FaCamera className="text-slate-300 mb-1" size={18} />
//                                   <span className="text-[10px] font-bold text-slate-400">SUBIR FOTO</span>
//                                 </>
//                               )}
//                               <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
//                                 onChange={e => handlePhotoUpload(e, itemActual.id, ev.id)} />
//                             </div>
//                           </div>
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 </div>

//                 {/* Navegación */}
//                 <div className="flex justify-between mt-6">
//                   <button onClick={() => setPreguntaActual(p => Math.max(0, p - 1))} disabled={preguntaActual === 0}
//                     className="px-5 py-2.5 font-bold text-slate-400 hover:text-slate-600 disabled:opacity-30 text-sm transition-colors">
//                     ← Anterior
//                   </button>
//                   <button onClick={() => setPreguntaActual(p => Math.min(checklist.length - 1, p + 1))} disabled={preguntaActual === checklist.length - 1}
//                     className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-30">
//                     Siguiente →
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {/* ── MAPA + ACCIONES (1/3) ────────────────────────────── */}
//             <div className="space-y-4">
//               {/* Mapa — solo muestra geo-refs capturadas */}
//               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
//                 <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
//                   <FaMapMarkedAlt className="text-orange-500" size={14} />
//                   <h3 className="font-bold text-slate-600 text-xs uppercase tracking-wide">Geo-referencias capturadas</h3>
//                   {geoRefs > 0 && <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{geoRefs}</span>}
//                 </div>
//                 <div ref={mapRef} className="h-52">
//                   <LeafletMap gps={gpsVista} reportes={[]} georefPins={georefPins} />
//                 </div>
//                 {geoRefs === 0 && (
//                   <p className="text-[11px] text-slate-400 text-center py-2 border-t border-slate-50">
//                     Las geo-refs aparecerán aquí al capturarlas
//                   </p>
//                 )}
//               </div>

//               {/* Botones */}
//               <button onClick={procesarFormularioActual}
//                 className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm">
//                 <FaFilePdf /> Guardar y añadir a cola PDF
//               </button>
//               <button onClick={generarPDFLocal}
//                 className="w-full py-3 bg-slate-800 text-white rounded-2xl font-bold shadow flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors text-sm">
//                 <FaFilePdf className="text-slate-300" /> Vista previa PDF
//               </button>
//               <button onClick={() => { if (window.confirm('¿Reiniciar formulario?')) limpiarFormulario(); }}
//                 className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors text-sm">
//                 <FaUndo size={13} /> Reiniciar
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default FormularioAlumbrado;



