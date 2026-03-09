'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  FaCar, FaClock, FaClipboardList, FaCamera, 
  FaFilePdf, FaTrash, FaCheckCircle, FaExclamationTriangle, FaPlus
} from 'react-icons/fa';
import jsPDF from 'jspdf';

// ================= INTERFACES =================
type TipoReporte = 'Recepcion' | 'Entrega';

interface VehicleFormData {
  modelo: string;
  identificador: string;
  fechaHora: string;
  estado: string;
}

type BasePhotoKeys = 'Frente' | 'Lado Izquierdo' | 'Lado Derecho' | 'Parte Trasera' | 'Interior';

type BasePhotosData = {
  [K in BasePhotoKeys]: string | null;
};

interface ExtraPhoto {
  id: string;
  url: string;
}

// ================= COMPONENTE PRINCIPAL =================
const VehicleLogPage: React.FC = () => {
  const [currentTime, setCurrentTime] = useState('');
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>('Recepcion');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Reloj en tiempo real
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString('es-MX', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Estado del formulario
  const [formData, setFormData] = useState<VehicleFormData>({
    modelo: '',
    identificador: '',
    fechaHora: '',
    estado: ''
  });

  // Estado de fotos
  const [fotosBase, setFotosBase] = useState<BasePhotosData>({
    'Frente': null,
    'Lado Izquierdo': null,
    'Lado Derecho': null,
    'Parte Trasera': null,
    'Interior': null
  });
  const [fotosExtra, setFotosExtra] = useState<ExtraPhoto[]>([]);
  const [errores, setErrores] = useState<string[]>([]);

  // ================= HANDLERS =================
  const handleTabChange = (tipo: TipoReporte) => {
    setTipoReporte(tipo);
    setErrores([]);
    // Opcional: limpiar el formulario al cambiar de pestaña
    // setFormData({ modelo: '', identificador: '', fechaHora: '', estado: '' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errores.length > 0) setErrores([]);
  };

  // Manejo de fotos base
  const handleBaseImageUpload = (e: React.ChangeEvent<HTMLInputElement>, angulo: BasePhotoKeys) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setFotosBase(prev => ({ ...prev, [angulo]: url }));
    }
  };

  const removeBaseImage = (e: React.MouseEvent, angulo: BasePhotoKeys) => {
    e.preventDefault();
    e.stopPropagation();
    setFotosBase(prev => ({ ...prev, [angulo]: null }));
  };

  // Manejo de fotos extra
  const handleExtraImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        id: Math.random().toString(36).substring(7),
        url: URL.createObjectURL(file)
      }));
      setFotosExtra(prev => [...prev, ...newFiles]);
    }
    // Limpiar el input para permitir subir la misma foto si se borró
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeExtraImage = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFotosExtra(prev => prev.filter(foto => foto.id !== id));
  };

  const conteoFotos = Object.values(fotosBase).filter(f => f !== null).length + fotosExtra.length;

  const LOGO_FONATUR_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA+8AAAD4CAYAAACdQdeb...";

  // ================= GENERACIÓN DE PDF =================
  const generarPDF = async () => {
    // Validación
    const nuevosErrores = [];
    if (!formData.modelo) nuevosErrores.push("El modelo del vehículo es obligatorio.");
    if (!formData.fechaHora) nuevosErrores.push(`La hora de ${tipoReporte.toLowerCase()} es obligatoria.`);
    if (!formData.estado) nuevosErrores.push("Las observaciones del estado son obligatorias.");
    
    if (nuevosErrores.length > 0) {
      setErrores(nuevosErrores);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();


  const aplicarMarcaDeAguaFinal = (pdfDoc: any) => {
    const totalPaginas = pdfDoc.internal.getNumberOfPages();
    
    for (let i = 1; i <= totalPaginas; i++) {
      pdfDoc.setPage(i); // Nos movemos a la página i
      
      pdfDoc.saveGraphicsState();
      // Opacidad muy baja (0.10 - 0.15) para que se vea el contenido de abajo
      pdfDoc.setGState(new (pdfDoc as any).GState({ opacity: 0.12 }));
      
      const imgWidth = 140; 
      const imgHeight = 40;
      const x = (pageWidth - imgWidth) / 2;
      const yPos = (pageHeight - imgHeight) / 2;

      // Usamos el Base64 o la ruta corregida '/logo_fonatur.png'
      // Si usas la ruta, asegúrate de que el archivo esté en /public/logo_fonatur.png
      pdfDoc.addImage("/logo_fonatur.png", 'PNG', x, yPos, imgWidth, imgHeight);
      
      pdfDoc.restoreGraphicsState();
    }
  };

  //  // --- FUNCIÓN PARA AGREGAR MARCA DE AGUA ---
  // const addWatermark = (pdfDoc: any) => {
  //   const imgData = "/logo_fonatur.png"; // Aquí pones el string del logo
    
  //   // Configuramos la transparencia (0.1 es 10% de opacidad)
  //   pdfDoc.saveGraphicsState();
  //   pdfDoc.setGState(new (pdfDoc as any).GState({ opacity: 0.15 }));
    
  //   // Calculamos posición para centrarlo
  //   const imgWidth = 150; // Ancho del logo en el centro
  //   const imgHeight = 40;  // Alto proporcional
  //   const x = (pageWidth - imgWidth) / 2;
  //   const y = (pageHeight - imgHeight) / 2;

  //   // Dibujamos el logo
  //   pdfDoc.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
    
  //   // Restauramos el estado para que el resto del texto sea 100% opaco
  //   pdfDoc.restoreGraphicsState();
  // };



    const margin = 15;
    let y = 20;

    const ahora = new Date();
    const fechaFormateada = ahora.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
    const prefijo = tipoReporte === 'Recepcion' ? 'REC' : 'ENT';
    const folio = `${prefijo}-${ahora.getTime().toString().slice(-6)}`;




    // --- INICIO DEL DOCUMENTO ---
  

    // ENCABEZADO
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`REPORTE DE ${tipoReporte.toUpperCase()} DE VEHÍCULO`, margin, y);
    y += 4;
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // DATOS GENERALES
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Folio: ${folio}`, margin, y);
    doc.text(`Fecha de Impresión: ${fechaFormateada}`, pageWidth - 70, y);
    y += 10;

    // INFORMACIÓN DEL VEHÍCULO
    doc.setFont("helvetica", "bold");
    doc.text("1. INFORMACIÓN DEL VEHÍCULO Y TIEMPO", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Modelo: ${formData.modelo}`, margin, y);
    doc.text(`Identificador/Placas: ${formData.identificador || 'N/A'}`, margin + 80, y);
    y += 8;
    doc.text(`Hora de ${tipoReporte}: ${formData.fechaHora.replace('T', ' ')}`, margin, y);
    y += 12;

    // CONDICIONES
    doc.setFont("helvetica", "bold");
    doc.text("2. CONDICIONES FÍSICAS Y MECÁNICAS", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    
    doc.text(`Observaciones al ${tipoReporte.toLowerCase()}:`, margin, y);
    y += 5;
    const lineasEstado = doc.splitTextToSize(formData.estado, pageWidth - margin * 2);
    doc.text(lineasEstado, margin, y);
    y += (lineasEstado.length * 5) + 10;

    // EVIDENCIA FOTOGRÁFICA
    const baseImgs = Object.entries(fotosBase).filter(([_, value]) => value !== null) as [string, string][];
    const extraImgs = fotosExtra.map((f, i) => [`Foto Extra ${i + 1}`, f.url] as [string, string]);
    const todasLasImagenes = [...baseImgs, ...extraImgs];
    
    if (todasLasImagenes.length > 0) {
      if (y > pageHeight - 60) { doc.addPage(); y = 20; }
      
      doc.setFont("helvetica", "bold");
      doc.text("3. EVIDENCIA FOTOGRÁFICA", margin, y);
      y += 10;

      const imgWidth = 80;
      const imgHeight = 60;
      const espacioX = 15;
      const espacioY = 25;
      let xPosition = margin;

      for (let i = 0; i < todasLasImagenes.length; i++) {
        const [titulo, base64] = todasLasImagenes[i];
        
        if (y + imgHeight > pageHeight - 30) {
          doc.addPage();
          y = 20;
          xPosition = margin;
        }

        doc.rect(xPosition - 1, y - 1, imgWidth + 2, imgHeight + 2);
        try {
            doc.addImage(base64, "JPEG", xPosition, y, imgWidth, imgHeight);
        } catch(e) {
            console.warn("Error agregando imagen al PDF.", e);
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(titulo.toUpperCase(), xPosition, y + imgHeight + 6);

        if (xPosition + imgWidth * 2 + espacioX <= pageWidth - margin) {
          xPosition += imgWidth + espacioX;
        } else {
          xPosition = margin;
          y += imgHeight + espacioY;
        }
      }
    }
    aplicarMarcaDeAguaFinal(doc);

    doc.save(`Reporte_${tipoReporte}_${folio}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#eef2f6] font-sans text-gray-700 py-8 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* ===== HEADER Y TABS ===== */}
        <header className="relative bg-emerald-700 text-white rounded-t-2xl overflow-hidden shadow-lg pt-8 px-8 flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-extrabold tracking-wide flex items-center gap-3">
                <FaCar className="text-emerald-300" /> BITÁCORA DE VEHÍCULO
              </h1>
              <p className="text-emerald-100 text-sm mt-1">
                Gestión de unidades en campo
              </p>
            </div>
            <div className="text-right text-sm font-mono bg-black/20 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
              {currentTime}
            </div>
          </div>

          {/* TABS */}
          <div className="flex gap-2">
            <button 
              onClick={() => handleTabChange('Recepcion')}
              className={`px-6 py-3 rounded-t-xl font-bold text-sm transition-colors ${
                tipoReporte === 'Recepcion' 
                  ? 'bg-[#eef2f6] text-emerald-800' 
                  : 'bg-emerald-800/50 text-emerald-100 hover:bg-emerald-600'
              }`}
            >
              📥 Reporte de Recepción
            </button>
            <button 
              onClick={() => handleTabChange('Entrega')}
              className={`px-6 py-3 rounded-t-xl font-bold text-sm transition-colors ${
                tipoReporte === 'Entrega' 
                  ? 'bg-[#eef2f6] text-emerald-800' 
                  : 'bg-emerald-800/50 text-emerald-100 hover:bg-emerald-600'
              }`}
            >
              📤 Reporte de Entrega
            </button>
          </div>
        </header>

        {errores.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm">
            <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
              <FaExclamationTriangle /> Por favor corrige los siguientes errores:
            </div>
            <ul className="list-disc list-inside text-sm text-red-600">
              {errores.map((err, idx) => <li key={idx}>{err}</li>)}
            </ul>
          </div>
        )}

        {/* ===== FORMULARIO ===== */}
        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-[#d35400] font-bold mb-4 uppercase text-sm flex items-center gap-2">
              <FaCar size={16}/> Información de la Unidad
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-gray-500 font-semibold mb-1">Modelo del Vehículo *</label>
                <input
                  type="text"
                  name="modelo"
                  value={formData.modelo}
                  onChange={handleInputChange}
                  placeholder="Ej. Chevrolet Silverado 4x4"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-gray-500 font-semibold mb-1">Nombre o Placas (Opcional)</label>
                <input
                  type="text"
                  name="identificador"
                  value={formData.identificador}
                  onChange={handleInputChange}
                  placeholder="Ej. Unidad 05 / JTD-4821"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
            <h2 className="text-[#d35400] font-bold mb-4 uppercase text-sm flex items-center gap-2">
              <FaClock size={16}/> {tipoReporte === 'Recepcion' ? 'Registro de Entrada' : 'Registro de Salida'}
            </h2>
            <div className="flex-grow space-y-4">
              <div>
                <label className="block text-xs uppercase text-gray-500 font-semibold mb-1">
                  Hora de {tipoReporte} *
                </label>
                <input
                  type="datetime-local"
                  name="fechaHora"
                  value={formData.fechaHora}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                />
              </div>
            </div>
          </section>
        </div>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-[#d35400] font-bold mb-4 uppercase text-sm flex items-center gap-2">
            <FaClipboardList size={16}/> Estado al {tipoReporte === 'Recepcion' ? 'Recibir' : 'Entregar'}
          </h2>
          <div>
            <textarea
              name="estado"
              value={formData.estado}
              onChange={handleInputChange}
              rows={4}
              placeholder={tipoReporte === 'Recepcion' 
                ? "Describa rayones, nivel de gasolina, limpieza, llantas al momento de RECIBIR la unidad..." 
                : "Describa las condiciones generales, nivel de gasolina y limpieza al ENTREGAR la unidad..."}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition resize-none"
            ></textarea>
          </div>
        </section>

        {/* ===== FOTOS ===== */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-end mb-6 border-b pb-4">
            <h2 className="text-[#d35400] font-bold uppercase text-sm flex items-center gap-2">
              <FaCamera size={18}/> Evidencia Fotográfica
            </h2>
            <div className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
              {conteoFotos} Fotos Subidas
            </div>
          </div>
          
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Tomas Obligatorias</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-8">
            {(Object.keys(fotosBase) as BasePhotoKeys[]).map((angulo) => (
              <div key={angulo} className="relative group">
                <input
                  type="file"
                  id={`base-${angulo}`}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleBaseImageUpload(e, angulo)}
                />
                <label 
                  htmlFor={`base-${angulo}`}
                  className={`block h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition cursor-pointer shadow-inner
                    ${fotosBase[angulo] 
                      ? 'border-emerald-500 bg-emerald-50' 
                      : 'border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-slate-100'}`}
                >
                  {fotosBase[angulo] ? (
                    <>
                      <img src={fotosBase[angulo] as string} alt={angulo} className="w-full h-full object-cover" />
                      <button 
                        onClick={(e) => removeBaseImage(e, angulo)}
                        className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                      >
                        <FaTrash size={10} />
                      </button>
                    </>
                  ) : (
                    <div className="text-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                      <FaCamera className="mx-auto mb-1 text-lg" />
                      <p className="text-[10px] font-bold uppercase px-1 text-center leading-tight">{angulo}</p>
                    </div>
                  )}
                </label>
                {fotosBase[angulo] && (
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center gap-1">
                    <FaCheckCircle className="text-emerald-400"/> OK
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* FOTOS EXTRAS DINÁMICAS */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fotos de Detalles Adicionales</h3>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition-colors"
            >
              <FaPlus /> Agregar Fotos Extra
            </button>
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleExtraImageUpload}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {fotosExtra.map((foto, index) => (
              <div key={foto.id} className="relative group h-28 rounded-xl border-2 border-emerald-500 bg-emerald-50 overflow-hidden shadow-inner">
                <img src={foto.url} alt={`Extra ${index + 1}`} className="w-full h-full object-cover" />
                <button 
                  onClick={(e) => removeExtraImage(e, foto.id)}
                  className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                >
                  <FaTrash size={10} />
                </button>
                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                  Extra {index + 1}
                </div>
              </div>
            ))}
            
            {/* Placeholder si no hay extras */}
            {fotosExtra.length === 0 && (
              <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400">
                <FaCamera className="mx-auto text-2xl mb-2 opacity-50" />
                <p className="text-sm">No hay fotos adicionales.</p>
                <p className="text-xs opacity-75 mt-1">Sube fotos de golpes, rayones o detalles específicos.</p>
              </div>
            )}
          </div>
        </section>

        {/* ===== BOTÓN GUARDAR ===== */}
        <div className="flex justify-end pt-4">
          <button
            onClick={generarPDF}
            className="px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-emerald-600/30 w-full sm:w-auto text-lg"
          >
            <FaFilePdf size={20} />
            Generar PDF de {tipoReporte}
          </button>
        </div>

      </div>
    </div>
  );
};

export default VehicleLogPage;