'use client';

import { usePDFQueue } from '@/app/context/pdf-queue-context';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FaCrosshairs, FaCamera, FaFolderOpen, FaMapMarkedAlt,
  FaFilePdf, FaTrash, FaUndo, FaPlus, FaChevronDown, FaChevronUp
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
interface GpsCoords { lat: string | null; lon: string | null; precision: string; }
interface FormData {
  id: string; sector: string; Tramo: string; accesoPublico: string;
  tipoMantenimiento: string; categoria: string; tipoAlumbrado: string;
}
interface GeoRef { lat: string; lon: string; precision: string; timestamp: string; }

interface EvidenceEntry {
  id: number;
  observation: string;
  geoRef: GeoRef | null;
  photo: string | null;
}

interface ChecklistItem {
  id: number;
  seccion: string;
  pregunta: string;
  respuesta: string;
  evidence: EvidenceEntry[];
  // Compat DB
  observacion: string;
  geoRef?: GeoRef | null;
}

// ═══════════════════════════════════════════════════════════
//  SECCIONES POR TIPO (imagen 3)
// ═══════════════════════════════════════════════════════════
interface Seccion { titulo: string; items: string[]; }

const SECCIONES_POR_TIPO: Record<string, Seccion[]> = {
  "Alumbrado Público Solar": [{
    titulo: "ALUMBRADO PÚBLICO SOLAR",
    items: [
      "OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?",
      "LA FOTOCELDA ¿CUMPLE CON SU FUNCIÓN?",
      "EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?",
      "LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN",
      "INTEGRIDAD DE LUMINARIA",
      "ESTADO DE POSTE METÁLICO/CONCRETO",
      "ESTADO DE BASE DE CONCRETO",
    ],
  }],
  "Alumbrado Público Eléctrico": [{
    titulo: "ALUMBRADO PÚBLICO ELÉCTRICO",
    items: [
      "FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?",
      "EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?",
      "ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS",
      "REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS",
      "EL BRAZO ¿SE ENCUENTRA EN BUENAS CONDICIONES?",
      "LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN",
      "INTEGRIDAD DE LUMINARIA",
      "ESTADO DE POSTE METÁLICO/CONCRETO",
      "ESTADO DE BASE DE CONCRETO",
    ],
  }],
  "Luminaria Tipo Cerillo": [{
    titulo: "LUMINARIA TIPO CERILLO",
    items: [
      "REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS",
      "LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN",
      "ESTADO DE BASE DE CONCRETO",
      "FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?",
    ],
  }],
  "Luminaria Tipo Europea": [{
    titulo: "LUMINARIA TIPO EUROPEA",
    items: [
      "REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS",
      "LUMINARIA SIN OBSTRUCCIONES EN SU RADIO DE ILUMINACIÓN",
      "ESTADO DE BASE DE CONCRETO",
      "FOTOCELDA GENERAL O (TIMER/INTERRUPTOR) ¿CUMPLE CON SU FUNCIÓN?",
      "ESTADO DEL ELEMENTO PORTADOR DE LA LUMINARIA (POSTE PIRAMIDAL PREFABRICADO)",
    ],
  }],
  "Otros": [{
    titulo: "OTROS",
    items: ["PARABUSES", "PROYECTOR LED", "PROYECTOR SPOT", "LUMINARIAS EMPOTRABLES FRAGATA"],
  }],
};

const TRAMOS_POR_SECTOR: Record<string, string[]> = {
  "Barra de Coyuca":      ["Sendero-Seguro-Barra Coyuca"],
  "Pie de la Cuesta":     ["Sendero-seguro-Pie de la cuesta"],
  "Barrios Historicos":   ["Caleta-caletilla", "Sendero-Costera-antigua", "Corredor Zocalo-quebrada", "Corredor zocalo-fuerte"],
  "Acapulco Tradicional": ["Sendero-Tadeo-arredondo", "Sendero-cinerio-hornitos", "Michoacan", "Av. Universidad", "Dr. Ignacio chavez"],
  "Acapulco Dorado":      ["Costa azul"],
  "Las Brisas":           [""],
  "Puerto Márquez":       ["Sendero-Puerto-Marquez"],
  "Acapulco Diamante":    ["Av. Costera Palmas"],
  "Otro":                 [""],
};

// ── Helpers ──────────────────────────────────────────────
const emptyEntry = (id: number): EvidenceEntry => ({ id, observation: '', geoRef: null, photo: null });

const buildChecklist = (tipo: string): ChecklistItem[] => {
  const secciones = SECCIONES_POR_TIPO[tipo] ?? [];
  let counter = 1;
  return secciones.flatMap(sec =>
    sec.items.map(pregunta => ({
      id: counter++,
      seccion: sec.titulo,
      pregunta,
      respuesta: '',
      observacion: '',
      geoRef: null,
      evidence: [emptyEntry(1)],
    }))
  );
};

function mostrarOpcionesPostGuardado(): Promise<'otro_mismo' | 'otro_distinto' | 'generar_ahora'> {
  return new Promise(resolve => {
    if (window.confirm('✅ Guardado.\n\n¿Llenar OTRO del mismo tipo?')) return resolve('otro_mismo');
    resolve(window.confirm('¿Generar PDF AHORA con la cola actual?') ? 'generar_ahora' : 'otro_distinto');
  });
}

