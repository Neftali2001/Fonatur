'use client';

import React, { useState, useRef, useEffect, useCallback, ChangeEvent } from 'react';
import {
  FaSun, FaCloud, FaUmbrella, FaCrosshairs, FaFileCsv,
  FaCamera, FaFolderOpen, FaGlobeAmericas, FaUsers,
  FaCube, FaListOl, FaChartPie, FaEraser, FaFilePdf,
  FaTrash, FaUndo, FaMapMarkedAlt,
} from 'react-icons/fa';
import SignatureCanvas from 'react-signature-canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

// ─── Leaflet (carga dinámica — evita "window is not defined" en SSR) ──────────
import dynamic from 'next/dynamic';

interface LeafletMapProps {
  lat:    string;
  lon:    string;
  mapRef: React.RefObject<HTMLDivElement | null>;
}

const LeafletMapInline = dynamic<LeafletMapProps>(
  () => import('./LeafletMap'),
  {
    ssr:     false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-slate-100 text-slate-400 text-xs font-semibold">
        Cargando mapa...
      </div>
    ),
  }
);

// ─── Helpers de tipos para jsPDF (evita @ts-expect-error en cascada) ──────────
// jspdf-autotable extiende jsPDF pero sus tipos no siempre se fusionan bien.
type JsPDFWithAutoTable = jsPDF & {
  lastAutoTable: { finalY: number };
};
// GState tampoco está en los tipos públicos de jsPDF.
type JsPDFInternal = {
  getNumberOfPages: () => number;
};


interface FormData {
  proyecto:   string;
  cliente:    string;
  ubicacion:  string;
  municipio:  string;
  jefe:       string;
  operador:   string;
  ayudantes:  string;
  hInicio:    string;
  hTermino:   string;
  vehiculo:   string;
  placas:     string;
  baseId:     string;
  altInst:    string;
  visado:     string;
  altPrisma:  string;
  norteB:     string;
  esteB:      string;
  elevB:      string;
  area:       string;
  notas:      string;
  modelo:     string;
  NoSerie:    string;
  
}

interface GpsState {
  lat:       string;
  lon:       string;
  precision: string;
}

interface Punto {
  id:    number;
  punto: string;
  norte: string;
  este:  string;
  elev:  string;
  desc:  string;
}

type FotoKey = 'Foto1' | 'Foto2' | 'Foto3' | 'Foto4' | 'Foto5' | 'Foto6';
type Fotos   = Record<FotoKey, string | null>;

const FOTO_KEYS: FotoKey[] = ['Foto1', 'Foto2', 'Foto3', 'Foto4', 'Foto5', 'Foto6'];
const EQUIPO_OPCIONES      = ['Estación', 'GPS RTK', 'Nivel', 'Dron', 'Prisma', 'Cinta'] as const;
const CLIMA_OPCIONES       = ['Soleado', 'Nublado', 'Lluvia'] as const;
const COORDS_OPCIONES      = ['UTM WGS84', 'ITRF08', 'Locales'] as const;
const PLANO_OPCIONES       = ['Planimétrico', 'Altimétrico', 'Curvas de Nivel', 'Deslinde', 'Fotoprametrico', 'Lotificacion', 'Peritaje', 'Plan-altimetro', 'Batimetria',] as const;

type ClimaType  = (typeof CLIMA_OPCIONES)[number];
type PlanoType  = (typeof PLANO_OPCIONES)[number];
type CoordsType = (typeof COORDS_OPCIONES)[number];

// ─── Componente Principal ─────────────────────────────────────────────────────

