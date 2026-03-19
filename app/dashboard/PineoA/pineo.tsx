'use client';

import { usePDFQueue }          from '@/app/context/pdf-queue-context';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FaCrosshairs, FaFolderOpen, FaMapMarkedAlt,
  FaFilePdf, FaTrash, FaUndo, FaPlus
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
interface GpsCoords { lat: string | null; lon: string | null; precision: string; }
interface FormData { id: string; sector: string; Tramo: string; accesoPublico: string; tipoMantenimiento: string; categoria: string; tipoAlumbrado: string; }
interface GeoRef { lat: string; lon: string; precision: string; timestamp: string; }

interface EvidenceEntry {
  id: number;
  observation: string;
  geoRef: GeoRef | null;
  photo: string | null;
}

interface ChecklistItem {
  id: number;
  pregunta: string;
  respuesta: string;
  evidence: EvidenceEntry[];
  // Campos añadidos para compatibilidad con el tipo que espera la base de datos:
  observacion: string; 
  geoRef?: GeoRef | null;
}

// ================= CONSTANTES =================
const PREGUNTAS: Record<string, string[]> = {
  "Alumbrado Público": [
    "OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?",
    "LA FOTOCELDA, RELOJ OPERATIVO O FUSIBLE ¿CUMPLE CON SU FUNCIÓN?",
    "EL BRAZO Y BASE DEL POSTE ¿SE ENCUENTRA EN BUENAS CONDICIONES?",
    "ROBO DE CABLE/DAÑOS: SIN CORTES, SIN CABLES EXPUESTOS",
    "REGISTROS Y/O CONEXIONES VISIBLES CORRECTAMENTE CERRADOS",
    "ENTORNO Y SEGURIDAD SEGÚN ZONA (CAMELLÓN/BANQUETA)",
    "INTEGRIDAD DE LUMINARIA Y ÓPTICA",
    "ESTADO DE POSTE METÁLICO/CONCRETO",
  ],
  "Cerillo": [
    "OPERATIVIDAD: ¿PRENDE Y SE MANTIENE ESTABLE?",
    "ORIENTACIÓN ADECUADA SIN DESLUMBRAMIENTO",
    "PRENDE O NO PRENDE LAMPARA TIPO BOLARDO (CERILLO)",
    "MANTENIMIENTO A TRANSFORMADORES DE ALUMBRADO",
    "ESTADO FISICO DE LAMPARAS TIPO BOLARDO (CERILLO)",
  ],
  "Parabuses": [
    "ESTADO DE BASE DE CONCRETO",
    "ESTADO DE LÁMPARAS E ILUMINACIÓN DE PARABUSES",
    "ESTADO DE LÁMPARAS WALLPACK",
    "ESTADO DE LÁMPARAS TIPO FRAGATA",
  ]
};

const TRAMOS_POR_SECTOR: Record<string, string[]> = {
  "Barra de Coyuca":      ["Sendero-Seguro-Barra Coyuca"],
  "Pie de la Cuesta":     ["Sendero-seguro-Pie de la cuesta"],
  "Barrios Historicos":   ["Caleta-caletilla", "Sendero-Costera-antigua", "Corredor Zocalo-quebrada", "Corredor zocalo-fuerte"],
  "Acapulco Tradicional": ["Sendero-Tadeo-arredondo", "Sendero-cinerio-hornitos", "Michoacan", "Av. Universidad", "Dr. Ignacio chavez"],
  "Acapulco Dorado":      ["Costa azul"],
  "Puerto Márquez":       ["Sendero-Puerto-Marquez"],
  "Acapulco Diamante":    ["Av. Costera Palmas"],
  "Otro":                 [""],
};

const empty_evidence_entry = (id: number): EvidenceEntry => ({
  id,
  observation: "",
  geoRef: null,
  photo: null,
});

const checklist_inicial = (tipo: string): ChecklistItem[] => {
  const preguntas = PREGUNTAS[tipo] || [];
  return preguntas.map((p, i) => ({
    id: i + 1,
    pregunta: p,
    respuesta: "",
    observacion: "", // Inicializado para TS
    evidence: [empty_evidence_entry(1)],
  }));
};