// ═══════════════════════════════════════════════════════════
//  COMPONENTE
// ═══════════════════════════════════════════════════════════
const PineoA: React.FC<FormularioProps> = ({ reporteParaEditar }) => {
  const { addToQueue } = usePDFQueue();
  const mapRef        = useRef<HTMLDivElement>(null);
  const geoRefWatchId = useRef<number | null>(null);

  const [currentTime,      setCurrentTime]      = useState('');
  const [preguntaActual,   setPreguntaActual]    = useState(0);
  const [sectorPersonalizado, setSectorPersonalizado] = useState('');
  const [tramoPersonalizado,  setTramoPersonalizado]  = useState('');
  const [capturandoGps,    setCapturandoGps]     = useState<{ itemId: number; entryId: number } | null>(null);

  const tipoInicial = reporteParaEditar?.tipoAlumbrado ?? 'Alumbrado Público Eléctrico';

  const [formData, setFormData] = useState<FormData>({
    id:                reporteParaEditar?.id                ?? '',
    sector:            reporteParaEditar?.sector            ?? '',
    Tramo:             reporteParaEditar?.tramo             ?? '',
    accesoPublico:     reporteParaEditar?.acceso_publico    ?? '',
    tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
    categoria:         'ALUMBRADO PÚBLICO',
    tipoAlumbrado:     tipoInicial,
  });


  const [checklist, setChecklist] = useState<ChecklistItem[]>(buildChecklist(tipoInicial));

  // ── Derivados del checklist — useMemo para que estén disponibles en callbacks ──
  const georefPins = React.useMemo(() =>
    checklist.flatMap(item =>
      item.evidence
        .filter(ev => ev.geoRef)
        .map((ev, ei) => ({
          lat:         ev.geoRef!.lat,
          lon:         ev.geoRef!.lon,
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


  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
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
    return () => { if (geoRefWatchId.current !== null) navigator.geolocation.clearWatch(geoRefWatchId.current); };
  }, []);

  // ── Cambio de tipo luminaria (tab) ───────────────────────
  const handleTipoChange = useCallback((nuevoTipo: string) => {
    const conEvidencia = checklist.filter(i => i.evidence.some(e => e.observation || e.geoRef || e.photo)).length;
    if (conEvidencia > 0 && !window.confirm('Cambiar la luminaria borrará las evidencias actuales. ¿Continuar?')) return;
    setFormData(prev => ({ ...prev, tipoAlumbrado: nuevoTipo }));
    setChecklist(buildChecklist(nuevoTipo));
    setPreguntaActual(0);
  }, [checklist]);

  // ── GPS por evidencia ────────────────────────────────────
  const capturarGeoRef = useCallback((itemId: number, entryId: number) => {
    if (!navigator.geolocation) return alert('GPS no soportado.');
    setCapturandoGps({ itemId, entryId });
    geoRefWatchId.current = navigator.geolocation.watchPosition(
      ({ coords: { latitude, longitude, accuracy } }) => {
        const timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setChecklist(prev => prev.map(item =>
          item.id === itemId ? {
            ...item,
            evidence: item.evidence.map(e => e.id === entryId
              ? { ...e, geoRef: { lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m`, timestamp } }
              : e)
          } : item
        ));
        if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; }
        setCapturandoGps(null);
      },
      () => { setCapturandoGps(null); alert('No se pudo obtener la ubicación.'); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
    setTimeout(() => {
      if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; setCapturandoGps(null); }
    }, 12000);
  }, []);

  // ── Evidencia helpers ────────────────────────────────────
  const addEvidence = useCallback((itemId: number) => {
    setChecklist(prev => prev.map(item =>
      item.id === itemId ? { ...item, evidence: [...item.evidence, emptyEntry(item.evidence.length + 1)] } : item
    ));
  }, []);

  const removeEvidence = useCallback((itemId: number, entryId: number) => {
    setChecklist(prev => prev.map(item =>
      item.id === itemId ? { ...item, evidence: item.evidence.filter(e => e.id !== entryId) } : item
    ));
  }, []);

  const updateObservation = useCallback((itemId: number, entryId: number, val: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === itemId ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, observation: val } : e) } : item
    ));
  }, []);

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, itemId: number, entryId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(700 / img.width, 1);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * ratio; canvas.height = img.height * ratio;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.65);
      setChecklist(prev => prev.map(item =>
        item.id === itemId ? { ...item, evidence: item.evidence.map(e => e.id === entryId ? { ...e, photo: b64 } : e) } : item
      ));
    };
    img.src = URL.createObjectURL(file);
  }, []);

  const limpiarFormulario = useCallback(() => {
    setChecklist(buildChecklist(formData.tipoAlumbrado));
    setPreguntaActual(0);
  }, [formData.tipoAlumbrado]);

  // ── Guardar en BD ────────────────────────────────────────
  const guardarCuestionario = useCallback(async (): Promise<string> => {
    const sectorFinal = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
    const tramoFinal  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;
    const fd = { ...formData, sector: sectorFinal, Tramo: tramoFinal };
    // Aplanar evidence al campo observacion para compat DB
    const checklistDB = checklist.map(item => ({
      ...item,
      observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
      geoRef: item.evidence.find(e => e.geoRef)?.geoRef ?? null,
    }));
    const lastGeoRef = checklist.flatMap(i => i.evidence).find(e => e.geoRef)?.geoRef;
    const gpsDB: GpsCoords = lastGeoRef
      ? { lat: lastGeoRef.lat, lon: lastGeoRef.lon, precision: lastGeoRef.precision }
      : { lat: null, lon: null, precision: '--' };
    if (reporteParaEditar?.id) {
      const id = await actualizarReporte(reporteParaEditar.id.toString(), fd, checklistDB as any, gpsDB, {});
      alert('¡Reporte actualizado!'); return id;
    } else {
      const id = await crearReporte(fd, checklistDB as any, gpsDB, {});
      alert('¡Reporte guardado!'); return id;
    }
  }, [formData, sectorPersonalizado, tramoPersonalizado, checklist, reporteParaEditar]);

  // ── Procesar ─────────────────────────────────────────────
  const procesarFormularioActual = useCallback(async () => {
    // Sin validación de respuesta — el formulario ahora es solo de evidencias
    try {
      const reporteId = await guardarCuestionario();
      addToQueue({
        id: reporteId, categoria: formData.categoria,
        formData: { ...formData },
        checklist: checklist.map(item => ({
          ...item,
          observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
          geoRef: item.evidence.find(e => e.geoRef)?.geoRef ?? null,
        })) as any,
        gps: gpsVista,
        fotos: {},
        mapImage: null,
        fechaCaptura: new Date(),
      });
      const opcion = await mostrarOpcionesPostGuardado();
      if (opcion === 'otro_mismo' || opcion === 'generar_ahora') limpiarFormulario();
    } catch (err) { console.error(err); alert('Error al procesar el formulario.'); }
  }, [addToQueue, checklist, formData, gpsVista, guardarCuestionario, limpiarFormulario]);

  // ── PDF local (descarga directa) ─────────────────────────
  const generarPDFLocal = useCallback(async () => {
    const doc        = new jsPDF('p', 'mm', 'a4');
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin     = 12;
    const folio      = `REV-ALU-${new Date().toISOString().slice(0,10)}-${Math.floor(Math.random()*900+100)}`;
    const sectorFinal = formData.sector === 'Otro' ? sectorPersonalizado : formData.sector;
    const tramoFinal  = formData.sector === 'Otro' ? tramoPersonalizado  : formData.Tramo;

    // Encabezado
    let y = 18;
    doc.setFont('helvetica', 'bold').setFontSize(13);
    doc.text('REPORTE ALUMBRADO PÚBLICO – CIP ACAPULCO-COYUCA', margin, y);
    y += 4; doc.setLineWidth(0.5).line(margin, y, pageWidth - margin, y); y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(9);
    doc.text(`Folio: ${folio}   Sector: ${sectorFinal}   Tramo: ${tramoFinal}`, margin, y); y += 5;
    doc.setFont('helvetica', 'bold').text(`Tipo: ${formData.tipoAlumbrado}   Mantenimiento: ${formData.tipoMantenimiento}`, margin, y);
    doc.setFont('helvetica', 'normal'); y += 8;

    // Tabla: No | Concepto + Coords | Cumple | NoCumple | Observaciones | Foto
    const rows: any[] = [];
    checklist.forEach(item => {
      item.evidence.forEach((ev, ei) => {
        const geoX = ev.geoRef ? ev.geoRef.lat : '';
        const geoY = ev.geoRef ? ev.geoRef.lon : '';
        rows.push([
          ei === 0 ? String(item.id) : '',
          ei === 0 ? item.pregunta : `↳ Incidencia ${ei + 1}`,
          geoX,
          geoY,

          ev.observation || '',
          { content: '', photo: ev.photo },
        ]);
      });
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[
        { content: 'No.', styles: { halign: 'center' } },
        { content: 'Concepto / Incidencia', styles: { halign: 'center' } },
        { content: 'X\n(lat)', styles: { halign: 'center', fontSize: 7 } },
        { content: 'Y\n(lon)', styles: { halign: 'center', fontSize: 7 } },

        { content: 'Observaciones', styles: { halign: 'center' } },
        { content: 'Foto', styles: { halign: 'center' } },
      ]],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle', overflow: 'linebreak', lineWidth: 0.2 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 52 },
        2: { cellWidth: 14, halign: 'center', fontSize: 7 },
        3: { cellWidth: 14, halign: 'center', fontSize: 7 },
        4: { cellWidth: 10, halign: 'center', fontSize: 11 },
        5: { cellWidth: 10, halign: 'center', fontSize: 11 },
        6: { cellWidth: 42 },
        7: { cellWidth: 26, halign: 'center' },
      },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 5 && data.cell.raw?.photo) {
          try {
            const p = doc.getImageProperties(data.cell.raw.photo);
            const maxW = 23, maxH = data.cell.height - 2;
            const ratio = Math.min(maxW / p.width, maxH / p.height);
            const dw = p.width * ratio, dh = p.height * ratio;
            doc.addImage(data.cell.raw.photo, 'JPEG',
              data.cell.x + (maxW - dw) / 2 + 1,
              data.cell.y + (data.cell.height - dh) / 2,
              dw, dh, `ev-${data.row.index}`, 'FAST');
          } catch { /* imagen inválida */ }
        }
      },
      rowPageBreak: 'avoid',
    });

    // Marca de agua
    for (let i = 1; i <= doc.getNumberOfPages(); i++) {
      doc.setPage(i); doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
      doc.addImage('/logo_fonatur.png', 'PNG', (pageWidth - 130) / 2, (pageHeight - 38) / 2, 130, 38);
      doc.restoreGraphicsState();
    }
    doc.save(`${folio}.pdf`);
  }, [checklist, formData, sectorPersonalizado, tramoPersonalizado]);

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════
  const itemActual    = checklist[preguntaActual];

  const tiposLuminaria = Object.keys(SECCIONES_POR_TIPO);
  const totalItems    = checklist.length;
  const respondidos   = checklist.filter(i => i.respuesta !== '').length;
  const incidencias   = checklist.filter(i => i.respuesta === 'NO').length;
  const geoRefs       = checklist.flatMap(i => i.evidence).filter(e => e.geoRef).length;

  return (
    <div className="min-h-screen bg-[#eef2f6] font-sans text-gray-700 py-0">
      <div className="max-w-5xl mx-auto space-y-0">

        {/* ── HEADER + TABS (estilo vehículo) ─────────────────── */}
        <header className="relative bg-emerald-700 text-white rounded-b-none overflow-hidden shadow-lg pt-8 px-8 flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-extrabold tracking-wide uppercase">
                Reporte de Mantenimiento – Alumbrado Público
              </h1>
              <p className="text-emerald-200 text-sm mt-1">CIP Acapulco-Coyuca</p>
            </div>
            <div className="text-right text-xs font-mono bg-black/20 px-4 py-2 rounded-xl border border-white/10">
              {currentTime}
            </div>
          </div>

          {/* TABS de tipo luminaria */}
          <div className="flex gap-1.5 overflow-x-auto pb-0 scrollbar-hide">
            {tiposLuminaria.map(tipo => (
              <button key={tipo} onClick={() => handleTipoChange(tipo)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-t-xl font-bold text-xs transition-colors whitespace-nowrap ${
                  formData.tipoAlumbrado === tipo
                    ? 'bg-[#eef2f6] text-emerald-800'
                    : 'bg-emerald-800/50 text-emerald-100 hover:bg-emerald-600'
                }`}>
                {tipo}
              </button>
            ))}
          </div>
        </header>

        <div className="p-4 sm:p-6 space-y-5">

          {/* ── DATOS: SECTOR / TRAMO / TIPO MANT ────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Sector</label>
                <select value={formData.sector} onChange={e => setFormData(prev => ({ ...prev, sector: e.target.value, Tramo: '' }))}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-[#e67e22] text-sm focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30">
                  <option value="">Seleccionar</option>
                  {Object.keys(TRAMOS_POR_SECTOR).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {formData.sector === 'Otro' && (
                  <input type="text" placeholder="Sector..." value={sectorPersonalizado}
                    onChange={e => setSectorPersonalizado(e.target.value)} className="mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tramo</label>
                {formData.sector === 'Otro' ? (
                  <input type="text" placeholder="Tramo..." value={tramoPersonalizado}
                    onChange={e => setTramoPersonalizado(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                ) : (
                  <select value={formData.Tramo} onChange={e => setFormData(prev => ({ ...prev, Tramo: e.target.value }))}
                    disabled={!formData.sector} className="px-3 py-2 rounded-xl border border-slate-200 text-sm">
                    <option value="">Seleccionar</option>
                    {(TRAMOS_POR_SECTOR[formData.sector] || []).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Acceso a playa</label>
                <input type="text" placeholder="Acceso" value={formData.accesoPublico}
                  onChange={e => setFormData(prev => ({ ...prev, accesoPublico: e.target.value }))}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tipo Mantenimiento</label>
                <select value={formData.tipoMantenimiento} onChange={e => setFormData(prev => ({ ...prev, tipoMantenimiento: e.target.value }))}
                  className={`px-3 py-2 rounded-xl border font-bold text-sm transition-colors ${formData.tipoMantenimiento === 'Urgente' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-gray-700'}`}>
                  <option value="">Seleccionar</option>
                  <option value="Urgente">🚨 Urgente</option>
                  <option value="Ordinario">📋 Ordinario</option>
                  <option value="Programable">🗓️ Programable</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── GRID PRINCIPAL: WIZARD + MAPA ────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-5">

            {/* ── WIZARD (2/3) ────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Barra de progreso */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{formData.tipoAlumbrado}</span>
                  <span className="text-xs bg-slate-100 px-3 py-1 rounded-full text-slate-500 font-semibold">{respondidos}/{totalItems}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${totalItems ? (respondidos / totalItems) * 100 : 0}%` }} />
                </div>
                <div className="flex flex-wrap gap-3 text-[11px]">
                  <span className="text-amber-600 font-semibold">📍 {geoRefs} geo-refs</span>
                  <span className="text-blue-500 font-semibold">📷 {checklist.flatMap(i => i.evidence).filter(e => e.photo).length} fotos</span>
                  <span className="text-slate-400">{respondidos}/{totalItems} respondidos</span>
                </div>

                {/* Mini mapa de ítems */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {checklist.map((item, idx) => (
                    <button key={item.id} type="button" onClick={() => setPreguntaActual(idx)}
                      title={item.pregunta}
                      className={`w-7 h-7 rounded-full text-[10px] font-bold transition-all border-2 ${
                        idx === preguntaActual ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
                      } ${
                        item.respuesta === 'SI' ? 'bg-emerald-500 border-emerald-500 text-white'
                        : item.respuesta === 'NO' ? 'bg-red-500 border-red-500 text-white'
                        : 'bg-white border-gray-200 text-gray-400'
                      }`}>
                      {item.id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tarjeta de pregunta */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                {/* Etiqueta sección */}
                <div className="mb-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                    {itemActual.seccion}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-slate-800 mb-5 leading-snug">
                  <span className="text-slate-300 mr-2">#{itemActual.id}</span>
                  {itemActual.pregunta}
                </h2>

                {/* Evidencias */}
                <div className="border-t border-slate-100 pt-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Evidencias / Incidencias
                    </h3>
                    <button onClick={() => addEvidence(itemActual.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
                      <FaPlus size={10} /> Añadir evidencia
                    </button>
                  </div>

                  <div className="space-y-3">
                    {itemActual.evidence.map((ev) => {
                      const isCapturing = capturandoGps?.itemId === itemActual.id && capturandoGps?.entryId === ev.id;
                      return (
                        <div key={ev.id} className="group relative">
                          {/* Botón eliminar — deslizable en móvil, visible en hover desktop */}
                          {itemActual.evidence.length > 1 && (
                            <button
                              onClick={() => removeEvidence(itemActual.id, ev.id)}
                              className="absolute -right-1 top-1/2 -translate-y-1/2 z-10
                                         w-12 h-12 rounded-full
                                         bg-red-500 text-white shadow-lg
                                         flex items-center justify-center
                                         translate-x-full
                                         sm:translate-x-full sm:opacity-0 sm:group-hover:opacity-100 sm:group-hover:translate-x-1/2
                                         active:scale-95 transition-all duration-200
                                         touch-manipulation">
                              <FaTrash size={14} />
                            </button>
                          )}
                          <div className={`bg-slate-50 rounded-2xl p-4 border border-slate-100 transition-transform duration-200 ${itemActual.evidence.length > 1 ? 'active:translate-x-[-3rem] sm:active:translate-x-0' : ''}`}>
                          <div className="grid md:grid-cols-2 gap-3">
                            {/* Izq: observación + georef */}
                            <div className="space-y-2.5">
                              <input type="text" placeholder="Observación..."
                                value={ev.observation}
                                onChange={e => updateObservation(itemActual.id, ev.id, e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />

                              {/* GeoRef button */}
                              {ev.geoRef ? (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between">
                                  <div className="text-[11px] font-mono text-emerald-700">
                                    <span className="font-bold">X:</span> {ev.geoRef.lat}<br/>
                                    <span className="font-bold">Y:</span> {ev.geoRef.lon}
                                    <span className="ml-2 text-emerald-400">±{ev.geoRef.precision}</span>
                                  </div>
                                  <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
                                    className="text-emerald-400 hover:text-emerald-600 ml-2" title="Recapturar">
                                    <FaUndo size={11} />
                                  </button>
                                </div>
                              ) : isCapturing ? (
                                // Animación radar mientras captura
                                <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-emerald-800 py-2.5 px-3 flex items-center gap-2.5">
                                  <style>{`
                                    @keyframes gs{0%{transform:translateY(-100%)}100%{transform:translateY(250%)}}
                                    @keyframes gr{from{transform:rotate(0)}to{transform:rotate(360deg)}}
                                    @keyframes gp{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:0;transform:scale(1.8)}}
                                  `}</style>
                                  <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                                    <div className="w-full h-6 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-500/40 border-b border-emerald-400/50"
                                      style={{ animation: 'gs 1.3s linear infinite' }} />
                                  </div>
                                  <div className="relative w-6 h-6 flex-shrink-0 flex items-center justify-center">
                                    <div className="absolute inset-0 rounded-full border border-emerald-500/40" style={{ animation: 'gp 1.8s ease-in-out infinite' }} />
                                    <div className="absolute inset-0.5 rounded-full border-2 border-transparent border-t-emerald-400" style={{ animation: 'gr 0.75s linear infinite' }} />
                                    <FaCrosshairs className="text-emerald-300 relative z-10 text-[9px]" />
                                  </div>
                                  <span className="text-emerald-300 text-[11px] font-bold animate-pulse relative z-10">
                                    Triangulando GPS...
                                  </span>
                                  <div className="ml-auto flex items-end gap-[2px] h-4 relative z-10 flex-shrink-0">
                                    {[0.4, 0.65, 1].map((d, i) => (
                                      <div key={i} className="w-1 bg-emerald-400 rounded-sm"
                                        style={{ height: `${40 + i * 25}%`, animation: `gp ${0.8 + i * 0.15}s ease-in-out infinite`, animationDelay: `${d * 0.3}s` }} />
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => capturarGeoRef(itemActual.id, ev.id)}
                                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                                  <FaCrosshairs size={11} /> Capturar ubicación exacta
                                </button>
                              )}
                            </div>

                            {/* Der: foto */}
                            <div className="relative aspect-video bg-white rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors">
                              {ev.photo ? (
                                <>
                                  <img src={ev.photo} className="w-full h-full object-cover" alt="evidencia" />
                                  <button type="button"
                                    onClick={() => setChecklist(prev => prev.map(item =>
                                      item.id === itemActual.id ? { ...item, evidence: item.evidence.map(e => e.id === ev.id ? { ...e, photo: null } : e) } : item
                                    ))}
                                    className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">
                                    <FaTrash size={9} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <FaCamera className="text-slate-300 mb-1" size={18} />
                                  <span className="text-[10px] font-bold text-slate-400">SUBIR FOTO</span>
                                </>
                              )}
                              <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={e => handlePhotoUpload(e, itemActual.id, ev.id)} />
                            </div>
                          </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Navegación */}
                <div className="flex justify-between mt-6">
                  <button onClick={() => setPreguntaActual(p => Math.max(0, p - 1))} disabled={preguntaActual === 0}
                    className="px-5 py-2.5 font-bold text-slate-400 hover:text-slate-600 disabled:opacity-30 text-sm transition-colors">
                    ← Anterior
                  </button>
                  <button onClick={() => setPreguntaActual(p => Math.min(checklist.length - 1, p + 1))} disabled={preguntaActual === checklist.length - 1}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-30">
                    Siguiente →
                  </button>
                </div>
              </div>
            </div>

            {/* ── MAPA + ACCIONES (1/3) ────────────────────────────── */}
            <div className="space-y-4">
              {/* Mapa — solo muestra geo-refs capturadas */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
                  <FaMapMarkedAlt className="text-orange-500" size={14} />
                  <h3 className="font-bold text-slate-600 text-xs uppercase tracking-wide">Geo-referencias capturadas</h3>
                  {geoRefs > 0 && <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{geoRefs}</span>}
                </div>
                <div ref={mapRef} className="h-52">
                  <LeafletMap gps={gpsVista} reportes={[]} georefPins={georefPins} />
                </div>
                {geoRefs === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-2 border-t border-slate-50">
                    Las geo-refs aparecerán aquí al capturarlas
                  </p>
                )}
              </div>

              {/* Botones */}
              <button onClick={procesarFormularioActual}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm">
                <FaFilePdf /> Guardar y añadir a cola PDF
              </button>
              <button onClick={generarPDFLocal}
                className="w-full py-3 bg-slate-800 text-white rounded-2xl font-bold shadow flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors text-sm">
                <FaFilePdf className="text-slate-300" /> Vista previa PDF
              </button>
              <button onClick={() => { if (window.confirm('¿Reiniciar formulario?')) limpiarFormulario(); }}
                className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors text-sm">
                <FaUndo size={13} /> Reiniciar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PineoA;







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

//   // GPS del mapa — solo para visualizar geo-refs, no para el formulario
//   const [gpsVista, setGpsVista] = useState<GpsCoords>({ lat: null, lon: null, precision: '--' });

//   const [checklist, setChecklist] = useState<ChecklistItem[]>(buildChecklist(tipoInicial));

//   // Sync mapa con la última geo-ref capturada
//   useEffect(() => {
//     const ultima = checklist
//       .flatMap(i => i.evidence)
//       .filter(e => e.geoRef)
//       .slice(-1)[0];
//     if (ultima?.geoRef) {
//       setGpsVista({ lat: ultima.geoRef.lat, lon: ultima.geoRef.lon, precision: ultima.geoRef.precision });
//     }
//   }, [checklist]);

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
//     const respondidas = checklist.filter(i => i.respuesta !== '').length;
//     if (respondidas > 0 && !window.confirm('Cambiar la luminaria borrará las respuestas. ¿Continuar?')) return;
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

//   const setRespuesta = useCallback((itemId: number, valor: string) => {
//     setChecklist(prev => prev.map(item => item.id === itemId ? { ...item, respuesta: valor } : item));
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
//     const sinResponder = checklist.filter(i => i.respuesta === '').length;
//     if (sinResponder > 0 && !window.confirm(`${sinResponder} ítem(s) sin responder. ¿Continuar?`)) return;
//     try {
//       const reporteId = await guardarCuestionario();
//       addToQueue({
//         id: reporteId, categoria: formData.categoria,
//         formData: { ...formData },
//         checklist: checklist.map(item => ({
//           ...item,
//           observacion: item.evidence.map(e => e.observation).filter(Boolean).join(' | '),
//           geoRef: item.evidence.find(e => e.geoRef)?.geoRef ?? null,
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
//           (ei === 0 && item.respuesta === 'SI') ? '✓' : '',
//           (ei === 0 && item.respuesta === 'NO') ? '✗' : '',
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
//         { content: '✓', styles: { halign: 'center' } },
//         { content: '✗', styles: { halign: 'center' } },
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
//         if (data.section === 'body' && data.column.index === 7 && data.cell.raw?.photo) {
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
//                   <span className="text-emerald-600 font-semibold">✓ {checklist.filter(i => i.respuesta === 'SI').length} cumplen</span>
//                   <span className="text-red-500 font-semibold">✗ {incidencias} incidencias</span>
//                   <span className="text-amber-600 font-semibold">📍 {geoRefs} geo-refs</span>
//                   <span className="text-blue-500 font-semibold">📷 {checklist.flatMap(i => i.evidence).filter(e => e.photo).length} fotos</span>
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

//                 {/* Botones SI / NO */}
//                 <div className="grid grid-cols-2 gap-3 mb-6">
//                   {(['SI', 'NO'] as const).map(val => (
//                     <button key={val} type="button" onClick={() => setRespuesta(itemActual.id, val)}
//                       className={`py-4 rounded-xl font-black text-sm border-2 transition-all ${
//                         itemActual.respuesta === val
//                           ? val === 'SI'
//                             ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200'
//                             : 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-200'
//                           : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
//                       }`}>
//                       {val === 'SI' ? '✓ SÍ CUMPLE' : '✗ NO CUMPLE'}
//                     </button>
//                   ))}
//                 </div>

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
//                         <div key={ev.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 relative">
//                           {itemActual.evidence.length > 1 && (
//                             <button onClick={() => removeEvidence(itemActual.id, ev.id)}
//                               className="absolute top-3 right-3 text-slate-300 hover:text-red-400 transition-colors">
//                               <FaTrash size={11} />
//                             </button>
//                           )}
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
//                   <LeafletMap gps={gpsVista} reportes={[]} />
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






// 'use client';

// import { usePDFQueue }          from '@/app/context/pdf-queue-context';
// import React, { useState, useRef, useEffect, useCallback } from 'react';
// import {
//   FaCrosshairs, FaFolderOpen, FaMapMarkedAlt,
//   FaFilePdf, FaTrash, FaUndo, FaPlus
// } from 'react-icons/fa';

// import jsPDF from "jspdf";
// import 'leaflet/dist/leaflet.css';
// import dynamic from 'next/dynamic';
// import autoTable from "jspdf-autotable";
// import { crearReporte, actualizarReporte } from '@/app/lib/actions';

// const LeafletMap = dynamic(
//   () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
//   { ssr: false }
// );

// // ================= INTERFACES (Aquí está la solución) =================
// interface GpsCoords { lat: string | null; lon: string | null; precision: string; }
// interface FormData { id: string; sector: string; Tramo: string; accesoPublico: string; tipoMantenimiento: string; categoria: string; tipoAlumbrado: string; }
// interface GeoRef { lat: string; lon: string; precision: string; timestamp: string; }

// interface EvidenceEntry {
//   id: number;
//   observation: string;
//   geoRef: GeoRef | null;
//   photo: string | null;
// }

// interface ChecklistItem {
//   id: number;
//   pregunta: string;
//   respuesta: string;
//   evidence: EvidenceEntry[];
//   observacion: string; // Para compatibilidad con DB
//   geoRef?: GeoRef | null; // Para compatibilidad con DB
// }

// // Interfaz que causaba el error
// interface FormularioProps {
//   reportesIniciales?: any[];
//   reporteParaEditar?: any;
// }

// // ================= CONSTANTES =================
// const PREGUNTAS: Record<string, string[]> = {
//   "Alumbrado Público": [
//     "OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?",
//     "LA FOTOCELDA, RELOJ OPERATIVO O FUSIBLE ¿CUMPLE CON SU FUNCIÓN?",
//     "EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?",
//     "ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS",
//     "REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS",
//     "ENTORNO Y SEGURIDAD SEGÚN ZONA (CAMELLÓN/BANQUETA)",
//     "INTEGRIDAD DE LUMINARIA Y ÓPTICA",
//     "ESTADO DE POSTE METÁLICO/CONCRETO",
//   ],
//   "Cerillo": [
//     "OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?",
//     "ORIENTACIÓN ADECUADA SIN DESLUMBRAMIENTO",
//     "PRENDE O NO PRENDE LAMPARA TIPO BOLARDO (CERILLO)",
//     "MANTENIMIENTO A TRANSFORMADORES DE ALUMBRADO",
//     "ESTADO FISICO DE LAMPARAS TIPO BOLARDO (CERILLO)",
//   ],
//   "Parabuses": [
//     "ESTADO DE BASE DE CONCRETO",
//     "ESTADO DE LÁMPARAS E ILUMINACIÓN DE PARABUSES",
//     "ESTADO DE LÁMPARAS WALLPACK",
//     "ESTADO DE LÁMPARAS TIPO FRAGATA",
//   ]
// };

// const TRAMOS_POR_SECTOR: Record<string, string[]> = {
//   "Barra de Coyuca":      ["Sendero-Seguro-Barra Coyuca"],
//   "Pie de la Cuesta":     ["Sendero-seguro-Pie de la cuesta"],
//   "Barrios Historicos":   ["Caleta-caletilla", "Sendero-Costera-antigua", "Corredor Zocalo-quebrada", "Corredor zocalo-fuerte"],
//   "Acapulco Tradicional": ["Sendero-Tadeo-arredondo", "Sendero-cinerio-hornitos", "Michoacan", "Av. Universidad", "Dr. Ignacio chavez"],
//   "Acapulco Dorado":      ["Costa azul"],
//   "Puerto Márquez":       ["Sendero-Puerto-Marquez"],
//   "Acapulco Diamante":    ["Av. Costera Palmas"],
//   "Otro":                 [""],
// };

// const empty_evidence_entry = (id: number): EvidenceEntry => ({
//   id,
//   observation: "",
//   geoRef: null,
//   photo: null,
// });

// const checklist_inicial = (tipo: string): ChecklistItem[] => {
//   const preguntas = PREGUNTAS[tipo] || [];
//   return preguntas.map((p, i) => ({
//     id: i + 1,
//     pregunta: p,
//     respuesta: "",
//     observacion: "",
//     evidence: [empty_evidence_entry(1)],
//   }));
// };

// // ================= COMPONENTE =================
// const PineoA: React.FC<FormularioProps> = ({ reporteParaEditar, reportesIniciales }) => {
//   const { addToQueue } = usePDFQueue();
//   const mapRef = useRef<HTMLDivElement>(null);
//   const watchId = useRef<number | null>(null);
//   const geoRefWatchId = useRef<number | null>(null);

//   const [currentTime, setCurrentTime] = useState('');
//   const [sectorPersonalizado, setSectorPersonalizado] = useState('');
//   const [tramoPersonalizado, setTramoPersonalizado] = useState('');
//   const [preguntaActual, setPreguntaActual] = useState(0);
//   const [cargandoGps, setCargandoGps] = useState(false);
//   const [cargandoGpsEntry, setCargandoGpsEntry] = useState<{ itemId: number; entryId: number } | null>(null);

//   const [formData, setFormData] = useState<FormData>({
//     id: reporteParaEditar?.id ?? '',
//     sector: reporteParaEditar?.sector ?? '',
//     Tramo: reporteParaEditar?.tramo ?? '',
//     accesoPublico: reporteParaEditar?.acceso_publico ?? '',
//     tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
//     categoria: 'ALUMBRADO PÚBLICO',
//     tipoAlumbrado: reporteParaEditar?.tipoAlumbrado ?? 'Alumbrado Público',
//   });

//   const [gps, setGps] = useState<GpsCoords>({
//     lat: reporteParaEditar?.latitud?.toString() ?? null,
//     lon: reporteParaEditar?.longitud?.toString() ?? null,
//     precision: reporteParaEditar?.latitud ? 'Guardado' : '--',
//   });

//   const [checklist, setChecklist] = useState<ChecklistItem[]>(
//     checklist_inicial(formData.tipoAlumbrado)
//   );

//   useEffect(() => {
//     const tick = () => setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
//     tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
//   }, []);

//   // GPS General
//   const obtenerUbicacionGeneral = useCallback(() => {
//     if (!navigator.geolocation) return alert("GPS no soportado");
//     setCargandoGps(true);
//     watchId.current = navigator.geolocation.watchPosition(
//       ({ coords: { latitude, longitude, accuracy } }) => {
//         setGps({ lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m` });
//         if (accuracy < 10 && watchId.current) {
//           navigator.geolocation.clearWatch(watchId.current);
//           setCargandoGps(false);
//         }
//       },
//       () => { setCargandoGps(false); alert("Error de señal GPS"); },
//       { enableHighAccuracy: true, timeout: 10000 }
//     );
//   }, []);

//   // GPS para incidencia específica
//   const capturarGeoRefIncidencia = useCallback((itemId: number, entryId: number) => {
//     setCargandoGpsEntry({ itemId, entryId });
//     geoRefWatchId.current = navigator.geolocation.watchPosition(
//       ({ coords: { latitude, longitude, accuracy } }) => {
//         const timestamp = new Date().toLocaleTimeString('es-MX');
//         setChecklist(prev => prev.map(item =>
//           item.id === itemId ? {
//             ...item,
//             evidence: item.evidence.map(e => e.id === entryId ? {
//               ...e, geoRef: { lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m`, timestamp }
//             } : e)
//           } : item
//         ));
//         if (geoRefWatchId.current) navigator.geolocation.clearWatch(geoRefWatchId.current);
//         setCargandoGpsEntry(null);
//       },
//       () => { setCargandoGpsEntry(null); alert("Error en GPS"); },
//       { enableHighAccuracy: true, timeout: 8000 }
//     );
//   }, []);

//   const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, itemId: number, entryId: number) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     const reader = new FileReader();
//     reader.onload = (event) => {
//       const base64 = event.target?.result as string;
//       setChecklist(prev => prev.map(item =>
//         item.id === itemId ? {
//           ...item,
//           evidence: item.evidence.map(e => e.id === entryId ? { ...e, photo: base64 } : e)
//         } : item
//       ));
//     };
//     reader.readAsDataURL(file);
//   }, []);

//   const addEvidence = (itemId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: [...item.evidence, empty_evidence_entry(item.evidence.length + 1)] } : item
//     ));
//   };

//   const removeEvidence = (itemId: number, entryId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.filter(e => e.id !== entryId) } : item
//     ));
//   };

//   const procesarReporte = async () => {
//     try {
//       const sectorFinal = formData.sector === "Otro" ? sectorPersonalizado : formData.sector;
//       const tramoFinal = formData.sector === "Otro" ? tramoPersonalizado : formData.Tramo;
//       const finalData = { ...formData, sector: sectorFinal, Tramo: tramoFinal };

//       const resId = reporteParaEditar?.id 
//         ? await actualizarReporte(reporteParaEditar.id.toString(), finalData, checklist as any, gps, {})
//         : await crearReporte(finalData, checklist as any, gps, {});

//       const doc = new jsPDF("p", "mm", "a4");
//       let y = 20;
//       doc.setFontSize(14).setFont("helvetica", "bold").text("REPORTE DE EVIDENCIA FOTOGRÁFICA", 105, y, { align: "center" });
//       y += 15;

//       const rows: any[] = [];
//       let counter = 1;

//       checklist.forEach(item => {
//         item.evidence.forEach(ev => {
//           if (ev.photo || ev.observation) {
//             const coords = ev.geoRef ? `${ev.geoRef.lat}, ${ev.geoRef.lon}\nPrec: ${ev.geoRef.precision}` : "Sin geo-ref";
//             rows.push([
//               counter++,
//               { content: `${item.pregunta}\n\nCOORDENADAS:\n${coords}`, styles: { fontSize: 7 } },
//               `${ev.observation || "Sin observaciones"}\n\nCUMPLE: ${item.respuesta}`,
//               { content: "", photo: ev.photo }
//             ]);
//           }
//         });
//       });

//       autoTable(doc, {
//         startY: y,
//         head: [['No.', 'Concepto', 'Descripción', 'Evidencia']],
//         body: rows,
//         columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 70 }, 2: { cellWidth: 60 }, 3: { cellWidth: 45, halign: 'center' } },
//         didDrawCell: (data) => {
//           if (data.column.index === 3 && data.cell.raw && (data.cell.raw as any).photo) {
//             doc.addImage((data.cell.raw as any).photo, 'JPEG', data.cell.x + 2, data.cell.y + 2, 40, 30);
//           }
//         },
//         styles: { minCellHeight: 35 }
//       });

//       doc.save(`Reporte_${sectorFinal}.pdf`);
//       alert("Reporte guardado y generado.");
//     } catch (error) {
//       console.error(error);
//       alert("Error al procesar.");
//     }
//   };

//   const itemActual = checklist[preguntaActual];

//   return (
//     <div className="max-w-5xl mx-auto p-4 bg-slate-50 min-h-screen text-slate-800">
//       {/* HEADER */}
//       <div className="bg-emerald-700 text-white p-6 rounded-2xl shadow-lg mb-6 flex justify-between items-center">
//         <div>
//           <h1 className="text-xl font-bold uppercase">Mantenimiento CIP Acapulco</h1>
//           <p className="text-emerald-100 text-sm">{formData.tipoAlumbrado}</p>
//         </div>
//         <div className="font-mono text-xs opacity-80">{currentTime}</div>
//       </div>

//       <div className="grid lg:grid-cols-3 gap-6">
//         <div className="lg:col-span-2 space-y-4">
//           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
//             <h2 className="text-lg font-bold text-slate-700 mb-6 text-center">{itemActual.pregunta}</h2>

//             <div className="grid grid-cols-2 gap-4 mb-8">
//               <button onClick={() => setChecklist(prev => prev.map(it => it.id === itemActual.id ? {...it, respuesta: 'SI'} : it))}
//                 className={`py-4 rounded-xl font-black border-2 ${itemActual.respuesta === 'SI' ? 'bg-emerald-500 border-emerald-600 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>SÍ CUMPLE</button>
//               <button onClick={() => setChecklist(prev => prev.map(it => it.id === itemActual.id ? {...it, respuesta: 'NO'} : it))}
//                 className={`py-4 rounded-xl font-black border-2 ${itemActual.respuesta === 'NO' ? 'bg-red-500 border-red-600 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>NO CUMPLE</button>
//             </div>

//             <div className="border-t pt-6">
//               <div className="flex justify-between items-center mb-4">
//                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Evidencias e Incidencias</h3>
//                 <button onClick={() => addEvidence(itemActual.id)} className="flex items-center gap-2 text-xs font-bold text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
//                   <FaPlus /> Añadir evidencia
//                 </button>
//               </div>

//               <div className="space-y-4">
//                 {itemActual.evidence.map((ev) => (
//                   <div key={ev.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 relative group">
//                     <div className="grid md:grid-cols-2 gap-4">
//                       <div className="space-y-3">
//                         <input 
//                           type="text" 
//                           placeholder="Observación..." 
//                           value={ev.observation}
//                           onChange={e => {
//                             const val = e.target.value;
//                             setChecklist(prev => prev.map(it => it.id === itemActual.id ? {
//                               ...it, evidence: it.evidence.map(e_ev => e_ev.id === ev.id ? {...e_ev, observation: val} : e_ev)
//                             } : it));
//                           }}
//                           className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
//                         />
                        
//                         {ev.geoRef ? (
//                           <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-xl border border-emerald-100 flex justify-between items-center">
//                             <span className="text-[10px] font-mono">{ev.geoRef.lat}, {ev.geoRef.lon}</span>
//                             <button onClick={() => capturarGeoRefIncidencia(itemActual.id, ev.id)}><FaUndo size={12}/></button>
//                           </div>
//                         ) : (
//                           <button onClick={() => capturarGeoRefIncidencia(itemActual.id, ev.id)} className="w-full py-2.5 bg-white border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-bold text-slate-400">
//                              <FaCrosshairs className="inline mr-2" /> CAPTURAR UBICACIÓN EXACTA
//                           </button>
//                         )}
//                       </div>

//                       <div className="relative aspect-video bg-white rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex flex-col items-center justify-center">
//                         {ev.photo ? (
//                           <img src={ev.photo} className="w-full h-full object-cover" />
//                         ) : (
//                           <><FaFolderOpen className="text-slate-300" size={20} /><span className="text-[10px] font-bold text-slate-400">SUBIR FOTO</span></>
//                         )}
//                         <input type="file" accept="image/*" onChange={e => handlePhotoUpload(e, itemActual.id, ev.id)} className="absolute inset-0 opacity-0 cursor-pointer" />
//                       </div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             <div className="flex justify-between mt-8">
//               <button onClick={() => setPreguntaActual(p => Math.max(0, p - 1))} className="px-6 py-2 font-bold text-slate-400">Anterior</button>
//               <button onClick={() => setPreguntaActual(p => Math.min(checklist.length - 1, p + 1))} className="px-8 py-2 bg-slate-800 text-white rounded-xl font-bold">Siguiente</button>
//             </div>
//           </div>
//         </div>

//         <div className="space-y-6">
//           <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
//             <div className="h-48 rounded-xl overflow-hidden border border-slate-100 mb-4" ref={mapRef}>
//               <LeafletMap gps={gps} reportes={[]} />
//             </div>
//             <button onClick={obtenerUbicacionGeneral} className="w-full py-3 rounded-xl font-bold text-xs bg-emerald-600 text-white">
//               <FaCrosshairs className="inline mr-2" /> PUNTO INICIAL
//             </button>
//           </div>
//           <button onClick={procesarReporte} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black shadow-lg uppercase">
//             <FaFilePdf className="inline mr-2" /> GENERAR REPORTE
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default PineoA;


// 'use client';

// import { usePDFQueue }          from '@/app/context/pdf-queue-context';
// import React, { useState, useRef, useEffect, useCallback } from 'react';
// import {
//   FaCrosshairs, FaFolderOpen, FaMapMarkedAlt,
//   FaFilePdf, FaTrash, FaUndo, FaPlus
// } from 'react-icons/fa';

// import jsPDF from "jspdf";
// import 'leaflet/dist/leaflet.css';
// import dynamic from 'next/dynamic';
// import autoTable from "jspdf-autotable";
// import html2canvas from "html2canvas";
// import { crearReporte, actualizarReporte } from '@/app/lib/actions';

// const LeafletMap = dynamic(
//   () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
//   { ssr: false }
// );

// // ================= INTERFACES =================
// interface GpsCoords { lat: string | null; lon: string | null; precision: string; }
// interface FormData { id: string; sector: string; Tramo: string; accesoPublico: string; tipoMantenimiento: string; categoria: string; tipoAlumbrado: string; reportesIniciales?: any[]; }
// interface GeoRef { lat: string; lon: string; precision: string; timestamp: string; }

// interface EvidenceEntry {
//   id: number;
//   observation: string;
//   geoRef: GeoRef | null;
//   photo: string | null;
// }

// interface ChecklistItem {
//   id: number;
//   pregunta: string;
//   respuesta: string;
//   evidence: EvidenceEntry[];
//   // Campos añadidos para compatibilidad con el tipo que espera la base de datos:
//   observacion: string; 
//   geoRef?: GeoRef | null;
// }

// // ================= CONSTANTES =================
// const PREGUNTAS: Record<string, string[]> = {
//   "Alumbrado Público": [
//     "OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?",
//     "LA FOTOCELDA, RELOJ OPERATIVO O FUSIBLE ¿CUMPLE CON SU FUNCIÓN?",
//     "EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?",
//     "ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS",
//     "REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS",
//     "ENTORNO Y SEGURIDAD SEGÚN ZONA (CAMELLÓN/BANQUETA)",
//     "INTEGRIDAD DE LUMINARIA Y ÓPTICA",
//     "ESTADO DE POSTE METÁLICO/CONCRETO",
//   ],
//   "Cerillo": [
//     "OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?",
//     "ORIENTACIÓN ADECUADA SIN DESLUMBRAMIENTO",
//     "PRENDE O NO PRENDE LAMPARA TIPO BOLARDO (CERILLO)",
//     "MANTENIMIENTO A TRANSFORMADORES DE ALUMBRADO",
//     "ESTADO FISICO DE LAMPARAS TIPO BOLARDO (CERILLO)",
//   ],
//   "Parabuses": [
//     "ESTADO DE BASE DE CONCRETO",
//     "ESTADO DE LÁMPARAS E ILUMINACIÓN DE PARABUSES",
//     "ESTADO DE LÁMPARAS WALLPACK",
//     "ESTADO DE LÁMPARAS TIPO FRAGATA",
//   ]
// };

// const TRAMOS_POR_SECTOR: Record<string, string[]> = {
//   "Barra de Coyuca":      ["Sendero-Seguro-Barra Coyuca"],
//   "Pie de la Cuesta":     ["Sendero-seguro-Pie de la cuesta"],
//   "Barrios Historicos":   ["Caleta-caletilla", "Sendero-Costera-antigua", "Corredor Zocalo-quebrada", "Corredor zocalo-fuerte"],
//   "Acapulco Tradicional": ["Sendero-Tadeo-arredondo", "Sendero-cinerio-hornitos", "Michoacan", "Av. Universidad", "Dr. Ignacio chavez"],
//   "Acapulco Dorado":      ["Costa azul"],
//   "Puerto Márquez":       ["Sendero-Puerto-Marquez"],
//   "Acapulco Diamante":    ["Av. Costera Palmas"],
//   "Otro":                 [""],
// };

// const empty_evidence_entry = (id: number): EvidenceEntry => ({
//   id,
//   observation: "",
//   geoRef: null,
//   photo: null,
// });

// const checklist_inicial = (tipo: string): ChecklistItem[] => {
//   const preguntas = PREGUNTAS[tipo] || [];
//   return preguntas.map((p, i) => ({
//     id: i + 1,
//     pregunta: p,
//     respuesta: "",
//     observacion: "", // Inicializado para TS
//     evidence: [empty_evidence_entry(1)],
//   }));
// };

// const PineoA: React.FC<FormularioProps> = ({ reporteParaEditar, reportesIniciales }) => {
//   const { addToQueue } = usePDFQueue();
//   const mapRef = useRef<HTMLDivElement>(null);
//   const watchId = useRef<number | null>(null);
//   const geoRefWatchId = useRef<number | null>(null);

//   const [currentTime, setCurrentTime] = useState('');
//   const [sectorPersonalizado, setSectorPersonalizado] = useState('');
//   const [tramoPersonalizado, setTramoPersonalizado] = useState('');
//   const [preguntaActual, setPreguntaActual] = useState(0);
//   const [cargandoGps, setCargandoGps] = useState(false);
//   const [cargandoGpsEntry, setCargandoGpsEntry] = useState<{ itemId: number; entryId: number } | null>(null);

//   const [formData, setFormData] = useState<FormData>({
//     id: reporteParaEditar?.id ?? '',
//     sector: reporteParaEditar?.sector ?? '',
//     Tramo: reporteParaEditar?.tramo ?? '',
//     accesoPublico: reporteParaEditar?.acceso_publico ?? '',
//     tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
//     categoria: 'ALUMBRADO PÚBLICO',
//     tipoAlumbrado: reporteParaEditar?.tipoAlumbrado ?? 'Alumbrado Público',
//   });

//   const [gps, setGps] = useState<GpsCoords>({
//     lat: reporteParaEditar?.latitud?.toString() ?? null,
//     lon: reporteParaEditar?.longitud?.toString() ?? null,
//     precision: reporteParaEditar?.latitud ? 'Guardado' : '--',
//   });

//   const [checklist, setChecklist] = useState<ChecklistItem[]>(
//     checklist_inicial(formData.tipoAlumbrado)
//   );

//   useEffect(() => {
//     const tick = () => setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
//     tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
//   }, []);

//   // ================= ACCIONES GPS =================
//   const obtenerUbicacionGeneral = useCallback(() => {
//     if (!navigator.geolocation) return alert("GPS no soportado");
//     setCargandoGps(true);
//     watchId.current = navigator.geolocation.watchPosition(
//       ({ coords: { latitude, longitude, accuracy } }) => {
//         setGps({ lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m` });
//         if (accuracy < 10 && watchId.current) {
//           navigator.geolocation.clearWatch(watchId.current);
//           setCargandoGps(false);
//         }
//       },
//       () => { setCargandoGps(false); alert("Error de señal GPS"); },
//       { enableHighAccuracy: true, timeout: 10000 }
//     );
//   }, []);

//   const capturarGeoRefIncidencia = useCallback((itemId: number, entryId: number) => {
//     setCargandoGpsEntry({ itemId, entryId });
//     geoRefWatchId.current = navigator.geolocation.watchPosition(
//       ({ coords: { latitude, longitude, accuracy } }) => {
//         const timestamp = new Date().toLocaleTimeString('es-MX');
//         setChecklist(prev => prev.map(item =>
//           item.id === itemId ? {
//             ...item,
//             evidence: item.evidence.map(e => e.id === entryId ? {
//               ...e, geoRef: { lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m`, timestamp }
//             } : e)
//           } : item
//         ));
//         if (geoRefWatchId.current) navigator.geolocation.clearWatch(geoRefWatchId.current);
//         setCargandoGpsEntry(null);
//       },
//       () => { setCargandoGpsEntry(null); alert("Error en GPS de incidencia"); },
//       { enableHighAccuracy: true, timeout: 8000 }
//     );
//   }, []);

//   // ================= MANEJO DE EVIDENCIA =================
//   const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, itemId: number, entryId: number) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     const reader = new FileReader();
//     reader.onload = (event) => {
//       const base64 = event.target?.result as string;
//       setChecklist(prev => prev.map(item =>
//         item.id === itemId ? {
//           ...item,
//           evidence: item.evidence.map(e => e.id === entryId ? { ...e, photo: base64 } : e)
//         } : item
//       ));
//     };
//     reader.readAsDataURL(file);
//   }, []);

//   const addEvidence = (itemId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: [...item.evidence, empty_evidence_entry(item.evidence.length + 1)] } : item
//     ));
//   };

//   const removeEvidence = (itemId: number, entryId: number) => {
//     setChecklist(prev => prev.map(item =>
//       item.id === itemId ? { ...item, evidence: item.evidence.filter(e => e.id !== entryId) } : item
//     ));
//   };

//   // ================= GUARDADO Y PDF =================
//   const procesarReporte = async () => {
//     try {
//       const sectorFinal = formData.sector === "Otro" ? sectorPersonalizado : formData.sector;
//       const tramoFinal = formData.sector === "Otro" ? tramoPersonalizado : formData.Tramo;
//       const finalData = { ...formData, sector: sectorFinal, Tramo: tramoFinal };

//       // Se envían los datos a la base de datos (se usa 'any' para evitar el bloqueo del build mientras actualizas el backend)
//       const resId = reporteParaEditar?.id 
//         ? await actualizarReporte(reporteParaEditar.id.toString(), finalData, checklist as any, gps, {})
//         : await crearReporte(finalData, checklist as any, gps, {});

//       // Generación de PDF según el diseño solicitado
//       const doc = new jsPDF("p", "mm", "a4");
//       let y = 20;
//       doc.setFontSize(14).setFont("helvetica", "bold").text("REPORTE DE EVIDENCIA FOTOGRÁFICA", 105, y, { align: "center" });
//       y += 15;

//       const rows: any[] = [];
//       let counter = 1;

//       checklist.forEach(item => {
//         item.evidence.forEach(ev => {
//           if (ev.photo || ev.observation) {
//             const coords = ev.geoRef ? `${ev.geoRef.lat}, ${ev.geoRef.lon}\nPrec: ${ev.geoRef.precision}` : "Sin geo-ref";
//             rows.push([
//               counter++,
//               { content: `${item.pregunta}\n\nCOORDENADAS:\n${coords}`, styles: { fontSize: 7 } },
//               `${ev.observation || "Sin observaciones"}\n\nCUMPLE: ${item.respuesta}`,
//               { content: ev.photo ? "FOTO_RESERVED" : "S/F", photo: ev.photo }
//             ]);
//           }
//         });
//       });

//       autoTable(doc, {
//         startY: y,
//         head: [['No.', 'Concepto (Pregunta / Coordenadas)', 'Descripción / Observaciones', 'Evidencia Fotográfica']],
//         body: rows,
//         columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 70 }, 2: { cellWidth: 60 }, 3: { cellWidth: 45, halign: 'center' } },
//         didDrawCell: (data) => {
//           if (data.column.index === 3 && data.cell.raw && (data.cell.raw as any).photo) {
//             doc.addImage((data.cell.raw as any).photo, 'JPEG', data.cell.x + 2, data.cell.y + 2, 40, 30);
//           }
//         },
//         styles: { minCellHeight: 35 }
//       });

//       doc.save(`Reporte_${sectorFinal}.pdf`);
//       alert("Reporte procesado con éxito");
//     } catch (error) {
//       console.error(error);
//       alert("Error al procesar");
//     }
//   };

//   const itemActual = checklist[preguntaActual];

//   return (
//     <div className="max-w-5xl mx-auto p-4 bg-slate-50 min-h-screen text-slate-800 font-sans">
//       {/* HEADER */}
//       <div className="bg-emerald-700 text-white p-6 rounded-2xl shadow-lg mb-6 flex justify-between items-center">
//         <div>
//           <h1 className="text-xl font-bold">CONTROL DE PINEO Y MANTENIMIENTO</h1>
//           <p className="text-emerald-100 text-sm">CIP ACAPULCO-COYUCA</p>
//         </div>
//         <div className="text-right font-mono text-xs opacity-80">{currentTime}</div>
//       </div>

//       {/* SELECTORES SUPERIORES */}
//       <div className="grid md:grid-cols-3 gap-4 mb-6">
//         <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
//           <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Sector</label>
//           <select value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})} className="w-full font-bold text-emerald-700 outline-none">
//             <option value="">Seleccionar...</option>
//             {Object.keys(TRAMOS_POR_SECTOR).map(s => <option key={s} value={s}>{s}</option>)}
//           </select>
//         </div>
//         <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
//           <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tramo</label>
//           <select value={formData.Tramo} onChange={e => setFormData({...formData, Tramo: e.target.value})} className="w-full outline-none">
//             <option value="">Seleccionar...</option>
//             {(TRAMOS_POR_SECTOR[formData.sector] || []).map(t => <option key={t} value={t}>{t}</option>)}
//           </select>
//         </div>
//         <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
//           <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tipo de Alumbrado</label>
//           <select value={formData.tipoAlumbrado} onChange={e => {
//              const val = e.target.value;
//              setFormData({...formData, tipoAlumbrado: val});
//              setChecklist(checklist_inicial(val));
//              setPreguntaActual(0);
//           }} className="w-full font-bold text-orange-600 outline-none">
//             {Object.keys(PREGUNTAS).map(k => <option key={k} value={k}>{k}</option>)}
//           </select>
//         </div>
//       </div>

//       <div className="grid lg:grid-cols-3 gap-6">
//         {/* COLUMNA IZQUIERDA: PREGUNTAS Y EVIDENCIAS */}
//         <div className="lg:col-span-2 space-y-4">
//           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
//             <div className="flex justify-between items-center mb-6">
//               <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-full uppercase">Pregunta {preguntaActual + 1} de {checklist.length}</span>
//               <div className="flex gap-1">
//                 {checklist.map((_, i) => (
//                   <div key={i} className={`w-2 h-2 rounded-full ${i === preguntaActual ? 'bg-orange-500' : 'bg-slate-200'}`} />
//                 ))}
//               </div>
//             </div>

//             <h2 className="text-xl font-bold text-slate-700 mb-6 text-center">{itemActual.pregunta}</h2>

//             <div className="grid grid-cols-2 gap-4 mb-8">
//               <button onClick={() => setChecklist(prev => prev.map(it => it.id === itemActual.id ? {...it, respuesta: 'SI'} : it))}
//                 className={`py-4 rounded-xl font-black transition-all border-2 ${itemActual.respuesta === 'SI' ? 'bg-emerald-500 border-emerald-600 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>SÍ CUMPLE</button>
//               <button onClick={() => setChecklist(prev => prev.map(it => it.id === itemActual.id ? {...it, respuesta: 'NO'} : it))}
//                 className={`py-4 rounded-xl font-black transition-all border-2 ${itemActual.respuesta === 'NO' ? 'bg-red-500 border-red-600 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>NO CUMPLE</button>
//             </div>

//             {/* SECCIÓN DE MÚLTIPLES EVIDENCIAS */}
//             <div className="border-t pt-6">
//               <div className="flex justify-between items-center mb-4">
//                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Evidencias Fotográficas e Incidencias</h3>
//                 <button onClick={() => addEvidence(itemActual.id)} className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
//                   <FaPlus /> Añadir evidencia
//                 </button>
//               </div>

//               <div className="space-y-4">
//                 {itemActual.evidence.map((ev, index) => (
//                   <div key={ev.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 relative group">
//                     {itemActual.evidence.length > 1 && (
//                       <button onClick={() => removeEvidence(itemActual.id, ev.id)} className="absolute -top-2 -right-2 bg-white text-red-500 p-1.5 rounded-full shadow-md border border-red-50 hover:bg-red-50">
//                         <FaTrash size={10} />
//                       </button>
//                     )}
                    
//                     <div className="grid md:grid-cols-2 gap-4">
//                       <div className="space-y-3">
//                         <input 
//                           type="text" 
//                           placeholder="Escribe observación de esta incidencia..." 
//                           value={ev.observation}
//                           onChange={e => {
//                             const val = e.target.value;
//                             setChecklist(prev => prev.map(it => it.id === itemActual.id ? {
//                               ...it, evidence: it.evidence.map(e_ev => e_ev.id === ev.id ? {...e_ev, observation: val} : e_ev)
//                             } : it));
//                           }}
//                           className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
//                         />
                        
//                         {ev.geoRef ? (
//                           <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-xl border border-emerald-100 flex justify-between items-center">
//                             <div className="text-[10px] font-mono leading-tight">
//                               <div className="font-bold">UBICACIÓN CAPTURADA:</div>
//                               {ev.geoRef.lat}, {ev.geoRef.lon}
//                             </div>
//                             <button onClick={() => capturarGeoRefIncidencia(itemActual.id, ev.id)} className="text-emerald-500 hover:rotate-180 transition-transform"><FaUndo size={12} /></button>
//                           </div>
//                         ) : (
//                           <button 
//                             disabled={cargandoGpsEntry !== null}
//                             onClick={() => capturarGeoRefIncidencia(itemActual.id, ev.id)} 
//                             className="w-full py-2.5 bg-white border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-bold text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition-all flex items-center justify-center gap-2">
//                             <FaCrosshairs className={cargandoGpsEntry?.entryId === ev.id ? "animate-spin" : ""} />
//                             {cargandoGpsEntry?.entryId === ev.id ? "OBTENIENDO..." : "CAPTURAR GEORREFERENCIA EXACTA"}
//                           </button>
//                         )}
//                       </div>

//                       <div className="relative aspect-video bg-white rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex flex-col items-center justify-center group/photo">
//                         {ev.photo ? (
//                           <>
//                             <img src={ev.photo} className="w-full h-full object-cover" />
//                             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
//                               <label className="cursor-pointer bg-white px-3 py-1.5 rounded-lg text-[10px] font-bold">Cambiar Foto</label>
//                             </div>
//                           </>
//                         ) : (
//                           <>
//                             <FaFolderOpen className="text-slate-300 mb-1" size={20} />
//                             <span className="text-[10px] font-bold text-slate-400">SUBIR FOTO</span>
//                           </>
//                         )}
//                         <input type="file" accept="image/*" onChange={e => handlePhotoUpload(e, itemActual.id, ev.id)} className="absolute inset-0 opacity-0 cursor-pointer" />
//                       </div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             <div className="flex justify-between mt-8">
//               <button onClick={() => setPreguntaActual(p => Math.max(0, p - 1))} className="px-6 py-2 rounded-xl font-bold text-slate-400 hover:bg-slate-100 transition-colors">Anterior</button>
//               <button onClick={() => setPreguntaActual(p => Math.min(checklist.length - 1, p + 1))} className="px-8 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors shadow-lg shadow-slate-200">Siguiente Pregunta</button>
//             </div>
//           </div>
//         </div>

//         {/* COLUMNA DERECHA: MAPA GENERAL Y BOTONES FINALES */}
//         <div className="space-y-6">
//           <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
//             <h3 className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2">
//               <FaMapMarkedAlt className="text-orange-500" /> Levantamiento General
//             </h3>
//             <div className="h-48 rounded-xl overflow-hidden border border-slate-100 mb-4" ref={mapRef}>
//               <LeafletMap gps={gps} reportes={[]} />
//             </div>
//             <button 
//               disabled={cargandoGps}
//               onClick={obtenerUbicacionGeneral} 
//               className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${cargandoGps ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'}`}>
//               <FaCrosshairs className={cargandoGps ? 'animate-spin' : ''} />
//               {cargandoGps ? 'Buscando satélites...' : 'Capturar Punto Inicial'}
//             </button>
//           </div>

//           <div className="space-y-3">
//             <button onClick={procesarReporte} className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black shadow-xl shadow-orange-100 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-wider">
//               <FaFilePdf size={20} /> Finalizar y Generar PDF
//             </button>
//             <button onClick={() => window.location.reload()} className="w-full py-4 bg-white text-slate-400 rounded-2xl font-bold border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-sm">
//               <FaUndo size={14} /> Reiniciar Cuestionario
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default PineoA;