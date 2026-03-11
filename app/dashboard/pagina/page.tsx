'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  FaSun, FaCloud, FaUmbrella, FaCrosshairs, FaFileCsv,
  FaCamera, FaFolderOpen, FaGlobeAmericas, FaUsers, FaMapMarkedAlt, FaSpinner,
  FaCube, FaListOl, FaChartPie, FaEraser, FaFilePdf, FaTrash, FaUndo
} from 'react-icons/fa';

import SignatureCanvas from 'react-signature-canvas';
import jsPDF from "jspdf";

import 'leaflet/dist/leaflet.css';
import dynamic from 'next/dynamic';
const LeafletMap = dynamic(
  () => import('@/app/dashboard/Alumbrado_publico/LeafletMap'),
  { ssr: false }
);

import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { useRouter } from 'next/navigation';
import { crearReporte, actualizarReporte } from '@/app/lib/actions';

// ================= INTERFACES =================
interface FormularioProps {
  reportesIniciales: any[];
  reporteParaEditar?: any | null;
}

interface GpsCoords {
  lat: string | null;
  lon: string | null;
  precision: string;
}

interface FormData {
  proyecto: string;
  cliente: string;
  ubicacion: string;
  municipio: string;
  jefe: string;
  operador: string;
  ayudantes: string;
  hInicio: string;
  hTermino: string;
  vehiculo: string;
  placas: string;
  baseId: string;
  altInst: string;
  visado: string;
  altPrisma: string;
  norteB: string;
  esteB: string;
  elevB: string;
  area: string;
  notas: string;
  sector: string;
  Tramo: string;
  accesoPublico: string;
  categoria: string;
  tipoMantenimiento: string;
}

interface Punto {
  id: number;
  punto: string;
  norte: string;
  este: string;
  elev: string;
  desc: string;
}

interface Fotos {
  [key: string]: string | null;
}

// ✅ GeoRef por ítem
interface GeoRef {
  lat: string;
  lon: string;
  precision: string;
  timestamp: string;
}

interface ChecklistItem {
  id: number;
  pregunta: string;
  respuesta: string;
  observacion: string;
  geoRef?: GeoRef | null; // ✅
}

interface PrintSigs {
  topografo: string | null;
  cliente: string | null;
}

// ================= HELPERS =================
const parsearChecklist = (raw: any): ChecklistItem[] | null => {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any) => ({
        ...item,
        respuesta: (item.respuesta ?? '').toUpperCase(),
        observacion: item.observacion ?? '',
        geoRef: item.geoRef ?? null, // ✅
      }));
    }
    return null;
  } catch {
    return null;
  }
};