const TopographyForm: React.FC = () => {
  const mapRef         = useRef<HTMLDivElement>(null);
  const formRef        = useRef<HTMLDivElement>(null);
  const sigPadTopografo = useRef<SignatureCanvas>(null);
  const sigPadCliente   = useRef<SignatureCanvas>(null);
  const watchId         = useRef<number | null>(null);

  // ── Estado del formulario ─────────────────────────────────────────────────
  const [formData, setFormData] = useState<FormData>({
    proyecto:  'Levantamiento Topográfico para playas...',
    cliente:   'Fonatur',
    ubicacion: '',
    municipio: 'Acapulco, Guerrero.',
    jefe:      'Tec. Dafne Juárez',
    operador:  'Ing. Jhosua Alemán',
    ayudantes: 'Tec. Jóvenes Construyendo el Futuro',
    hInicio:   '09:05',
    hTermino:  '15:00',
    vehiculo:  'Silverado 4x4',
    placas:    'JTD-4821',
    baseId:    'BASE 01',
    altInst:   '1.735',
    visado:    'DIRECTO',
    altPrisma: '2.000',
    norteB:    '2286543.217',
    esteB:     '612845.332',
    elevB:     '',
    area:      '2.35ha',
    notas:     'Trabajo realizado sin incidencias relevantes...',
    modelo:    'MDOIK23',
    NoSerie:   '18282728'
  });

  const [gps,          setGps]          = useState<GpsState>({ lat: '', lon: '', precision: '--' });
  const [cargandoGps,  setCargandoGps]  = useState<boolean>(false);
  const [clima,        setClima]        = useState<ClimaType>('Soleado');
  const [sistemaCoords, setSistemaCoords] = useState<CoordsType>('UTM WGS84');
  const [puntos,       setPuntos]       = useState<Punto[]>([
    { id: 1, punto: 'P001', norte: '2286612.458', este: '612902.776', elev: '1586.921', desc: '' },
  ]);
  const [equipo,    setEquipo]    = useState<string[]>(['Estación']);
  const [fotos,     setFotos]     = useState<Fotos>({
    Foto1: null, Foto2: null, Foto3: null,
    Foto4: null, Foto5: null, Foto6: null,
  });
  const [tipoPlano, setTipoPlano] = useState<PlanoType>('Planimétrico');
  const [logo,      setLogo]      = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  // ── Reloj ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () =>
      setCurrentTime(new Date().toLocaleString('es-MX', { hour12: false }));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // ── GPS ───────────────────────────────────────────────────────────────────
  const finalizarCaptura = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setCargandoGps(false);
    }
  }, []);

  const obtenerUbicacion = useCallback(() => {
    if (!navigator.geolocation) {
      alert('GPS no soportado en este navegador');
      return;
    }
    setCargandoGps(true);

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };

    const onSuccess: PositionCallback = async ({ coords }) => {
      const latStr = coords.latitude.toFixed(6);
      const lonStr = coords.longitude.toFixed(6);

      setGps({
        lat:       latStr,
        lon:       lonStr,
        precision: `${coords.accuracy.toFixed(1)}m`,
      });
      
      if (coords.accuracy < 10) finalizarCaptura();

      try {
        // 1. Obtener Calle y Municipio (Reverse Geocoding con OpenStreetMap)
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latStr}&lon=${lonStr}`);
        const geoData = await geoRes.json();
        
        if (geoData && geoData.address) {
          const address = geoData.address;
          const calle = address.road || address.pedestrian || address.suburb || 'Ubicación no especificada';
          
          // Buscar el municipio/ciudad y el estado
          const ciudad = address.city || address.town || address.village || address.county || '';
          const estado = address.state || '';
          const municipioCalculado = ciudad ? `${ciudad}, ${estado}` : estado;

          setFormData(prev => ({
            ...prev,
            ubicacion: calle,
            municipio: municipioCalculado || prev.municipio
          }));
        }

        // 2. Obtener el Clima (Open-Meteo)
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latStr}&longitude=${lonStr}&current_weather=true`);
        const weatherData = await weatherRes.json();
        
        if (weatherData && weatherData.current_weather) {
          const code = weatherData.current_weather.weathercode;
          let climaCalculado: ClimaType = 'Soleado';
          
          // Códigos WMO: 0 = Despejado, 1-3 = Nublado, >50 = Lluvia/Chubascos
          if (code >= 1 && code <= 3) {
            climaCalculado = 'Nublado';
          } else if (code >= 50) {
            climaCalculado = 'Lluvia';
          }
          
          setClima(climaCalculado);
        }

      } catch (error) {
        console.error('Error al obtener datos adicionales (Geocoding/Clima):', error);
      } finally {
        // Por si la precisión no fue menor a 10 y el watch sigue, detenemos el loading
        setCargandoGps(false); 
      }
    };

    const onError: PositionErrorCallback = () => {
      setCargandoGps(false);
      alert('Error al obtener señal GPS.');
    };

    watchId.current = navigator.geolocation.watchPosition(onSuccess, onError, options);
    window.setTimeout(finalizarCaptura, 10_000);
  }, [finalizarCaptura]);
  // ── Handlers de formulario ────────────────────────────────────────────────
  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    },
    []
  );

  const handlePuntoChange = useCallback(
    (id: number, field: keyof Omit<Punto, 'id'>, value: string) => {
      setPuntos(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
    },
    []
  );

  const agregarFila = useCallback(() => {
    setPuntos(prev => {
      const nuevoId = prev.length + 1;
      return [
        ...prev,
        { id: nuevoId, punto: `P${String(nuevoId).padStart(3, '0')}`, norte: '', este: '', elev: '', desc: '' },
      ];
    });
  }, []);

  const exportarCSV = useCallback(() => {
    let csv = 'data:text/csv;charset=utf-8,ID,Punto,Norte,Este,Elevacion,Descripcion\n';
    puntos.forEach(p => { csv += `${p.id},${p.punto},${p.norte},${p.este},${p.elev},${p.desc}\n`; });
    const link = document.createElement('a');
    link.href     = encodeURI(csv);
    link.download = 'puntos_topograficos.csv';
    link.click();
  }, [puntos]);

  const importarCSV = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const lines = (ev.target?.result as string)
          .split(/\r?\n/)
          .filter(l => l.trim());
        const hasHeader = lines[0].toLowerCase().includes('punto');
        const nuevos: Punto[] = lines
          .slice(hasHeader ? 1 : 0)
          .map((line, i) => {
            const cols = line.split(',');
            return {
              id:    i + 1,
              punto: cols[1] ?? `P${i + 1}`,
              norte: cols[2] ?? '',
              este:  cols[3] ?? '',
              elev:  cols[4] ?? '',
              desc:  cols[5] ?? '',
            };
          })
          .filter(p => p.norte || p.este);
        if (!nuevos.length) { alert('El archivo no contiene puntos válidos'); return; }
        setPuntos(nuevos);
        alert(`Se importaron ${nuevos.length} puntos`);
      } catch {
        alert('Error al importar el archivo CSV');
      }
    };
    reader.readAsText(file);
  }, []);

  // ── Fotos ─────────────────────────────────────────────────────────────────
  const handleImageUpload = useCallback(
    (e: ChangeEvent<HTMLInputElement>, tipo: FotoKey | 'logo') => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      if (tipo === 'logo') setLogo(url);
      else setFotos(prev => ({ ...prev, [tipo]: url }));
    },
    []
  );

  const eliminarFoto = useCallback((tipo: FotoKey) => {
    setFotos(prev => ({ ...prev, [tipo]: null }));
  }, []);

  const toggleEquipo = useCallback((item: string) => {
    setEquipo(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  }, []);

  // ── Generación de PDF ─────────────────────────────────────────────────────
  const generarPDF = async (): Promise<void> => {
    const doc        = new jsPDF('p', 'mm', 'a4');
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin     = 15;
    let y            = 20;

    const ahora   = new Date();
    const fecha   = ahora.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora    = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const random  = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const folio   = `BIT-${fecha.replace(/\//g, '-')}-${random}`;

    // Marca de agua
    const aplicarMarcaDeAgua = (pdfDoc: jsPDF): void => {
      if (!logo) return;
      const total = (pdfDoc.internal as unknown as JsPDFInternal).getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        pdfDoc.setPage(i);
        pdfDoc.saveGraphicsState();
        pdfDoc.setGState(new (pdfDoc as unknown as { GState: new (opts: { opacity: number }) => unknown }).GState({ opacity: 0.08 }));
        const [w, h] = [120, 40];
        pdfDoc.addImage(logo, 'PNG', (pageWidth - w) / 2, (pageHeight - h) / 2, w, h);
        pdfDoc.restoreGraphicsState();
      }
    };

    // ── Encabezado ────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('BITÁCORA TÉCNICA TOPOGRÁFICA', margin, y);
    y += 4;
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Folio: ${folio}`,     margin,             y);
    doc.text(`Fecha: ${fecha}`,     pageWidth / 2,       y);
    doc.text(`Hora: ${hora}`,       pageWidth - 50,      y);
    y += 8;

    // ── 1. Datos del proyecto ─────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('1. DATOS DEL PROYECTO', margin, y); y += 4;
    autoTable(doc, {
      startY: y,
      body: [
        ['Proyecto',        formData.proyecto,   'Cliente',   formData.cliente],
        ['Ubicación',       formData.ubicacion,  'Municipio', formData.municipio],
        ['Sistema Coords',  sistemaCoords,       'Clima',     clima],
        ['GPS Lat',         gps.lat || 'N/A',    'GPS Lon',   gps.lon || 'N/A'],
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 }, 2: { fontStyle: 'bold', cellWidth: 35 } },
    });
    y = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;

    // ── 2. Personal y jornada ─────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('2. PERSONAL Y JORNADA', margin, y); y += 4;
    autoTable(doc, {
      startY: y,
      body: [
        ['Jefe de Brigada', formData.jefe,      'Operador',       formData.operador],
        ['Ayudantes',       formData.ayudantes, 'Vehículo',       `${formData.vehiculo} | ${formData.placas}`],
        ['Hora inicio',     formData.hInicio,   'Hora término',   formData.hTermino],
        ['Equipo utilizado',equipo.join(', '),  'Tipo de plano',  tipoPlano],
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 }, 2: { fontStyle: 'bold', cellWidth: 35 } },
    });
    y = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;

    // ── 3. Estación base ──────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('3. DATOS DE ESTACIÓN (BASE)', margin, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Punto ID', 'Alt. Inst. (m)', 'Visado (BS)', 'Alt. Prisma (m)', 'Norte (Y)', 'Este (X)', 'Elevación (Z)']],
      body: [[formData.baseId, formData.altInst, formData.visado, formData.altPrisma, formData.norteB, formData.esteB, formData.elevB || '---']],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', halign: 'center' },
    });
    y = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;

    // ── 4. Tabla de puntos ────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('4. REGISTRO DE PUNTOS / RADIACIONES', margin, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [['#', 'Punto', 'Norte (Y)', 'Este (X)', 'Elev. (Z)', 'Descripción']],
      body: puntos.map((pt, i) => [i + 1, pt.punto, pt.norte, pt.este, pt.elev, pt.desc || '---']),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 35, halign: 'center' },
        3: { cellWidth: 35, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' },
      },
    });
    y = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;

    // Resumen
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(
      `Total de puntos: ${puntos.length}  |  Área cubierta: ${formData.area}  |  Tipo de plano: ${tipoPlano}`,
      margin, y
    );
    y += 6;

    // Observaciones
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Observaciones de campo:', margin, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const notasLines = doc.splitTextToSize(formData.notas || 'Sin observaciones.', pageWidth - margin * 2);
    doc.text(notasLines, margin, y);
    y += notasLines.length * 4 + 8;

    // ── Firmas ────────────────────────────────────────────────────────────
    const topoSig    = !sigPadTopografo.current?.isEmpty() ? sigPadTopografo.current?.getCanvas().toDataURL('image/png') : null;
    const clienteSig = !sigPadCliente.current?.isEmpty()   ? sigPadCliente.current?.getCanvas().toDataURL('image/png')   : null;

    if (y + 50 > pageHeight - 20) { doc.addPage(); y = 20; }

    const sigWidth  = (pageWidth - margin * 2 - 20) / 2;
    const sigStartX = margin + sigWidth + 20;

    if (topoSig)    doc.addImage(topoSig,    'PNG', margin,    y, sigWidth, 30);
    if (clienteSig) doc.addImage(clienteSig, 'PNG', sigStartX, y, sigWidth, 30);

    y += 32;
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + sigWidth, y);
    doc.line(sigStartX, y, sigStartX + sigWidth, y);
    y += 4;
    doc.setFontSize(8);
    doc.text(formData.jefe,                  margin,    y);
    doc.text('Topógrafo / Jefe de Brigada',  margin,    y + 4);
    doc.text('Vo. Bo. Cliente / Supervisor', sigStartX, y);

    // ── Mapa ──────────────────────────────────────────────────────────────
    if (gps.lat && gps.lon && mapRef.current) {
      try {
        const canvas = await html2canvas(mapRef.current, {
          useCORS:    true,
          allowTaint: true,
          scale:      3,
          ignoreElements: el => el.classList.contains('leaflet-control-container'),
        });
        doc.addPage();
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
        doc.text('MAPA DE UBICACIÓN', margin, 20);
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, 30, pageWidth - margin * 2, 100);
      } catch (err) {
        console.warn('No se pudo capturar el mapa:', err);
      }
    }

    // ── Evidencia fotográfica ─────────────────────────────────────────────
    const imagenes = (Object.entries(fotos) as [FotoKey, string | null][]).filter(([, v]) => v !== null) as [FotoKey, string][];
    if (imagenes.length > 0) {
      doc.addPage();
      let yImg = 20;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text('EVIDENCIA FOTOGRÁFICA', margin, yImg);
      yImg += 12;

      const imgW = 80, imgH = 60, gapX = 15, gapY = 22;
      let xPos = margin, contador = 1;

      for (const [tipo, src] of imagenes) {
        if (yImg + imgH > pageHeight - 30) { doc.addPage(); yImg = 20; xPos = margin; }
        doc.rect(xPos - 2, yImg - 2, imgW + 4, imgH + 4);
        try {
          const props = doc.getImageProperties(src);
          const ratio = Math.min(imgW / props.width, imgH / props.height);
          doc.addImage(src, 'JPEG', xPos, yImg, props.width * ratio, props.height * ratio);
        } catch {
          doc.addImage(src, 'PNG', xPos, yImg, imgW, imgH);
        }
        doc.setFontSize(7); doc.setFont('helvetica', 'normal');
        doc.text(`Figura ${contador}. ${tipo}`, xPos, yImg + imgH + 5);
        contador++;
        xPos = xPos + imgW * 2 + gapX <= pageWidth - margin ? xPos + imgW + gapX : margin;
        if (xPos === margin) yImg += imgH + gapY;
      }
    }

    aplicarMarcaDeAgua(doc);
    doc.save(`Bitacora_Topografica_${folio}.pdf`);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* Keyframes GPS */}
      <style>{`
        @keyframes scanline  { 0% { transform: translateY(-150%); } 100% { transform: translateY(200%); } }
        @keyframes radar-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div className="max-w-5xl mx-auto font-sans bg-[#eef2f6] p-4 sm:p-8 space-y-6 text-gray-700">

        {/* ── Logo ──────────────────────────────────────────────────────────── */}
        <div className="flex justify-center mt-4">
          {logo
            ? <img src={logo} alt="Logo" className="h-20 object-contain" />
            : (
              <label className="cursor-pointer flex flex-col items-center gap-1 text-gray-400 border-2 border-dashed rounded-xl p-4 hover:bg-gray-100 transition">
                <FaCamera size={28} />
                <span className="text-xs font-bold uppercase">Subir Logo</span>
                <input type="file" className="hidden" accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'logo')} />
              </label>
            )
          }
        </div>

        <div ref={formRef} className="p-2 space-y-6">

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <header className="relative bg-[#2c3e50] text-white px-8 py-8 rounded-xl border-b-4 border-[#e67e22]">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h1 className="text-3xl font-extrabold tracking-wide">Bitácora Técnica Topográfica</h1>
                <p className="text-[#e67e22] font-bold text-lg mt-1 tracking-widest">FONATUR SOLUCIONES</p>
              </div>
              <div className="text-right text-sm font-mono bg-white/10 px-4 py-2 rounded-xl">
                {currentTime}
              </div>
            </div>
          </header>

          {/* ── Información del Proyecto ─────────────────────────────────────── */}
          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-[#d35400] font-bold mb-4 flex items-center gap-2 uppercase text-sm">
              <FaFolderOpen size={18} /> Información del Proyecto
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [['proyecto', 'Proyecto'], ['cliente', 'Cliente'],
                 ['ubicacion', 'Ubicación'], ['municipio', 'Municipio']] as [keyof FormData, string][]
              ).map(([name, label]) => (
                <div key={name}>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">{label}</label>
                  <input
                    className="w-full p-2.5 bg-[#f8fafc] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-orange-400"
                    name={name}
                    value={formData[name]}
                    onChange={handleInputChange}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ── Mapa + GPS + Clima ───────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-3">
              <FaGlobeAmericas className="text-orange-500" />
              <h2 className="font-bold text-slate-700 uppercase text-sm">Ubicación y Condiciones</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8 p-6">
              {/* Mapa */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
                  <FaMapMarkedAlt className="text-orange-500" />
                  <h3 className="font-bold text-xs uppercase text-slate-600">Mapa de Ubicación</h3>
                </div>
                <div className="h-72">
                  <LeafletMapInline lat={gps.lat} lon={gps.lon} mapRef={mapRef} />
                </div>
              </div>

              {/* Panel GPS + Clima + Sistema */}
              <div className="space-y-5">

                {/* GPS */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-emerald-800 uppercase mb-3">Coordenadas GPS</h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <input value={gps.lat} readOnly placeholder="Latitud"
                      className="p-2.5 rounded-lg border bg-white font-mono text-xs text-center shadow-sm" />
                    <input value={gps.lon} readOnly placeholder="Longitud"
                      className="p-2.5 rounded-lg border bg-white font-mono text-xs text-center shadow-sm" />
                  </div>

                  <button
                    onClick={obtenerUbicacion}
                    disabled={cargandoGps}
                    className={`relative w-full py-3 rounded-xl text-white font-bold flex items-center justify-center overflow-hidden transition-all shadow-lg ${
                      cargandoGps
                        ? 'bg-slate-800 cursor-not-allowed border border-emerald-900/50'
                        : 'bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-emerald-500/30'
                    }`}
                  >
                    {cargandoGps ? (
                      <>
                        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                          <div
                            className="w-full h-12 bg-gradient-to-b from-transparent via-emerald-400/20 to-emerald-400/50 border-b-2 border-emerald-400 shadow-[0_5px_15px_rgba(52,211,152,0.4)]"
                            style={{ animation: 'scanline 1.5s linear infinite' }}
                          />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-32 h-32 border border-emerald-500/20 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                        </div>
                        <div className="relative z-10 flex items-center gap-3">
                          <div className="relative flex items-center justify-center w-6 h-6">
                            <div
                              className="absolute inset-0 border-2 border-transparent border-t-emerald-400 rounded-full opacity-90"
                              style={{ animation: 'radar-spin 0.8s linear infinite' }}
                            />
                            <FaCrosshairs className="text-emerald-300 relative z-10 text-sm" />
                          </div>
                          <span className="animate-pulse tracking-wide font-medium text-emerald-100">
                            Buscando satélites...
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <FaCrosshairs className="mr-2 text-lg" />
                        <span>Capturar Coordenadas</span>
                      </>
                    )}
                  </button>

                  <p className="text-xs text-center mt-3 font-semibold">
                    Precisión:{' '}
                    <span className={parseFloat(gps.precision) > 50 ? 'text-red-600' : 'text-emerald-700'}>
                      {gps.precision}
                    </span>
                  </p>
                </div>

                {/* Clima */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-3">
                    Condiciones Climáticas
                  </label>
                  <div className="flex gap-2">
                    {CLIMA_OPCIONES.map(c => (
                      <button key={c} onClick={() => setClima(c)}
                        className={`flex-1 py-2.5 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                          clima === c ? 'bg-white border-slate-300 shadow text-slate-800' : 'bg-slate-100 border-slate-200 text-slate-400'
                        }`}>
                        {c === 'Soleado' && <FaSun className="text-yellow-500" />}
                        {c === 'Nublado' && <FaCloud className="text-slate-500" />}
                        {c === 'Lluvia'  && <FaUmbrella className="text-blue-500" />}
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sistema de coordenadas */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">
                    Sistema de Coordenadas
                  </label>
                  <select
                    value={sistemaCoords}
                    onChange={(e) => setSistemaCoords(e.target.value as CoordsType)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {COORDS_OPCIONES.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* ── Personal y Jornada ───────────────────────────────────────────── */}
          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-[#d35400] font-bold mb-4 flex items-center gap-2 uppercase text-sm">
              <FaUsers size={18} /> Personal y Jornada
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {(
                [['jefe', 'Jefe de Brigada'], ['operador', 'Operador'], ['ayudantes', 'Ayudantes']] as [keyof FormData, string][]
              ).map(([n, l]) => (
                <div key={n}>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">{l}</label>
                  <input className="w-full p-2.5 bg-[#f8fafc] border border-gray-200 rounded-lg outline-none"
                    name={n} value={formData[n]} onChange={handleInputChange} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Hora Inicio</label>
                <input type="time" className="w-full p-2.5 bg-[#f8fafc] border border-gray-200 rounded-lg outline-none"
                  name="hInicio" value={formData.hInicio} onChange={handleInputChange} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Hora Término</label>
                <input type="time" className="w-full p-2.5 bg-[#f8fafc] border border-gray-200 rounded-lg outline-none"
                  name="hTermino" value={formData.hTermino} onChange={handleInputChange} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Vehículo</label>
                <input className="w-full p-2.5 bg-[#f8fafc] border border-gray-200 rounded-lg outline-none"
                  name="vehiculo" value={formData.vehiculo} onChange={handleInputChange} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Placas</label>
                <input className="w-full p-2.5 bg-[#f8fafc] border border-gray-200 rounded-lg outline-none"
                  name="placas" value={formData.placas} onChange={handleInputChange} />
              </div>
            </div>
          </section>

          {/* ── Datos de Estación (Base) ─────────────────────────────────────── */}
          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-[#d35400] font-bold mb-4 flex items-center gap-2 uppercase text-sm">
              <FaCube size={18} /> Datos de Estación (Base)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {(
                [['baseId', 'Punto ID'], ['altInst', 'Altura Inst.'], ['visado', 'Visado (BS)'], ['altPrisma', 'Alt. Prisma']] as [keyof FormData, string][]
              ).map(([n, l]) => (
                <div key={n}>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">{l}</label>
                  <input className="w-full p-2.5 bg-[#f8fafc] border border-gray-200 rounded-lg outline-none"
                    name={n} value={formData[n]} onChange={handleInputChange} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [['norteB', 'Norte (Y)'], ['esteB', 'Este (X)'], ['elevB', 'Elevación (Z)']] as [keyof FormData, string][]
              ).map(([n, l]) => (
                <div key={n}>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">{l}</label>
                  <input className="w-full p-2.5 bg-[#f8fafc] border border-gray-200 rounded-lg outline-none"
                    name={n} value={formData[n]} onChange={handleInputChange} />
                </div>
              ))}
            </div>
          </section>

                    {/* ── Datos de Estación (Equipo) ─────────────────────────────────────── */}
          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-[#d35400] font-bold mb-4 flex items-center gap-2 uppercase text-sm">
              <FaCube size={18} /> Datos del equipo
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {(
                [['baseId', 'Punto ID'], ['altInst', 'Altura Inst.'], ['visado', 'Visado (BS)'], ['altPrisma', 'Alt. Prisma']] as [keyof FormData, string][]
              ).map(([n, l]) => (
                <div key={n}>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">{l}</label>
                  <input className="w-full p-2.5 bg-[#f8fafc] border border-gray-200 rounded-lg outline-none"
                    name={n} value={formData[n]} onChange={handleInputChange} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [['norteB', 'Norte (Y)'], ['esteB', 'Este (X)'], ['elevB', 'Elevación (Z)']] as [keyof FormData, string][]
              ).map(([n, l]) => (
                <div key={n}>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">{l}</label>
                  <input className="w-full p-2.5 bg-[#f8fafc] border border-gray-200 rounded-lg outline-none"
                    name={n} value={formData[n]} onChange={handleInputChange} />
                </div>
              ))}
            </div>
          </section>

          {/* ── Registro de Puntos ───────────────────────────────────────────── */}
          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-[#d35400] font-bold mb-4 flex items-center gap-2 uppercase text-sm">
              <FaListOl size={18} /> Registro de Puntos / Radiaciones
            </h2>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-center text-sm">
                <thead className="bg-[#2c3e50] text-white text-[10px] uppercase">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Punto</th>
                    <th className="p-3">Norte (Y)</th>
                    <th className="p-3">Este (X)</th>
                    <th className="p-3">Elev (Z)</th>
                    <th className="p-3">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {puntos.map((pt, i) => (
                    <tr key={pt.id} className="border-b bg-white">
                      <td className="p-2 text-gray-500 font-bold">{i + 1}</td>
                      {(['punto', 'norte', 'este', 'elev', 'desc'] as (keyof Omit<Punto, 'id'>)[]).map(f => (
                        <td key={f} className="p-2">
                          <input
                            value={pt[f]}
                            onChange={e => handlePuntoChange(pt.id, f, e.target.value)}
                            className="w-full p-1.5 bg-[#f8fafc] border rounded text-center outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-between items-center mt-4 gap-2">
              <button onClick={agregarFila}
                className="bg-[#1a252f] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition-all">
                ⊕ Agregar Fila
              </button>
              <label className="bg-[#2563eb] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-[#1d4ed8] cursor-pointer">
                <FaFolderOpen /> Importar CSV
                <input type="file" accept=".csv" onChange={importarCSV} className="hidden" />
              </label>
              <button onClick={exportarCSV}
                className="bg-[#10b981] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-[#059669]">
                <FaFileCsv /> Exportar CSV
              </button>
            </div>
          </section>

          {/* ── Resultados y Equipo ──────────────────────────────────────────── */}
          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-[#d35400] font-bold mb-4 flex items-center gap-2 uppercase text-sm">
              <FaChartPie size={18} /> Resultados y Equipo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Área Cubierta</label>
                <input className="w-full p-2.5 bg-[#f8fafc] border border-gray-200 rounded-lg outline-none"
                  name="area" value={formData.area} onChange={handleInputChange} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Total Puntos</label>
                <input className="w-full p-2.5 bg-[#f8fafc] border border-gray-200 rounded-lg"
                  value={puntos.length} readOnly />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Tipo de Plano</label>
                <select
                  value={tipoPlano}
                  onChange={e => setTipoPlano(e.target.value as PlanoType)}
                  className="w-full p-2.5 bg-[#f8fafc] border border-gray-200 rounded-lg text-sm outline-none"
                >
                  {PLANO_OPCIONES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {EQUIPO_OPCIONES.map(item => (
                <label key={item} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer bg-white text-sm">
                  <input type="checkbox" checked={equipo.includes(item)} onChange={() => toggleEquipo(item)}
                    className="w-4 h-4 text-orange-500 rounded" />
                  {item}
                </label>
              ))}
            </div>
          </section>

          {/* ── Evidencia Fotográfica ────────────────────────────────────────── */}
          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-[#d35400] font-bold mb-4 flex items-center gap-2 uppercase text-sm">
              <FaCamera size={18} /> Evidencia Fotográfica y Observaciones
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FOTO_KEYS.map(tipo => (
                <div key={tipo} className="flex flex-col gap-2">
                  <label className="text-xs tracking-wider uppercase text-gray-500 font-semibold">
                    {tipo.replace('Foto', 'Foto ')}
                  </label>
                  <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition h-48 overflow-hidden">
                    {fotos[tipo] ? (
                      <>
                        <img src={fotos[tipo]!} alt={tipo} className="h-full w-full object-contain rounded" />
                        <button onClick={() => eliminarFoto(tipo)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-md transition-colors">
                          <FaTrash size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <FaFolderOpen className="text-gray-400 mb-2" size={32} />
                        <span className="text-sm text-gray-500 font-medium">Subir imagen</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => handleImageUpload(e, tipo)}
                          onClick={e => { (e.currentTarget as HTMLInputElement).value = ''; }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2">
                Observaciones de campo
              </label>
              <textarea
                className="w-full p-3 bg-[#f8fafc] border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-orange-400"
                rows={3}
                name="notas"
                value={formData.notas}
                onChange={handleInputChange}
              />
            </div>
          </section>

          {/* ── Firmas ──────────────────────────────────────────────────────── */}
          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-[#d35400] font-bold mb-4 uppercase text-sm">Firmas de Conformidad</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 py-4">
              {(
                [
                  { ref: sigPadTopografo, label: 'Firma Topógrafo' },
                  { ref: sigPadCliente,   label: 'Firma Cliente / Supervisor' },
                ] as { ref: React.RefObject<SignatureCanvas>; label: string }[]
              ).map(({ ref, label }) => (
                <div key={label} className="text-center">
                  <div className="border-b border-gray-300 bg-gray-50 rounded-lg overflow-hidden">
                    <SignatureCanvas ref={ref} penColor="black"
                      canvasProps={{ className: 'w-full h-32' }} />
                  </div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase mt-2">{label}</p>
                  <button
                    onClick={() => ref.current?.clear()}
                    className="text-red-500 text-[10px] mt-1 flex items-center gap-1 mx-auto hover:text-red-700"
                  >
                    <FaEraser /> Limpiar
                  </button>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="flex flex-col md:flex-row justify-center gap-6 pt-6 border-t">
          <button
            onClick={generarPDF}
            className="px-10 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold shadow-xl hover:scale-105 transition transform flex items-center gap-3"
          >
            <FaFilePdf /> Generar Reporte Profesional
          </button>
          <button
            onClick={() => { if (window.confirm('¿Reiniciar el formulario?')) window.location.reload(); }}
            className="px-8 py-4 rounded-2xl bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition flex items-center gap-2"
          >
            <FaUndo /> Reiniciar
          </button>
        </footer>

      </div>
    </div>
  );
};

export default TopographyForm;
