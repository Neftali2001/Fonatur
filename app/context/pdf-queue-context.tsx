'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// ── Tipos ──────────────────────────────────────────────────────────────────
export interface QueuedForm {
  /** ID del reporte en la BD (para guardar el PDF generado de vuelta) */
  id?: string;
  /** Categoría del formulario: 'ALUMBRADO PÚBLICO' | 'AREAS VERDES' | etc. */
  categoria: string;
  formData: {
    sector: string;
    Tramo: string;
    accesoPublico: string;
    tipoMantenimiento: string;
    [key: string]: any;
  };
  checklist: {
    id: number | string;
    pregunta: string;
    respuesta: string;
    observacion: string;
    seccion?: string;
    foto?: string | null;
    geoRef?: { lat: string; lon: string; precision: string; timestamp: string } | null;
    // Soporte modelo nuevo con múltiples evidencias
    evidence?: Array<{
      id: number;
      observation: string;
      geoRef: { lat: string; lon: string; precision: string; timestamp: string } | null;
      photo: string | null;
    }>;
  }[];
  gps: { lat: string | null; lon: string | null; precision: string };
  fotos: { [key: string]: string | null };
  mapImage: string | null;
  fechaCaptura: Date;
}

interface PDFQueueContextType {
  queue: QueuedForm[];
  addToQueue: (form: QueuedForm) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
}

// ── Contexto ───────────────────────────────────────────────────────────────
const PDFQueueContext = createContext<PDFQueueContextType | null>(null);

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Crea una versión "lite" del formulario sin base64 de fotos para sessionStorage.
 *
 * 🔧 FIX: Las fotos base64 pueden ser 100-500 KB cada una. Con múltiples
 * evidencias el JSON supera rápidamente el límite de 5 MB de sessionStorage,
 * causando un error silencioso y la pérdida de todas las fotos al recargar.
 *
 * Las fotos se conservan SOLO en memoria (React state). El PDF debe
 * generarse en la misma sesión sin recargar la página.
 */
function queueToLite(queue: QueuedForm[]): QueuedForm[] {
  return queue.map(form => ({
    ...form,
    fotos:    {},
    mapImage: null,
    checklist: form.checklist.map(item => ({
      ...item,
      foto: null,
      evidence: item.evidence?.map(ev => ({ ...ev, photo: null })),
    })),
  }));
}

