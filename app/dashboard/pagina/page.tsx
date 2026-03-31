'use client';

import React, { useState, useMemo } from 'react';
import { 
  FaFolder, FaFolderOpen, FaFilePdf, FaSearch, FaCalendarAlt, 
  FaPlus, FaUpload, FaArrowLeft, FaTrash, FaDownload, FaEye
} from 'react-icons/fa';

// ═══════════════════════════════════════════════════════════
//  INTERFACES
// ═══════════════════════════════════════════════════════════
interface Carpeta {
  id: string;
  nombre: string;
  fechaCreacion: string;
}

interface ArchivoPDF {
  id: string;
  carpetaId: string;
  nombre: string;
  fecha: string;
  tamano: string;
}

// ═══════════════════════════════════════════════════════════
//  DATOS MOCK (Simulando tu Base de Datos)
// ═══════════════════════════════════════════════════════════
const CARPETAS_INICIALES: Carpeta[] = [
  { id: 'c1', nombre: 'Acuses de Obra - Zona Norte', fechaCreacion: '2026-03-01' },
  { id: 'c2', nombre: 'Estimaciones Marzo 2026', fechaCreacion: '2026-03-15' },
];

const ARCHIVOS_INICIALES: ArchivoPDF[] = [
  { id: 'a1', carpetaId: 'c1', nombre: 'Acuse_Entrega_Materiales.pdf', fecha: '2026-03-05', tamano: '1.2 MB' },
  { id: 'a2', carpetaId: 'c1', nombre: 'Reporte_Supervision_Semana1.pdf', fecha: '2026-03-10', tamano: '2.4 MB' },
  { id: 'a3', carpetaId: 'c2', nombre: 'Factura_Proveedores_001.pdf', fecha: '2026-03-16', tamano: '0.8 MB' },
];