const PineoA: React.FC<{ reporteParaEditar?: any }> = ({ reporteParaEditar }) => {
  const { addToQueue } = usePDFQueue();
  const mapRef = useRef<HTMLDivElement>(null);
  const watchId = useRef<number | null>(null);
  const geoRefWatchId = useRef<number | null>(null);

  const [currentTime, setCurrentTime] = useState('');
  const [sectorPersonalizado, setSectorPersonalizado] = useState('');
  const [tramoPersonalizado, setTramoPersonalizado] = useState('');
  const [preguntaActual, setPreguntaActual] = useState(0);
  const [cargandoGps, setCargandoGps] = useState(false);
  const [cargandoGpsEntry, setCargandoGpsEntry] = useState<{ itemId: number; entryId: number } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    id: reporteParaEditar?.id ?? '',
    sector: reporteParaEditar?.sector ?? '',
    Tramo: reporteParaEditar?.tramo ?? '',
    accesoPublico: reporteParaEditar?.acceso_publico ?? '',
    tipoMantenimiento: reporteParaEditar?.tipo_mantenimiento ?? 'Ordinario',
    categoria: 'ALUMBRADO PÚBLICO',
    tipoAlumbrado: reporteParaEditar?.tipoAlumbrado ?? 'Alumbrado Público',
  });

  const [gps, setGps] = useState<GpsCoords>({
    lat: reporteParaEditar?.latitud?.toString() ?? null,
    lon: reporteParaEditar?.longitud?.toString() ?? null,
    precision: reporteParaEditar?.latitud ? 'Guardado' : '--',
  });

  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    checklist_inicial(formData.tipoAlumbrado)
  );

  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);

  // ================= ACCIONES GPS =================
  const obtenerUbicacionGeneral = useCallback(() => {
    if (!navigator.geolocation) return alert("GPS no soportado");
    setCargandoGps(true);
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords: { latitude, longitude, accuracy } }) => {
        setGps({ lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m` });
        if (accuracy < 10 && watchId.current) {
          navigator.geolocation.clearWatch(watchId.current);
          setCargandoGps(false);
        }
      },
      () => { setCargandoGps(false); alert("Error de señal GPS"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const capturarGeoRefIncidencia = useCallback((itemId: number, entryId: number) => {
    setCargandoGpsEntry({ itemId, entryId });
    geoRefWatchId.current = navigator.geolocation.watchPosition(
      ({ coords: { latitude, longitude, accuracy } }) => {
        const timestamp = new Date().toLocaleTimeString('es-MX');
        setChecklist(prev => prev.map(item =>
          item.id === itemId ? {
            ...item,
            evidence: item.evidence.map(e => e.id === entryId ? {
              ...e, geoRef: { lat: latitude.toFixed(6), lon: longitude.toFixed(6), precision: `${accuracy.toFixed(1)}m`, timestamp }
            } : e)
          } : item
        ));
        if (geoRefWatchId.current) navigator.geolocation.clearWatch(geoRefWatchId.current);
        setCargandoGpsEntry(null);
      },
      () => { setCargandoGpsEntry(null); alert("Error en GPS de incidencia"); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // ================= MANEJO DE EVIDENCIA =================
  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, itemId: number, entryId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setChecklist(prev => prev.map(item =>
        item.id === itemId ? {
          ...item,
          evidence: item.evidence.map(e => e.id === entryId ? { ...e, photo: base64 } : e)
        } : item
      ));
    };
    reader.readAsDataURL(file);
  }, []);

  const addEvidence = (itemId: number) => {
    setChecklist(prev => prev.map(item =>
      item.id === itemId ? { ...item, evidence: [...item.evidence, empty_evidence_entry(item.evidence.length + 1)] } : item
    ));
  };

  const removeEvidence = (itemId: number, entryId: number) => {
    setChecklist(prev => prev.map(item =>
      item.id === itemId ? { ...item, evidence: item.evidence.filter(e => e.id !== entryId) } : item
    ));
  };

  // ================= GUARDADO Y PDF =================
  const procesarReporte = async () => {
    try {
      const sectorFinal = formData.sector === "Otro" ? sectorPersonalizado : formData.sector;
      const tramoFinal = formData.sector === "Otro" ? tramoPersonalizado : formData.Tramo;
      const finalData = { ...formData, sector: sectorFinal, Tramo: tramoFinal };

      // Se envían los datos a la base de datos (se usa 'any' para evitar el bloqueo del build mientras actualizas el backend)
      const resId = reporteParaEditar?.id 
        ? await actualizarReporte(reporteParaEditar.id.toString(), finalData, checklist as any, gps, {})
        : await crearReporte(finalData, checklist as any, gps, {});

      // Generación de PDF según el diseño solicitado
      const doc = new jsPDF("p", "mm", "a4");
      let y = 20;
      doc.setFontSize(14).setFont("helvetica", "bold").text("REPORTE DE EVIDENCIA FOTOGRÁFICA", 105, y, { align: "center" });
      y += 15;

      const rows: any[] = [];
      let counter = 1;

      checklist.forEach(item => {
        item.evidence.forEach(ev => {
          if (ev.photo || ev.observation) {
            const coords = ev.geoRef ? `${ev.geoRef.lat}, ${ev.geoRef.lon}\nPrec: ${ev.geoRef.precision}` : "Sin geo-ref";
            rows.push([
              counter++,
              { content: `${item.pregunta}\n\nCOORDENADAS:\n${coords}`, styles: { fontSize: 7 } },
              `${ev.observation || "Sin observaciones"}\n\nCUMPLE: ${item.respuesta}`,
              { content: ev.photo ? "FOTO_RESERVED" : "S/F", photo: ev.photo }
            ]);
          }
        });
      });

      autoTable(doc, {
        startY: y,
        head: [['No.', 'Concepto (Pregunta / Coordenadas)', 'Descripción / Observaciones', 'Evidencia Fotográfica']],
        body: rows,
        columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 70 }, 2: { cellWidth: 60 }, 3: { cellWidth: 45, halign: 'center' } },
        didDrawCell: (data) => {
          if (data.column.index === 3 && data.cell.raw && (data.cell.raw as any).photo) {
            doc.addImage((data.cell.raw as any).photo, 'JPEG', data.cell.x + 2, data.cell.y + 2, 40, 30);
          }
        },
        styles: { minCellHeight: 35 }
      });

      doc.save(`Reporte_${sectorFinal}.pdf`);
      alert("Reporte procesado con éxito");
    } catch (error) {
      console.error(error);
      alert("Error al procesar");
    }
  };

  const itemActual = checklist[preguntaActual];

  return (
    <div className="max-w-5xl mx-auto p-4 bg-slate-50 min-h-screen text-slate-800 font-sans">
      {/* HEADER */}
      <div className="bg-emerald-700 text-white p-6 rounded-2xl shadow-lg mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">CONTROL DE PINEO Y MANTENIMIENTO</h1>
          <p className="text-emerald-100 text-sm">CIP ACAPULCO-COYUCA</p>
        </div>
        <div className="text-right font-mono text-xs opacity-80">{currentTime}</div>
      </div>

      {/* SELECTORES SUPERIORES */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Sector</label>
          <select value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})} className="w-full font-bold text-emerald-700 outline-none">
            <option value="">Seleccionar...</option>
            {Object.keys(TRAMOS_POR_SECTOR).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tramo</label>
          <select value={formData.Tramo} onChange={e => setFormData({...formData, Tramo: e.target.value})} className="w-full outline-none">
            <option value="">Seleccionar...</option>
            {(TRAMOS_POR_SECTOR[formData.sector] || []).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tipo de Alumbrado</label>
          <select value={formData.tipoAlumbrado} onChange={e => {
             const val = e.target.value;
             setFormData({...formData, tipoAlumbrado: val});
             setChecklist(checklist_inicial(val));
             setPreguntaActual(0);
          }} className="w-full font-bold text-orange-600 outline-none">
            {Object.keys(PREGUNTAS).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* COLUMNA IZQUIERDA: PREGUNTAS Y EVIDENCIAS */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-full uppercase">Pregunta {preguntaActual + 1} de {checklist.length}</span>
              <div className="flex gap-1">
                {checklist.map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full ${i === preguntaActual ? 'bg-orange-500' : 'bg-slate-200'}`} />
                ))}
              </div>
            </div>

            <h2 className="text-xl font-bold text-slate-700 mb-6 text-center">{itemActual.pregunta}</h2>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <button onClick={() => setChecklist(prev => prev.map(it => it.id === itemActual.id ? {...it, respuesta: 'SI'} : it))}
                className={`py-4 rounded-xl font-black transition-all border-2 ${itemActual.respuesta === 'SI' ? 'bg-emerald-500 border-emerald-600 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>SÍ CUMPLE</button>
              <button onClick={() => setChecklist(prev => prev.map(it => it.id === itemActual.id ? {...it, respuesta: 'NO'} : it))}
                className={`py-4 rounded-xl font-black transition-all border-2 ${itemActual.respuesta === 'NO' ? 'bg-red-500 border-red-600 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>NO CUMPLE</button>
            </div>

            {/* SECCIÓN DE MÚLTIPLES EVIDENCIAS */}
            <div className="border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Evidencias Fotográficas e Incidencias</h3>
                <button onClick={() => addEvidence(itemActual.id)} className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
                  <FaPlus /> Añadir evidencia
                </button>
              </div>

              <div className="space-y-4">
                {itemActual.evidence.map((ev, index) => (
                  <div key={ev.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 relative group">
                    {itemActual.evidence.length > 1 && (
                      <button onClick={() => removeEvidence(itemActual.id, ev.id)} className="absolute -top-2 -right-2 bg-white text-red-500 p-1.5 rounded-full shadow-md border border-red-50 hover:bg-red-50">
                        <FaTrash size={10} />
                      </button>
                    )}
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <input 
                          type="text" 
                          placeholder="Escribe observación de esta incidencia..." 
                          value={ev.observation}
                          onChange={e => {
                            const val = e.target.value;
                            setChecklist(prev => prev.map(it => it.id === itemActual.id ? {
                              ...it, evidence: it.evidence.map(e_ev => e_ev.id === ev.id ? {...e_ev, observation: val} : e_ev)
                            } : it));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                        />
                        
                        {ev.geoRef ? (
                          <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-xl border border-emerald-100 flex justify-between items-center">
                            <div className="text-[10px] font-mono leading-tight">
                              <div className="font-bold">UBICACIÓN CAPTURADA:</div>
                              {ev.geoRef.lat}, {ev.geoRef.lon}
                            </div>
                            <button onClick={() => capturarGeoRefIncidencia(itemActual.id, ev.id)} className="text-emerald-500 hover:rotate-180 transition-transform"><FaUndo size={12} /></button>
                          </div>
                        ) : (
                          <button 
                            disabled={cargandoGpsEntry !== null}
                            onClick={() => capturarGeoRefIncidencia(itemActual.id, ev.id)} 
                            className="w-full py-2.5 bg-white border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-bold text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition-all flex items-center justify-center gap-2">
                            <FaCrosshairs className={cargandoGpsEntry?.entryId === ev.id ? "animate-spin" : ""} />
                            {cargandoGpsEntry?.entryId === ev.id ? "OBTENIENDO..." : "CAPTURAR GEORREFERENCIA EXACTA"}
                          </button>
                        )}
                      </div>

                      <div className="relative aspect-video bg-white rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex flex-col items-center justify-center group/photo">
                        {ev.photo ? (
                          <>
                            <img src={ev.photo} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                              <label className="cursor-pointer bg-white px-3 py-1.5 rounded-lg text-[10px] font-bold">Cambiar Foto</label>
                            </div>
                          </>
                        ) : (
                          <>
                            <FaFolderOpen className="text-slate-300 mb-1" size={20} />
                            <span className="text-[10px] font-bold text-slate-400">SUBIR FOTO</span>
                          </>
                        )}
                        <input type="file" accept="image/*" onChange={e => handlePhotoUpload(e, itemActual.id, ev.id)} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button onClick={() => setPreguntaActual(p => Math.max(0, p - 1))} className="px-6 py-2 rounded-xl font-bold text-slate-400 hover:bg-slate-100 transition-colors">Anterior</button>
              <button onClick={() => setPreguntaActual(p => Math.min(checklist.length - 1, p + 1))} className="px-8 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors shadow-lg shadow-slate-200">Siguiente Pregunta</button>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: MAPA GENERAL Y BOTONES FINALES */}
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <h3 className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2">
              <FaMapMarkedAlt className="text-orange-500" /> Levantamiento General
            </h3>
            <div className="h-48 rounded-xl overflow-hidden border border-slate-100 mb-4" ref={mapRef}>
              <LeafletMap gps={gps} reportes={[]} />
            </div>
            <button 
              disabled={cargandoGps}
              onClick={obtenerUbicacionGeneral} 
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${cargandoGps ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'}`}>
              <FaCrosshairs className={cargandoGps ? 'animate-spin' : ''} />
              {cargandoGps ? 'Buscando satélites...' : 'Capturar Punto Inicial'}
            </button>
          </div>

          <div className="space-y-3">
            <button onClick={procesarReporte} className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black shadow-xl shadow-orange-100 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-wider">
              <FaFilePdf size={20} /> Finalizar y Generar PDF
            </button>
            <button onClick={() => window.location.reload()} className="w-full py-4 bg-white text-slate-400 rounded-2xl font-bold border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-sm">
              <FaUndo size={14} /> Reiniciar Cuestionario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PineoA;