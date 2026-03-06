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
)

import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { useRouter } from 'next/navigation';
import { crearReporte } from '@/app/lib/actions';

// ================= INTERFACES =================
interface FormularioProps {
  reportesIniciales: any[]; 
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

interface ChecklistItem {
  id: number;
  pregunta: string;
  respuesta: string;
  observacion: string;
}

interface PrintSigs {
  topografo: string | null;
  cliente: string | null;
}

// ================= COMPONENTE PRINCIPAL =================
const LimpiezaUrbana: React.FC<FormularioProps> = ({ reportesIniciales }) => {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState('');

  const [reportesPrevios, setReportesPrevios] = useState<any[]>([]);

  useEffect(() => {
    const loadLeaflet = async () => {
      const L = await import('leaflet');

      delete (L.Icon.Default.prototype as any)._getIconUrl;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });
    };

    loadLeaflet();
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleString('es-MX', {
          hour12: false,
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);
  
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
    sector: '',
    Tramo: '',
    accesoPublico: ""
  });

  const [gps, setGps] = useState<GpsCoords>({ lat: null, lon: null, precision: '--' });
  const [cargandoGps, setCargandoGps] = useState<boolean>(false);
  const watchId = useRef<number | null>(null);

  const [sectorPersonalizado, setSectorPersonalizado] = useState<string>("");
  const [tramoPersonalizado, setTramoPersonalizado] = useState<string>("");

  const obtenerUbicacion = () => {
    if (!navigator.geolocation) return alert("GPS no soportado");
    
    setCargandoGps(true);
    const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

    const onSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setGps({
        lat: latitude.toFixed(6),
        lon: longitude.toFixed(6),
        precision: `${accuracy.toFixed(1)}m`
      });
      if (accuracy < 10) finalizarCaptura(); 
    };

    const onError = () => {
      setCargandoGps(false);
      alert("Error al obtener señal GPS.");
    };

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

  const [clima, setClima] = useState<string>('Soleado');
  const [sistemaCoords, setSistemaCoords] = useState<string>('UTM WGS84');
  const [puntos, setPuntos] = useState<Punto[]>([{ id: 1, punto: 'P001', norte: '2286612.458', este: '612902.776', elev: '1586.921', desc: '' }]);
  const [equipo, setEquipo] = useState<string[]>(['Estación']);
  const [fotos, setFotos] = useState<Fotos>({ Foto1: null, Foto2: null, Foto3: null, Foto4: null , Foto5: null, Foto6: null  });
  const [tipoPlano, setTipoPlano] = useState<string>('Planimétrico');
  const [logo, setLogo] = useState<string | null>(null);
  const [printSigs, setPrintSigs] = useState<PrintSigs>({ topografo: null, cliente: null });

  const tramosPorSector: Record<string, string[]> = {
    "Barra de coyuca": ["Sendero seguro", "Barra coyuca"],
    "Pie cuesta": ["Sendero seguro", "Pie cuesta"],
    "Barrios historicos": ["Caleta-caletilla", "Sendero", "Costera-antigua", "Corredor Zocalo-quebrada", "Corredor zocalo-fuerte"],
    "Aca. Tradicional": ["Sendero Tadeo arredondo", "Sendero cinerio-hornitos", "Michoacan", "Av. Universidad", "Dr. Ignacio chavez", "Costa Azul"],
    "Acapulco dorado": [""],
    "Las brisas": [""],
    "Puerto marquez": [""],
    "Diamante": ["Sendero Puerto marquez", "Av. Costera Palmas"],
    "Otro": [""]
  };
  