// ================= COMPONENTE PRINCIPAL =================
const LimpiezaUrbana: React.FC<FormularioProps> = ({ reportesIniciales, reporteParaEditar }) => {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [reportesPrevios, setReportesPrevios] = useState<any[]>([]);
  const [formulariosAcumulados, setFormulariosAcumulados] = useState<any[]>([]);

  // ✅ Estado geo-ref por ítem
  const [capturandoGeoRefId, setCapturandoGeoRefId] = useState<number | null>(null);
  const geoRefWatchId = useRef<number | null>(null);

  useEffect(() => {
    const loadLeaflet = async () => {
      const L = await import('leaflet');
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });
    };
    loadLeaflet();
  }, []);

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // ================= PREGUNTAS =================
  const preguntasAlumbrado: string[] = [
    "ÁREA GENERAL LIMPIA DE BASURA VISIBLE A LO LARGO DEL TRAMO",
    "BANQUETAS BARRIDAS Y LIBRES DE RESIDUOS SOLIDOS",
    "CUNETAS LIMPIAS Y SIN OBSTRUCCIONES POR RESIDUOS",
    "ACUMULACIÓN DE BASURA EN PUNTOS CRÍTICOS (ESQUINAS, ACCESOS, MUROS)",
    "PLAYA LIMPIA DE RESIDUOS ORGÁNICOS E INORGÁNICOS (SI APLICA)",
    "ACCESOS A PLAYA O ZONA PÚBLICA LIBRES DE BASURA",
    "BOTES DE BASURA VACÍOS (NO REBASADOS).",
    "BOTES Y CONTENEDORES LIMPIOS POR DENTRO Y POR FUERA.",
    "ÁREA ALREDEDOR DEL BOTE (1 METRO) LIBRE DE RESIDUOS",
    "LIXIVIADOS O DERRAMES ALREDEDOR DE BOTES O CONTENEDORES",
    "RESIDUOS DISPERSOS DESPUÉS DE LA RECOLECCIÓN",
    "PODA EN GRAL CADA 6 MESES",
    "SUSTITUCIÓN DE BOTES DE BASURA"
  ];

  const tramosPorSector: Record<string, string[]> = {
    "Barra de Coyuca": ["Sendero-Seguro-Barra Coyuca"],
    "Pie de la Cuesta": ["Sendero-seguro-Pie de la cuesta"],
    "Barrios Historicos": ["Caleta-caletilla", "Sendero-Costera-antigua", "Corredor Zocalo-quebrada", "Corredor zocalo-fuerte"],
    "Acapulco Tradicional": ["Sendero-Tadeo-arredondo", "Sendero-cinerio-hornitos", "Michoacan", "Av. Universidad", "Dr. Ignacio chavez"],
    "Acapulco Dorado": ["Costa azul"],
    "Las Brisas": [""],
    "Puerto Márquez": ["Sendero-Puerto-Marquez"],
    "Acapulco Diamante": ["Av. Costera Palmas"],
    "Otro": [""]
  };

  // ================= ESTADOS =================
  const [formData, setFormData] = useState<FormData>({
    proyecto: 'Levantamiento Topográfico para playas...',
    cliente: 'Fonatur',
    ubicacion: '',
    municipio: 'Acapulco, Guerrero.',
    jefe: 'Tec. Dafne juarez',
    operador: 'Ing. Jhosua aleman',
    ayudantes: 'Tec. jovenes construyendo el futuro',
    hInicio: '09:05',
    hTermino: '15:00',
    vehiculo: 'Silverado 4x4',
    placas: 'JTD-4821',
    baseId: 'BASE 01',
    altInst: '1.735',
    visado: 'DIRECTO',
    altPrisma: '2.000',
    norteB: '2286543.217',
    esteB: '612845.332',
    elevB: '',
    area: '2.35ha',
    notas: 'Trabajo realizado sin incidencias relevantes...',
    sector: reporteParaEditar?.sector ?? '',
    Tramo: reporteParaEditar?.tramo ?? '',
    accesoPublico: reporteParaEditar?.acceso_publico ?? '',
    tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
    categoria: reporteParaEditar?.categoria ?? 'LIMPIEZA URBANA',
  });

  const [gps, setGps] = useState<GpsCoords>({
    lat: reporteParaEditar?.latitud?.toString() ?? null,
    lon: reporteParaEditar?.longitud?.toString() ?? null,
    precision: reporteParaEditar?.latitud ? 'Guardado' : '--',
  });
  const [cargandoGps, setCargandoGps] = useState<boolean>(false);
  const watchId = useRef<number | null>(null);

  const [sectorPersonalizado, setSectorPersonalizado] = useState<string>("");
  const [tramoPersonalizado, setTramoPersonalizado] = useState<string>("");

  const [fotos, setFotos] = useState<Fotos>(
    reporteParaEditar?.fotos && Object.keys(reporteParaEditar.fotos).length > 0
      ? reporteParaEditar.fotos
      : { Foto1: null, Foto2: null, Foto3: null, Foto4: null, Foto5: null, Foto6: null }
  );

  // ✅ Checklist con geoRef: null
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    parsearChecklist(reporteParaEditar?.checklist) ??
    preguntasAlumbrado.map((p, i) => ({
      id: i + 1,
      pregunta: p,
      respuesta: "",
      observacion: "",
      geoRef: null, // ✅
    }))
  );

  const [preguntaActual, setPreguntaActual] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);

  // ================= GPS GENERAL =================
  const obtenerUbicacion = () => {
    if (!navigator.geolocation) return alert("GPS no soportado");
    setCargandoGps(true);
    const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
    const onSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setGps({ lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m` });
      if (accuracy < 10) finalizarCaptura();
    };
    const onError = () => { setCargandoGps(false); alert("Error al obtener señal GPS."); };
    watchId.current = navigator.geolocation.watchPosition(onSuccess, onError, options);
    setTimeout(finalizarCaptura, 10000);
  };

  const finalizarCaptura = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setCargandoGps(false);
    }
  };

  // ✅ GPS por ítem
  const capturarGeoRefItem = (itemId: number) => {
    if (!navigator.geolocation) return alert("GPS no soportado en este dispositivo.");
    setCapturandoGeoRefId(itemId);
    const options = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 };

    const onSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const geoRef: GeoRef = {
        lat: latitude.toFixed(6),
        lon: longitude.toFixed(6),
        precision: `${accuracy.toFixed(1)}m`,
        timestamp,
      };
      setChecklist(prev => prev.map(item => item.id === itemId ? { ...item, geoRef } : item));
      if (geoRefWatchId.current !== null) {
        navigator.geolocation.clearWatch(geoRefWatchId.current);
        geoRefWatchId.current = null;
      }
      setCapturandoGeoRefId(null);
    };

    const onError = () => {
      setCapturandoGeoRefId(null);
      alert("No se pudo obtener la ubicación. Verifica que el GPS esté activo.");
    };

    geoRefWatchId.current = navigator.geolocation.watchPosition(onSuccess, onError, options);
    setTimeout(() => {
      if (geoRefWatchId.current !== null) {
        navigator.geolocation.clearWatch(geoRefWatchId.current);
        geoRefWatchId.current = null;
        setCapturandoGeoRefId(null);
      }
    }, 12000);
  };

  const limpiarGeoRefItem = (itemId: number) => {
    setChecklist(prev => prev.map(item => item.id === itemId ? { ...item, geoRef: null } : item));
  };

  // ================= HELPERS =================
  const handleChecklistChange = (id: number, field: keyof ChecklistItem, value: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const responderYAvanzar = (id: number, valor: string) => {
    handleChecklistChange(id, 'respuesta', valor);
    if (preguntaActual < checklist.length - 1) {
      setTimeout(() => setPreguntaActual(preguntaActual + 1), 350);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, tipo: string) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      const maxW = 800;
      const ratio = Math.min(maxW / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      setFotos(prev => ({ ...prev, [tipo]: canvas.toDataURL('image/jpeg', 0.7) }));
    };
    img.src = URL.createObjectURL(file);
  };

  const limpiarFormulario = () => {
    setPreguntaActual(0);
    setChecklist(preguntasAlumbrado.map((p, i) => ({
      id: i + 1, pregunta: p, respuesta: "", observacion: "", geoRef: null, // ✅
    })));
    setFotos({ Foto1: null, Foto2: null, Foto3: null, Foto4: null, Foto5: null, Foto6: null });
    setGps({ lat: null, lon: null, precision: '--' });
  };

  // ================= GUARDAR =================
  const guardarCuestionario = async () => {
    try {
      const sectorFinal = formData.sector === "Otro" ? sectorPersonalizado : formData.sector;
      const tramoFinal = formData.sector === "Otro" ? tramoPersonalizado : formData.Tramo;
      const formDataFinal = { ...formData, sector: sectorFinal, Tramo: tramoFinal };
      if (reporteParaEditar?.id) {
        await actualizarReporte(reporteParaEditar.id.toString(), formDataFinal, checklist, gps, fotos);
        alert("¡Reporte actualizado exitosamente!");
      } else {
        await crearReporte(formDataFinal, checklist, gps, fotos);
        alert("¡Reporte guardado exitosamente en la base de datos!");
      }
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Hubo un error al guardar el reporte.");
    }
  };

  const procesarFormularioActual = async () => {
    try {
      await guardarCuestionario();
      let mapImage = null;
      if (gps.lat && mapRef.current) {
        const canvas = await html2canvas(mapRef.current, {
          useCORS: true, allowTaint: true, scale: 4,
          ignoreElements: (el) => el.classList?.contains('leaflet-control-container'),
        });
        mapImage = canvas.toDataURL("image/png");
      }
      const sectorFinal = formData.sector === "Otro" ? sectorPersonalizado : formData.sector;
      const tramoFinal = formData.sector === "Otro" ? tramoPersonalizado : formData.Tramo;
      const formularioCompleto = {
        formData: { ...formData, sector: sectorFinal, Tramo: tramoFinal },
        checklist: [...checklist], // ✅ geoRefs incluidos
        gps: { ...gps },
        fotos: { ...fotos },
        mapImage,
        fechaCaptura: new Date(),
      };
      const nuevosFormularios = [...formulariosAcumulados, formularioCompleto];
      setFormulariosAcumulados(nuevosFormularios);
      const agregarOtro = window.confirm("Formulario guardado exitosamente.\n\n¿Deseas llenar OTRO formulario para incluirlo en el MISMO PDF?");
      if (agregarOtro) {
        limpiarFormulario();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        await generarPDFMultiples(nuevosFormularios);
        setFormulariosAcumulados([]);
        limpiarFormulario();
      }
    } catch (error) {
      console.error("Error en el proceso:", error);
      alert("Hubo un error al procesar el formulario.");
    }
  };

  // ================= PDF (márgenes corregidos + geoRef) =================
  const generarPDFMultiples = async (listaFormularios: any[]) => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();   // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
    const margin = 15;
    // Ancho útil = 210 - 15 - 15 = 180mm

    const aplicarMarcaDeAguaFinal = (pdfDoc: any) => {
      const totalPaginas = pdfDoc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPaginas; i++) {
        pdfDoc.setPage(i);
        pdfDoc.saveGraphicsState();
        pdfDoc.setGState(new (pdfDoc as any).GState({ opacity: 0.15 }));
        const imgWidth = 140, imgHeight = 40;
        pdfDoc.addImage(
          "/logo_fonatur.png", "PNG",
          (pageWidth - imgWidth) / 2, (pageHeight - imgHeight) / 2,
          imgWidth, imgHeight
        );
        pdfDoc.restoreGraphicsState();
      }
    };

    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    const folioFinal = `REV-MULTIPLE-${random}`;

    for (let index = 0; index < listaFormularios.length; index++) {
      const form = listaFormularios[index];
      if (index > 0) doc.addPage();

      let y = 20;
      const fechaFormateada = form.fechaCaptura.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
      const horaFormateada = form.fechaCaptura.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      const ubicacionTexto = form.gps.lat && form.gps.lon
        ? `Lat: ${form.gps.lat}  |  Lon: ${form.gps.lon}`
        : "No capturada";

      // ── ENCABEZADO ──
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA (Reg. ${index + 1})`, margin, y);
      y += 4;
      doc.setLineWidth(0.6);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // ── DATOS GENERALES ──
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Folio Interno: ${folioFinal}-${index + 1}`, margin, y);
      doc.text(`Fecha: ${fechaFormateada}`, pageWidth / 2, y);
      doc.text(`Hora: ${horaFormateada}`, pageWidth - 50, y);
      y += 6;
      doc.text(`Sector: ${form.formData.sector}`, margin, y); y += 6;
      doc.text(`Tramo: ${form.formData.Tramo}`, margin, y); y += 6;
      doc.text(`Acceso público a playa: ${form.formData.accesoPublico || "No especificado"}`, margin, y); y += 6;
      doc.setFont("helvetica", "bold");
      doc.text(`TIPO DE MANTENIMIENTO: ${form.formData.tipoMantenimiento?.toUpperCase() || "NO ESPECIFICADO"}`, margin, y);
      doc.setFont("helvetica", "normal");
      y += 8;

      // ── CHECKLIST ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      // ✅ Título correcto para este formulario
      doc.text("1. LISTA DE VERIFICACIÓN – LIMPIEZA URBANA", margin, y);
      y += 5;

      /*
        Anchos columnas (deben sumar 180mm):
          No.           →  10
          Concepto      →  88
          Cumple        →  16
          No Cumple     →  16
          Observaciones →  50
                            ───
                            180  ✓
      */
      const tableData: any[] = [];
      form.checklist.forEach((item: ChecklistItem) => {
        // ✅ Observaciones + geoRef en una sola celda
        const obsTexto = item.observacion || "";
        const geoTexto = item.geoRef
          ? `Lat: ${item.geoRef.lat}\nLon: ${item.geoRef.lon}\n±${item.geoRef.precision} — ${item.geoRef.timestamp}`
          : "";
        const obsConGeoRef = [obsTexto, geoTexto].filter(Boolean).join("\n");

        tableData.push([
          item.id,
          item.pregunta,
          item.respuesta === "SI" ? "X" : "",
          item.respuesta === "NO" ? "X" : "",
          obsConGeoRef,
        ]);
      });

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin }, // ✅
        head: [["No.", "Concepto Evaluado", "Cumple", "No Cumple", "Observaciones / Geo-ref"]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 3, valign: "top", lineWidth: 0.2, overflow: "linebreak" },
        headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold", halign: "center" },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 88 },
          2: { cellWidth: 16, halign: "center" },
          3: { cellWidth: 16, halign: "center" },
          4: { cellWidth: 50 },             // 10+88+16+16+50 = 180 ✓
        },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      // ── GEO-REFERENCIAS (página propia si existen) ──
      /*
        Anchos columnas (180mm):
          No.       →  10
          Concepto  →  80
          Latitud   →  22
          Longitud  →  22
          Precisión →  22
          Hora      →  24
                        ───
                        180  ✓
      */
      // const itemsConGeoRef = form.checklist.filter((item: ChecklistItem) => item.geoRef);
      // if (itemsConGeoRef.length > 0) {
      //   doc.addPage();
      //   doc.setFont("helvetica", "bold");
      //   doc.setFontSize(12);
      //   doc.text(`2. GEO-REFERENCIAS DE INCIDENCIAS (Reg. ${index + 1})`, margin, 20);
      //   doc.setFont("helvetica", "normal");
      //   doc.setFontSize(9);
      //   doc.text("Coordenadas específicas capturadas durante la inspección:", margin, 28);

      //   autoTable(doc, {
      //     startY: 33,
      //     margin: { left: margin, right: margin }, // ✅
      //     head: [["No.", "Concepto", "Latitud", "Longitud", "Precisión", "Hora"]],
      //     body: itemsConGeoRef.map((item: ChecklistItem) => [
      //       item.id,
      //       item.pregunta,
      //       item.geoRef!.lat,
      //       item.geoRef!.lon,
      //       item.geoRef!.precision,
      //       item.geoRef!.timestamp,
      //     ]),
      //     theme: "striped",
      //     styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
      //     headStyles: { fillColor: [20, 83, 45], textColor: 255, fontStyle: "bold", halign: "center" },
      //     columnStyles: {
      //       0: { cellWidth: 10, halign: "center" },
      //       1: { cellWidth: 80 },
      //       2: { cellWidth: 22, halign: "center" },
      //       3: { cellWidth: 22, halign: "center" },
      //       4: { cellWidth: 22, halign: "center" },
      //       5: { cellWidth: 24, halign: "center" }, // 10+80+22+22+22+24 = 180 ✓
      //     },
      //   });
      // }

      // ── MAPA ──
      if (form.mapImage) {
        doc.addPage();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(`2. MAPA DE UBICACIÓN (Reg. ${index + 1})`, margin, 20);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Ubicación: ${ubicacionTexto}`, margin, 27); // y fijo tras addPage ✅
        doc.addImage(form.mapImage, "PNG", margin, 33, pageWidth - margin * 2, 120, "", "FAST"); // una sola llamada ✅
      }

      // ── EVIDENCIA FOTOGRÁFICA ──
      // ── EVIDENCIA FOTOGRÁFICA ──────────────────────────────────────
