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


const parsearChecklist = (raw: any): ChecklistItem[] | null => {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Normaliza respuestas a mayúsculas por si acaso
      return parsed.map((item: any) => ({
        ...item,
        respuesta: (item.respuesta ?? '').toUpperCase(),
        observacion: item.observacion ?? '',
      }));
    }
    return null;
  } catch {
    return null;
  }
};

// ================= COMPONENTE PRINCIPAL =================
const AreasVerdes: React.FC<FormularioProps> = ({ reportesIniciales, reporteParaEditar }) => {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState('');

  const [formulariosAcumulados, setFormulariosAcumulados] = useState<any[]>([]);


  const limpiarFormulario = () => {
    setPreguntaActual(0);

    // Reiniciamos checklist, fotos y GPS. 
    // Puedes decidir si mantener el mismo "Sector" y "Tramo" o reiniciarlos también.
    setChecklist(
      preguntasAlumbrado.map((p, i) => ({
        id: i + 1,
        pregunta: p,
        respuesta: "",
        observacion: ""
      }))
    );
    setFotos({ Foto1: null, Foto2: null, Foto3: null, Foto4: null, Foto5: null, Foto6: null });
    setGps({ lat: null, lon: null, precision: '--' });
  };



  const procesarFormularioActual = async () => {
    try {
      // 1. Guardar el formulario actual en la base de datos de Neon
      await guardarCuestionario();

      // 2. Capturar el mapa actual en Base64 antes de que se limpie el componente
      let mapImage = null;
      if (gps.lat && mapRef.current) {
        const canvas = await html2canvas(mapRef.current, {
          useCORS: true,
          allowTaint: true,
          scale: 4,
          ignoreElements: (element) => element.classList && element.classList.contains('leaflet-control-container')
        });
        mapImage = canvas.toDataURL("image/png");
      }

      // 3. Preparar todos los datos locales para el PDF
      const sectorFinal = formData.sector === "Otro" ? sectorPersonalizado : formData.sector;
      const tramoFinal = formData.sector === "Otro" ? tramoPersonalizado : formData.Tramo;

      const formularioCompleto = {
        formData: { ...formData, sector: sectorFinal, Tramo: tramoFinal },
        checklist: [...checklist],
        gps: { ...gps },
        fotos: { ...fotos },
        mapImage,
        fechaCaptura: new Date()
      };

      const nuevosFormularios = [...formulariosAcumulados, formularioCompleto];
      setFormulariosAcumulados(nuevosFormularios);

      // 4. Preguntar si desea hacer otro formulario
      const agregarOtro = window.confirm("Formulario guardado en la BD exitosamente.\n\n¿Deseas llenar OTRO formulario para incluirlo en el MISMO PDF?");

      if (agregarOtro) {
        // Limpiamos pantalla para capturar el siguiente
        limpiarFormulario();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Si no quiere agregar más, generamos el PDF con todos los acumulados
        await generarPDFMultiples(nuevosFormularios);

        // Reiniciamos todo para un reporte completamente nuevo
        setFormulariosAcumulados([]);
        limpiarFormulario();
      }

    } catch (error) {
      console.error("Error en el proceso:", error);
      alert("Hubo un error al procesar el formulario.");
    }
  };

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
    sector: reporteParaEditar?.sector ?? '',
    Tramo: reporteParaEditar?.tramo ?? '',
    accesoPublico: reporteParaEditar?.acceso_publico ?? '',
    tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
    categoria: reporteParaEditar?.categoria ?? 'AREAS VERDES',

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
    const [fotos, setFotos] = useState<Fotos>(
        reporteParaEditar?.fotos && Object.keys(reporteParaEditar.fotos).length > 0
            ? reporteParaEditar.fotos
            : { Foto1: null, Foto2: null, Foto3: null, Foto4: null, Foto5: null, Foto6: null }
    );
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
    "OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?",
    "LA FOTOCELDA, RELOJ OPERATIVO O FUSIBLE ¿CUMPLE CON SU FUNCIÓN?",
    "EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?",
    "ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS",
    "REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS",
    "ENTORNO Y SEGURIDAD SEGÚN ZONA (CAMELLÓN/BANQUETA)",
    "INTEGRIDAD DE LUMINARIA Y ÓPTICA",
    "ORIENTACIÓN ADECUADA SIN DESLUMBRAMIENTO",
    "ESTADO DE POSTE METÁLICO/CONCRETO",
    "ESTADO DE BASE DE CONCRETO",
    "ESTADO DE LÁMPARAS E ILUMINACIÓN DE PARABUSES",
    "ESTADO DE LÁMPARAS WALLPACK",
    "ESTADO DE LÁMPARAS TIPO FRAGATA",
    "MANTENIMIENTO A TRANSFORMADORES DE ALUMBRADO"
  ];

