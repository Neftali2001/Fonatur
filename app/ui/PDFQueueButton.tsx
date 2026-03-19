'use client';

import React, { useState } from 'react';
import { FaFilePdf, FaTrash, FaChevronUp, FaChevronDown } from 'react-icons/fa';
import { usePDFQueue } from '../../app/context/pdf-queue-context';
import { generarPDFCombinado } from '../lib/generarPDFCombinado';

// Colores por categoría
const CATEGORIA_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'ALUMBRADO PÚBLICO':  { bg: 'bg-yellow-50',  text: 'text-yellow-700',  dot: 'bg-yellow-400'  },
  'AREAS VERDES':       { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  'BARRIDO VIALIDADES': { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400'    },
  'LIMPIEZA URBANA':    { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-400'  },
};

const defaultColor = { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-400' };

export default function PDFQueueButton() {
  const { queue, removeFromQueue, clearQueue } = usePDFQueue();
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);

  if (queue.length === 0) return null;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generarPDFCombinado(queue);
      clearQueue();
      setExpanded(false);
    } catch (err) {
      console.error(err);
      alert('Error al generar el PDF combinado.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">

      {/* ── Panel expandible ── */}
      {expanded && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <FaFilePdf className="text-orange-400" />
              <span>Cola de PDF ({queue.length})</span>
            </div>
            <button onClick={clearQueue} className="text-slate-400 hover:text-red-400 transition-colors" title="Vaciar cola">
              <FaTrash size={13} />
            </button>
          </div>

          {/* Lista de formularios */}
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
            {queue.map((form, idx) => {
              const color = CATEGORIA_COLORS[form.categoria] ?? defaultColor;
              const fecha = form.fechaCaptura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
              const hora  = form.fechaCaptura.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={idx} className={`flex items-center gap-3 px-4 py-3 ${color.bg}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${color.text}`}>{form.categoria}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {form.formData.sector || '—'} · {fecha} {hora}
                    </p>
                  </div>
                  <button onClick={() => removeFromQueue(idx)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                    <FaTrash size={11} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Generar */}
          <div className="p-3 bg-gray-50 border-t border-gray-100">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {generating ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Generando…
                </>
              ) : (
                <>
                  <FaFilePdf />
                  Generar PDF combinado
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Botón flotante principal ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="relative flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl shadow-2xl transition-all duration-200 font-bold text-sm"
      >
        {/* Badge con conteo */}
        <span className="absolute -top-2 -left-2 w-5 h-5 bg-orange-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow">
          {queue.length}
        </span>

        <FaFilePdf className="text-orange-400 text-base" />
        <span className="hidden sm:block">Cola PDF</span>
        {expanded ? <FaChevronDown size={11} /> : <FaChevronUp size={11} />}
      </button>
    </div>
  );
}
