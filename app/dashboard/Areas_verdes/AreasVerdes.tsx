'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FaCrosshairs, FaCamera, FaFolderOpen, FaMapMarkedAlt,
  FaFilePdf, FaTrash, FaUndo
} from 'react-icons/fa';

import jsPDF from "jspdf";
import 'leaflet/dist/leaflet.css';
import dynamic from 'next/dynamic';
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { crearReporte, actualizarReporte } from '@/app/lib/actions';

const LeafletMap = dynamic(
  () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
  { ssr: false }
);

// ================= INTERFACES =================
interface FormularioProps {
  reportesIniciales: any[];
  reporteParaEditar?: any | null;
}
interface GpsCoords { lat: string | null; lon: string | null; precision: string; }
interface FormData { sector: string; Tramo: string; accesoPublico: string; categoria: string; tipoMantenimiento: string; }
interface Fotos { [key: string]: string | null; }
interface GeoRef { lat: string; lon: string; precision: string; timestamp: string; }
interface ChecklistItem { id: number; pregunta: string; respuesta: string; observacion: string; geoRef?: GeoRef | null; }

// ================= CONSTANTES =================
const PREGUNTAS: string[] = [
  "PASTO A LO LARGO DEL TRAMO DENTRO DE ALTURA OBJETIVO (1–2 / 2.5–5.0 CM) Y UNIFORME",
  "ORILLAS/DESORILLE CORRECTO: ANCHO 20 CM ± 2 CM; SIN INVASIÓN A GUARNICIÓNES/BANQUETAS.",
  "SIN ZONAS SECAS O QUEMADAS (PARCHES CAFÉS, PÉRDIDA DE COBERTURA)",
  "ÁREA LIBRE DE CONTAMINACIÓN (TIERRA/CASCAJO, LODOS, EXCRETAS, HIDROCARBUROS, ESCOMBROS)",
  "JARDINERAS/ARRIATES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO).",
  "COBERTURA COMPLETA SEGÚN EL TIPO DE ZONA: CAMELLÓN (AMBOS MÁRGENES Y RETORNOS)",
  "RED DE RIEGO TAPADA, FUERA DE DIRECCIÓN O CON FUGAS",
  "DESCOQUE (DERRAME DE COCOS DE PALMERAS)",
  "DESPALAPADA (DERRAME DE PALAPAS DE PALMERAS DE COCO)",
  "ESTADO DE SEÑALETICAS  (Bueno/Regular/Malo)",
  "BALIZADO DE CALLE ",
  "ESTADO DE MURALES",
  "BACHEO DE CALLE (M2)",
  "REPARACIÓN DE BANQUETA  (ML) ",
  "MANTENIMIENTO DE PARABUSES",
];

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

const FOTOS_INICIAL: Fotos = { Foto1: null, Foto2: null, Foto3: null, Foto4: null, Foto5: null, Foto6: null };
const checklist_inicial = (): ChecklistItem[] =>
  PREGUNTAS.map((p, i) => ({ id: i + 1, pregunta: p, respuesta: "", observacion: "", geoRef: null }));

// ================= HELPERS =================
const parsearChecklist = (raw: any): ChecklistItem[] | null => {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any) => ({
        ...item,
        respuesta:   (item.respuesta  ?? '').toUpperCase(),
        observacion: item.observacion ?? '',
        geoRef:      item.geoRef      ?? null,
      }));
    }
    return null;
  } catch { return null; }
};