// ── Provider ───────────────────────────────────────────────────────────────
export function PDFQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueuedForm[]>([]);

  // Rehidratar desde sessionStorage al montar.
  // NOTA: Solo se restauran metadatos (sin fotos). Las fotos viven en memoria.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('pdf_queue_meta');
      if (saved) {
        const parsed = JSON.parse(saved);
        const hydrated = parsed.map((f: any) => ({
          ...f,
          fechaCaptura: new Date(f.fechaCaptura),
        }));
        setQueue(hydrated);
      }
    } catch { /* sessionStorage no disponible */ }
  }, []);

  // Persistir en sessionStorage sin fotos (evita superar el límite de ~5 MB).
  // Las fotos permanecen en el estado React mientras la pestaña esté abierta.
  useEffect(() => {
    try {
      const lite = queueToLite(queue);
      sessionStorage.setItem('pdf_queue_meta', JSON.stringify(lite));
    } catch {
      // Si aun así falla (muy raro), limpiar la clave corrupta
      try { sessionStorage.removeItem('pdf_queue_meta'); } catch { /* noop */ }
    }
  }, [queue]);

  const addToQueue = useCallback((form: QueuedForm) => {
    setQueue(prev => [...prev, form]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    try { sessionStorage.removeItem('pdf_queue_meta'); } catch { /* noop */ }
  }, []);

  return (
    <PDFQueueContext.Provider value={{ queue, addToQueue, removeFromQueue, clearQueue }}>
      {children}
    </PDFQueueContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function usePDFQueue() {
  const ctx = useContext(PDFQueueContext);
  if (!ctx) throw new Error('usePDFQueue debe usarse dentro de <PDFQueueProvider>');
  return ctx;
}










// 'use client';

// import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// // ── Tipos ──────────────────────────────────────────────────────────────────
// export interface QueuedForm {
//   /** ID del reporte en la BD (para guardar el PDF generado de vuelta) */
//   id?: string;
//   /** Categoría del formulario: 'ALUMBRADO PÚBLICO' | 'AREAS VERDES' | etc. */
//   categoria: string;
//   formData: {
//     sector: string;
//     Tramo: string;
//     accesoPublico: string;
//     tipoMantenimiento: string;
//     [key: string]: any;
//   };
//   checklist: {
//     id: number | string;  // number para formularios anteriores, string ("1.1") para Alumbrado nuevo
//     pregunta: string;
//     respuesta: string;
//     observacion: string;
//     seccion?: string;
//     foto?: string | null;
//     geoRef?: { lat: string; lon: string; precision: string; timestamp: string } | null;
//   }[];
//   gps: { lat: string | null; lon: string | null; precision: string };
//   fotos: { [key: string]: string | null };
//   mapImage: string | null;
//   fechaCaptura: Date;
// }

// interface PDFQueueContextType {
//   queue: QueuedForm[];
//   addToQueue: (form: QueuedForm) => void;
//   removeFromQueue: (index: number) => void;
//   clearQueue: () => void;
// }

// // ── Contexto ───────────────────────────────────────────────────────────────
// const PDFQueueContext = createContext<PDFQueueContextType | null>(null);

// // ── Provider ───────────────────────────────────────────────────────────────
// export function PDFQueueProvider({ children }: { children: React.ReactNode }) {
//   const [queue, setQueue] = useState<QueuedForm[]>([]);

//   // Rehidratar desde sessionStorage al montar (sobrevive navegación client-side,
//   // pero se limpia al cerrar la pestaña — comportamiento deseado para reportes)
//   useEffect(() => {
//     try {
//       const saved = sessionStorage.getItem('pdf_queue');
//       if (saved) {
//         const parsed = JSON.parse(saved);
//         // Convertir fechas de string a Date
//         const hydrated = parsed.map((f: any) => ({
//           ...f,
//           fechaCaptura: new Date(f.fechaCaptura),
//         }));
//         setQueue(hydrated);
//       }
//     } catch { /* sessionStorage no disponible */ }
//   }, []);

//   // Persistir en sessionStorage cada vez que cambia la cola
//   useEffect(() => {
//     try {
//       sessionStorage.setItem('pdf_queue', JSON.stringify(queue));
//     } catch { /* sessionStorage no disponible */ }
//   }, [queue]);

//   const addToQueue = useCallback((form: QueuedForm) => {
//     setQueue(prev => [...prev, form]);
//   }, []);

//   const removeFromQueue = useCallback((index: number) => {
//     setQueue(prev => prev.filter((_, i) => i !== index));
//   }, []);

//   const clearQueue = useCallback(() => {
//     setQueue([]);
//     try { sessionStorage.removeItem('pdf_queue'); } catch { /* */ }
//   }, []);

//   return (
//     <PDFQueueContext.Provider value={{ queue, addToQueue, removeFromQueue, clearQueue }}>
//       {children}
//     </PDFQueueContext.Provider>
//   );
// }

// // ── Hook ───────────────────────────────────────────────────────────────────
// export function usePDFQueue() {
//   const ctx = useContext(PDFQueueContext);
//   if (!ctx) throw new Error('usePDFQueue debe usarse dentro de <PDFQueueProvider>');
//   return ctx;
// }





// 'use client';

// import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// // ── Tipos ──────────────────────────────────────────────────────────────────
// export interface QueuedForm {
//   /** ID del reporte en la BD (para guardar el PDF generado de vuelta) */
//   id?: string;
//   /** Categoría del formulario: 'ALUMBRADO PÚBLICO' | 'AREAS VERDES' | etc. */
//   categoria: string;
//   formData: {
//     sector: string;
//     Tramo: string;
//     accesoPublico: string;
//     tipoMantenimiento: string;
//     [key: string]: any;
//   };
//   checklist: {
//     id: number;
//     pregunta: string;
//     respuesta: string;
//     observacion: string;
//     geoRef?: { lat: string; lon: string; precision: string; timestamp: string } | null;
//   }[];
//   gps: { lat: string | null; lon: string | null; precision: string };
//   fotos: { [key: string]: string | null };
//   mapImage: string | null;
//   fechaCaptura: Date;
// }

// interface PDFQueueContextType {
//   queue: QueuedForm[];
//   addToQueue: (form: QueuedForm) => void;
//   removeFromQueue: (index: number) => void;
//   clearQueue: () => void;
// }

// // ── Contexto ───────────────────────────────────────────────────────────────
// const PDFQueueContext = createContext<PDFQueueContextType | null>(null);

// // ── Provider ───────────────────────────────────────────────────────────────
// export function PDFQueueProvider({ children }: { children: React.ReactNode }) {
//   const [queue, setQueue] = useState<QueuedForm[]>([]);

//   // Rehidratar desde sessionStorage al montar (sobrevive navegación client-side,
//   // pero se limpia al cerrar la pestaña — comportamiento deseado para reportes)
//   useEffect(() => {
//     try {
//       const saved = sessionStorage.getItem('pdf_queue');
//       if (saved) {
//         const parsed = JSON.parse(saved);
//         // Convertir fechas de string a Date
//         const hydrated = parsed.map((f: any) => ({
//           ...f,
//           fechaCaptura: new Date(f.fechaCaptura),
//         }));
//         setQueue(hydrated);
//       }
//     } catch { /* sessionStorage no disponible */ }
//   }, []);

//   // Persistir en sessionStorage cada vez que cambia la cola
//   useEffect(() => {
//     try {
//       sessionStorage.setItem('pdf_queue', JSON.stringify(queue));
//     } catch { /* sessionStorage no disponible */ }
//   }, [queue]);

//   const addToQueue = useCallback((form: QueuedForm) => {
//     setQueue(prev => [...prev, form]);
//   }, []);

//   const removeFromQueue = useCallback((index: number) => {
//     setQueue(prev => prev.filter((_, i) => i !== index));
//   }, []);

//   const clearQueue = useCallback(() => {
//     setQueue([]);
//     try { sessionStorage.removeItem('pdf_queue'); } catch { /* */ }
//   }, []);

//   return (
//     <PDFQueueContext.Provider value={{ queue, addToQueue, removeFromQueue, clearQueue }}>
//       {children}
//     </PDFQueueContext.Provider>
//   );
// }

// // ── Hook ───────────────────────────────────────────────────────────────────
// export function usePDFQueue() {
//   const ctx = useContext(PDFQueueContext);
//   if (!ctx) throw new Error('usePDFQueue debe usarse dentro de <PDFQueueProvider>');
//   return ctx;
// }



// 'use client';

// import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// // ── Tipos ──────────────────────────────────────────────────────────────────
// export interface QueuedForm {
//   /** Categoría del formulario: 'ALUMBRADO PÚBLICO' | 'AREAS VERDES' | etc. */
//   categoria: string;
//   formData: {
//     sector: string;
//     Tramo: string;
//     accesoPublico: string;
//     tipoMantenimiento: string;
//     [key: string]: any;
//   };
//   checklist: {
//     id: number;
//     pregunta: string;
//     respuesta: string;
//     observacion: string;
//     geoRef?: { lat: string; lon: string; precision: string; timestamp: string } | null;
//   }[];
//   gps: { lat: string | null; lon: string | null; precision: string };
//   fotos: { [key: string]: string | null };
//   mapImage: string | null;
//   fechaCaptura: Date;
// }

// interface PDFQueueContextType {
//   queue: QueuedForm[];
//   addToQueue: (form: QueuedForm) => void;
//   removeFromQueue: (index: number) => void;
//   clearQueue: () => void;
// }

// // ── Contexto ───────────────────────────────────────────────────────────────
// const PDFQueueContext = createContext<PDFQueueContextType | null>(null);

// // ── Provider ───────────────────────────────────────────────────────────────
// export function PDFQueueProvider({ children }: { children: React.ReactNode }) {
//   const [queue, setQueue] = useState<QueuedForm[]>([]);

//   // Rehidratar desde sessionStorage al montar (sobrevive navegación client-side,
//   // pero se limpia al cerrar la pestaña — comportamiento deseado para reportes)
//   useEffect(() => {
//     try {
//       const saved = sessionStorage.getItem('pdf_queue');
//       if (saved) {
//         const parsed = JSON.parse(saved);
//         // Convertir fechas de string a Date
//         const hydrated = parsed.map((f: any) => ({
//           ...f,
//           fechaCaptura: new Date(f.fechaCaptura),
//         }));
//         setQueue(hydrated);
//       }
//     } catch { /* sessionStorage no disponible */ }
//   }, []);

//   // Persistir en sessionStorage cada vez que cambia la cola
//   useEffect(() => {
//     try {
//       sessionStorage.setItem('pdf_queue', JSON.stringify(queue));
//     } catch { /* sessionStorage no disponible */ }
//   }, [queue]);

//   const addToQueue = useCallback((form: QueuedForm) => {
//     setQueue(prev => [...prev, form]);
//   }, []);

//   const removeFromQueue = useCallback((index: number) => {
//     setQueue(prev => prev.filter((_, i) => i !== index));
//   }, []);

//   const clearQueue = useCallback(() => {
//     setQueue([]);
//     try { sessionStorage.removeItem('pdf_queue'); } catch { /* */ }
//   }, []);

//   return (
//     <PDFQueueContext.Provider value={{ queue, addToQueue, removeFromQueue, clearQueue }}>
//       {children}
//     </PDFQueueContext.Provider>
//   );
// }

// // ── Hook ───────────────────────────────────────────────────────────────────
// export function usePDFQueue() {
//   const ctx = useContext(PDFQueueContext);
//   if (!ctx) throw new Error('usePDFQueue debe usarse dentro de <PDFQueueProvider>');
//   return ctx;
// }
