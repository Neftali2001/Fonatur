'use client';

// app/dashboard/Historial/GenerarPDFLote.tsx
//
// Botón que genera un PDF combinado con los reportes actualmente filtrados.
// Llama a POST /api/generar-pdf-lote con los IDs visibles.

import { useState } from 'react';
import { FaFilePdf, FaSpinner } from 'react-icons/fa';

interface Props {
  ids:         string[];   // IDs de los reportes filtrados (máx. page actual)
  totalCount:  number;     // total de registros filtrados (puede superar la página)
  titulo?:     string;
}

export default function GenerarPDFLote({ ids, totalCount, titulo }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  if (ids.length === 0) return null;

  // Aviso estimado de tiempo para lotes grandes
  const esLote = ids.length > 30;

  const handleGenerar = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generar-pdf-lote', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ids, titulo: titulo ?? 'REPORTE COMBINADO – CIP ACAPULCO-COYUCA' }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Error ${res.status}`);
      }

      // Disparar descarga del PDF
      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const filename = `LOTE-${new Date().toISOString().slice(0, 10)}.pdf`;
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message ?? 'Error al generar el PDF.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <button
        onClick={handleGenerar}
        disabled={loading}
        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors shadow-sm whitespace-nowrap min-w-[180px]"
      >
        {loading
          ? <><FaSpinner className="animate-spin" size={13} /> Generando…</>
          : <><FaFilePdf size={13} /> PDF de {ids.length} reporte{ids.length !== 1 ? 's' : ''}</>
        }
      </button>
      {loading && esLote && (
        <p className="text-[10px] text-emerald-600 text-right">
          ⏳ Lotes grandes pueden tardar hasta 60 s…
        </p>
      )}
      {error && (
        <p className="text-[11px] text-red-600 font-semibold text-right">{error}</p>
      )}
    </div>
  );
}