  const preguntasAlumbrado: string[] = [
    "ÁREA GENERAL LIMPIA DE BASURA VISIBLE A LO LARGO DEL TRAMO",
    "BANQUETAS BARRIDAS Y LIBRES DE RESIDUOS SOLIDOS",
    "CUNETAS LIMPIAS Y SIN OBSTRUCCIÓNES POR RESIDUOS",
    "BARRIDO MANUAL DE ANDADORES",
    "ACUMULACIÓN DE BASURA EN PUNTOS CRÍTICOS (ESQUINAS, ACCESOS, MUROS)",
    "PLAYA LIMPIA DE RESIDUOS ORGÁNICOS E INORGÁNICOS (SI APLICA)",
    "ACCESOS A PLAYA O ZONA PÚBLICA LIBRES DE BASURA",
    "BOTES DE BASURA VACÍOS (NO REBASADOS).",
    "BOTES Y CONTENEDORES LIMPIOS POR DENTRO Y POR FUERA.",
    "ÁREA ALREDEDOR DEL BOTE (1 METRO) LIBRE DE RESIDUOS",
    "SLIXIVIADOS O DERRAMES ALREDEDOR DE BOTES O CONTENEDORES",
    "RESIDUOS DISPERSOS DESPUÉS DE LA RECOLECCIÓN ",
    "PODA EN GRAL CADA 6 MESES ",
    "SUSTITUCIÓN DE BOTES DE BASURA "
  ];

  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    preguntasAlumbrado.map((p, i) => ({
      id: i + 1,
      pregunta: p,
      respuesta: "",
      observacion: "" 
    }))
  );

  const formRef = useRef<HTMLDivElement>(null); 
  
  const handleChecklistChange = (id: number, field: keyof ChecklistItem, value: string) => {
    setChecklist(prev =>
      prev.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePuntoChange = (id: number, field: keyof Punto, value: string) => {
    setPuntos(puntos.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const agregarFila = () => {
    const nuevoId = puntos.length + 1;
    setPuntos([...puntos, { id: nuevoId, punto: `P00${nuevoId}`, norte: '', este: '', elev: '', desc: '' }]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, tipo: string) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      if (tipo === 'logo') setLogo(url);
      else setFotos({ ...fotos, [tipo]: url });
    }
  };

  const guardarCuestionario = async () => {
    try {
      await crearReporte(formData, checklist, gps);
      alert("¡Reporte guardado exitosamente en la base de datos!");
    } catch (error) {
      console.error("Error al guardar el cuestionario:", error);
      alert("Hubo un error al guardar el reporte.");
    }
  };

  const generarPDF = async () => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = 20;

    const sectorFinal = formData.sector === "Otro" ? sectorPersonalizado : formData.sector;
    const tramoFinal = formData.sector === "Otro" ? tramoPersonalizado : formData.Tramo;

    const accesoPublico = formData.accesoPublico || "No especificado";

    const ahora = new Date();
    const fechaFormateada = ahora.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
    const horaFormateada = ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    const ubicacionTexto = gps.lat && gps.lon ? `Lat: ${gps.lat}  |  Lon: ${gps.lon}` : "No capturada";

    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const fechaArchivo = fechaFormateada.replace(/\//g, '-');
    const folio = `REV-${fechaArchivo}-${random}`;

    // ================= ENCABEZADO =================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    y += 6;
    doc.setFontSize(16);
    doc.text("REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA", margin, y);
    y += 4;
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ================= DATOS GENERALES =================
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Folio: ${folio}`, margin, y);
    doc.text(`Fecha: ${fechaFormateada}`, pageWidth / 2, y);
    doc.text(`Hora: ${horaFormateada}`, pageWidth - 50, y);
    y += 6;
    doc.text(`Sector: ${sectorFinal}`, margin, y);
    y += 6;
    doc.text(`Tramo: ${tramoFinal}`, margin, y);
    y += 6;
    doc.text(`Acceso público a playa: ${accesoPublico}`, margin, y);
    y += 6;


    // ================= SECCIÓN DE CHECKLIST =================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("1. LISTA DE VERIFICACIÓN – ALUMBRADO PÚBLICO", margin, y);
    y += 5;

    const tableData: any[] = [];
    checklist.forEach(item => {
      tableData.push([
        item.id,
        item.pregunta,
        item.respuesta === "SI" ? "X" : "",
        item.respuesta === "NO" ? "X" : "",
        item.observacion || ""
      ]);
    });

    autoTable(doc, {
      startY: y,
      head: [["No.", "Concepto Evaluado", "Cumple", "No Cumple", "Observaciones"]],
      body: tableData,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3, valign: "top", lineWidth: 0.2 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold", halign: "center" },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 110 },
        2: { cellWidth: 20, halign: "center" },
        3: { cellWidth: 20, halign: "center" }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 10;
    y += 6;
    doc.text(`Ubicación: ${ubicacionTexto}`, margin, y);
    y += 10;

    // ================= PIE DE PÁGINA =================
    doc.setFontSize(8);
    doc.text(
      `Documento generado electrónicamente | Página 1 de 1`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );

    // ================= MAPA EN PDF =================
    if (gps.lat && mapRef.current) {
      const canvas = await html2canvas(mapRef.current, {
        useCORS: true, 
        allowTaint: true, 
        scale: 4, // <-- 1. Aumentamos la escala de 2 a 4 para calidad ultra nítida
        ignoreElements: (element) => {
          // <-- 2. Esta función ignora los controles (zoom, atribución de Leaflet, etc.)
          if (element.classList && element.classList.contains('leaflet-control-container')) {
            return true;
          }
          return false;
        }
      });
      
      // Usamos "image/png" para la máxima calidad (puedes cambiar a "image/jpeg", 1.0 si el PDF pesa demasiado)
      const imgData = canvas.toDataURL("image/png");
      
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("MAPA DE UBICACIÓN", margin, 20);
      doc.addImage(imgData, "PNG", margin, 30, pageWidth - margin * 2, 90);
    }

    // ================= EVIDENCIA FOTOGRÁFICA =================
    const imagenes = Object.entries(fotos).filter(([_, value]) => value !== null) as [string, string][];
    if (imagenes.length > 0) {
      doc.addPage();
      let yImg = 20;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("4. EVIDENCIA FOTOGRÁFICA", margin, yImg);
      yImg += 12;

      const imgWidth = 80;
      const imgHeight = 60;
      const espacioX = 15;
      const espacioY = 25;
      let xPosition = margin;
      let contador = 1;

      for (let i = 0; i < imagenes.length; i++) {
        const [tipo, base64] = imagenes[i];
        if (yImg + imgHeight > pageHeight - 30) {
          doc.addPage();
          yImg = 20;
          xPosition = margin;
        }

        doc.rect(xPosition - 2, yImg - 2, imgWidth + 4, imgHeight + 4);
        const imgProps = doc.getImageProperties(base64);
        const ratio = Math.min(imgWidth / imgProps.width, imgHeight / imgProps.height);
        const newWidth = imgProps.width * ratio;
        const newHeight = imgProps.height * ratio;

        doc.addImage(base64, "JPEG", xPosition, yImg, newWidth, newHeight);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`Figura ${contador}. Evidencia: ${tipo.toUpperCase()}`, xPosition, yImg + imgHeight + 6);
        contador++;

        if (xPosition + imgWidth * 2 + espacioX <= pageWidth - margin) {
          xPosition += imgWidth + espacioX;
        } else {
          xPosition = margin;
          yImg += imgHeight + espacioY;
        }
      }
    }
    // ================= GUARDAR =================
    await guardarCuestionario();
    doc.save(`Reporte_Tecnico_${folio}.pdf`);
  };

  return (
    <div className="relative">
      <div className="max-w-5xl mx-auto font-sans bg-[#eef2f6] p-4 sm:p-8 space-y-6 text-gray-700">
       <div className="mb-4">
        <div className="flex justify-center mt-4">
          <img src="/logo_fonatur.png" alt="Logo" className="w-1/2" />
        </div>
    </div>

        <div ref={formRef} className="p-2 space-y-6">
          {/* ===== HEADER PREMIUM ===== */}
          <header className="relative bg-emerald-600 text-white px-8 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h1 className="text-3xl font-extrabold tracking-wide">
                  REPORTE DE MANTENIMIENTO  CIP ACAPULCO-COYUCA
                </h1>
                <p className="text-slate-300 text-sm mt-1">
                  Desarrollo y servicios urbanos
                </p>
              </div>

              <div className="text-right text-sm font-mono bg-white/10 px-4 py-2 rounded-xl">
               {currentTime}
              </div>
            </div>
          </header>

          {/* ===== SECTOR Y TRAMO ===== */}
          <div className="w-full max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 px-4 sm:px-6 py-4 
                            bg-gradient-to-r from-white to-gray-50 
                            rounded-2xl shadow-md border border-gray-100
                            backdrop-blur-sm">

              {/* Sector */}
              <div className="flex flex-col gap-2 w-full sm:w-1/3">
                <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">
                  Sector
                </label>

                <select
                  name="sector"
                  value={formData.sector}
                  onChange={(e) => {
                    const sectorSeleccionado = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      sector: sectorSeleccionado,
                      Tramo: ""
                    }));
                  }}
                  className="px-3 py-2 rounded-xl 
                             bg-white border border-gray-200
                             font-semibold text-[#e67e22]
                             focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30
                             focus:border-[#e67e22]"
                >
                  <option value="">Seleccionar</option>
                  {Object.keys(tramosPorSector).map(sector => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>

                {formData.sector === "Otro" && (
                  <input
                    type="text"
                    placeholder="Escribe el sector..."
                    value={sectorPersonalizado}
                    onChange={(e) => setSectorPersonalizado(e.target.value)}
                    className="mt-2 px-3 py-2 rounded-xl border border-gray-200 w-full"
                  />
                )}
              </div>

              {/* Tramo */}
              <div className="flex flex-col gap-2 w-full sm:w-1/3">
                <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">
                  Tramo
                </label>

                {formData.sector === "Otro" ? (
                  <input
                    type="text"
                    placeholder="Escribe el tramo..."
                    value={tramoPersonalizado}
                    onChange={(e) => setTramoPersonalizado(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-gray-200 w-full"
                  />
                ) : (
                  <select
                    name="Tramo"
                    value={formData.Tramo}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        Tramo: e.target.value
                      }))
                    }
                    disabled={!formData.sector}
                    className="px-3 py-2 rounded-xl border border-gray-200"
                  >
                    <option value="">Seleccionar</option>
                    {(tramosPorSector[formData.sector] || []).map(tramo => (
                      <option key={tramo} value={tramo}>
                        {tramo}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Acceso público a playa */}
              <div className="flex flex-col gap-2 w-full sm:w-1/3">
                <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">
                  Acceso público a playa
                </label>

                <input
                  type="text"
                  name="accesoPublico"
                  placeholder="Acceso"
                  value={formData.accesoPublico}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      accesoPublico: e.target.value
                    }))
                  }
                  className="px-3 py-2 rounded-xl 
                             bg-white border border-gray-200
                             text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-[#e67e22]/30
                             focus:border-[#e67e22]"
                />
              </div>

            </div>
          </div>

          <section className="grid md:grid-cols-2 gap-8">
            {/* === MAPA === */}
            <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-3">
                <FaMapMarkedAlt className="text-orange-500" />
                <h2 className="font-bold text-slate-700 uppercase text-sm">
                  Mapa de Ubicación
                </h2>
              </div>

                <div ref={mapRef} className="h-64">
              <LeafletMap gps={gps} reportes={[]} />
                </div>
            </div>

            {/* === PANEL GPS === */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl shadow-md border border-emerald-200 p-6">
              <h3 className="font-bold text-emerald-800 text-sm uppercase mb-4">
                Coordenadas del Levantamiento
              </h3>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <input
                  value={gps.lat || ""}
                  readOnly
                  placeholder="Latitud"
                  className="p-3 rounded-xl border bg-white font-mono text-sm text-center shadow-sm"
                />
                <input
                  value={gps.lon || ""}
                  readOnly
                  placeholder="Longitud"
                  className="p-3 rounded-xl border bg-white font-mono text-sm text-center shadow-sm"
                />
              </div>

              <button
                onClick={obtenerUbicacion}
                disabled={cargandoGps}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50"
              >
                {cargandoGps ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Buscando precisión...
                  </>
                ) : (
                  <>
                    <FaCrosshairs />
                    Capturar Coordenadas
                  </>
                )}
              </button>

              <p className="text-xs text-center mt-3 font-semibold">
                Precisión:{" "}
                <span className={parseFloat(gps.precision) > 50 ? "text-red-600" : "text-emerald-700"}>
                  {gps.precision}
                </span>
              </p>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-[#d35400] font-bold mb-4 uppercase text-sm">
              REVISIÓN GENERAL - ALUMBRADO PÚBLICO
            </h2>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-white text-xs uppercase">
                  <tr>
                    <th className="p-3 w-12 text-center">N°</th>
                    <th className="p-3 text-left">Concepto Evaluado</th>
                    <th className="p-3 text-center">Cumple</th>
                    <th className="p-3 text-center">No Cumple</th>
                    <th className="p-3 text-center">Observaciones</th>
                  </tr>
                </thead>

                <tbody>
                  {checklist.map((item) => (
                    <React.Fragment key={item.id}>
                      {/* ===== FILA NORMAL ===== */}
                      <tr className="border-b hover:bg-slate-50 transition">
                        <td className="p-3 text-center font-bold text-slate-600">
                          {item.id}
                        </td>

                        <td className="p-3 text-slate-700">
                          {item.pregunta}
                        </td>

                        <td className="p-3 text-center">
                          <input
                            type="radio"
                            name={`pregunta-${item.id}`}
                            checked={item.respuesta === "SI"}
                            onChange={() =>
                              handleChecklistChange(item.id, "respuesta", "SI")
                            }
                            className="w-5 h-5 accent-emerald-600 cursor-pointer"
                          />
                        </td>

                        <td className="p-3 text-center">
                          <input
                            type="radio"
                            name={`pregunta-${item.id}`}
                            checked={item.respuesta === "NO"}
                            onChange={() =>
                              handleChecklistChange(item.id, "respuesta", "NO")
                            }
                            className="w-5 h-5 accent-red-600 cursor-pointer"
                          />
                        </td>

                        <td className="p-3">
                          <input
                            type="text"
                            value={item.observacion}
                            onChange={(e) =>
                              handleChecklistChange(item.id, "observacion", e.target.value)
                            }
                            className="w-full p-2 rounded-lg border focus:ring-2 focus:ring-orange-400 outline-none text-xs"
                            placeholder="Observaciones..."
                          />
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-[#d35400] font-bold mb-4 flex items-center gap-2 uppercase text-sm">
              <FaCamera size={18}/> Evidencia Fotográfica y Observaciones
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {["Foto 1", "Foto 2", "Foto 3", "Foto 4", "Foto 5", "Foto 6"].map((tipo) => (
                <label key={tipo} className="group cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, tipo.replace(/\s/g, ''))}
                  />

                  <div className="h-44 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden group-hover:border-orange-400 transition shadow-inner">
                    {fotos[tipo.replace(/\s/g, '')] ? (
                      <img
                        src={fotos[tipo.replace(/\s/g, '')] as string}
                        alt={tipo}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-slate-400">
                        <FaCamera className="mx-auto mb-2" />
                        <p className="text-xs font-semibold uppercase">{tipo}</p>
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex flex-col md:flex-row justify-center gap-6 pt-6 border-t">
          <button
            onClick={generarPDF}
            className="px-10 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold shadow-xl hover:scale-105 transition transform flex items-center gap-3"
          >
            <FaFilePdf />
            Generar Reporte Profesional
          </button>

          <button
            onClick={() => window.location.reload()}
            className="px-8 py-4 rounded-2xl bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition flex items-center gap-2"
          >
            <FaUndo />
            Reiniciar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default LimpiezaUrbana;