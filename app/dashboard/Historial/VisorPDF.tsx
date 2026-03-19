'use client';

import { useState, useEffect, useRef } from 'react';
import { FaFilePdf, FaTimes, FaDownload, FaExpand } from 'react-icons/fa';

interface VisorPDFProps {
  pdfBase64: string;   // data URI completa: "data:application/pdf;base64,..."
  folio: string;
}

export default function VisorPDF({ pdfBase64, folio }: VisorPDFProps) {
  const [abierto, setAbierto] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  // Crear Blob URL al abrir (evita problemas con data: URIs en Safari/Firefox)
  useEffect(() => {
    if (!abierto || blobUrl) return;
    try {
      const base64 = pdfBase64.split(',')[1];
      const bytes   = atob(base64);
      const arr     = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      urlRef.current = url;
      setBlobUrl(url);
    } catch { /* fallback: usar data URI directo */ setBlobUrl(pdfBase64); }
  }, [abierto, pdfBase64, blobUrl]);

  // Limpiar Blob URL al desmontar
  useEffect(() => {
    return () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, []);

  const handleCerrar = () => { setAbierto(false); };

  const handleDescargar = () => {
    const a = document.createElement('a');
    a.href = blobUrl ?? pdfBase64;
    a.download = `${folio}.pdf`;
    a.click();
  };

  return (
    <>
      {/* ── Botón en la fila del historial ── */}
      <button
        onClick={() => setAbierto(true)}
        className="p-2 md:p-2.5 text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
        title="Ver PDF"
      >
        <FaFilePdf size={16} />
      </button>

      {/* ── Modal ── */}
      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) handleCerrar(); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col"
               style={{ height: 'min(90vh, 860px)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <FaFilePdf className="text-orange-500" size={18} />
                <span className="font-bold text-slate-700 text-sm truncate max-w-xs">{folio}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={blobUrl ?? pdfBase64}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Abrir en nueva pestaña"
                >
                  <FaExpand size={11} /> Nueva pestaña
                </a>
                <button
                  onClick={handleDescargar}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
                >
                  <FaDownload size={11} /> Descargar
                </button>
                <button
                  onClick={handleCerrar}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FaTimes size={16} />
                </button>
              </div>
            </div>

            {/* PDF iframe */}
            <div className="flex-1 bg-gray-100 rounded-b-2xl overflow-hidden">
              {blobUrl ? (
                <iframe
                  src={blobUrl}
                  className="w-full h-full border-0"
                  title={`PDF ${folio}`}
                />
              ) : (
                <div className="flex items-center justify-center h-full gap-3 text-slate-400">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  <span className="text-sm font-medium">Cargando PDF…</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