const imagenes = Object.entries(form.fotos).filter(
  ([_, value]) => value !== null
) as [string, string][];

if (imagenes.length > 0) {
  doc.addPage();
  let yImg = 20;

  // Título de sección
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`3. EVIDENCIA FOTOGRÁFICA (Reg. ${index + 1})`, margin, yImg);
  yImg += 4;
  doc.setLineWidth(0.3);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yImg + 2, pageWidth - margin, yImg + 2);
  yImg += 10;

  /*
    Layout: 2 columnas, sin marcos, con sombra simulada (rect gris claro detrás),
    imagen a máxima resolución posible dentro de su celda.

    Anchos:
      col1 xPosition  = margin (15)
      col2 xPosition  = margin + imgWidth + espacioX
      imgWidth        = 82mm  → dos columnas = 82+10+82 = 174 ≤ 180 ✓
  */
  const imgWidth  = 82;
  const imgHeight = 62;
  const espacioX  = 10;   // separación horizontal entre columnas
  const espacioY  = 16;   // separación vertical entre filas
  const captionH  = 8;    // altura reservada para el pie de foto

  let xPosition = margin;
  let contador  = 1;

  // Resetear color de trazo
  doc.setDrawColor(0, 0, 0);

  for (let i = 0; i < imagenes.length; i++) {
    const [_, base64] = imagenes[i];

    // ¿Cabe en la página actual?
    if (yImg + imgHeight + captionH > pageHeight - 20) {
      doc.addPage();
      yImg      = 20;
      xPosition = margin;
    }

    // ── Sombra simulada: rect gris muy claro, desplazado 1.5mm ──
    doc.setFillColor(220, 220, 220);
    doc.roundedRect(xPosition + 1.5, yImg + 1.5, imgWidth, imgHeight, 2, 2, "F");

    // ── Fondo blanco de la celda ──
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(xPosition, yImg, imgWidth, imgHeight, 2, 2, "F");

    // ── Imagen: escalar manteniendo aspecto y centrar dentro de la celda ──
    const imgProps = doc.getImageProperties(base64);
    const scaleX   = imgWidth  / imgProps.width;
    const scaleY   = imgHeight / imgProps.height;
    const ratio    = Math.min(scaleX, scaleY);  // contiene sin distorsionar

    const drawW = imgProps.width  * ratio;
    const drawH = imgProps.height * ratio;

    // Centrado dentro de la celda
    const offsetX = (imgWidth  - drawW) / 2;
    const offsetY = (imgHeight - drawH) / 2;

    // ✅ "PNG" en lugar de "JPEG" conserva la calidad original del base64
    doc.addImage(
      base64, "PNG",
      xPosition + offsetX,
      yImg      + offsetY,
      drawW, drawH,
      `img-${index}-${i}`,  // alias único, evita re-codificación si se repite
      "FAST"
    );

    // ── Pie de foto: solo número, sin "FOTO1" repetitivo ──
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Fotografía ${contador}`,
      xPosition + imgWidth / 2,
      yImg + imgHeight + 5.5,
      { align: "center" }
    );
    doc.setTextColor(0, 0, 0); // resetear color

    contador++;

    // Avanzar columna o nueva fila
    if (xPosition + imgWidth + espacioX + imgWidth <= pageWidth - margin) {
      xPosition += imgWidth + espacioX;
    } else {
      xPosition = margin;
      yImg += imgHeight + captionH + espacioY;
    }
  }
}
    }

    aplicarMarcaDeAguaFinal(doc);
    doc.save(`${folioFinal}.pdf`);
  };

  // ================= RENDER =================
  return (
    <div className="relative">
      <div className="max-w-5xl mx-auto font-sans bg-[#eef2f6] p-4 sm:p-8 space-y-6 text-gray-700">
        <div className="mb-4">
          <div className="flex justify-center mt-4">
            <img src="/Ricardo.jpeg" alt="Logo" className="w-1/2" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LimpiezaUrbana;