// ═══════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function GestorArchivosGeneral() {
  // ── Estados ──
  const [carpetas, setCarpetas] = useState<Carpeta[]>(CARPETAS_INICIALES);
  const [archivos, setArchivos] = useState<ArchivoPDF[]>(ARCHIVOS_INICIALES);
  
  const [carpetaActual, setCarpetaActual] = useState<Carpeta | null>(null);
  
  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');

  // Modales UI (Simulados con estado)
  const [mostrarModalCarpeta, setMostrarModalCarpeta] = useState(false);
  const [nuevaCarpetaNombre, setNuevaCarpetaNombre] = useState('');

  // ── Lógica de Filtrado ──
  const elementosFiltrados = useMemo(() => {
    if (!carpetaActual) {
      // Estamos en la raíz, filtramos carpetas
      return carpetas.filter(c => {
        const matchNombre = c.nombre.toLowerCase().includes(busqueda.toLowerCase());
        const matchFecha = filtroFecha ? c.fechaCreacion === filtroFecha : true;
        return matchNombre && matchFecha;
      });
    } else {
      // Estamos dentro de una carpeta, filtramos archivos
      return archivos.filter(a => {
        const matchCarpeta = a.carpetaId === carpetaActual.id;
        const matchNombre = a.nombre.toLowerCase().includes(busqueda.toLowerCase());
        const matchFecha = filtroFecha ? a.fecha === filtroFecha : true;
        return matchCarpeta && matchNombre && matchFecha;
      });
    }
  }, [carpetas, archivos, carpetaActual, busqueda, filtroFecha]);

  // ── Handlers (Acciones) ──
  const crearCarpeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaCarpetaNombre.trim()) return;
    
    const nueva: Carpeta = {
      id: `c_${Date.now()}`,
      nombre: nuevaCarpetaNombre,
      fechaCreacion: new Date().toISOString().split('T')[0] // Formato YYYY-MM-DD
    };
    setCarpetas([...carpetas, nueva]);
    setNuevaCarpetaNombre('');
    setMostrarModalCarpeta(false);
  };

  const subirArchivoFake = () => {
    if (!carpetaActual) return;
    // Aquí iría tu lógica real de <input type="file" /> y subida a tu backend/S3
    const nombreFicticio = prompt('Simulación: Ingresa el nombre del PDF a subir:');
    if (!nombreFicticio) return;

    const nuevoArchivo: ArchivoPDF = {
      id: `a_${Date.now()}`,
      carpetaId: carpetaActual.id,
      nombre: nombreFicticio.endsWith('.pdf') ? nombreFicticio : `${nombreFicticio}.pdf`,
      fecha: new Date().toISOString().split('T')[0],
      tamano: `${(Math.random() * 5 + 0.1).toFixed(1)} MB`
    };
    setArchivos([...archivos, nuevoArchivo]);
  };

  const eliminarCarpeta = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Evita que al hacer clic en eliminar, se abra la carpeta
    if (window.confirm('¿Eliminar carpeta y TODOS los PDFs en su interior?')) {
      setCarpetas(carpetas.filter(c => c.id !== id));
      setArchivos(archivos.filter(a => a.carpetaId !== id));
    }
  };

  const eliminarArchivo = (id: string) => {
    if (window.confirm('¿Eliminar este PDF permanentemente?')) {
      setArchivos(archivos.filter(a => a.id !== id));
    }
  };

  // ── Renderizado ──
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        
        {/* ENCABEZADO Y BREADCRUMB */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-slate-800 mb-4">
            <FaFolderOpen className="text-blue-600" />
            Gestor de Archivos
          </h1>

          <div className="flex items-center gap-2 text-sm md:text-base text-slate-600 bg-white p-3 rounded-lg shadow-sm border border-slate-200">
            <button 
              onClick={() => { setCarpetaActual(null); setBusqueda(''); setFiltroFecha(''); }}
              className={`hover:text-blue-600 font-medium transition-colors ${!carpetaActual ? 'text-blue-600' : ''}`}
            >
              Mi Unidad
            </button>
            {carpetaActual && (
              <>
                <span className="text-slate-400">/</span>
                <span className="font-semibold text-slate-800 flex items-center gap-2">
                  <FaFolder className="text-blue-500" />
                  {carpetaActual.nombre}
                </span>
              </>
            )}
          </div>
        </div>

        {/* BARRA DE HERRAMIENTAS (Buscador, Filtros y Botones de Acción) */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-4 justify-between items-center">
          
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto flex-1">
            {/* Buscador */}
            <div className="relative flex-1 max-w-md">
              <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
              <input 
                type="text"
                placeholder={carpetaActual ? "Buscar archivo PDF..." : "Buscar carpeta..."}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            {/* Filtro de Fecha */}
            <div className="relative">
              <FaCalendarAlt className="absolute left-3 top-3.5 text-slate-400" />
              <input 
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-600"
              />
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex gap-3 w-full md:w-auto">
            {!carpetaActual ? (
              <button 
                onClick={() => setMostrarModalCarpeta(true)}
                className="flex items-center justify-center gap-2 w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
              >
                <FaPlus /> Nueva Carpeta
              </button>
            ) : (
              <button 
                onClick={subirArchivoFake}
                className="flex items-center justify-center gap-2 w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
              >
                <FaUpload /> Subir PDF
              </button>
            )}
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL (Grid responsive) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          
          {/* VISTA DE CARPETAS (Si estamos en la raíz) */}
          {!carpetaActual && (elementosFiltrados as Carpeta[]).map((carpeta) => (
            <div 
              key={carpeta.id}
              onClick={() => { setCarpetaActual(carpeta); setBusqueda(''); setFiltroFecha(''); }}
              className="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group relative flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-3">
                <FaFolder className="text-4xl text-blue-400 group-hover:text-blue-500 transition-colors" />
                <button 
                  onClick={(e) => eliminarCarpeta(carpeta.id, e)}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Eliminar carpeta"
                >
                  <FaTrash />
                </button>
              </div>
              <h3 className="font-semibold text-slate-800 text-lg mb-1 truncate line-clamp-2 leading-tight">
                {carpeta.nombre}
              </h3>
              <p className="text-sm text-slate-500 mt-auto pt-2 flex items-center gap-2">
                <FaCalendarAlt className="text-slate-400" />
                {carpeta.fechaCreacion}
              </p>
            </div>
          ))}

          {/* VISTA DE ARCHIVOS (Si estamos dentro de una carpeta) */}
          {carpetaActual && (elementosFiltrados as ArchivoPDF[]).map((archivo) => (
            <div 
              key={archivo.id}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all group flex flex-col h-full"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="bg-red-50 p-3 rounded-lg text-red-500">
                  <FaFilePdf className="text-3xl" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-800 text-sm truncate" title={archivo.nombre}>
                    {archivo.nombre}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">{archivo.tamano}</p>
                </div>
              </div>
              
              <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">{archivo.fecha}</span>
                <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Ver">
                    <FaEye />
                  </button>
                  <button className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Descargar">
                    <FaDownload />
                  </button>
                  <button onClick={() => eliminarArchivo(archivo.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Eliminar">
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* ESTADO VACÍO */}
          {elementosFiltrados.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
              {!carpetaActual ? <FaFolderOpen className="text-6xl mb-4 text-slate-200" /> : <FaFilePdf className="text-6xl mb-4 text-slate-200" />}
              <p className="text-lg font-medium text-slate-500">
                {busqueda || filtroFecha ? 'No se encontraron resultados' : (carpetaActual ? 'Esta carpeta está vacía' : 'Aún no hay carpetas creadas')}
              </p>
              <p className="text-sm mt-1">
                {busqueda || filtroFecha ? 'Intenta borrar los filtros de búsqueda.' : (carpetaActual ? 'Haz clic en "Subir PDF" para comenzar.' : 'Crea tu primera carpeta para organizar tus documentos.')}
              </p>
            </div>
          )}
        </div>

      </div>

      {/* MODAL NUEVA CARPETA (Simplificado) */}
      {mostrarModalCarpeta && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FaFolder className="text-blue-500" /> Crear Nueva Carpeta
            </h2>
            <form onSubmit={crearCarpeta}>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la carpeta</label>
              <input 
                type="text"
                autoFocus
                required
                placeholder="Ej. Proyecto Central, Estimaciones, etc."
                value={nuevaCarpetaNombre}
                onChange={(e) => setNuevaCarpetaNombre(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-6"
              />
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => { setMostrarModalCarpeta(false); setNuevaCarpetaNombre(''); }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  Crear Carpeta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}







// 'use client';

// import React, { useState } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { Heart, Sparkles, Ban } from 'lucide-react';

// export default function LovePageMobile() {
//   const [accepted, setAccepted] = useState(false);
//   const [yesScale, setYesScale] = useState(1);
//   const [noCount, setNoCount] = useState(0);

//   // Mensajes que cambian mientras el botón SÍ invade la pantalla
//   const getNoText = () => {
//     const phrases = [
//       "No...",
//       "¿Segura?",
//       "Piénsalo bien...",
//       "¿En serio? 🤨",
//       "¡Intenta otra vez!",
//       "Casi lo tienes...",
//       "Ya no hay espacio para el No"
//     ];
//     return phrases[Math.min(noCount, phrases.length - 1)];
//   };

//   const handleNoInteraction = () => {
//     setNoCount(prev => prev + 1);
//     // Crecimiento exponencial: 1.5 -> 2.5 -> 4.5 -> 8...
//     setYesScale(prev => prev + (prev * 0.8) + 1);
//   };

//   return (
//     <div className="fixed inset-0 bg-[#fff5f7] flex items-center justify-center p-6 overflow-hidden touch-none font-sans">
//       <AnimatePresence mode="wait">
//         {!accepted ? (
//           <motion.div 
//             key="question-box"
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             exit={{ opacity: 0, scale: 0.5 }}
//             className="w-full max-w-sm text-center z-10"
//           >
//             {/* Cabecera Creativa */}
//             <div className="mb-8">
//               <motion.div
//                 animate={{ scale: [1, 1.1, 1] }}
//                 transition={{ repeat: Infinity, duration: 2 }}
//                 className="inline-block bg-rose-500 p-4 rounded-3xl shadow-lg mb-4"
//               >
//                 <Heart className="text-white w-10 h-10 fill-current" />
//               </motion.div>
//               <h2 className="text-rose-400 font-bold tracking-[0.3em] text-[10px] uppercase mb-2">Petición Especial</h2>
//               <h1 className="text-4xl font-black text-slate-800 leading-tight">
//                 ¿Quieres salir <br/> a comer?
//               </h1>
//             </div>

//             <div className="flex flex-col gap-4 items-center justify-center min-h-[300px] relative">
              
//               {/* BOTÓN SÍ: El invasor de pantalla */}
//               <motion.button
//                 onClick={() => setAccepted(true)}
//                 animate={{ 
//                   scale: yesScale,
//                   boxShadow: yesScale > 1 ? "0 20px 50px rgba(225, 29, 72, 0.3)" : "0 10px 20px rgba(225, 29, 72, 0.1)"
//                 }}
//                 transition={{ type: "spring", stiffness: 200, damping: 25 }}
//                 className="z-50 bg-rose-500 text-white px-12 py-5 rounded-2xl font-black text-2xl flex items-center gap-3 whitespace-nowrap overflow-hidden"
//               >
//                 {yesScale > 10 ? <Heart className="fill-current w-8 h-8 animate-pulse" /> : "¡SÍ!"}
//                 {yesScale < 5 && <Sparkles className="w-6 h-6" />}
//               </motion.button>

//               {/* BOTÓN NO: La víctima */}
//               <motion.button
//                 onPointerDown={handleNoInteraction} // Mejor que onClick para móviles
//                 animate={{ 
//                   opacity: Math.max(0.1, 1 - noCount * 0.2),
//                   scale: Math.max(0.5, 1 - noCount * 0.1),
//                   y: noCount > 0 ? 20 : 0
//                 }}
//                 className="z-0 bg-slate-200 text-slate-500 px-8 py-4 rounded-xl font-bold text-lg flex items-center gap-2"
//               >
//                 <Ban className="w-4 h-4" />
//                 {getNoText()}
//               </motion.button>
//             </div>

//             <p className="mt-8 text-[10px] text-slate-400 font-medium uppercase tracking-widest">
//               Protocolo de Invasión Romántica Activo
//             </p>
//           </motion.div>
//         ) : (
//           <motion.div 
//             key="success-screen"
//             initial={{ scale: 0 }}
//             animate={{ scale: 1 }}
//             className="fixed inset-0 bg-rose-500 flex flex-col items-center justify-center p-10 z-[100] text-center"
//           >
//             <motion.div
//               animate={{ 
//                 rotate: [0, 10, -10, 0],
//                 scale: [1, 1.2, 1]
//               }}
//               transition={{ repeat: Infinity, duration: 1 }}
//             >
//               <Heart className="text-white w-32 h-32 fill-current mb-6 drop-shadow-2xl" />
//             </motion.div>
//             <h1 className="text-white text-5xl font-black mb-4 italic tracking-tighter">¡LO SABÍA! 💖</h1>
//             <p className="text-rose-100 text-xl font-light">Fue la decisión más fácil, ¿verdad?</p>
            
//             <motion.div 
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               transition={{ delay: 1 }}
//               className="mt-12 text-white/50 text-[10px] uppercase tracking-widest"
//             >
//               A comel
//             </motion.div>
//           </motion.div>
//         )}
//       </AnimatePresence>

//       {/* Decoración de fondo */}
//       <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
//         <div className="absolute top-10 left-10 rotate-12 text-rose-300"><Heart /></div>
//         <div className="absolute bottom-20 right-10 -rotate-12 text-rose-300"><Heart /></div>
//         <div className="absolute top-1/2 left-5 text-rose-300"><Sparkles /></div>
//       </div>
//     </div>
//   );
// }