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
interface FormData { sector: string; Tramo: string; accesoPublico: string; tipoMantenimiento: string; categoria: string; }
interface Fotos { [key: string]: string | null; }
interface GeoRef { lat: string; lon: string; precision: string; timestamp: string; }
interface ChecklistItem { id: number; pregunta: string; respuesta: string; observacion: string; geoRef?: GeoRef | null; }

// ================= CONSTANTES =================
const PREGUNTAS: string[] = [
  "BACHEO DE CALLE (M2)",
  "REPARACIÓN DE BANQUETA (ML)",
  "MANTENIMIENTO DE PARABUSES",
  "SUSTITUCIÓN DE TAPAS DE CONCRETO DIFERENTES EMPRESAS (TELECOMUNICACIONES, CFE Y ALUMBRADO)",
  "¿EL BARANDAL (ACERO INOXIDABLE O ACERO NORMAL) SE ENCUENTRA EN BUEN ESTADO GENERAL, SIN CORROSIÓN, SIN DEFORMACIONES, BIEN ALINEADO Y FIRMEMENTE ANCLADO?",
  "¿EL BARANDAL (ACERO INOXIDABLE O ACERO NORMAL) CUMPLE CON LA ALTURA Y LOS CRITERIOS DE SEGURIDAD, SIN TRAMOS FALTANTES O DAÑADOS?",
  "ESTADO DE SEÑALETICAS ",
  "BALIZADO DE CALLE ",
  "ESTADO DE MURALES ",
  "ESTADO DEL BOLARDO ",
  "FIGURAS LÚDICAS ",
  "MANTENIMIENTO DE POSTE DE SEMAFORO ",
  "MANTENIMIENTO DE RAMPAS",

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
const MobiliarioUrbano: React.FC<FormularioProps> = ({ reporteParaEditar }) => {
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
    categoria:         reporteParaEditar?.categoria         ?? 'Mobiliario Urbano ',
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
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
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
    if (watchId.current !== null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; setCargandoGps(false); }
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
    // setPreguntaActual(prev => prev < PREGUNTAS.length - 1 ? prev + 1 : prev);
  }, [handleChecklistChange]);


  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, tipo: string) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    // Reducimos el ancho máximo a 800px para evitar payloads masivos
    const ratio = Math.min(800 / img.width, 1); 
    const canvas = document.createElement('canvas');
    canvas.width = img.width * ratio; 
    canvas.height = img.height * ratio;
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Reducimos la calidad al 60% (0.6). En móviles y PDFs es imperceptible la diferencia.
    setFotos(prev => ({ ...prev, [tipo]: canvas.toDataURL('image/jpeg', 0.6) }));
  };
  img.src = URL.createObjectURL(file);
}, []);
  // const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, tipo: string) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;
  //   const img = new Image();
  //   img.onload = () => {
  //     const ratio = Math.min(1200 / img.width, 1);
  //     const canvas = document.createElement('canvas');
  //     canvas.width = img.width * ratio; canvas.height = img.height * ratio;
  //     canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  //     setFotos(prev => ({ ...prev, [tipo]: canvas.toDataURL('image/jpeg', 0.92) }));
  //   };
  //   img.src = URL.createObjectURL(file);
  // }, []);

  const limpiarFormulario = useCallback(() => {
    setPreguntaActual(0); setChecklist(checklist_inicial()); setFotos(FOTOS_INICIAL);
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
      doc.text("1. LISTA DE VERIFICACIÓN – ALUMBRADO PÚBLICO", margin, y); y += 5;

    //   // Construir tabla con fila separadora antes del ítem 7
    //   const tableData: any[] = [];
    //   form.checklist.forEach((item: ChecklistItem) => {
    //     if (item.id === 7) {
    //       tableData.push([
    //         { content: "ESTADO FÍSICO", colSpan: 2, styles: { halign: "center", fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" } },
    //         { content: "Bueno", styles: { halign: "center", fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" } },
    //         { content: "Malo",  styles: { halign: "center", fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" } },
    //         { content: "Observaciones", styles: { halign: "center", fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" } },
    //       ]);
    //     }
    //     const obs = item.observacion || "";
    //     const geo = item.geoRef ? `Lat: ${item.geoRef.lat}\nLon: ${item.geoRef.lon}\n±${item.geoRef.precision} — ${item.geoRef.timestamp}` : "";
    //     tableData.push([item.id, item.pregunta, item.respuesta === "SI" ? "X" : "", item.respuesta === "NO" ? "X" : "", [obs, geo].filter(Boolean).join("\n")]);
    //   });

    //   autoTable(doc, {
    //     startY: y, margin: { left: margin, right: margin },
    //     head: [["No.", "Concepto Evaluado", "Cumple", "No Cumple", "Observaciones / Geo-ref"]],
    //     body: tableData, theme: "grid",
    //     styles: { fontSize: 8, cellPadding: 3, valign: "top", lineWidth: 0.2, overflow: "linebreak" },
    //     headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold", halign: "center" },
    //     columnStyles: {
    //       0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 88 },
    //       2: { cellWidth: 16, halign: "center" }, 3: { cellWidth: 16, halign: "center" },
    //       4: { cellWidth: 50 }, // 180 ✓
    //     },
    //   });
    // Construir tabla con fila separadora antes del ítem 7
const tableData: any[] = [];
form.checklist.forEach((item: ChecklistItem) => {
  if (item.id === 7) {
    tableData.push([
      { content: "ESTADO FÍSICO", colSpan: 2, styles: { halign: "center", fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" } },
      { content: "B", styles: { halign: "center", fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" } },
      { content: "R", styles: { halign: "center", fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" } },
      { content: "M", styles: { halign: "center", fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" } },
      { content: "Observaciones", styles: { halign: "center", fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" } },
    ]);
  }
  const obs = item.observacion || "";
  const geo = item.geoRef ? `Lat: ${item.geoRef.lat}\nLon: ${item.geoRef.lon}\n±${item.geoRef.precision} — ${item.geoRef.timestamp}` : "";
  
  // Si la pregunta es < 7, la columna "Regular" llevará un guion para indicar que no aplica
  const colRegular = item.id < 7 ? "-" : (item.respuesta === "REGULAR" ? "X" : "");

  tableData.push([
    item.id, 
    item.pregunta, 
    item.respuesta === "SI" ? "X" : "", 
    colRegular, 
    item.respuesta === "NO" ? "X" : "", 
    [obs, geo].filter(Boolean).join("\n")
  ]);
});

autoTable(doc, {
  startY: y, margin: { left: margin, right: margin },
  head: [["No.", "Concepto Evaluado", "SÍ/B", "REG", "NO/M", "Observaciones / Geo-ref"]],
  body: tableData, theme: "grid",
  styles: { fontSize: 8, cellPadding: 3, valign: "top", lineWidth: 0.2, overflow: "linebreak" },
  headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold", halign: "center" },
  columnStyles: {
    0: { cellWidth: 10, halign: "center" }, 
    1: { cellWidth: 84 }, // Le quitamos 4 puntos para dárselos a las opciones
    2: { cellWidth: 12, halign: "center" }, 
    3: { cellWidth: 12, halign: "center" }, 
    4: { cellWidth: 12, halign: "center" },
    5: { cellWidth: 50 }, 
    // Total: 10 + 84 + 12 + 12 + 12 + 50 = 180 ✓ Perfecto
  },
});

      y = (doc as any).lastAutoTable.finalY + 8;

  

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
        doc.addPage(); let yImg = 20;
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
              {/* Badge "Estado Físico" para ítems 7+ */}
              {itemActual.id >= 7 && (
                <div className="text-center mb-4">
                  <span className="bg-slate-800 text-white text-[10px] uppercase px-3 py-1 rounded-full font-bold tracking-wide">
                    Estado Físico de Componentes
                  </span>
                </div>
              )}
              <h3 className="text-lg sm:text-xl font-bold text-center text-slate-800 mb-8 min-h-[60px] flex items-center justify-center">
                {itemActual.id}. {itemActual.pregunta}
              </h3>
              {/* <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                {(["SI", "NO"] as const).map(val => (
                  <label key={val} className={`cursor-pointer flex-1 py-4 px-6 rounded-xl border-2 text-center font-bold transition-all ${
                    itemActual.respuesta === val
                      ? val === "SI" ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/30"
                      : "bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50"}`}>
                    <input type="radio" name={`p-${itemActual.id}`} value={val} className="hidden"
                      checked={itemActual.respuesta === val} onChange={() => responderYAvanzar(itemActual.id, val)} />
                    {val === "SI"
                      ? (itemActual.id >= 7 ? "BUENO" : "CUMPLE (SÍ)")
                      : (itemActual.id >= 7 ? "MALO"  : "NO CUMPLE (NO)")}
                  </label>
                ))}
              </div> */}
                          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                              {(itemActual.id >= 7 ? ["SI", "REGULAR", "NO"] : ["SI", "NO"]).map(val => {
                                  // Definir la etiqueta del botón
                                  let etiqueta = val;
                                  if (itemActual.id >= 7) {
                                      if (val === "SI") etiqueta = "BUENO";
                                      if (val === "REGULAR") etiqueta = "REGULAR";
                                      if (val === "NO") etiqueta = "MALO";
                                  } else {
                                      if (val === "SI") etiqueta = "CUMPLE (SÍ)";
                                      if (val === "NO") etiqueta = "NO CUMPLE (NO)";
                                  }

                                  // Definir colores según el estado
                                  let colores = "bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50";
                                  if (itemActual.respuesta === val) {
                                      if (val === "SI") colores = "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30";
                                      if (val === "REGULAR") colores = "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/30";
                                      if (val === "NO") colores = "bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/30";
                                  }

                                  return (
                                      <label key={val} className={`cursor-pointer flex-1 py-4 px-6 rounded-xl border-2 text-center font-bold transition-all ${colores}`}>
                                          <input type="radio" name={`p-${itemActual.id}`} value={val} className="hidden"
                                              checked={itemActual.respuesta === val} onChange={() => responderYAvanzar(itemActual.id, val)} />
                                          {etiqueta}
                                      </label>
                                  );
                              })}
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

export default MobiliarioUrbano;