// ================= COMPONENTE =================
const AreasVerdes: React.FC<FormularioProps> = ({ reporteParaEditar }) => {
  const mapRef        = useRef<HTMLDivElement>(null);
  const watchId       = useRef<number | null>(null);
  const geoRefWatchId = useRef<number | null>(null);

  const [currentTime,           setCurrentTime]           = useState('');
  const [formulariosAcumulados, setFormulariosAcumulados] = useState<any[]>([]);
  const [capturandoGeoRefId,    setCapturandoGeoRefId]    = useState<number | null>(null);
  const [cargandoGps,           setCargandoGps]           = useState(false);
  const [sectorPersonalizado,   setSectorPersonalizado]   = useState('');
  const [tramoPersonalizado,    setTramoPersonalizado]    = useState('');
  const [preguntaActual,        setPreguntaActual]        = useState(0);

  const [formData, setFormData] = useState<FormData>({
    sector:            reporteParaEditar?.sector            ?? '',
    Tramo:             reporteParaEditar?.tramo             ?? '',
    accesoPublico:     reporteParaEditar?.acceso_publico    ?? '',
    tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
    categoria:         reporteParaEditar?.categoria         ?? 'AREAS VERDES',
  });

  const [gps, setGps] = useState<GpsCoords>({
    lat:       reporteParaEditar?.latitud?.toString()  ?? null,
    lon:       reporteParaEditar?.longitud?.toString() ?? null,
    precision: reporteParaEditar?.latitud ? 'Guardado' : '--',
  });

  const [fotos, setFotos] = useState<Fotos>(
    reporteParaEditar?.fotos && Object.keys(reporteParaEditar.fotos).length > 0
      ? reporteParaEditar.fotos : FOTOS_INICIAL
  );

  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    parsearChecklist(reporteParaEditar?.checklist) ?? checklist_inicial()
  );

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
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });
    });
  }, []);

  useEffect(() => {
    return () => {
      if (watchId.current       !== null) navigator.geolocation.clearWatch(watchId.current);
      if (geoRefWatchId.current !== null) navigator.geolocation.clearWatch(geoRefWatchId.current);
    };
  }, []);

  // ================= GPS =================
  const finalizarCaptura = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setCargandoGps(false);
    }
  }, []);

  const obtenerUbicacion = useCallback(() => {
    if (!navigator.geolocation) return alert("GPS no soportado");
    setCargandoGps(true);
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords: { latitude, longitude, accuracy } }) => {
        setGps({ lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m` });
        if (accuracy < 10) finalizarCaptura();
      },
      () => { setCargandoGps(false); alert("Error al obtener señal GPS."); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    setTimeout(finalizarCaptura, 10000);
  }, [finalizarCaptura]);

  const capturarGeoRefItem = useCallback((itemId: number) => {
    if (!navigator.geolocation) return alert("GPS no soportado en este dispositivo.");
    setCapturandoGeoRefId(itemId);
    geoRefWatchId.current = navigator.geolocation.watchPosition(
      ({ coords: { latitude, longitude, accuracy } }) => {
        const timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setChecklist(prev => prev.map(item =>
          item.id === itemId
            ? { ...item, geoRef: { lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m`, timestamp } }
            : item
        ));
        if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; }
        setCapturandoGeoRefId(null);
      },
      () => { setCapturandoGeoRefId(null); alert("No se pudo obtener la ubicación."); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
    setTimeout(() => {
      if (geoRefWatchId.current !== null) { navigator.geolocation.clearWatch(geoRefWatchId.current); geoRefWatchId.current = null; setCapturandoGeoRefId(null); }
    }, 12000);
  }, []);

  const limpiarGeoRefItem = useCallback((itemId: number) => {
    setChecklist(prev => prev.map(item => item.id === itemId ? { ...item, geoRef: null } : item));
  }, []);

  // ================= HANDLERS =================
  const handleChecklistChange = useCallback((id: number, field: keyof ChecklistItem, value: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  }, []);

  const responderYAvanzar = useCallback((id: number, valor: string) => {
    handleChecklistChange(id, 'respuesta', valor);
    setPreguntaActual(prev => prev < PREGUNTAS.length - 1 ? prev + 1 : prev);
  }, [handleChecklistChange]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, tipo: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1200 / img.width, 1);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * ratio; canvas.height = img.height * ratio;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      setFotos(prev => ({ ...prev, [tipo]: canvas.toDataURL('image/jpeg', 0.92) }));
    };
    img.src = URL.createObjectURL(file);
  }, []);

  const limpiarFormulario = useCallback(() => {
    setPreguntaActual(0);
    setChecklist(checklist_inicial());
    setFotos(FOTOS_INICIAL);
    setGps({ lat: null, lon: null, precision: '--' });
  }, []);

  const guardarCuestionario = useCallback(async () => {
    const sectorFinal = formData.sector === "Otro" ? sectorPersonalizado : formData.sector;
    const tramoFinal  = formData.sector === "Otro" ? tramoPersonalizado  : formData.Tramo;
    const fd = { ...formData, sector: sectorFinal, Tramo: tramoFinal };
    if (reporteParaEditar?.id) {
      await actualizarReporte(reporteParaEditar.id.toString(), fd, checklist, gps, fotos);
      alert("¡Reporte actualizado!");
    } else {
      await crearReporte(fd, checklist, gps, fotos);
      alert("¡Reporte guardado!");
    }
  }, [formData, sectorPersonalizado, tramoPersonalizado, checklist, gps, fotos, reporteParaEditar]);

  const procesarFormularioActual = useCallback(async () => {
    const sinResponder = checklist.filter(i => i.respuesta === "").length;
    if (sinResponder > 0 && !window.confirm(`${sinResponder} pregunta(s) sin responder. ¿Continuar?`)) return;
    try {
      await guardarCuestionario();
      let mapImage: string | null = null;
      if (gps.lat && mapRef.current) {
        const canvas = await html2canvas(mapRef.current, {
          useCORS: true, allowTaint: true, scale: 3,
          ignoreElements: el => el.classList?.contains('leaflet-control-container'),
        });
        mapImage = canvas.toDataURL("image/png");
      }
      const sectorFinal = formData.sector === "Otro" ? sectorPersonalizado : formData.sector;
      const tramoFinal  = formData.sector === "Otro" ? tramoPersonalizado  : formData.Tramo;
      const nuevos = [...formulariosAcumulados, {
        formData: { ...formData, sector: sectorFinal, Tramo: tramoFinal },
        checklist: [...checklist], gps: { ...gps }, fotos: { ...fotos }, mapImage, fechaCaptura: new Date(),
      }];
      setFormulariosAcumulados(nuevos);
      if (window.confirm("¿Deseas llenar OTRO formulario para el mismo PDF?")) {
        limpiarFormulario(); window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        await generarPDFMultiples(nuevos); setFormulariosAcumulados([]); limpiarFormulario();
      }
    } catch (err) { console.error(err); alert("Error al procesar el formulario."); }
  }, [checklist, fotos, formData, formulariosAcumulados, gps, guardarCuestionario, limpiarFormulario, sectorPersonalizado, tramoPersonalizado]);

  // ================= PDF =================
  const generarPDFMultiples = async (lista: any[]) => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    const aplicarMarcaDeAgua = (d: any) => {
      for (let i = 1; i <= d.internal.getNumberOfPages(); i++) {
        d.setPage(i); d.saveGraphicsState();
        d.setGState(new (d as any).GState({ opacity: 0.15 }));
        const iw = 140, ih = 40;
        d.addImage("/logo_fonatur.png", "PNG", (pageWidth - iw) / 2, (pageHeight - ih) / 2, iw, ih);
        d.restoreGraphicsState();
      }
    };

    const folio = `REV-MULTIPLE-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;

    for (let index = 0; index < lista.length; index++) {
      const form = lista[index];
      if (index > 0) doc.addPage();
      let y = 26;
      const fechaStr = form.fechaCaptura.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
      const horaStr  = form.fechaCaptura.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      const ubStr    = form.gps.lat ? `Lat: ${form.gps.lat}  |  Lon: ${form.gps.lon}` : "No capturada";

      doc.setFont("helvetica", "bold").setFontSize(13);
      doc.text(`REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA (Reg. ${index + 1})`, margin, y);
      y += 4; doc.setLineWidth(0.6).line(margin, y, pageWidth - margin, y); y += 8;

      doc.setFont("helvetica", "normal").setFontSize(10);
      doc.text(`Folio: ${folio}-${index + 1}`, margin, y);
      doc.text(`Fecha: ${fechaStr}`, pageWidth / 2, y);
      doc.text(`Hora: ${horaStr}`, pageWidth - 50, y); y += 6;
      doc.text(`Sector: ${form.formData.sector}`, margin, y); y += 6;
      doc.text(`Tramo: ${form.formData.Tramo}`, margin, y); y += 6;
      doc.text(`Acceso público: ${form.formData.accesoPublico || "No especificado"}`, margin, y); y += 6;
      doc.setFont("helvetica", "bold").text(`TIPO: ${(form.formData.tipoMantenimiento ?? "N/E").toUpperCase()}`, margin, y);
      doc.setFont("helvetica", "normal"); y += 8;

      doc.setFont("helvetica", "bold").setFontSize(12);
      doc.text("1. LISTA DE VERIFICACIÓN – ÁREAS VERDES", margin, y); y += 5;

      autoTable(doc, {
        startY: y, margin: { left: margin, right: margin },
        head: [["No.", "Concepto Evaluado", "Cumple", "No Cumple", "Observaciones / Geo-ref"]],
        body: form.checklist.map((item: ChecklistItem) => {
          const obs = item.observacion || "";
          const geo = item.geoRef ? `Lat: ${item.geoRef.lat}\nLon: ${item.geoRef.lon}\n±${item.geoRef.precision} — ${item.geoRef.timestamp}` : "";
          return [item.id, item.pregunta, item.respuesta === "SI" ? "X" : "", item.respuesta === "NO" ? "X" : "", [obs, geo].filter(Boolean).join("\n")];
        }),
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 3, valign: "top", lineWidth: 0.2, overflow: "linebreak" },
        headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold", halign: "center" },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 88 },
          2: { cellWidth: 16, halign: "center" }, 3: { cellWidth: 16, halign: "center" },
          4: { cellWidth: 50 }, // 180 ✓
        },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(9).text(`Ubicación: ${ubStr}`, margin, y);

 
      // Mapa
      if (form.mapImage) {
        doc.addPage();
        doc.setFont("helvetica", "bold").setFontSize(12).text(`2. MAPA DE UBICACIÓN (Reg. ${index + 1})`, margin, 20);
        doc.setFont("helvetica", "normal").setFontSize(9).text(`Ubicación: ${ubStr}`, margin, 27);
        doc.addImage(form.mapImage, "PNG", margin, 33, pageWidth - margin * 2, 120, "", "FAST");
      }

      // Fotos
      const imagenes = (Object.entries(form.fotos) as [string, string | null][]).filter(([, v]) => v !== null) as [string, string][];
      if (imagenes.length > 0) {
        doc.addPage();
        let yImg = 20;
        doc.setFont("helvetica", "bold").setFontSize(12).text(`3. EVIDENCIA FOTOGRÁFICA (Reg. ${index + 1})`, margin, yImg);
        yImg += 4; doc.setLineWidth(0.3).setDrawColor(200, 200, 200).line(margin, yImg + 2, pageWidth - margin, yImg + 2); yImg += 10;
        doc.setDrawColor(0, 0, 0);
        const imgW = 82, imgH = 62, gapX = 10, gapY = 16, captH = 8;
        let xPos = margin, n = 1;
        for (let i = 0; i < imagenes.length; i++) {
          const [, b64] = imagenes[i];
          if (yImg + imgH + captH > pageHeight - 20) { doc.addPage(); yImg = 20; xPos = margin; }
          doc.setFillColor(220, 220, 220); doc.roundedRect(xPos + 1.5, yImg + 1.5, imgW, imgH, 2, 2, "F");
          doc.setFillColor(255, 255, 255); doc.roundedRect(xPos, yImg, imgW, imgH, 2, 2, "F");
          const props = doc.getImageProperties(b64);
          const ratio = Math.min(imgW / props.width, imgH / props.height);
          const drawW = props.width * ratio, drawH = props.height * ratio;
          doc.addImage(b64, "JPEG", xPos + (imgW - drawW) / 2, yImg + (imgH - drawH) / 2, drawW, drawH, `img-${index}-${i}`, "FAST");
          doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(100, 100, 100);
          doc.text(`Fotografía ${n}`, xPos + imgW / 2, yImg + imgH + 5.5, { align: "center" });
          doc.setTextColor(0, 0, 0); n++;
          if (xPos + imgW + gapX + imgW <= pageWidth - margin) { xPos += imgW + gapX; } else { xPos = margin; yImg += imgH + captH + gapY; }
        }
      }
    }
    aplicarMarcaDeAgua(doc);
    doc.save(`${folio}.pdf`);
  };

  // ================= RENDER =================
  const itemActual = checklist[preguntaActual];
  return (
    <div className="relative">
      <div className="max-w-5xl mx-auto font-sans bg-[#eef2f6] p-4 sm:p-8 space-y-6 text-gray-700">
        <div className="flex justify-center"><img src="/logo_fonatur.png" alt="Logo FONATUR" className="w-1/2" /></div>
        <div className="p-2 space-y-6">
          <header className="bg-emerald-600 text-white px-8 py-8 rounded-b-2xl">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h1 className="text-3xl font-extrabold tracking-wide">REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA</h1>
                <p className="text-slate-300 text-sm mt-1">Desarrollo y servicios urbanos</p>
              </div>
              <div className="text-right text-sm font-mono bg-white/10 px-4 py-2 rounded-xl">{currentTime}</div>
            </div>
          </header>

          {/* SECTOR / TRAMO / ACCESO */}
          <div className="w-full max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 px-4 sm:px-6 py-4 bg-gradient-to-r from-white to-gray-50 rounded-2xl shadow-md border border-gray-100">
              <div className="flex flex-col gap-2 w-full sm:w-1/3">
                <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">Sector</label>
                <select value={formData.sector} onChange={e => setFormData(prev => ({ ...prev, sector: e.target.value, Tramo: "" }))}
                  className="px-3 py-2 rounded-xl bg-white border border-gray-200 font-semibold text-[#e67e22] focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30">
                  <option value="">Seleccionar</option>
                  {Object.keys(TRAMOS_POR_SECTOR).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {formData.sector === "Otro" && (
                  <input type="text" placeholder="Sector personalizado..." value={sectorPersonalizado}
                    onChange={e => setSectorPersonalizado(e.target.value)} className="mt-1 px-3 py-2 rounded-xl border border-gray-200 w-full" />
                )}
              </div>
              <div className="flex flex-col gap-2 w-full sm:w-1/3">
                <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">Tramo</label>
                {formData.sector === "Otro" ? (
                  <input type="text" placeholder="Tramo personalizado..." value={tramoPersonalizado}
                    onChange={e => setTramoPersonalizado(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 w-full" />
                ) : (
                  <select value={formData.Tramo} onChange={e => setFormData(prev => ({ ...prev, Tramo: e.target.value }))}
                    disabled={!formData.sector} className="px-3 py-2 rounded-xl border border-gray-200">
                    <option value="">Seleccionar</option>
                    {(TRAMOS_POR_SECTOR[formData.sector] || []).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>
              <div className="flex flex-col gap-2 w-full sm:w-1/3">
                <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">Acceso público a playa</label>
                <input type="text" placeholder="Acceso" value={formData.accesoPublico}
                  onChange={e => setFormData(prev => ({ ...prev, accesoPublico: e.target.value }))}
                  className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30" />
              </div>
            </div>
          </div>

          {/* TIPO MANTENIMIENTO */}
          <div className="flex flex-col gap-2">
            <label className="text-xs tracking-wider uppercase text-emerald-700 font-bold">Tipo de Mantenimiento</label>
            <select value={formData.tipoMantenimiento} onChange={e => setFormData(prev => ({ ...prev, tipoMantenimiento: e.target.value }))}
              className={`px-3 py-2 rounded-xl border font-bold transition-colors ${formData.tipoMantenimiento === 'Urgente' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-700'}`}>
              <option value="">Seleccionar</option>
              <option value="Urgente">🚨 Urgente</option>
              <option value="Ordinario">📋 Ordinario</option>
              <option value="Programable">🗓️ Programable</option>
            </select>
          </div>

          {/* MAPA + GPS */}
          <section className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-3">
                <FaMapMarkedAlt className="text-orange-500" />
                <h2 className="font-bold text-slate-700 uppercase text-sm">Mapa de Ubicación</h2>
              </div>
              <div ref={mapRef} className="h-64"><LeafletMap gps={gps} reportes={[]} /></div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl shadow-md border border-emerald-200 p-6">
              <h3 className="font-bold text-emerald-800 text-sm uppercase mb-4">Coordenadas del Levantamiento</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <input value={gps.lat || ""} readOnly placeholder="Latitud"  className="p-3 rounded-xl border bg-white font-mono text-sm text-center shadow-sm" />
                <input value={gps.lon || ""} readOnly placeholder="Longitud" className="p-3 rounded-xl border bg-white font-mono text-sm text-center shadow-sm" />
              </div>
              <button onClick={obtenerUbicacion} disabled={cargandoGps}
                className={`relative w-full py-3 rounded-xl text-white font-bold flex items-center justify-center overflow-hidden transition-all shadow-lg ${cargandoGps ? "bg-slate-800 cursor-not-allowed border border-emerald-900/50" : "bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5"}`}>
                {cargandoGps ? (
                  <>
                    <style>{`@keyframes scanline{0%{transform:translateY(-150%)}100%{transform:translateY(200%)}} @keyframes radar-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                      <div className="w-full h-12 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-400/50 border-b-2 border-emerald-400" style={{ animation: 'scanline 1.5s linear infinite' }} />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-32 h-32 border border-emerald-500/20 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                    </div>
                    <div className="relative z-10 flex items-center gap-3">
                      <div className="relative flex items-center justify-center w-6 h-6">
                        <div className="absolute inset-0 border-2 border-transparent border-t-emerald-400 rounded-full" style={{ animation: 'radar-spin 0.8s linear infinite' }} />
                        <FaCrosshairs className="text-emerald-300 relative z-10 text-sm" />
                      </div>
                      <span className="animate-pulse font-medium text-emerald-100">Buscando satélites...</span>
                    </div>
                  </>
                ) : <><FaCrosshairs className="mr-2 text-lg" /><span>Capturar Coordenadas</span></>}
              </button>
              <p className="text-xs text-center mt-3 font-semibold">
                Precisión: <span className={parseFloat(gps.precision) > 50 ? "text-red-600" : "text-emerald-700"}>{gps.precision}</span>
              </p>
            </div>
          </section>

          {/* CUESTIONARIO WIZARD */}
          <section className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 max-w-2xl mx-auto w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[#d35400] font-bold uppercase text-xs sm:text-sm">{formData.categoria}</h2>
              <span className="text-xs font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-600">{preguntaActual + 1} de {checklist.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${((preguntaActual + 1) / checklist.length) * 100}%` }} />
            </div>
            <div className="flex flex-wrap gap-1.5 mb-6">
              {checklist.map((item, idx) => (
                <button key={item.id} type="button" onClick={() => setPreguntaActual(idx)} title={item.pregunta}
                  className={`w-6 h-6 rounded-full text-[10px] font-bold transition-all border
                    ${idx === preguntaActual ? "ring-2 ring-offset-1 ring-slate-400 scale-110" : ""}
                    ${item.respuesta === "SI" ? "bg-emerald-500 border-emerald-500 text-white" : item.respuesta === "NO" ? "bg-red-500 border-red-500 text-white" : "bg-white border-gray-300 text-gray-400"}
                    ${item.geoRef ? "outline outline-1 outline-yellow-400" : ""}`}>
                  {item.id}
                </button>
              ))}
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-8 min-h-[300px] flex flex-col justify-center">
              <h3 className="text-lg sm:text-xl font-bold text-center text-slate-800 mb-8 min-h-[60px] flex items-center justify-center">
                {itemActual.id}. {itemActual.pregunta}
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                {(["SI", "NO"] as const).map(val => (
                  <label key={val} className={`cursor-pointer flex-1 py-4 px-6 rounded-xl border-2 text-center font-bold transition-all ${
                    itemActual.respuesta === val
                      ? val === "SI" ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/30"
                      : "bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50"}`}>
                    <input type="radio" name={`p-${itemActual.id}`} value={val} className="hidden"
                      checked={itemActual.respuesta === val} onChange={() => responderYAvanzar(itemActual.id, val)} />
                    {val === "SI" ? "CUMPLE" : "NO CUMPLE"}
                  </label>
                ))}
              </div>
              <div className="mt-auto space-y-3">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Observaciones (Opcional)</label>
                <input type="text" placeholder="Escribe aquí si hay algún detalle..." value={itemActual.observacion}
                  onChange={e => handleChecklistChange(itemActual.id, "observacion", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e67e22]/50 outline-none transition-all text-sm" />
                <div className="flex flex-col gap-2">
                  {itemActual.geoRef ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                        <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
                        <span>{itemActual.geoRef.lat}, {itemActual.geoRef.lon} · ±{itemActual.geoRef.precision} · {itemActual.geoRef.timestamp}</span>
                      </div>
                      <button type="button" onClick={() => limpiarGeoRefItem(itemActual.id)} className="ml-3 text-red-400 hover:text-red-600 transition-colors"><FaTrash size={12} /></button>
                    </div>
                  ) : capturandoGeoRefId === itemActual.id ? (
                    <div className="relative w-full overflow-hidden rounded-xl bg-slate-900 border border-emerald-800 py-3 px-4 flex items-center gap-3">
                      <style>{`@keyframes georef-scan{0%{transform:translateY(-150%)}100%{transform:translateY(350%)}} @keyframes georef-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes georef-pulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:0;transform:scale(1.8)}}`}</style>
                      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                        <div className="w-full h-8 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-500/40 border-b border-emerald-400/60" style={{ animation: 'georef-scan 1.4s linear infinite' }} />
                      </div>
                      <div className="relative flex-shrink-0 w-8 h-8 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border border-emerald-500/40" style={{ animation: 'georef-pulse 1.8s ease-in-out infinite' }} />
                        <div className="absolute inset-0.5 rounded-full border-2 border-transparent border-t-emerald-400" style={{ animation: 'georef-spin 0.75s linear infinite' }} />
                        <svg className="w-3.5 h-3.5 text-emerald-300 relative z-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
                      </div>
                      <div className="relative z-10 flex flex-col min-w-0">
                        <span className="text-emerald-300 text-xs font-bold tracking-wide animate-pulse">Triangulando señal GPS...</span>
                        <span className="text-emerald-600 text-[10px] font-mono truncate">{gps.lat ? `${gps.lat}, ${gps.lon}` : '??.??????, -??.??????'}</span>
                      </div>
                      <div className="ml-auto flex-shrink-0 flex items-end gap-[3px] h-5 relative z-10">
                        {[0.4, 0.65, 1].map((delay, i) => (
                          <div key={i} className="w-1 bg-emerald-400 rounded-sm" style={{ height: `${40 + i * 25}%`, animation: `georef-pulse ${0.8 + i * 0.15}s ease-in-out infinite`, animationDelay: `${delay * 0.3}s` }} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => capturarGeoRefItem(itemActual.id)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed border-slate-300 bg-white text-slate-500 text-sm font-semibold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
                      <span>Geo-referenciar esta incidencia</span>
                    </button>
                  )}
                </div>
                {itemActual.respuesta === "NO" && !itemActual.geoRef && (
                  <p className="text-[11px] text-amber-600 font-medium">⚠️ Incidencia detectada. Considera geo-referenciar la ubicación exacta.</p>
                )}
              </div>
            </div>
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <p className="font-bold text-slate-500 uppercase tracking-wide mb-2">Resumen</p>
              <div className="flex flex-wrap gap-4">
                <span className="text-emerald-600 font-semibold">✓ {checklist.filter(i => i.respuesta === "SI").length} cumplen</span>
                <span className="text-red-500 font-semibold">✗ {checklist.filter(i => i.respuesta === "NO").length} incidencias</span>
                <span className="text-gray-400">— {checklist.filter(i => i.respuesta === "").length} sin responder</span>
                <span className="text-yellow-600 font-semibold">📍 {checklist.filter(i => i.geoRef).length} geo-refs</span>
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <button type="button" onClick={() => setPreguntaActual(p => Math.max(0, p - 1))} disabled={preguntaActual === 0}
                className="px-5 py-2.5 rounded-lg font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm">← Anterior</button>
              <button type="button" onClick={() => setPreguntaActual(p => Math.min(checklist.length - 1, p + 1))} disabled={preguntaActual === checklist.length - 1}
                className="px-5 py-2.5 rounded-lg font-bold text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm">Siguiente →</button>
            </div>
          </section>

          {/* FOTOS */}
          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-[#d35400] font-bold mb-4 flex items-center gap-2 uppercase text-sm"><FaCamera size={18} /> Evidencia Fotográfica</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.keys(FOTOS_INICIAL).map(tipo => (
                <div key={tipo} className="flex flex-col gap-2">
                  <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">{tipo.replace("Foto", "Foto ")}</label>
                  <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition h-48 overflow-hidden">
                    {fotos[tipo] ? (
                      <>
                        <img src={fotos[tipo]!} alt={tipo} className="h-full w-full object-contain rounded" />
                        <button onClick={() => setFotos(prev => ({ ...prev, [tipo]: null }))} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-md transition-colors"><FaTrash size={14} /></button>
                      </>
                    ) : (
                      <>
                        <FaFolderOpen className="text-gray-400 mb-2" size={32} />
                        <span className="text-sm text-gray-500 font-medium">Subir imagen</span>
                        <input type="file" accept="image/*" onChange={e => handleImageUpload(e, tipo)} onClick={e => { e.currentTarget.value = ""; }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex flex-col md:flex-row justify-center gap-6 pt-6 border-t">
          <button onClick={procesarFormularioActual} className="px-10 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold shadow-xl hover:scale-105 transition transform flex items-center gap-3">
            <FaFilePdf /> Generar Reporte Profesional
          </button>
          <button onClick={() => window.location.reload()} className="px-8 py-4 rounded-2xl bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition flex items-center gap-2">
            <FaUndo /> Reiniciar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AreasVerdes;



// 'use client';

// import React, { useState, useRef, useEffect } from 'react';
// import {
//   FaSun, FaCloud, FaUmbrella, FaCrosshairs, FaFileCsv,
//   FaCamera, FaFolderOpen, FaGlobeAmericas, FaUsers, FaMapMarkedAlt, FaSpinner,
//   FaCube, FaListOl, FaChartPie, FaEraser, FaFilePdf, FaTrash, FaUndo
// } from 'react-icons/fa';

// import SignatureCanvas from 'react-signature-canvas';
// import jsPDF from "jspdf";

// import 'leaflet/dist/leaflet.css';
// import dynamic from 'next/dynamic';
// const LeafletMap = dynamic(
//   () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
//   { ssr: false }
// );

// import autoTable from "jspdf-autotable";
// import html2canvas from "html2canvas";
// import { useRouter } from 'next/navigation';
// import { crearReporte, actualizarReporte } from '@/app/lib/actions';

// // ================= INTERFACES =================
// interface FormularioProps {
//   reportesIniciales: any[];
//   reporteParaEditar?: any | null;
// }

// interface GpsCoords {
//   lat: string | null;
//   lon: string | null;
//   precision: string;
// }

// interface FormData {
//   proyecto: string;
//   cliente: string;
//   ubicacion: string;
//   municipio: string;
//   jefe: string;
//   operador: string;
//   ayudantes: string;
//   hInicio: string;
//   hTermino: string;
//   vehiculo: string;
//   placas: string;
//   baseId: string;
//   altInst: string;
//   visado: string;
//   altPrisma: string;
//   norteB: string;
//   esteB: string;
//   elevB: string;
//   area: string;
//   notas: string;
//   sector: string;
//   Tramo: string;
//   accesoPublico: string;
//   categoria: string;
//   tipoMantenimiento: string;
// }

// interface Punto {
//   id: number;
//   punto: string;
//   norte: string;
//   este: string;
//   elev: string;
//   desc: string;
// }

// interface Fotos {
//   [key: string]: string | null;
// }

// // ✅ GeoRef por ítem del checklist
// interface GeoRef {
//   lat: string;
//   lon: string;
//   precision: string;
//   timestamp: string;
// }

// interface ChecklistItem {
//   id: number;
//   pregunta: string;
//   respuesta: string;
//   observacion: string;
//   geoRef?: GeoRef | null; // ✅
// }

// interface PrintSigs {
//   topografo: string | null;
//   cliente: string | null;
// }

// // ================= HELPERS =================
// const parsearChecklist = (raw: any): ChecklistItem[] | null => {
//   if (!raw) return null;
//   try {
//     const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
//     if (Array.isArray(parsed) && parsed.length > 0) {
//       return parsed.map((item: any) => ({
//         ...item,
//         respuesta: (item.respuesta ?? '').toUpperCase(),
//         observacion: item.observacion ?? '',
//         geoRef: item.geoRef ?? null, // ✅ preserva geoRef al editar
//       }));
//     }
//     return null;
//   } catch {
//     return null;
//   }
// };

// // ================= COMPONENTE PRINCIPAL =================
// const AreasVerdes: React.FC<FormularioProps> = ({ reportesIniciales, reporteParaEditar }) => {
//   const router = useRouter();
//   const mapRef = useRef<HTMLDivElement>(null);
//   const [currentTime, setCurrentTime] = useState('');
//   const [formulariosAcumulados, setFormulariosAcumulados] = useState<any[]>([]);
//   const [reportesPrevios, setReportesPrevios] = useState<any[]>([]);

//   // ✅ Estado para geo-ref por ítem
//   const [capturandoGeoRefId, setCapturandoGeoRefId] = useState<number | null>(null);
//   const geoRefWatchId = useRef<number | null>(null);

//   // Leaflet se carga una sola vez
//   useEffect(() => {
//     const loadLeaflet = async () => {
//       const L = await import('leaflet');
//       delete (L.Icon.Default.prototype as any)._getIconUrl;
//       L.Icon.Default.mergeOptions({
//         iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
//         iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
//         shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
//       });
//     };
//     loadLeaflet();
//   }, []);

//   useEffect(() => {
//     const updateTime = () => {
//       setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
//     };
//     updateTime();
//     const interval = setInterval(updateTime, 1000);
//     return () => clearInterval(interval);
//   }, []);

//   // ================= PREGUNTAS ÁREAS VERDES =================
//   const preguntasAlumbrado: string[] = [
//     "PASTO A LO LARGO DEL TRAMO DENTRO DE ALTURA OBJETIVO (1”–2” / 2.5–5.0 CM) Y UNIFORME",
//     "ORILLAS/DESORILLE CORRECTO: ANCHO 20 CM ± 2 CM; SIN INVASIÓN A GUARNICIÓNES/BANQUETAS.",
//     "SIN ZONAS SECAS O “QUEMADAS” (PARCHES CAFÉS, PÉRDIDA DE COBERTURA)",
//     "ÁREA LIBRE DE CONTAMINACIÓN (TIERRA/CASCAJO, LODOS, EXCRETAS, HIDROCARBUROS, ESCOMBROS)",
//     "JARDINERAS/ARRIATES SIN BASURA (PAPEL, PLÁSTICOS, ORGÁNICOS, VIDRIO).",
//     "COBERTURA COMPLETA SEGÚN EL TIPO DE ZONA: CAMELLÓN (AMBOS MÁRGENES Y RETORNOS)",
//     "RED DE RIEGO TAPADA, FUERA DE DIRECCIÓN O CON FUGAS",
//     "DESCOQUE (DERRAME DE COCOS DE PALMERAS)",
//     "DESPALAPADA (DERRAME DE PALAPAS DE PALMERAS DE COCO)",
//     "ESTADO DE SEÑALETICAS  (Bueno/Regular/Malo)",
//     "BALIZADO DE CALLE ",
//     "ESTADO DE MURALES",
//     "BACHEO DE CALLE (M2)",
//     "REPARACIÓN DE BANQUETA  (ML) ",
//     "MANTENIMIENTO DE PARABUSES"
//   ];

//   const tramosPorSector: Record<string, string[]> = {
//     "Barra de Coyuca": ["Sendero-Seguro-Barra Coyuca"],
//     "Pie de la Cuesta": ["Sendero-seguro-Pie de la cuesta"],
//     "Barrios Historicos": ["Caleta-caletilla", "Sendero-Costera-antigua", "Corredor Zocalo-quebrada", "Corredor zocalo-fuerte"],
//     "Acapulco Tradicional": ["Sendero-Tadeo-arredondo", "Sendero-cinerio-hornitos", "Michoacan", "Av. Universidad", "Dr. Ignacio chavez"],
//     "Acapulco Dorado": ["Costa azul"],
//     "Las Brisas": [""],
//     "Puerto Márquez": ["Sendero-Puerto-Marquez"],
//     "Acapulco Diamante": ["Av. Costera Palmas"],
//     "Otro": [""]
//   };

//   // ================= ESTADOS =================
//   const [formData, setFormData] = useState<FormData>({
//     proyecto: 'Levantamiento Topográfico para playas...',
//     cliente: 'Fonatur',
//     ubicacion: '',
//     municipio: 'Acapulco, Guerrero.',
//     jefe: 'Tec. Dafne juarez',
//     operador: 'Ing. Jhosua aleman',
//     ayudantes: 'Tec. jovenes construyendo el futuro',
//     hInicio: '09:05',
//     hTermino: '15:00',
//     vehiculo: 'Silverado 4x4',
//     placas: 'JTD-4821',
//     baseId: 'BASE 01',
//     altInst: '1.735',
//     visado: 'DIRECTO',
//     altPrisma: '2.000',
//     norteB: '2286543.217',
//     esteB: '612845.332',
//     elevB: '',
//     area: '2.35ha',
//     notas: 'Trabajo realizado sin incidencias relevantes...',
//     sector: reporteParaEditar?.sector ?? '',
//     Tramo: reporteParaEditar?.tramo ?? '',
//     accesoPublico: reporteParaEditar?.acceso_publico ?? '',
//     tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
//     categoria: reporteParaEditar?.categoria ?? 'AREAS VERDES',
//   });

//   const [gps, setGps] = useState<GpsCoords>({
//     lat: reporteParaEditar?.latitud?.toString() ?? null,
//     lon: reporteParaEditar?.longitud?.toString() ?? null,
//     precision: reporteParaEditar?.latitud ? 'Guardado' : '--',
//   });
//   const [cargandoGps, setCargandoGps] = useState<boolean>(false);
//   const watchId = useRef<number | null>(null);

//   const [sectorPersonalizado, setSectorPersonalizado] = useState<string>("");
//   const [tramoPersonalizado, setTramoPersonalizado] = useState<string>("");

//   const [fotos, setFotos] = useState<Fotos>(
//     reporteParaEditar?.fotos && Object.keys(reporteParaEditar.fotos).length > 0
//       ? reporteParaEditar.fotos
//       : { Foto1: null, Foto2: null, Foto3: null, Foto4: null, Foto5: null, Foto6: null }
//   );

//   // ✅ Checklist con geoRef: null inicializado
//   const [checklist, setChecklist] = useState<ChecklistItem[]>(
//     parsearChecklist(reporteParaEditar?.checklist) ??
//     preguntasAlumbrado.map((p, i) => ({
//       id: i + 1,
//       pregunta: p,
//       respuesta: "",
//       observacion: "",
//       geoRef: null, // ✅
//     }))
//   );

//   const [preguntaActual, setPreguntaActual] = useState(0);
//   const formRef = useRef<HTMLDivElement>(null);

//   // ================= GPS GENERAL =================
//   const obtenerUbicacion = () => {
//     if (!navigator.geolocation) return alert("GPS no soportado");
//     setCargandoGps(true);
//     const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
//     const onSuccess = (pos: GeolocationPosition) => {
//       const { latitude, longitude, accuracy } = pos.coords;
//       setGps({ lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m` });
//       if (accuracy < 10) finalizarCaptura();
//     };
//     const onError = () => { setCargandoGps(false); alert("Error al obtener señal GPS."); };
//     watchId.current = navigator.geolocation.watchPosition(onSuccess, onError, options);
//     setTimeout(finalizarCaptura, 10000);
//   };

//   const finalizarCaptura = () => {
//     if (watchId.current !== null) {
//       navigator.geolocation.clearWatch(watchId.current);
//       watchId.current = null;
//       setCargandoGps(false);
//     }
//   };

//   // ✅ GPS por ítem del checklist
//   const capturarGeoRefItem = (itemId: number) => {
//     if (!navigator.geolocation) return alert("GPS no soportado en este dispositivo.");
//     setCapturandoGeoRefId(itemId);
//     const options = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 };

//     const onSuccess = (pos: GeolocationPosition) => {
//       const { latitude, longitude, accuracy } = pos.coords;
//       const ahora = new Date();
//       const timestamp = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
//       const geoRef: GeoRef = {
//         lat: latitude.toFixed(6),
//         lon: longitude.toFixed(6),
//         precision: `${accuracy.toFixed(1)}m`,
//         timestamp,
//       };
//       setChecklist(prev => prev.map(item => item.id === itemId ? { ...item, geoRef } : item));
//       if (geoRefWatchId.current !== null) {
//         navigator.geolocation.clearWatch(geoRefWatchId.current);
//         geoRefWatchId.current = null;
//       }
//       setCapturandoGeoRefId(null);
//     };

//     const onError = () => {
//       setCapturandoGeoRefId(null);
//       alert("No se pudo obtener la ubicación. Verifica que el GPS esté activo.");
//     };

//     geoRefWatchId.current = navigator.geolocation.watchPosition(onSuccess, onError, options);
//     setTimeout(() => {
//       if (geoRefWatchId.current !== null) {
//         navigator.geolocation.clearWatch(geoRefWatchId.current);
//         geoRefWatchId.current = null;
//         setCapturandoGeoRefId(null);
//       }
//     }, 12000);
//   };

//   const limpiarGeoRefItem = (itemId: number) => {
//     setChecklist(prev => prev.map(item => item.id === itemId ? { ...item, geoRef: null } : item));
//   };

//   // ================= HELPERS DE FORMULARIO =================
//   const handleChecklistChange = (id: number, field: keyof ChecklistItem, value: string) => {
//     setChecklist(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
//   };

//   const responderYAvanzar = (id: number, valor: string) => {
//     handleChecklistChange(id, 'respuesta', valor);
//     if (preguntaActual < checklist.length - 1) {
//       setTimeout(() => setPreguntaActual(preguntaActual + 1), 350);
//     }
//   };

//   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({ ...prev, [name]: value }));
//   };

//   const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, tipo: string) => {
//     if (!e.target.files || !e.target.files[0]) return;
//     const file = e.target.files[0];
//     const canvas = document.createElement('canvas');
//     const img = new Image();
//     img.onload = () => {
//       const maxW = 800;
//       const ratio = Math.min(maxW / img.width, 1);
//       canvas.width = img.width * ratio;
//       canvas.height = img.height * ratio;
//       canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
//       setFotos(prev => ({ ...prev, [tipo]: canvas.toDataURL('image/jpeg', 0.7) }));
//     };
//     img.src = URL.createObjectURL(file);
//   };

//   const limpiarFormulario = () => {
//     setPreguntaActual(0);
//     setChecklist(preguntasAlumbrado.map((p, i) => ({
//       id: i + 1, pregunta: p, respuesta: "", observacion: "", geoRef: null // ✅
//     })));
//     setFotos({ Foto1: null, Foto2: null, Foto3: null, Foto4: null, Foto5: null, Foto6: null });
//     setGps({ lat: null, lon: null, precision: '--' });
//   };

//   // ================= GUARDAR EN BD =================
//   const guardarCuestionario = async () => {
//     try {
//       const sectorFinal = formData.sector === "Otro" ? sectorPersonalizado : formData.sector;
//       const tramoFinal = formData.sector === "Otro" ? tramoPersonalizado : formData.Tramo;
//       const formDataFinal = { ...formData, sector: sectorFinal, Tramo: tramoFinal };
//       if (reporteParaEditar?.id) {
//         await actualizarReporte(reporteParaEditar.id.toString(), formDataFinal, checklist, gps, fotos);
//         alert("¡Reporte actualizado exitosamente!");
//       } else {
//         await crearReporte(formDataFinal, checklist, gps, fotos);
//         alert("¡Reporte guardado exitosamente en la base de datos!");
//       }
//     } catch (error) {
//       console.error("Error al guardar:", error);
//       alert("Hubo un error al guardar el reporte.");
//     }
//   };

//   // ================= PROCESAR Y ACUMULAR =================
//   const procesarFormularioActual = async () => {
//     try {
//       await guardarCuestionario();
//       let mapImage = null;
//       if (gps.lat && mapRef.current) {
//         const canvas = await html2canvas(mapRef.current, {
//           useCORS: true, allowTaint: true, scale: 4,
//           ignoreElements: (el) => el.classList?.contains('leaflet-control-container'),
//         });
//         mapImage = canvas.toDataURL("image/png");
//       }
//       const sectorFinal = formData.sector === "Otro" ? sectorPersonalizado : formData.sector;
//       const tramoFinal = formData.sector === "Otro" ? tramoPersonalizado : formData.Tramo;
//       const formularioCompleto = {
//         formData: { ...formData, sector: sectorFinal, Tramo: tramoFinal },
//         checklist: [...checklist], // ✅ geoRefs incluidos
//         gps: { ...gps },
//         fotos: { ...fotos },
//         mapImage,
//         fechaCaptura: new Date(),
//       };
//       const nuevosFormularios = [...formulariosAcumulados, formularioCompleto];
//       setFormulariosAcumulados(nuevosFormularios);
//       const agregarOtro = window.confirm("Formulario guardado exitosamente.\n\n¿Deseas llenar OTRO formulario para incluirlo en el MISMO PDF?");
//       if (agregarOtro) {
//         limpiarFormulario();
//         window.scrollTo({ top: 0, behavior: 'smooth' });
//       } else {
//         await generarPDFMultiples(nuevosFormularios);
//         setFormulariosAcumulados([]);
//         limpiarFormulario();
//       }
//     } catch (error) {
//       console.error("Error en el proceso:", error);
//       alert("Hubo un error al procesar el formulario.");
//     }
//   };

//   // ================= GENERAR PDF (márgenes corregidos) =================
//   const generarPDFMultiples = async (listaFormularios: any[]) => {
//     const doc = new jsPDF("p", "mm", "a4");
//     const pageWidth = doc.internal.pageSize.getWidth();   // 210mm
//     const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
//     const margin = 15;
//     // Ancho útil = 210 - 15 - 15 = 180mm — todas las tablas deben sumar esto

//     // ── Marca de agua (se aplica al final) ──
//     const aplicarMarcaDeAguaFinal = (pdfDoc: any) => {
//       const totalPaginas = pdfDoc.internal.getNumberOfPages();
//       for (let i = 1; i <= totalPaginas; i++) {
//         pdfDoc.setPage(i);
//         pdfDoc.saveGraphicsState();
//         pdfDoc.setGState(new (pdfDoc as any).GState({ opacity: 0.15 }));
//         const imgWidth = 140, imgHeight = 40;
//         pdfDoc.addImage(
//           "/logo_fonatur.png", "PNG",
//           (pageWidth - imgWidth) / 2, (pageHeight - imgHeight) / 2,
//           imgWidth, imgHeight
//         );
//         pdfDoc.restoreGraphicsState();
//       }
//     };

//     const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
//     const folioFinal = `REV-MULTIPLE-${random}`;

//     for (let index = 0; index < listaFormularios.length; index++) {
//       const form = listaFormularios[index];
//       if (index > 0) doc.addPage();

//       let y = 20;
//       const fechaFormateada = form.fechaCaptura.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
//       const horaFormateada = form.fechaCaptura.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
//       const ubicacionTexto = form.gps.lat && form.gps.lon
//         ? `Lat: ${form.gps.lat}  |  Lon: ${form.gps.lon}`
//         : "No capturada";

//       // ── ENCABEZADO ──
//       y += 6;
//       doc.setFont("helvetica", "bold");
//       doc.setFontSize(13);
//       doc.text(`REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA (Reg. ${index + 1})`, margin, y);
//       y += 4;
//       doc.setLineWidth(0.6);
//       doc.line(margin, y, pageWidth - margin, y);
//       y += 8;

//       // ── DATOS GENERALES ──
//       doc.setFontSize(10);
//       doc.setFont("helvetica", "normal");
//       doc.text(`Folio Interno: ${folioFinal}-${index + 1}`, margin, y);
//       doc.text(`Fecha: ${fechaFormateada}`, pageWidth / 2, y);
//       doc.text(`Hora: ${horaFormateada}`, pageWidth - 50, y);
//       y += 6;
//       doc.text(`Sector: ${form.formData.sector}`, margin, y); y += 6;
//       doc.text(`Tramo: ${form.formData.Tramo}`, margin, y); y += 6;
//       doc.text(`Acceso público a playa: ${form.formData.accesoPublico || "No especificado"}`, margin, y); y += 6;
//       doc.setFont("helvetica", "bold");
//       doc.text(`TIPO DE MANTENIMIENTO: ${form.formData.tipoMantenimiento?.toUpperCase() || "NO ESPECIFICADO"}`, margin, y);
//       doc.setFont("helvetica", "normal");
//       y += 8;

//       // ── CHECKLIST ──
//       doc.setFont("helvetica", "bold");
//       doc.setFontSize(12);
//       doc.text("1. LISTA DE VERIFICACIÓN – ÁREAS VERDES", margin, y);
//       y += 5;

//       /*
//         Anchos columnas (deben sumar 180mm):
//           No.           →  10
//           Concepto      →  88
//           Cumple        →  16
//           No Cumple     →  16
//           Observaciones →  50
//                             ───
//                             180  ✓
//       */
//       const tableData: any[] = [];
//       form.checklist.forEach((item: ChecklistItem) => {
//         // ✅ Observaciones + geoRef en una sola celda
//         const obsTexto = item.observacion || "";
//         const geoTexto = item.geoRef
//           ? `Lat: ${item.geoRef.lat}\nLon: ${item.geoRef.lon}\n±${item.geoRef.precision} — ${item.geoRef.timestamp}`
//           : "";
//         const obsConGeoRef = [obsTexto, geoTexto].filter(Boolean).join("\n");

//         tableData.push([
//           item.id,
//           item.pregunta,
//           item.respuesta === "SI" ? "X" : "",
//           item.respuesta === "NO" ? "X" : "",
//           obsConGeoRef,
//         ]);
//       });

//       autoTable(doc, {
//         startY: y,
//         margin: { left: margin, right: margin }, // ✅
//         head: [["No.", "Concepto Evaluado", "Cumple", "No Cumple", "Observaciones / Geo-ref"]],
//         body: tableData,
//         theme: "grid",
//         styles: { fontSize: 8, cellPadding: 3, valign: "top", lineWidth: 0.2, overflow: "linebreak" },
//         headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold", halign: "center" },
//         columnStyles: {
//           0: { cellWidth: 10, halign: "center" },
//           1: { cellWidth: 88 },
//           2: { cellWidth: 16, halign: "center" },
//           3: { cellWidth: 16, halign: "center" },
//           4: { cellWidth: 50 },             // 10+88+16+16+50 = 180 ✓
//         },
//       });

//       y = (doc as any).lastAutoTable.finalY + 8;
//       doc.setFontSize(9);
//       doc.setFont("helvetica", "normal");

//       // ── TABLA GEO-REFERENCIAS (página propia si existen) ──
//       /*
//         Anchos columnas (180mm):
//           No.       →  10
//           Concepto  →  80
//           Latitud   →  22
//           Longitud  →  22
//           Precisión →  22
//           Hora      →  24
//                         ───
//                         180  ✓
//       */
//       // const itemsConGeoRef = form.checklist.filter((item: ChecklistItem) => item.geoRef);
//       // if (itemsConGeoRef.length > 0) {
//       //   doc.addPage();
//       //   doc.setFont("helvetica", "bold");
//       //   doc.setFontSize(12);
//       //   doc.text(`2. GEO-REFERENCIAS DE INCIDENCIAS (Reg. ${index + 1})`, margin, 20);
//       //   doc.setFont("helvetica", "normal");
//       //   doc.setFontSize(9);
//       //   doc.text("Coordenadas específicas capturadas durante la inspección:", margin, 28);

//       //   autoTable(doc, {
//       //     startY: 33,
//       //     margin: { left: margin, right: margin }, // ✅
//       //     head: [["No.", "Concepto", "Latitud", "Longitud", "Precisión", "Hora"]],
//       //     body: itemsConGeoRef.map((item: ChecklistItem) => [
//       //       item.id,
//       //       item.pregunta,
//       //       item.geoRef!.lat,
//       //       item.geoRef!.lon,
//       //       item.geoRef!.precision,
//       //       item.geoRef!.timestamp,
//       //     ]),
//       //     theme: "striped",
//       //     styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
//       //     headStyles: { fillColor: [20, 83, 45], textColor: 255, fontStyle: "bold", halign: "center" },
//       //     columnStyles: {
//       //       0: { cellWidth: 10, halign: "center" },
//       //       1: { cellWidth: 80 },
//       //       2: { cellWidth: 22, halign: "center" },
//       //       3: { cellWidth: 22, halign: "center" },
//       //       4: { cellWidth: 22, halign: "center" },
//       //       5: { cellWidth: 24, halign: "center" }, // 10+80+22+22+22+24 = 180 ✓
//       //     },
//       //   });
//       // }

//       // ── MAPA ──
//       if (form.mapImage) {
//         doc.addPage();
//         doc.setFont("helvetica", "bold");
//         doc.setFontSize(12);
//         doc.text(`2. MAPA DE UBICACIÓN (Reg. ${index + 1})`, margin, 20);
//         doc.setFontSize(9);
//         doc.setFont("helvetica", "normal");
//         doc.text(`Ubicación: ${ubicacionTexto}`, margin, 27); // y fijo tras addPage
//         // Una sola llamada addImage
//         doc.addImage(form.mapImage, "PNG", margin, 33, pageWidth - margin * 2, 120, "", "FAST");
//       }

//       // ── EVIDENCIA FOTOGRÁFICA ──
//     // ── EVIDENCIA FOTOGRÁFICA ──────────────────────────────────────
// const imagenes = Object.entries(form.fotos).filter(
//   ([_, value]) => value !== null
// ) as [string, string][];

// if (imagenes.length > 0) {
//   doc.addPage();
//   let yImg = 20;

//   // Título de sección
//   doc.setFont("helvetica", "bold");
//   doc.setFontSize(12);
//   doc.text(`3. EVIDENCIA FOTOGRÁFICA (Reg. ${index + 1})`, margin, yImg);
//   yImg += 4;
//   doc.setLineWidth(0.3);
//   doc.setDrawColor(200, 200, 200);
//   doc.line(margin, yImg + 2, pageWidth - margin, yImg + 2);
//   yImg += 10;

//   /*
//     Layout: 2 columnas, sin marcos, con sombra simulada (rect gris claro detrás),
//     imagen a máxima resolución posible dentro de su celda.

//     Anchos:
//       col1 xPosition  = margin (15)
//       col2 xPosition  = margin + imgWidth + espacioX
//       imgWidth        = 82mm  → dos columnas = 82+10+82 = 174 ≤ 180 ✓
//   */
//   const imgWidth  = 82;
//   const imgHeight = 62;
//   const espacioX  = 10;   // separación horizontal entre columnas
//   const espacioY  = 16;   // separación vertical entre filas
//   const captionH  = 8;    // altura reservada para el pie de foto

//   let xPosition = margin;
//   let contador  = 1;

//   // Resetear color de trazo
//   doc.setDrawColor(0, 0, 0);

//   for (let i = 0; i < imagenes.length; i++) {
//     const [_, base64] = imagenes[i];

//     // ¿Cabe en la página actual?
//     if (yImg + imgHeight + captionH > pageHeight - 20) {
//       doc.addPage();
//       yImg      = 20;
//       xPosition = margin;
//     }

//     // ── Sombra simulada: rect gris muy claro, desplazado 1.5mm ──
//     doc.setFillColor(220, 220, 220);
//     doc.roundedRect(xPosition + 1.5, yImg + 1.5, imgWidth, imgHeight, 2, 2, "F");

//     // ── Fondo blanco de la celda ──
//     doc.setFillColor(255, 255, 255);
//     doc.roundedRect(xPosition, yImg, imgWidth, imgHeight, 2, 2, "F");

//     // ── Imagen: escalar manteniendo aspecto y centrar dentro de la celda ──
//     const imgProps = doc.getImageProperties(base64);
//     const scaleX   = imgWidth  / imgProps.width;
//     const scaleY   = imgHeight / imgProps.height;
//     const ratio    = Math.min(scaleX, scaleY);  // contiene sin distorsionar

//     const drawW = imgProps.width  * ratio;
//     const drawH = imgProps.height * ratio;

//     // Centrado dentro de la celda
//     const offsetX = (imgWidth  - drawW) / 2;
//     const offsetY = (imgHeight - drawH) / 2;

//     // ✅ "PNG" en lugar de "JPEG" conserva la calidad original del base64
//     doc.addImage(
//       base64, "PNG",
//       xPosition + offsetX,
//       yImg      + offsetY,
//       drawW, drawH,
//       `img-${index}-${i}`,  // alias único, evita re-codificación si se repite
//       "FAST"
//     );

//     // ── Pie de foto: solo número, sin "FOTO1" repetitivo ──
//     doc.setFont("helvetica", "italic");
//     doc.setFontSize(7.5);
//     doc.setTextColor(100, 100, 100);
//     doc.text(
//       `Fotografía ${contador}`,
//       xPosition + imgWidth / 2,
//       yImg + imgHeight + 5.5,
//       { align: "center" }
//     );
//     doc.setTextColor(0, 0, 0); // resetear color

//     contador++;

//     // Avanzar columna o nueva fila
//     if (xPosition + imgWidth + espacioX + imgWidth <= pageWidth - margin) {
//       xPosition += imgWidth + espacioX;
//     } else {
//       xPosition = margin;
//       yImg += imgHeight + captionH + espacioY;
//     }
//   }
// }
//     }

//     // ── MARCA DE AGUA GLOBAL ──
//     aplicarMarcaDeAguaFinal(doc);
//     doc.save(`${folioFinal}.pdf`);
//   };

//   // ================= RENDER =================
//   return (
//     <div className="relative">
//       <div className="max-w-5xl mx-auto font-sans bg-[#eef2f6] p-4 sm:p-8 space-y-6 text-gray-700">
//         <div className="mb-4">
//           <div className="flex justify-center mt-4">
//             <img src="/logo_fonatur.png" alt="Logo" className="w-1/2" />
//           </div>
//         </div>

//         <div ref={formRef} className="p-2 space-y-6">
//           {/* HEADER */}
//           <header className="relative bg-emerald-600 text-white px-8 py-8">
//             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
//               <div>
//                 <h1 className="text-3xl font-extrabold tracking-wide">
//                   REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA
//                 </h1>
//                 <p className="text-slate-300 text-sm mt-1">Desarrollo y servicios urbanos</p>
//               </div>
//               <div className="text-right text-sm font-mono bg-white/10 px-4 py-2 rounded-xl">
//                 {currentTime}
//               </div>
//             </div>
//           </header>

//           {/* SECTOR Y TRAMO */}
//           <div className="w-full max-w-4xl mx-auto">
//             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 px-4 sm:px-6 py-4
//                             bg-gradient-to-r from-white to-gray-50 rounded-2xl shadow-md border border-gray-100 backdrop-blur-sm">
//               <div className="flex flex-col gap-2 w-full sm:w-1/3">
//                 <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">Sector</label>
//                 <select
//                   name="sector"
//                   value={formData.sector}
//                   onChange={(e) => setFormData(prev => ({ ...prev, sector: e.target.value, Tramo: "" }))}
//                   className="px-3 py-2 rounded-xl bg-white border border-gray-200 font-semibold text-[#e67e22] focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30"
//                 >
//                   <option value="">Seleccionar</option>
//                   {Object.keys(tramosPorSector).map(sector => (
//                     <option key={sector} value={sector}>{sector}</option>
//                   ))}
//                 </select>
//                 {formData.sector === "Otro" && (
//                   <input
//                     type="text"
//                     placeholder="Escribe el sector..."
//                     value={sectorPersonalizado}
//                     onChange={(e) => setSectorPersonalizado(e.target.value)}
//                     className="mt-2 px-3 py-2 rounded-xl border border-gray-200 w-full"
//                   />
//                 )}
//               </div>

//               <div className="flex flex-col gap-2 w-full sm:w-1/3">
//                 <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">Tramo</label>
//                 {formData.sector === "Otro" ? (
//                   <input
//                     type="text"
//                     placeholder="Escribe el tramo..."
//                     value={tramoPersonalizado}
//                     onChange={(e) => setTramoPersonalizado(e.target.value)}
//                     className="px-3 py-2 rounded-xl border border-gray-200 w-full"
//                   />
//                 ) : (
//                   <select
//                     name="Tramo"
//                     value={formData.Tramo}
//                     onChange={(e) => setFormData(prev => ({ ...prev, Tramo: e.target.value }))}
//                     disabled={!formData.sector}
//                     className="px-3 py-2 rounded-xl border border-gray-200"
//                   >
//                     <option value="">Seleccionar</option>
//                     {(tramosPorSector[formData.sector] || []).map(tramo => (
//                       <option key={tramo} value={tramo}>{tramo}</option>
//                     ))}
//                   </select>
//                 )}
//               </div>

//               <div className="flex flex-col gap-2 w-full sm:w-1/3">
//                 <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">Acceso público a playa</label>
//                 <input
//                   type="text"
//                   name="accesoPublico"
//                   placeholder="Acceso"
//                   value={formData.accesoPublico}
//                   onChange={(e) => setFormData(prev => ({ ...prev, accesoPublico: e.target.value }))}
//                   className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30"
//                 />
//               </div>
//             </div>
//           </div>

//           {/* TIPO DE MANTENIMIENTO */}
//           <div className="flex flex-col gap-2">
//             <label className="text-xs tracking-wider uppercase text-emerald-700 font-bold">Tipo de Mantenimiento</label>
//             <select
//               name="tipoMantenimiento"
//               value={formData.tipoMantenimiento}
//               onChange={handleInputChange}
//               className={`px-3 py-2 rounded-xl border font-bold transition-colors ${
//                 formData.tipoMantenimiento === 'Urgente'
//                   ? 'bg-red-50 border-red-200 text-red-600'
//                   : 'bg-white border-gray-200 text-gray-700'
//               }`}
//             >
//               <option value="">Seleccionar</option>
//               <option value="Urgente">🚨 Urgente</option>
//               <option value="Ordinario">📋 Ordinario</option>
//               <option value="Programable">🗓️ Programable</option>
//             </select>
//           </div>

//           {/* MAPA + GPS */}
//           <section className="grid md:grid-cols-2 gap-8">
//             <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
//               <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-3">
//                 <FaMapMarkedAlt className="text-orange-500" />
//                 <h2 className="font-bold text-slate-700 uppercase text-sm">Mapa de Ubicación</h2>
//               </div>
//               <div ref={mapRef} className="h-64">
//                 <LeafletMap gps={gps} reportes={[]} />
//               </div>
//             </div>

//             <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl shadow-md border border-emerald-200 p-6">
//               <h3 className="font-bold text-emerald-800 text-sm uppercase mb-4">Coordenadas del Levantamiento</h3>
//               <div className="grid grid-cols-2 gap-3 mb-4">
//                 <input value={gps.lat || ""} readOnly placeholder="Latitud" className="p-3 rounded-xl border bg-white font-mono text-sm text-center shadow-sm" />
//                 <input value={gps.lon || ""} readOnly placeholder="Longitud" className="p-3 rounded-xl border bg-white font-mono text-sm text-center shadow-sm" />
//               </div>
//               <button
//                 onClick={obtenerUbicacion}
//                 disabled={cargandoGps}
//                 className={`relative w-full py-3 rounded-xl text-white font-bold flex items-center justify-center overflow-hidden transition-all shadow-lg ${
//                   cargandoGps
//                     ? "bg-slate-800 cursor-not-allowed border border-emerald-900/50"
//                     : "bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-emerald-500/30"
//                 }`}
//               >
//                 {cargandoGps ? (
//                   <>
//                     <style>{`
//                       @keyframes scanline { 0% { transform: translateY(-150%); } 100% { transform: translateY(200%); } }
//                       @keyframes radar-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
//                     `}</style>
//                     <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
//                       <div className="w-full h-12 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-400/50 border-b-2 border-emerald-400 shadow-[0_5px_15px_rgba(52,211,152,0.4)]"
//                         style={{ animation: 'scanline 1.5s linear infinite' }}></div>
//                     </div>
//                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
//                       <div className="w-32 h-32 border border-emerald-500/20 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
//                     </div>
//                     <div className="relative z-10 flex items-center gap-3">
//                       <div className="relative flex items-center justify-center w-6 h-6">
//                         <div className="absolute inset-0 border-2 border-transparent border-t-emerald-400 rounded-full opacity-90"
//                           style={{ animation: 'radar-spin 0.8s linear infinite' }}></div>
//                         <FaCrosshairs className="text-emerald-300 relative z-10 text-sm" />
//                       </div>
//                       <span className="animate-pulse tracking-wide font-medium text-emerald-100">Buscando satélites...</span>
//                     </div>
//                   </>
//                 ) : (
//                   <><FaCrosshairs className="mr-2 text-lg" /><span>Capturar Coordenadas</span></>
//                 )}
//               </button>
//               <p className="text-xs text-center mt-3 font-semibold">
//                 Precisión:{" "}
//                 <span className={parseFloat(gps.precision) > 50 ? "text-red-600" : "text-emerald-700"}>{gps.precision}</span>
//               </p>
//             </div>
//           </section>

//           {/* CUESTIONARIO WIZARD */}
//           <section className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 max-w-2xl mx-auto w-full">
//             <div className="flex justify-between items-center mb-4">
//               <h2 className="text-[#d35400] font-bold uppercase text-xs sm:text-sm">{formData.categoria}</h2>
//               <span className="text-xs font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-600">
//                 {preguntaActual + 1} de {checklist.length}
//               </span>
//             </div>

//             <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
//               <div
//                 className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
//                 style={{ width: `${((preguntaActual + 1) / checklist.length) * 100}%` }}
//               />
//             </div>
//              {/* Mini-mapa de preguntas — va debajo de la barra de progreso */}
//             <div className="flex flex-wrap gap-1.5 mb-6">
//               {checklist.map((item, idx) => (
//                 <button
//                   key={item.id}
//                   type="button"
//                   onClick={() => setPreguntaActual(idx)}
//                   title={item.pregunta}
//                   className={`w-6 h-6 rounded-full text-[10px] font-bold transition-all border
//         ${idx === preguntaActual
//                       ? "ring-2 ring-offset-1 ring-slate-400 scale-110"
//                       : ""}
//         ${item.respuesta === "SI"
//                       ? "bg-emerald-500 border-emerald-500 text-white"
//                       : item.respuesta === "NO"
//                         ? "bg-red-500 border-red-500 text-white"
//                         : "bg-white border-gray-300 text-gray-400"}
//         ${item.geoRef ? "ring-1 ring-yellow-400" : ""}
//       `}
//                 >
//                   {item.id}
//                 </button>
//               ))}
//             </div>

//             <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-8 min-h-[300px] flex flex-col justify-center transition-all">
//               <h3 className="text-lg sm:text-xl font-bold text-center text-slate-800 mb-8 min-h-[60px] flex items-center justify-center">
//                 {checklist[preguntaActual].id}. {checklist[preguntaActual].pregunta}
//               </h3>

//               <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
//                 <label className={`cursor-pointer flex-1 py-4 px-6 rounded-xl border-2 text-center font-bold transition-all ${
//                   checklist[preguntaActual].respuesta === "SI"
//                     ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30"
//                     : "bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50"
//                 }`}>
//                   <input type="radio" name={`pregunta-${checklist[preguntaActual].id}`} value="SI" className="hidden"
//                     checked={checklist[preguntaActual].respuesta === "SI"}
//                     onChange={() => responderYAvanzar(checklist[preguntaActual].id, "SI")} />
//                   CUMPLE
//                 </label>
//                 <label className={`cursor-pointer flex-1 py-4 px-6 rounded-xl border-2 text-center font-bold transition-all ${
//                   checklist[preguntaActual].respuesta === "NO"
//                     ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/30"
//                     : "bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50"
//                 }`}>
//                   <input type="radio" name={`pregunta-${checklist[preguntaActual].id}`} value="NO" className="hidden"
//                     checked={checklist[preguntaActual].respuesta === "NO"}
//                     onChange={() => responderYAvanzar(checklist[preguntaActual].id, "NO")} />
//                   NO CUMPLE
//                 </label>
//               </div>

//               {/* Observaciones + geo-ref */}
//               <div className="mt-auto space-y-3">
//                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
//                   Observaciones (Opcional)
//                 </label>
//                 <input
//                   type="text"
//                   placeholder="Escribe aquí si hay algún detalle..."
//                   value={checklist[preguntaActual].observacion}
//                   onChange={(e) => handleChecklistChange(checklist[preguntaActual].id, "observacion", e.target.value)}
//                   className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e67e22]/50 focus:border-[#e67e22] outline-none transition-all text-sm"
//                 />

//                 {/* ✅ Botón/badge de geo-referencia */}
//                 {/* ── Geo-referencia por ítem ── */}
//                 <div className="flex flex-col gap-2">
//                   {checklist[preguntaActual].geoRef ? (
//                     // ── Estado: ya tiene coordenadas ──
//                     <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
//                       <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
//                         <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
//                           <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
//                         </svg>
//                         <span>
//                           {checklist[preguntaActual].geoRef!.lat}, {checklist[preguntaActual].geoRef!.lon}
//                           &nbsp;·&nbsp;±{checklist[preguntaActual].geoRef!.precision}
//                           &nbsp;·&nbsp;{checklist[preguntaActual].geoRef!.timestamp}
//                         </span>
//                       </div>
//                       <button
//                         type="button"
//                         onClick={() => limpiarGeoRefItem(checklist[preguntaActual].id)}
//                         className="ml-3 text-red-400 hover:text-red-600 transition-colors"
//                         title="Eliminar geo-referencia"
//                       >
//                         <FaTrash size={12} />
//                       </button>
//                     </div>

//                   ) : capturandoGeoRefId === checklist[preguntaActual].id ? (
//                     // ── Estado: capturando GPS ── ANIMACIÓN RADAR ──
//                     <div className="relative w-full overflow-hidden rounded-xl bg-slate-900 border border-emerald-800 py-3 px-4 flex items-center gap-3">

//                       {/* Keyframes inline */}
//                       <style>{`
//         @keyframes georef-scan {
//           0%   { transform: translateY(-150%); }
//           100% { transform: translateY(350%); }
//         }
//         @keyframes georef-spin {
//           from { transform: rotate(0deg); }
//           to   { transform: rotate(360deg); }
//         }
//         @keyframes georef-ping-slow {
//           0%, 100% { opacity: 0.6; transform: scale(1);   }
//           50%       { opacity: 0;   transform: scale(1.8); }
//         }
//       `}</style>

//                       {/* Láser de barrido horizontal */}
//                       <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
//                         <div
//                           className="w-full h-8 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-500/40 border-b border-emerald-400/60 shadow-[0_4px_12px_rgba(52,211,152,0.35)]"
//                           style={{ animation: 'georef-scan 1.4s linear infinite' }}
//                         />
//                       </div>

//                       {/* Icono radar giratorio */}
//                       <div className="relative flex-shrink-0 w-8 h-8 flex items-center justify-center">
//                         {/* Anillo exterior pulsante */}
//                         <div
//                           className="absolute inset-0 rounded-full border border-emerald-500/40"
//                           style={{ animation: 'georef-ping-slow 1.8s ease-in-out infinite' }}
//                         />
//                         {/* Arco giratorio */}
//                         <div
//                           className="absolute inset-0.5 rounded-full border-2 border-transparent border-t-emerald-400"
//                           style={{ animation: 'georef-spin 0.75s linear infinite' }}
//                         />
//                         {/* Pin estático en el centro */}
//                         <svg className="w-3.5 h-3.5 text-emerald-300 relative z-10" fill="currentColor" viewBox="0 0 24 24">
//                           <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
//                         </svg>
//                       </div>

//                       {/* Texto + coordenadas simuladas parpadeando */}
//                       <div className="relative z-10 flex flex-col min-w-0">
//                         <span className="text-emerald-300 text-xs font-bold tracking-wide animate-pulse">
//                           Triangulando señal GPS...
//                         </span>
//                         <span className="text-emerald-600 text-[10px] font-mono truncate">
//                           {/* Muestra las coords generales del formulario si ya las capturó, si no puntos */}
//                           {gps.lat ? `${gps.lat}, ${gps.lon}` : '??.??????, -??.??????'}
//                         </span>
//                       </div>

//                       {/* Indicador de señal (3 barras animadas) */}
//                       <div className="ml-auto flex-shrink-0 flex items-end gap-[3px] h-5 relative z-10">
//                         {[0.4, 0.65, 1].map((delay, i) => (
//                           <div
//                             key={i}
//                             className="w-1 bg-emerald-400 rounded-sm"
//                             style={{
//                               height: `${40 + i * 25}%`,
//                               animation: `georef-ping-slow ${0.8 + i * 0.15}s ease-in-out infinite`,
//                               animationDelay: `${delay * 0.3}s`,
//                             }}
//                           />
//                         ))}
//                       </div>
//                     </div>

//                   ) : (
//                     // ── Estado: sin coordenadas, botón inactivo ──
//                     <button
//                       type="button"
//                       onClick={() => capturarGeoRefItem(checklist[preguntaActual].id)}
//                       className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
//                  border-2 border-dashed border-slate-300 bg-white
//                  text-slate-500 text-sm font-semibold
//                  hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50
//                  transition-all"
//                     >
//                       <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
//                         <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
//                       </svg>
//                       <span>Geo-referenciar esta incidencia</span>
//                     </button>
//                   )}
//                 </div>

//                 {/* ── Ayuda contextual ── */}
//                 {checklist[preguntaActual].respuesta === "NO" && !checklist[preguntaActual].geoRef && (
//                   <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
//                     ⚠️ Incidencia detectada. Considera geo-referenciar la ubicación exacta del problema.
//                   </p>
//                 )}
//               </div>
//             </div>

            
//                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
//               <p className="font-bold text-slate-500 uppercase tracking-wide mb-2">Resumen</p>
//               <div className="flex flex-wrap gap-4">
//                 <span className="text-emerald-600 font-semibold">✓ {checklist.filter(i => i.respuesta === "SI").length} cumplen</span>
//                 <span className="text-red-500 font-semibold">✗ {checklist.filter(i => i.respuesta === "NO").length} incidencias</span>
//                 <span className="text-gray-400">— {checklist.filter(i => i.respuesta === "").length} sin responder</span>
//                 <span className="text-yellow-600 font-semibold">📍 {checklist.filter(i => i.geoRef).length} geo-refs</span>
//               </div>
//             </div>

//             <div className="flex justify-between mt-6">
//               <button
//                 type="button"
//                 onClick={() => setPreguntaActual(Math.max(0, preguntaActual - 1))}
//                 disabled={preguntaActual === 0}
//                 className="px-5 py-2.5 rounded-lg font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
//               >
//                 ← Anterior
//               </button>
//               <button
//                 type="button"
//                 onClick={() => setPreguntaActual(Math.min(checklist.length - 1, preguntaActual + 1))}
//                 disabled={preguntaActual === checklist.length - 1}
//                 className="px-5 py-2.5 rounded-lg font-bold text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
//               >
//                 Siguiente →
//               </button>
//             </div>
//           </section>

//           {/* EVIDENCIA FOTOGRÁFICA */}
//           <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
//             <h2 className="text-[#d35400] font-bold mb-4 flex items-center gap-2 uppercase text-sm">
//               <FaCamera size={18} /> Evidencia Fotográfica y Observaciones
//             </h2>
//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
//               {["Foto1", "Foto2", "Foto3", "Foto4", "Foto5", "Foto6"].map((tipo) => (
//                 <div key={tipo} className="flex flex-col gap-2">
//                   <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">
//                     {tipo.replace("Foto", "Foto ")}
//                   </label>
//                   <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition h-48 overflow-hidden">
//                     {fotos[tipo] ? (
//                       <>
//                         <img src={fotos[tipo]!} alt={tipo} className="h-full w-full object-contain rounded" />
//                         <button
//                           onClick={() => setFotos(prev => ({ ...prev, [tipo]: null }))}
//                           className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-md transition-colors"
//                         >
//                           <FaTrash size={14} />
//                         </button>
//                       </>
//                     ) : (
//                       <>
//                         <FaFolderOpen className="text-gray-400 mb-2" size={32} />
//                         <span className="text-sm text-gray-500 font-medium">Subir imagen</span>
//                         <input
//                           type="file"
//                           accept="image/*"
//                           onChange={(e) => handleImageUpload(e, tipo)}
//                           onClick={(e) => { e.currentTarget.value = ""; }}
//                           className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
//                         />
//                       </>
//                     )}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </section>
//         </div>

//         <footer className="flex flex-col md:flex-row justify-center gap-6 pt-6 border-t">
//           <button
//             onClick={procesarFormularioActual}
//             className="px-10 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold shadow-xl hover:scale-105 transition transform flex items-center gap-3"
//           >
//             <FaFilePdf />
//             Generar Reporte Profesional
//           </button>
//           <button
//             onClick={() => window.location.reload()}
//             className="px-8 py-4 rounded-2xl bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition flex items-center gap-2"
//           >
//             <FaUndo />
//             Reiniciar
//           </button>
//         </footer>
//       </div>
//     </div>
//   );
// };

// export default AreasVerdes;





// 'use client';

// import React, { useState, useRef, useEffect } from 'react';
// import {
//   FaSun, FaCloud, FaUmbrella, FaCrosshairs, FaFileCsv,
//   FaCamera, FaFolderOpen, FaGlobeAmericas, FaUsers, FaMapMarkedAlt, FaSpinner,
//   FaCube, FaListOl, FaChartPie, FaEraser, FaFilePdf, FaTrash, FaUndo
// } from 'react-icons/fa';

// import SignatureCanvas from 'react-signature-canvas';
// import jsPDF from "jspdf";

// import 'leaflet/dist/leaflet.css';
// import dynamic from 'next/dynamic';
// const LeafletMap = dynamic(
//   () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
//   { ssr: false }
// )

// import autoTable from "jspdf-autotable";
// import html2canvas from "html2canvas";
// import { useRouter } from 'next/navigation';
// import { crearReporte, actualizarReporte } from '@/app/lib/actions';

// // ================= INTERFACES =================
// interface FormularioProps {
//   reportesIniciales: any[];
//   reporteParaEditar?: any | null;
// }
// interface GpsCoords {
//   lat: string | null;
//   lon: string | null;
//   precision: string;
// }

// interface FormData {
//   proyecto: string;
//   cliente: string;
//   ubicacion: string;
//   municipio: string;
//   jefe: string;
//   operador: string;
//   ayudantes: string;
//   hInicio: string;
//   hTermino: string;
//   vehiculo: string;
//   placas: string;
//   baseId: string;
//   altInst: string;
//   visado: string;
//   altPrisma: string;
//   norteB: string;
//   esteB: string;
//   elevB: string;
//   area: string;
//   notas: string;
//   sector: string;
//   Tramo: string;
//   accesoPublico: string;
//   categoria: string; 
//   tipoMantenimiento: string; 
  

// }

// interface Punto {
//   id: number;
//   punto: string;
//   norte: string;
//   este: string;
//   elev: string;
//   desc: string;
// }

// interface Fotos {
//   [key: string]: string | null;
// }

// interface GeoRef {
//   lat: string;
//   lon: string;
//   precision: string;
//   timestamp: string; // hora de captura legible
// }

// interface ChecklistItem {
//   id: number;
//   pregunta: string;
//   respuesta: string;
//   observacion: string;
//   geoRef?: GeoRef | null;
// }

// interface PrintSigs {
//   topografo: string | null;
//   cliente: string | null;
// }


// const parsearChecklist = (raw: any): ChecklistItem[] | null => {
//   if (!raw) return null;
//   try {
//     const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
//     if (Array.isArray(parsed) && parsed.length > 0) {
//       // Normaliza respuestas a mayúsculas por si acaso
//       return parsed.map((item: any) => ({
//         ...item,
//         respuesta: (item.respuesta ?? '').toUpperCase(),
//         observacion: item.observacion ?? '',
//         geoRef: item.geoRef ?? null,
//       }));
//     }
//     return null;
//   } catch {
//     return null;
//   }
// };

// // ================= COMPONENTE PRINCIPAL =================
// const AreasVerdes: React.FC<FormularioProps> = ({ reportesIniciales, reporteParaEditar }) => {
//   const router = useRouter();
//   const mapRef = useRef<HTMLDivElement>(null);
//   const [currentTime, setCurrentTime] = useState('');

//   const [formulariosAcumulados, setFormulariosAcumulados] = useState<any[]>([]);

//     const [capturandoGeoRefId, setCapturandoGeoRefId] = useState<number | null>(null);
//     const geoRefWatchId = useRef<number | null>(null);

    
//       useEffect(() => {
//       const loadLeaflet = async () => {
//         const L = await import('leaflet');
    
//         delete (L.Icon.Default.prototype as any)._getIconUrl;
    
//         L.Icon.Default.mergeOptions({
//           iconRetinaUrl:
//             "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
//           iconUrl:
//             "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
//           shadowUrl:
//             "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
//         });
//       };
    
//       loadLeaflet();
//     }, []);


//   const limpiarFormulario = () => {
//     setPreguntaActual(0);

//     // Reiniciamos checklist, fotos y GPS. 
//     // Puedes decidir si mantener el mismo "Sector" y "Tramo" o reiniciarlos también.
//     setChecklist(
//       preguntasAlumbrado.map((p, i) => ({
//         id: i + 1,
//         pregunta: p,
//         respuesta: "",
//         observacion: ""
//       }))
//     );
//     setFotos({ Foto1: null, Foto2: null, Foto3: null, Foto4: null, Foto5: null, Foto6: null });
//     setGps({ lat: null, lon: null, precision: '--' });
//   };



//   const procesarFormularioActual = async () => {
//     try {
//       // 1. Guardar el formulario actual en la base de datos de Neon
//       await guardarCuestionario();

//       // 2. Capturar el mapa actual en Base64 antes de que se limpie el componente
//       let mapImage = null;
//       if (gps.lat && mapRef.current) {
//         const canvas = await html2canvas(mapRef.current, {
//           useCORS: true,
//           allowTaint: true,
//           scale: 4,
//           ignoreElements: (element) => element.classList && element.classList.contains('leaflet-control-container')
//         });
//         mapImage = canvas.toDataURL("image/png");
//       }

//       // 3. Preparar todos los datos locales para el PDF
//       const sectorFinal = formData.sector === "Otro" ? sectorPersonalizado : formData.sector;
//       const tramoFinal = formData.sector === "Otro" ? tramoPersonalizado : formData.Tramo;

//       const formularioCompleto = {
//         formData: { ...formData, sector: sectorFinal, Tramo: tramoFinal },
//         checklist: [...checklist],
//         gps: { ...gps },
//         fotos: { ...fotos },
//         mapImage,
//         fechaCaptura: new Date()
//       };

//       const nuevosFormularios = [...formulariosAcumulados, formularioCompleto];
//       setFormulariosAcumulados(nuevosFormularios);

//       // 4. Preguntar si desea hacer otro formulario
//       const agregarOtro = window.confirm("Formulario guardado en la BD exitosamente.\n\n¿Deseas llenar OTRO formulario para incluirlo en el MISMO PDF?");

//       if (agregarOtro) {
//         // Limpiamos pantalla para capturar el siguiente
//         limpiarFormulario();
//         window.scrollTo({ top: 0, behavior: 'smooth' });
//       } else {
//         // Si no quiere agregar más, generamos el PDF con todos los acumulados
//         await generarPDFMultiples(nuevosFormularios);

//         // Reiniciamos todo para un reporte completamente nuevo
//         setFormulariosAcumulados([]);
//         limpiarFormulario();
//       }

//     } catch (error) {
//       console.error("Error en el proceso:", error);
//       alert("Hubo un error al procesar el formulario.");
//     }
//   };

//   const [reportesPrevios, setReportesPrevios] = useState<any[]>([]);

//   useEffect(() => {
//     const loadLeaflet = async () => {
//       const L = await import('leaflet');

//       delete (L.Icon.Default.prototype as any)._getIconUrl;

//       L.Icon.Default.mergeOptions({
//         iconRetinaUrl:
//           "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
//         iconUrl:
//           "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
//         shadowUrl:
//           "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
//       });
//     };

//     loadLeaflet();
//   }, []);

//   useEffect(() => {
//     const updateTime = () => {
//       const now = new Date();
//       setCurrentTime(
//         now.toLocaleString('es-MX', {
//           hour12: false,
//         })
//       );
//     };

//     updateTime();
//     const interval = setInterval(updateTime, 1000);

//     return () => clearInterval(interval);
//   }, []);

//   const [formData, setFormData] = useState<FormData>({
//     proyecto: 'Levantamiento Topográfico para playas...',
//     cliente: 'Fonatur',
//     ubicacion: '',
//     municipio: 'Acapulco, Guerrero.',
//     jefe: 'Tec. Dafne juarez',
//     operador: 'Ing. Jhosua aleman',
//     ayudantes: 'Tec. jovenes construyendo el futuro',
//     hInicio: '09:05',
//     hTermino: '15:00',
//     vehiculo: 'Silverado 4x4',
//     placas: 'JTD-4821',
//     baseId: 'BASE 01',
//     altInst: '1.735',
//     visado: 'DIRECTO',
//     altPrisma: '2.000',
//     norteB: '2286543.217',
//     esteB: '612845.332',
//     elevB: '',
//     area: '2.35ha',
//     notas: 'Trabajo realizado sin incidencias relevantes...',
//     sector: reporteParaEditar?.sector ?? '',
//     Tramo: reporteParaEditar?.tramo ?? '',
//     accesoPublico: reporteParaEditar?.acceso_publico ?? '',
//     tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
//     categoria: reporteParaEditar?.categoria ?? 'AREAS VERDES',

//   });

//   const [gps, setGps] = useState<GpsCoords>({
//   lat: reporteParaEditar?.latitud?.toString() ?? null,
//   lon: reporteParaEditar?.longitud?.toString() ?? null,
//   precision: reporteParaEditar?.latitud ? 'Guardado' : '--',
// });
//   const [cargandoGps, setCargandoGps] = useState<boolean>(false);
//   const watchId = useRef<number | null>(null);

//   const [sectorPersonalizado, setSectorPersonalizado] = useState<string>("");
//   const [tramoPersonalizado, setTramoPersonalizado] = useState<string>("");

//   const obtenerUbicacion = () => {
//     if (!navigator.geolocation) return alert("GPS no soportado");
    
//     setCargandoGps(true);
//     const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

//     const onSuccess = (pos: GeolocationPosition) => {
//       const { latitude, longitude, accuracy } = pos.coords;
//       setGps({
//         lat: latitude.toFixed(6),
//         lon: longitude.toFixed(6),
//         precision: `${accuracy.toFixed(1)}m`
//       });
//       if (accuracy < 10) finalizarCaptura(); 
//     };

//     const onError = () => {
//       setCargandoGps(false);
//       alert("Error al obtener señal GPS.");
//     };

//     watchId.current = navigator.geolocation.watchPosition(onSuccess, onError, options);
//     setTimeout(finalizarCaptura, 10000);
//   };

//   const finalizarCaptura = () => {
//     if (watchId.current !== null) {
//       navigator.geolocation.clearWatch(watchId.current);
//       watchId.current = null;
//       setCargandoGps(false);
//     }
//   };

//    const capturarGeoRefItem = (itemId: number) => {
//     if (!navigator.geolocation) return alert("GPS no soportado en este dispositivo.");
//     setCapturandoGeoRefId(itemId);

//     const options = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 };

//     const onSuccess = (pos: GeolocationPosition) => {
//       const { latitude, longitude, accuracy } = pos.coords;

//       // Hora de captura legible en español
//       const ahora = new Date();
//       const timestamp = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

//       const geoRef: GeoRef = {
//         lat: latitude.toFixed(6),
//         lon: longitude.toFixed(6),
//         precision: `${accuracy.toFixed(1)}m`,
//         timestamp,
//       };

//       // Guardamos el geoRef en el ítem correspondiente del checklist
//       setChecklist(prev =>
//         prev.map(item => item.id === itemId ? { ...item, geoRef } : item)
//       );

//       if (geoRefWatchId.current !== null) {
//         navigator.geolocation.clearWatch(geoRefWatchId.current);
//         geoRefWatchId.current = null;
//       }
//       setCapturandoGeoRefId(null);
//     };

//     const onError = () => {
//       setCapturandoGeoRefId(null);
//       alert("No se pudo obtener la ubicación. Verifica que el GPS esté activo.");
//     };

//     geoRefWatchId.current = navigator.geolocation.watchPosition(onSuccess, onError, options);
//     // Timeout de seguridad
//     setTimeout(() => {
//       if (geoRefWatchId.current !== null) {
//         navigator.geolocation.clearWatch(geoRefWatchId.current);
//         geoRefWatchId.current = null;
//         setCapturandoGeoRefId(null);
//       }
//     }, 12000);
//   };

//   const limpiarGeoRefItem = (itemId: number) => {
//     setChecklist(prev =>
//       prev.map(item => item.id === itemId ? { ...item, geoRef: null } : item)
//     );
//   };

//   const [clima, setClima] = useState<string>('Soleado');
//   const [sistemaCoords, setSistemaCoords] = useState<string>('UTM WGS84');
//   const [puntos, setPuntos] = useState<Punto[]>([{ id: 1, punto: 'P001', norte: '2286612.458', este: '612902.776', elev: '1586.921', desc: '' }]);
//   const [equipo, setEquipo] = useState<string[]>(['Estación']);
//     const [fotos, setFotos] = useState<Fotos>(
//         reporteParaEditar?.fotos && Object.keys(reporteParaEditar.fotos).length > 0
//             ? reporteParaEditar.fotos
//             : { Foto1: null, Foto2: null, Foto3: null, Foto4: null, Foto5: null, Foto6: null }
//     );
//   const [tipoPlano, setTipoPlano] = useState<string>('Planimétrico');
//   const [logo, setLogo] = useState<string | null>(null);
//   const [printSigs, setPrintSigs] = useState<PrintSigs>({ topografo: null, cliente: null });

//   const tramosPorSector: Record<string, string[]> = {
//     "Barra de Coyuca": ["Sendero-Seguro-Barra Coyuca"],
//     "Pie de la Cuesta": ["Sendero-seguro-Pie de la cuesta"],
//     "Barrios Historicos": ["Caleta-caletilla", "Sendero-Costera-antigua", "Corredor Zocalo-quebrada", "Corredor zocalo-fuerte"],
//     "Acapulco Tradicional": ["Sendero-Tadeo-arredondo", "Sendero-cinerio-hornitos", "Michoacan", "Av. Universidad", "Dr. Ignacio chavez"],
//     "Acapulco Dorado": ["Costa azul"],
//     "Las Brisas": [""],
//     "Puerto Márquez": ["Sendero-Puerto-Marquez"],
//     "Acapulco Diamante": ["Av. Costera Palmas"],
//     "Otro": [""]
//   };

//   const preguntasAlumbrado: string[] = [
//     "OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?",
//     "LA FOTOCELDA, RELOJ OPERATIVO O FUSIBLE ¿CUMPLE CON SU FUNCIÓN?",
//     "EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?",
//     "ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS",
//     "REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS",
//     "ENTORNO Y SEGURIDAD SEGÚN ZONA (CAMELLÓN/BANQUETA)",
//     "INTEGRIDAD DE LUMINARIA Y ÓPTICA",
//     "ORIENTACIÓN ADECUADA SIN DESLUMBRAMIENTO",
//     "ESTADO DE POSTE METÁLICO/CONCRETO",
//     "ESTADO DE BASE DE CONCRETO",
//     "ESTADO DE LÁMPARAS E ILUMINACIÓN DE PARABUSES",
//     "ESTADO DE LÁMPARAS WALLPACK",
//     "ESTADO DE LÁMPARAS TIPO FRAGATA",
//     "MANTENIMIENTO A TRANSFORMADORES DE ALUMBRADO"
//   ];

// const [checklist, setChecklist] = useState<ChecklistItem[]>(
//   parsearChecklist(reporteParaEditar?.checklist) ??
//   preguntasAlumbrado.map((p, i) => ({
//     id: i + 1, pregunta: p, respuesta: "", observacion: ""
//   }))
// );




//   // Estado para saber en qué pregunta estamos (índice 0 a 13)
//   const [preguntaActual, setPreguntaActual] = useState(0);

//   // Función para guardar la respuesta y avanzar automáticamente a la siguiente
//   const responderYAvanzar = (id: number, valor: string) => {
//     handleChecklistChange(id, 'respuesta', valor);

//     // Le damos un pequeño retardo (350ms) para que el usuario vea qué seleccionó antes de cambiar de pantalla
//     if (preguntaActual < checklist.length - 1) {
//       setTimeout(() => setPreguntaActual(preguntaActual + 1), 350);
//     }
//   };







//   const formRef = useRef<HTMLDivElement>(null);

//   const handleChecklistChange = (id: number, field: keyof ChecklistItem, value: string) => {
//     setChecklist(prev =>
//       prev.map(item =>
//         item.id === id ? { ...item, [field]: value } : item
//       )
//     );
//   };

//   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({ ...prev, [name]: value }));
//   };

//   const handlePuntoChange = (id: number, field: keyof Punto, value: string) => {
//     setPuntos(puntos.map(p => p.id === id ? { ...p, [field]: value } : p));
//   };

//   const agregarFila = () => {
//     const nuevoId = puntos.length + 1;
//     setPuntos([...puntos, { id: nuevoId, punto: `P00${nuevoId}`, norte: '', este: '', elev: '', desc: '' }]);
//   };

//  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, tipo: string) => {
//   if (!e.target.files || !e.target.files[0]) return;
  
//   const file = e.target.files[0];
//   const canvas = document.createElement('canvas');
//   const img = new Image();
//   img.onload = () => {
//     const maxW = 800;
//     const ratio = Math.min(maxW / img.width, 1);
//     canvas.width = img.width * ratio;
//     canvas.height = img.height * ratio;
//     canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
//     setFotos(prev => ({ ...prev, [tipo]: canvas.toDataURL('image/jpeg', 0.7) }));
//   };
//   img.src = URL.createObjectURL(file);
// };

//   const guardarCuestionario = async () => {
//   try {
//     const sectorFinal = formData.sector === "Otro" ? sectorPersonalizado : formData.sector;
//     const tramoFinal = formData.sector === "Otro" ? tramoPersonalizado : formData.Tramo;
//     const formDataFinal = { ...formData, sector: sectorFinal, Tramo: tramoFinal };

//     if (reporteParaEditar?.id) {
//       await actualizarReporte(reporteParaEditar.id.toString(), formDataFinal, checklist, gps, fotos);
//       alert("¡Reporte actualizado exitosamente!");
//     } else {
//       await crearReporte(formDataFinal, checklist, gps, fotos);
//       alert("¡Reporte guardado exitosamente en la base de datos!");
//     }
//   } catch (error) {
//     console.error("Error al guardar:", error);
//     alert("Hubo un error al guardar el reporte.");
//   }
// };

//   const generarPDFMultiples = async (listaFormularios: any[]) => {
//     const doc = new jsPDF("p", "mm", "a4");
//     const pageWidth = doc.internal.pageSize.getWidth();
//     const pageHeight = doc.internal.pageSize.getHeight();

//     // Función para la marca de agua (Se ejecuta AL FINAL)
//     const aplicarMarcaDeAguaFinal = (pdfDoc: any) => {
//       const totalPaginas = pdfDoc.internal.getNumberOfPages();
//       for (let i = 1; i <= totalPaginas; i++) {
//         pdfDoc.setPage(i);
//         pdfDoc.saveGraphicsState();
//         // Opacidad para que se mezcle sobre las fotos/textos sin ocultarlos del todo
//         pdfDoc.setGState(new (pdfDoc as any).GState({ opacity: 0.15 }));

//         const imgWidth = 140;
//         const imgHeight = 40;
//         const x = (pageWidth - imgWidth) / 2;
//         const yPos = (pageHeight - imgHeight) / 2;

//         pdfDoc.addImage("/logo_fonatur.png", 'PNG', x, yPos, imgWidth, imgHeight);
//         pdfDoc.restoreGraphicsState();
//       }
//     };

//     const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
//     const folioFinal = `REV-MULTIPLE-${random}`;

//     // Iteramos sobre todos los formularios guardados
//     for (let index = 0; index < listaFormularios.length; index++) {
//       const form = listaFormularios[index];

//       // Si no es el primer formulario, agregamos una nueva página
//       if (index > 0) doc.addPage();

//       const margin = 15;
//       let y = 20;

//       const fechaFormateada = form.fechaCaptura.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
//       const horaFormateada = form.fechaCaptura.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
//       const ubicacionTexto = form.gps.lat && form.gps.lon ? `Lat: ${form.gps.lat}  |  Lon: ${form.gps.lon}` : "No capturada";

//       // ================= ENCABEZADO =================
//       doc.setFont("helvetica", "bold");
//       doc.setFontSize(14);
//       y += 6;
//       doc.setFontSize(16);
//       doc.text(`REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA (Reg. ${index + 1})`, margin, y);
//       y += 4;
//       doc.setLineWidth(0.6);
//       doc.line(margin, y, pageWidth - margin, y);
//       y += 8;

//       // ================= DATOS GENERALES =================
//       doc.setFontSize(10);
//       doc.setFont("helvetica", "normal");
//       doc.text(`Folio Interno: ${folioFinal}-${index + 1}`, margin, y);
//       doc.text(`Fecha: ${fechaFormateada}`, pageWidth / 2, y);
//       doc.text(`Hora: ${horaFormateada}`, pageWidth - 50, y);
//       y += 6;
//       doc.text(`Sector: ${form.formData.sector}`, margin, y);
//       y += 6;
//       doc.text(`Tramo: ${form.formData.Tramo}`, margin, y);
//       y += 6;
//       doc.text(`Acceso público a playa: ${form.formData.accesoPublico || "No especificado"}`, margin, y);
//       y += 6;

//       // ================= SECCIÓN DE CHECKLIST =================
//       doc.setFont("helvetica", "bold");
//       doc.setFontSize(12);
//       doc.text("1. LISTA DE VERIFICACIÓN – ALUMBRADO PÚBLICO", margin, y);
//       y += 5;

//       const tableData: any[] = [];
//       form.checklist.forEach((item: any) => {
//         if (item.id === 9) {
//           tableData.push([
//             { content: "ESTADO FÍSICO", colSpan: 2, styles: { halign: 'center', fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' } },
//             { content: "Bueno", styles: { halign: 'center', fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' } },
//             { content: "Malo", styles: { halign: 'center', fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' } },
//             { content: "Observaciones", styles: { halign: 'center', fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' } }
//           ]);
//         }
//         tableData.push([
//           item.id, item.pregunta, item.respuesta === "SI" ? "X" : "", item.respuesta === "NO" ? "X" : "", item.observacion || ""
//         ]);
//       });

//       autoTable(doc, {
//         startY: y,
//         head: [["No.", "Concepto Evaluado", "Cumple", "No Cumple", "Observaciones"]],
//         body: tableData,
//         theme: "grid",
//         styles: { fontSize: 8, cellPadding: 3, valign: "top", lineWidth: 0.2 },
//         headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold", halign: "center" },
//         columnStyles: { 0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 110 }, 2: { cellWidth: 20, halign: "center" }, 3: { cellWidth: 20, halign: "center" } }
//       });

//       y = (doc as any).lastAutoTable.finalY + 10;
//       y += 6;
//       doc.text(`Ubicación: ${ubicacionTexto}`, margin, y);

//       // ================= MAPA EN PDF =================
//       if (form.mapImage) {
//         doc.addPage();
//         doc.setFont("helvetica", "bold");
//         doc.setFontSize(12);
//         doc.text(`MAPA DE UBICACIÓN (Reg. ${index + 1})`, margin, 20);
//         doc.addImage(form.mapImage, "PNG", margin, 30, pageWidth - margin * 2, 90);
//       }

//       // ================= EVIDENCIA FOTOGRÁFICA =================
//       const imagenes = Object.entries(form.fotos).filter(([_, value]) => value !== null) as [string, string][];
//       if (imagenes.length > 0) {
//         doc.addPage();
//         let yImg = 20;
//         doc.setFont("helvetica", "bold");
//         doc.setFontSize(12);
//         doc.text(`4. EVIDENCIA FOTOGRÁFICA (Reg. ${index + 1})`, margin, yImg);
//         yImg += 12;

//         const imgWidth = 80;
//         const imgHeight = 60;
//         const espacioX = 15;
//         const espacioY = 25;
//         let xPosition = margin;
//         let contador = 1;

//         for (let i = 0; i < imagenes.length; i++) {
//           const [tipo, base64] = imagenes[i];
//           if (yImg + imgHeight > pageHeight - 30) {
//             doc.addPage();
//             yImg = 20;
//             xPosition = margin;
//           }

//           doc.rect(xPosition - 2, yImg - 2, imgWidth + 4, imgHeight + 4);
//           const imgProps = doc.getImageProperties(base64);
//           const ratio = Math.min(imgWidth / imgProps.width, imgHeight / imgProps.height);
//           const newWidth = imgProps.width * ratio;
//           const newHeight = imgProps.height * ratio;

//           doc.addImage(base64, "JPEG", xPosition, yImg, newWidth, newHeight);
//           doc.setFont("helvetica", "normal");
//           doc.setFontSize(8);
//           doc.text(`Figura ${contador}. Evidencia: ${tipo.toUpperCase()}`, xPosition, yImg + imgHeight + 6);

//           contador++;
//           if (xPosition + imgWidth * 2 + espacioX <= pageWidth - margin) {
//             xPosition += imgWidth + espacioX;
//           } else {
//             xPosition = margin;
//             yImg += imgHeight + espacioY;
//           }
//         }
//       }
//     }

//     // ================= APLICAR MARCA DE AGUA SOBRE TODO AL FINAL =================
//     aplicarMarcaDeAguaFinal(doc);

//     // Guardar PDF
//     doc.save(`${folioFinal}.pdf`);
//   };

//   return (
//     <div className="relative">
//       <div className="max-w-5xl mx-auto font-sans bg-[#eef2f6] p-4 sm:p-8 space-y-6 text-gray-700">
//         <div className="mb-4">
//           <div className="flex justify-center mt-4">
//             <img src="/logo_fonatur.png" alt="Logo" className="w-1/2" />
//           </div>
//         </div>

//         <div ref={formRef} className="p-2 space-y-6">
//           {/* ===== HEADER PREMIUM ===== */}
//           <header className="relative bg-emerald-600 text-white px-8 py-8">
//             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
//               <div>
//                 <h1 className="text-3xl font-extrabold tracking-wide">
//                   REPORTE DE MANTENIMIENTO  CIP ACAPULCO-COYUCA
//                 </h1>
//                 <p className="text-slate-300 text-sm mt-1">
//                   Desarrollo y servicios urbanos
//                 </p>
//               </div>

//               <div className="text-right text-sm font-mono bg-white/10 px-4 py-2 rounded-xl">
//                 {currentTime}
//               </div>
//             </div>
//           </header>

//           {/* ===== SECTOR Y TRAMO ===== */}
//           <div className="w-full max-w-4xl mx-auto">
//             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 px-4 sm:px-6 py-4 
//                             bg-gradient-to-r from-white to-gray-50 
//                             rounded-2xl shadow-md border border-gray-100
//                             backdrop-blur-sm">

//               {/* Sector */}
//               <div className="flex flex-col gap-2 w-full sm:w-1/3">
//                 <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">
//                   Sector
//                 </label>

//                 <select
//                   name="sector"
//                   value={formData.sector}
//                   onChange={(e) => {
//                     const sectorSeleccionado = e.target.value;
//                     setFormData(prev => ({
//                       ...prev,
//                       sector: sectorSeleccionado,
//                       Tramo: ""
//                     }));
//                   }}
//                   className="px-3 py-2 rounded-xl 
//                              bg-white border border-gray-200
//                              font-semibold text-[#e67e22]
//                              focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30
//                              focus:border-[#e67e22]"
//                 >
//                   <option value="">Seleccionar</option>
//                   {Object.keys(tramosPorSector).map(sector => (
//                     <option key={sector} value={sector}>
//                       {sector}
//                     </option>
//                   ))}
//                 </select>

//                 {formData.sector === "Otro" && (
//                   <input
//                     type="text"
//                     placeholder="Escribe el sector..."
//                     value={sectorPersonalizado}
//                     onChange={(e) => setSectorPersonalizado(e.target.value)}
//                     className="mt-2 px-3 py-2 rounded-xl border border-gray-200 w-full"
//                   />
//                 )}
//               </div>

//               {/* Tramo */}
//               <div className="flex flex-col gap-2 w-full sm:w-1/3">
//                 <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">
//                   Tramo
//                 </label>

//                 {formData.sector === "Otro" ? (
//                   <input
//                     type="text"
//                     placeholder="Escribe el tramo..."
//                     value={tramoPersonalizado}
//                     onChange={(e) => setTramoPersonalizado(e.target.value)}
//                     className="px-3 py-2 rounded-xl border border-gray-200 w-full"
//                   />
//                 ) : (
//                   <select
//                     name="Tramo"
//                     value={formData.Tramo}
//                     onChange={(e) =>
//                       setFormData(prev => ({
//                         ...prev,
//                         Tramo: e.target.value
//                       }))
//                     }
//                     disabled={!formData.sector}
//                     className="px-3 py-2 rounded-xl border border-gray-200"
//                   >
//                     <option value="">Seleccionar</option>
//                     {(tramosPorSector[formData.sector] || []).map(tramo => (
//                       <option key={tramo} value={tramo}>
//                         {tramo}
//                       </option>
//                     ))}
//                   </select>
//                 )}
//               </div>

//               {/* Acceso público a playa */}
//               <div className="flex flex-col gap-2 w-full sm:w-1/3">
//                 <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">
//                   Acceso público a playa
//                 </label>

//                 <input
//                   type="text"
//                   name="accesoPublico"
//                   placeholder="Acceso"
//                   value={formData.accesoPublico}
//                   onChange={(e) =>
//                     setFormData(prev => ({
//                       ...prev,
//                       accesoPublico: e.target.value
//                     }))
//                   }
//                   className="px-3 py-2 rounded-xl 
//                              bg-white border border-gray-200
//                              text-gray-700
//                              focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30
//                              focus:border-[#e67e22]"
//                 />
//               </div>

//             </div>
//           </div>



//                   <div className="flex flex-col gap-2">
//                       <label className="text-xs tracking-wider uppercase text-emerald-700 font-bold">
//                           Tipo de Mantenimiento
//                       </label>
//                       <select
//                           name="tipoMantenimiento"
//                           value={formData.tipoMantenimiento}
//                           onChange={handleInputChange}
//                           className={`px-3 py-2 rounded-xl border font-bold transition-colors ${formData.tipoMantenimiento === 'Urgente'
//                                   ? 'bg-red-50 border-red-200 text-red-600'
//                                   : 'bg-white border-gray-200 text-gray-700'
//                               }`}
//                       >
//                           <option value="">Seleccionar</option>
//                           <option value="Urgente">🚨 Urgente</option>
//                           <option value="Ordinario">📋 Ordinario</option>
//                           <option value="Programable">🗓️ Programable</option>
//                       </select>
//                   </div>
//           <section className="grid md:grid-cols-2 gap-8">
//             {/* === MAPA === */}
//             <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
//               <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-3">
//                 <FaMapMarkedAlt className="text-orange-500" />
//                 <h2 className="font-bold text-slate-700 uppercase text-sm">
//                   Mapa de Ubicación
//                 </h2>
//               </div>

//               <div ref={mapRef} className="h-64">
//                 <LeafletMap gps={gps} reportes={[]} />
//               </div>
//             </div>

//             {/* === PANEL GPS === */}
//             <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl shadow-md border border-emerald-200 p-6">
//               <h3 className="font-bold text-emerald-800 text-sm uppercase mb-4">
//                 Coordenadas del Levantamiento
//               </h3>

//               <div className="grid grid-cols-2 gap-3 mb-4">
//                 <input
//                   value={gps.lat || ""}
//                   readOnly
//                   placeholder="Latitud"
//                   className="p-3 rounded-xl border bg-white font-mono text-sm text-center shadow-sm"
//                 />
//                 <input
//                   value={gps.lon || ""}
//                   readOnly
//                   placeholder="Longitud"
//                   className="p-3 rounded-xl border bg-white font-mono text-sm text-center shadow-sm"
//                 />
//               </div>
//               <button
//                 onClick={obtenerUbicacion}
//                 disabled={cargandoGps}
//                 className={`relative w-full py-3 rounded-xl text-white font-bold flex items-center justify-center overflow-hidden transition-all shadow-lg ${cargandoGps
//                     ? "bg-slate-800 cursor-not-allowed border border-emerald-900/50" // Fondo oscuro para resaltar la luz de búsqueda
//                     : "bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-emerald-500/30"
//                   }`}
//               >
//                 {cargandoGps ? (
//                   <>
//                     {/* === ANIMACIONES KEYFRAMES INSERTADAS === */}
//                     <style>{`
//                       @keyframes scanline {
//                         0% { transform: translateY(-150%); }
//                         100% { transform: translateY(200%); }
//                       }
//                       @keyframes radar-spin {
//                         from { transform: rotate(0deg); }
//                         to { transform: rotate(360deg); }
//                       }
//                     `}</style>

//                     {/* === 1. LÁSER DE ESCANEO BARRIDO === */}
//                     <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
//                       <div
//                         className="w-full h-12 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-400/50 border-b-2 border-emerald-400 shadow-[0_5px_15px_rgba(52,211,152,0.4)]"
//                         style={{ animation: 'scanline 1.5s linear infinite' }}
//                       ></div>
//                     </div>

//                     {/* === 2. PULSO DE SEÑAL GLOBAL === */}
//                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
//                       <div className="w-32 h-32 border border-emerald-500/20 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
//                     </div>

//                     {/* === 3. CONTENIDO (RADAR Y TEXTO) === */}
//                     <div className="relative z-10 flex items-center gap-3">
//                       {/* Contenedor del ícono con anillo giratorio */}
//                       <div className="relative flex items-center justify-center w-6 h-6">
//                         {/* Arco de radar girando rápido */}
//                         <div
//                           className="absolute inset-0 border-2 border-transparent border-t-emerald-400 rounded-full opacity-90"
//                           style={{ animation: 'radar-spin 0.8s linear infinite' }}
//                         ></div>
//                         {/* Mirilla estática en el centro */}
//                         <FaCrosshairs className="text-emerald-300 relative z-10 text-sm" />
//                       </div>
//                       <span className="animate-pulse tracking-wide font-medium text-emerald-100">
//                         Buscando satélites...
//                       </span>
//                     </div>
//                   </>
//                 ) : (
//                   <>
//                     {/* === ESTADO NORMAL === */}
//                     <FaCrosshairs className="mr-2 text-lg" />
//                     <span>Capturar Coordenadas</span>
//                   </>
//                 )}
//               </button>

//               <p className="text-xs text-center mt-3 font-semibold">
//                 Precisión:{" "}
//                 <span className={parseFloat(gps.precision) > 50 ? "text-red-600" : "text-emerald-700"}>
//                   {gps.precision}
//                 </span>
//               </p>
//             </div>
//           </section>

//           {/*_____________________________CUESTIONARIO (MODO WIZARD)_________________________________*/}
//           <section className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 max-w-2xl mx-auto w-full">
//             <div className="flex justify-between items-center mb-4">
//             <h2 className="text-[#d35400] font-bold uppercase text-xs sm:text-sm">
//                 {formData.categoria}  {/* ← CAMBIAR el texto hardcodeado por esta variable */}
//               </h2>
//               <span className="text-xs font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-600">
//                 {preguntaActual + 1} de {checklist.length}
//               </span>
//             </div>

//             {/* Barra de progreso */}
//             <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
//               <div
//                 className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
//                 style={{ width: `${((preguntaActual + 1) / checklist.length) * 100}%` }}
//               ></div>
//             </div>

//             {/* Tarjeta de la Pregunta Actual */}
//             <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-8 min-h-[300px] flex flex-col justify-center transition-all">

//               {/* Texto de la Pregunta */}
//               <h3 className="text-lg sm:text-xl font-bold text-center text-slate-800 mb-8 min-h-[60px] flex items-center justify-center">
//                 {checklist[preguntaActual].id}. {checklist[preguntaActual].pregunta}
//               </h3>

//               {/* Botones de Opción (Simulados con etiquetas grandes) */}
//               <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
//                 <label
//                   className={`cursor-pointer flex-1 py-4 px-6 rounded-xl border-2 text-center font-bold transition-all ${checklist[preguntaActual].respuesta === "SI"
//                       ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30"
//                       : "bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50"
//                     }`}
//                 >
//                   <input
//                     type="radio"
//                     name={`pregunta-${checklist[preguntaActual].id}`}
//                     value="SI"
//                     className="hidden"
//                     checked={checklist[preguntaActual].respuesta === "SI"}
//                     onChange={() => responderYAvanzar(checklist[preguntaActual].id, "SI")}
//                   />
//                   CUMPLE
//                 </label>

//                 <label
//                   className={`cursor-pointer flex-1 py-4 px-6 rounded-xl border-2 text-center font-bold transition-all ${checklist[preguntaActual].respuesta === "NO"
//                       ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/30"
//                       : "bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50"
//                     }`}
//                 >
//                   <input
//                     type="radio"
//                     name={`pregunta-${checklist[preguntaActual].id}`}
//                     value="NO"
//                     className="hidden"
//                     checked={checklist[preguntaActual].respuesta === "NO"}
//                     onChange={() => responderYAvanzar(checklist[preguntaActual].id, "NO")}
//                   />
//                   NO CUMPLE
//                 </label>
//               </div>

//               {/* Input de Observaciones */}
//               <div className="mt-auto">
//                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
//                   Observaciones (Opcional)
//                 </label>
//                 <input
//                   type="text"
//                   placeholder="Escribe aquí si hay algún detalle..."
//                   value={checklist[preguntaActual].observacion}
//                   onChange={(e) => handleChecklistChange(checklist[preguntaActual].id, "observacion", e.target.value)}
//                   className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e67e22]/50 focus:border-[#e67e22] outline-none transition-all text-sm"
//                 />
//                     <div className="flex flex-col gap-2">
//                                   {checklist[preguntaActual].geoRef ? (
//                                     // ── Estado: ya tiene coordenadas ──
//                                     <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
//                                       <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
//                                         {/* Pin icon inline SVG para no agregar otra dependencia */}
//                                         <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
//                                           <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
//                                         </svg>
//                                         <span>
//                                           {checklist[preguntaActual].geoRef!.lat}, {checklist[preguntaActual].geoRef!.lon}
//                                           &nbsp;·&nbsp;±{checklist[preguntaActual].geoRef!.precision}
//                                           &nbsp;·&nbsp;{checklist[preguntaActual].geoRef!.timestamp}
//                                         </span>
//                                       </div>
//                                       <button
//                                         type="button"
//                                         onClick={() => limpiarGeoRefItem(checklist[preguntaActual].id)}
//                                         className="ml-3 text-red-400 hover:text-red-600 transition-colors"
//                                         title="Eliminar geo-referencia"
//                                       >
//                                         <FaTrash size={12} />
//                                       </button>
//                                     </div>
//                                   ) : (
//                                     // ── Estado: sin coordenadas aún ──
//                                     <button
//                                       type="button"
//                                       onClick={() => capturarGeoRefItem(checklist[preguntaActual].id)}
//                                       disabled={capturandoGeoRefId === checklist[preguntaActual].id}
//                                       className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${
//                                         capturandoGeoRefId === checklist[preguntaActual].id
//                                           ? "bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed"
//                                           : "bg-white border-dashed border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50"
//                                       }`}
//                                     >
//                                       {capturandoGeoRefId === checklist[preguntaActual].id ? (
//                                         <>
//                                           <FaSpinner className="animate-spin" size={14} />
//                                           <span>Obteniendo ubicación...</span>
//                                         </>
//                                       ) : (
//                                         <>
//                                           {/* Pin icon */}
//                                           <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
//                                             <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
//                                           </svg>
//                                           <span>Geo-referenciar esta incidencia</span>
//                                         </>
//                                       )}
//                                     </button>
//                                   )}
//                                 </div>
//                                 {/* ── Ayuda contextual: se muestra solo si la respuesta es NO ── */}
//                                 {checklist[preguntaActual].respuesta === "NO" && !checklist[preguntaActual].geoRef && (
//                                   <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
//                                     ⚠️ Incidencia detectada. Considera geo-referenciar la ubicación exacta del problema.
//                                   </p>
//                                 )}
//               </div>
//             </div>
//             {/* Controles de Navegación Manual */}
//             <div className="flex justify-between mt-6">
//               <button
//                 type="button"
//                 onClick={() => setPreguntaActual(Math.max(0, preguntaActual - 1))}
//                 disabled={preguntaActual === 0}
//                 className="px-5 py-2.5 rounded-lg font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
//               >
//                 ← Anterior
//               </button>
//               <button
//                 type="button"
//                 onClick={() => setPreguntaActual(Math.min(checklist.length - 1, preguntaActual + 1))}
//                 disabled={preguntaActual === checklist.length - 1}
//                 className="px-5 py-2.5 rounded-lg font-bold text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
//               >
//                 Siguiente →
//               </button>
//             </div>
//           </section>

//           <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
//             <h2 className="text-[#d35400] font-bold mb-4 flex items-center gap-2 uppercase text-sm">
//               <FaCamera size={18} /> Evidencia Fotográfica y Observaciones
//             </h2>
//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
//               {/* Nota que quitamos los espacios para que hagan match exacto con las llaves de tu estado 'fotos' */}
//               {["Foto1", "Foto2", "Foto3", "Foto4", "Foto5", "Foto6"].map((tipo) => (
//                 <div key={tipo} className="flex flex-col gap-2">
//                   <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">
//                     {tipo.replace("Foto", "Foto ")}
//                   </label>

//                   <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition h-48 overflow-hidden">
//                     {fotos[tipo] ? (
//                       <>
//                         <img
//                           src={fotos[tipo]!}
//                           alt={tipo}
//                           className="h-full w-full object-contain rounded"
//                         />
//                         {/* Botón para eliminar la foto si el usuario se equivoca */}
//                         <button
//                           onClick={() => setFotos(prev => ({ ...prev, [tipo]: null }))}
//                           className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-md transition-colors"
//                         >
//                           <FaTrash size={14} />
//                         </button>
//                       </>
//                     ) : (
//                       <>
//                         <FaFolderOpen className="text-gray-400 mb-2" size={32} />
//                         <span className="text-sm text-gray-500 font-medium">Subir imagen</span>
//                         <input
//                           type="file"
//                           accept="image/*"
//                           onChange={(e) => handleImageUpload(e, tipo)}
//                           // EL TRUCO ESTÁ AQUÍ: Resetea el valor del input al hacer clic, forzando que el onChange siempre se dispare.
//                           onClick={(e) => { e.currentTarget.value = "" }}
//                           className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
//                         />
//                       </>
//                     )}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </section>
//         </div>

//         <footer className="flex flex-col md:flex-row justify-center gap-6 pt-6 border-t">
//           <button
//             onClick={procesarFormularioActual}
//             className="px-10 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold shadow-xl hover:scale-105 transition transform flex items-center gap-3"
//           >
//             <FaFilePdf />
//             Generar Reporte Profesional
//           </button>

//           <button
//             onClick={() => window.location.reload()}
//             className="px-8 py-4 rounded-2xl bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition flex items-center gap-2"
//           >
//             <FaUndo />
//             Reiniciar
//           </button>
//         </footer>
//       </div>
//     </div>
//   );
// };

// export default AreasVerdes;