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
    id: number;
    pregunta: string;
    respuesta: string;
    observacion: string;
    geoRef?: { lat: string; lon: string; precision: string; timestamp: string } | null;
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

// ── Provider ───────────────────────────────────────────────────────────────
export function PDFQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueuedForm[]>([]);

  // Rehidratar desde sessionStorage al montar (sobrevive navegación client-side,
  // pero se limpia al cerrar la pestaña — comportamiento deseado para reportes)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('pdf_queue');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convertir fechas de string a Date
        const hydrated = parsed.map((f: any) => ({
          ...f,
          fechaCaptura: new Date(f.fechaCaptura),
        }));
        setQueue(hydrated);
      }
    } catch { /* sessionStorage no disponible */ }
  }, []);

  // Persistir en sessionStorage cada vez que cambia la cola
  useEffect(() => {
    try {
      sessionStorage.setItem('pdf_queue', JSON.stringify(queue));
    } catch { /* sessionStorage no disponible */ }
  }, [queue]);

  const addToQueue = useCallback((form: QueuedForm) => {
    setQueue(prev => [...prev, form]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    try { sessionStorage.removeItem('pdf_queue'); } catch { /* */ }
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