const [checklist, setChecklist] = useState<ChecklistItem[]>(
  parsearChecklist(reporteParaEditar?.checklist) ??
  preguntasAlumbrado.map((p, i) => ({
    id: i + 1, pregunta: p, respuesta: "", observacion: ""
  }))
);




  // Estado para saber en qué pregunta estamos (índice 0 a 13)
  const [preguntaActual, setPreguntaActual] = useState(0);

  // Función para guardar la respuesta y avanzar automáticamente a la siguiente
  const responderYAvanzar = (id: number, valor: string) => {
    handleChecklistChange(id, 'respuesta', valor);

    // Le damos un pequeño retardo (350ms) para que el usuario vea qué seleccionó antes de cambiar de pantalla
    if (preguntaActual < checklist.length - 1) {
      setTimeout(() => setPreguntaActual(preguntaActual + 1), 350);
    }
  };







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

  const generarPDFMultiples = async (listaFormularios: any[]) => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Función para la marca de agua (Se ejecuta AL FINAL)
    const aplicarMarcaDeAguaFinal = (pdfDoc: any) => {
      const totalPaginas = pdfDoc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPaginas; i++) {
        pdfDoc.setPage(i);
        pdfDoc.saveGraphicsState();
        // Opacidad para que se mezcle sobre las fotos/textos sin ocultarlos del todo
        pdfDoc.setGState(new (pdfDoc as any).GState({ opacity: 0.15 }));

        const imgWidth = 140;
        const imgHeight = 40;
        const x = (pageWidth - imgWidth) / 2;
        const yPos = (pageHeight - imgHeight) / 2;

        pdfDoc.addImage("/logo_fonatur.png", 'PNG', x, yPos, imgWidth, imgHeight);
        pdfDoc.restoreGraphicsState();
      }
    };

    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const folioFinal = `REV-MULTIPLE-${random}`;

    // Iteramos sobre todos los formularios guardados
    for (let index = 0; index < listaFormularios.length; index++) {
      const form = listaFormularios[index];

      // Si no es el primer formulario, agregamos una nueva página
      if (index > 0) doc.addPage();

      const margin = 15;
      let y = 20;

      const fechaFormateada = form.fechaCaptura.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
      const horaFormateada = form.fechaCaptura.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      const ubicacionTexto = form.gps.lat && form.gps.lon ? `Lat: ${form.gps.lat}  |  Lon: ${form.gps.lon}` : "No capturada";

      // ================= ENCABEZADO =================
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      y += 6;
      doc.setFontSize(16);
      doc.text(`REPORTE DE MANTENIMIENTO CIP ACAPULCO-COYUCA (Reg. ${index + 1})`, margin, y);
      y += 4;
      doc.setLineWidth(0.6);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // ================= DATOS GENERALES =================
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Folio Interno: ${folioFinal}-${index + 1}`, margin, y);
      doc.text(`Fecha: ${fechaFormateada}`, pageWidth / 2, y);
      doc.text(`Hora: ${horaFormateada}`, pageWidth - 50, y);
      y += 6;
      doc.text(`Sector: ${form.formData.sector}`, margin, y);
      y += 6;
      doc.text(`Tramo: ${form.formData.Tramo}`, margin, y);
      y += 6;
      doc.text(`Acceso público a playa: ${form.formData.accesoPublico || "No especificado"}`, margin, y);
      y += 6;

      // ================= SECCIÓN DE CHECKLIST =================
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("1. LISTA DE VERIFICACIÓN – ALUMBRADO PÚBLICO", margin, y);
      y += 5;

      const tableData: any[] = [];
      form.checklist.forEach((item: any) => {
        if (item.id === 9) {
          tableData.push([
            { content: "ESTADO FÍSICO", colSpan: 2, styles: { halign: 'center', fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' } },
            { content: "Bueno", styles: { halign: 'center', fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' } },
            { content: "Malo", styles: { halign: 'center', fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' } },
            { content: "Observaciones", styles: { halign: 'center', fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' } }
          ]);
        }
        tableData.push([
          item.id, item.pregunta, item.respuesta === "SI" ? "X" : "", item.respuesta === "NO" ? "X" : "", item.observacion || ""
        ]);
      });

      autoTable(doc, {
        startY: y,
        head: [["No.", "Concepto Evaluado", "Cumple", "No Cumple", "Observaciones"]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 3, valign: "top", lineWidth: 0.2 },
        headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold", halign: "center" },
        columnStyles: { 0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 110 }, 2: { cellWidth: 20, halign: "center" }, 3: { cellWidth: 20, halign: "center" } }
      });

      y = (doc as any).lastAutoTable.finalY + 10;
      y += 6;
      doc.text(`Ubicación: ${ubicacionTexto}`, margin, y);

      // ================= MAPA EN PDF =================
      if (form.mapImage) {
        doc.addPage();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(`MAPA DE UBICACIÓN (Reg. ${index + 1})`, margin, 20);
        doc.addImage(form.mapImage, "PNG", margin, 30, pageWidth - margin * 2, 90);
      }

      // ================= EVIDENCIA FOTOGRÁFICA =================
      const imagenes = Object.entries(form.fotos).filter(([_, value]) => value !== null) as [string, string][];
      if (imagenes.length > 0) {
        doc.addPage();
        let yImg = 20;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(`4. EVIDENCIA FOTOGRÁFICA (Reg. ${index + 1})`, margin, yImg);
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
    }

    // ================= APLICAR MARCA DE AGUA SOBRE TODO AL FINAL =================
    aplicarMarcaDeAguaFinal(doc);

    // Guardar PDF
    doc.save(`${folioFinal}.pdf`);
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



                  <div className="flex flex-col gap-2">
                      <label className="text-xs tracking-wider uppercase text-emerald-700 font-bold">
                          Tipo de Mantenimiento
                      </label>
                      <select
                          name="tipoMantenimiento"
                          value={formData.tipoMantenimiento}
                          onChange={handleInputChange}
                          className={`px-3 py-2 rounded-xl border font-bold transition-colors ${formData.tipoMantenimiento === 'Urgente'
                                  ? 'bg-red-50 border-red-200 text-red-600'
                                  : 'bg-white border-gray-200 text-gray-700'
                              }`}
                      >
                          <option value="">Seleccionar</option>
                          <option value="Urgente">🚨 Urgente</option>
                          <option value="Ordinario">📋 Ordinario</option>
                          <option value="Programable">🗓️ Programable</option>
                      </select>
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
                className={`relative w-full py-3 rounded-xl text-white font-bold flex items-center justify-center overflow-hidden transition-all shadow-lg ${cargandoGps
                    ? "bg-slate-800 cursor-not-allowed border border-emerald-900/50" // Fondo oscuro para resaltar la luz de búsqueda
                    : "bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-emerald-500/30"
                  }`}
              >
                {cargandoGps ? (
                  <>
                    {/* === ANIMACIONES KEYFRAMES INSERTADAS === */}
                    <style>{`
                      @keyframes scanline {
                        0% { transform: translateY(-150%); }
                        100% { transform: translateY(200%); }
                      }
                      @keyframes radar-spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                      }
                    `}</style>

                    {/* === 1. LÁSER DE ESCANEO BARRIDO === */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                      <div
                        className="w-full h-12 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-400/50 border-b-2 border-emerald-400 shadow-[0_5px_15px_rgba(52,211,152,0.4)]"
                        style={{ animation: 'scanline 1.5s linear infinite' }}
                      ></div>
                    </div>

                    {/* === 2. PULSO DE SEÑAL GLOBAL === */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-32 h-32 border border-emerald-500/20 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
                    </div>

                    {/* === 3. CONTENIDO (RADAR Y TEXTO) === */}
                    <div className="relative z-10 flex items-center gap-3">
                      {/* Contenedor del ícono con anillo giratorio */}
                      <div className="relative flex items-center justify-center w-6 h-6">
                        {/* Arco de radar girando rápido */}
                        <div
                          className="absolute inset-0 border-2 border-transparent border-t-emerald-400 rounded-full opacity-90"
                          style={{ animation: 'radar-spin 0.8s linear infinite' }}
                        ></div>
                        {/* Mirilla estática en el centro */}
                        <FaCrosshairs className="text-emerald-300 relative z-10 text-sm" />
                      </div>
                      <span className="animate-pulse tracking-wide font-medium text-emerald-100">
                        Buscando satélites...
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* === ESTADO NORMAL === */}
                    <FaCrosshairs className="mr-2 text-lg" />
                    <span>Capturar Coordenadas</span>
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

          {/*_____________________________CUESTIONARIO (MODO WIZARD)_________________________________*/}
          <section className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 max-w-2xl mx-auto w-full">
            <div className="flex justify-between items-center mb-4">
            <h2 className="text-[#d35400] font-bold uppercase text-xs sm:text-sm">
                {formData.categoria}  {/* ← CAMBIAR el texto hardcodeado por esta variable */}
              </h2>
              <span className="text-xs font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-600">
                {preguntaActual + 1} de {checklist.length}
              </span>
            </div>

            {/* Barra de progreso */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((preguntaActual + 1) / checklist.length) * 100}%` }}
              ></div>
            </div>

            {/* Tarjeta de la Pregunta Actual */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-8 min-h-[300px] flex flex-col justify-center transition-all">

              {/* Texto de la Pregunta */}
              <h3 className="text-lg sm:text-xl font-bold text-center text-slate-800 mb-8 min-h-[60px] flex items-center justify-center">
                {checklist[preguntaActual].id}. {checklist[preguntaActual].pregunta}
              </h3>

              {/* Botones de Opción (Simulados con etiquetas grandes) */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                <label
                  className={`cursor-pointer flex-1 py-4 px-6 rounded-xl border-2 text-center font-bold transition-all ${checklist[preguntaActual].respuesta === "SI"
                      ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50"
                    }`}
                >
                  <input
                    type="radio"
                    name={`pregunta-${checklist[preguntaActual].id}`}
                    value="SI"
                    className="hidden"
                    checked={checklist[preguntaActual].respuesta === "SI"}
                    onChange={() => responderYAvanzar(checklist[preguntaActual].id, "SI")}
                  />
                  CUMPLE
                </label>

                <label
                  className={`cursor-pointer flex-1 py-4 px-6 rounded-xl border-2 text-center font-bold transition-all ${checklist[preguntaActual].respuesta === "NO"
                      ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/30"
                      : "bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50"
                    }`}
                >
                  <input
                    type="radio"
                    name={`pregunta-${checklist[preguntaActual].id}`}
                    value="NO"
                    className="hidden"
                    checked={checklist[preguntaActual].respuesta === "NO"}
                    onChange={() => responderYAvanzar(checklist[preguntaActual].id, "NO")}
                  />
                  NO CUMPLE
                </label>
              </div>

              {/* Input de Observaciones */}
              <div className="mt-auto">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Observaciones (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Escribe aquí si hay algún detalle..."
                  value={checklist[preguntaActual].observacion}
                  onChange={(e) => handleChecklistChange(checklist[preguntaActual].id, "observacion", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e67e22]/50 focus:border-[#e67e22] outline-none transition-all text-sm"
                />
              </div>
            </div>

            {/* Controles de Navegación Manual */}
            <div className="flex justify-between mt-6">
              <button
                type="button"
                onClick={() => setPreguntaActual(Math.max(0, preguntaActual - 1))}
                disabled={preguntaActual === 0}
                className="px-5 py-2.5 rounded-lg font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                ← Anterior
              </button>

              <button
                type="button"
                onClick={() => setPreguntaActual(Math.min(checklist.length - 1, preguntaActual + 1))}
                disabled={preguntaActual === checklist.length - 1}
                className="px-5 py-2.5 rounded-lg font-bold text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                Siguiente →
              </button>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-[#d35400] font-bold mb-4 flex items-center gap-2 uppercase text-sm">
              <FaCamera size={18} /> Evidencia Fotográfica y Observaciones
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Nota que quitamos los espacios para que hagan match exacto con las llaves de tu estado 'fotos' */}
              {["Foto1", "Foto2", "Foto3", "Foto4", "Foto5", "Foto6"].map((tipo) => (
                <div key={tipo} className="flex flex-col gap-2">
                  <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">
                    {tipo.replace("Foto", "Foto ")}
                  </label>

                  <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition h-48 overflow-hidden">
                    {fotos[tipo] ? (
                      <>
                        <img
                          src={fotos[tipo]!}
                          alt={tipo}
                          className="h-full w-full object-contain rounded"
                        />
                        {/* Botón para eliminar la foto si el usuario se equivoca */}
                        <button
                          onClick={() => setFotos(prev => ({ ...prev, [tipo]: null }))}
                          className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-md transition-colors"
                        >
                          <FaTrash size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <FaFolderOpen className="text-gray-400 mb-2" size={32} />
                        <span className="text-sm text-gray-500 font-medium">Subir imagen</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, tipo)}
                          // EL TRUCO ESTÁ AQUÍ: Resetea el valor del input al hacer clic, forzando que el onChange siempre se dispare.
                          onClick={(e) => { e.currentTarget.value = "" }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex flex-col md:flex-row justify-center gap-6 pt-6 border-t">
          <button
            onClick={procesarFormularioActual}
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

export default AreasVerdes;