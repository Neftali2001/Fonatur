'use client';

import { useState, useTransition } from 'react';
import { FaTrash, FaCalendarAlt, FaChevronDown, FaExclamationTriangle } from 'react-icons/fa';
import { eliminarReportesPorFecha } from '@/app/lib/actions';

interface FechaItem { fecha: string; total: number; }

interface BorrarPorFechaProps {
  /** Lista precargada desde el servidor: [{ fecha: "YYYY-MM-DD", total: N }] */
  fechas: FechaItem[];
}

// Formatea "YYYY-MM-DD" → "Lunes 23 de junio 2025"
function formatearFecha(ymd: string): string {
  try {
    // Parsear como UTC para evitar desplazamientos de zona
    const [y, m, d] = ymd.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString('es-MX', {
      timeZone: 'UTC',
      weekday: 'long',
      day:     'numeric',
      month:   'long',
      year:    'numeric',
    });
  } catch { return ymd; }
}

export default function BorrarPorFecha({ fechas: fechasIniciales }: BorrarPorFechaProps) {
  const [abierto,         setAbierto]         = useState(false);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [confirmando,     setConfirmando]     = useState(false);
  const [resultado,       setResultado]       = useState<{ ok: boolean; msg: string } | null>(null);
  const [fechas,          setFechas]          = useState<FechaItem[]>(fechasIniciales);
  const [isPending,       startTransition]    = useTransition();

  const itemSeleccionado = fechas.find(f => f.fecha === fechaSeleccionada);

  const handleEliminar = () => {
    if (!fechaSeleccionada) return;
    setConfirmando(false);
    setResultado(null);

    startTransition(async () => {
      try {
        const eliminados = await eliminarReportesPorFecha(fechaSeleccionada);
        setResultado({
          ok:  true,
          msg: `Se eliminaron ${eliminados} reporte${eliminados !== 1 ? 's' : ''} del ${formatearFecha(fechaSeleccionada)}.`,
        });
        // Quitar la fecha de la lista local (ya no hay reportes ese día)
        setFechas(prev => prev.filter(f => f.fecha !== fechaSeleccionada));
        setFechaSeleccionada('');
      } catch (err: any) {
        setResultado({ ok: false, msg: err?.message ?? 'Error al eliminar los reportes.' });
      }
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

      {/* ── Encabezado colapsable ───────────────────────── */}
      <button
        type="button"
        onClick={() => { setAbierto(v => !v); setResultado(null); setConfirmando(false); }}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
            <FaTrash className="text-red-500" size={13} />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-800">Borrar reportes por fecha</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Elimina todos los reportes creados en un día específico
            </p>
          </div>
        </div>
        <FaChevronDown
          className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${abierto ? 'rotate-180' : ''}`}
          size={13}
        />
      </button>

      {/* ── Contenido ───────────────────────────────────── */}
      {abierto && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">

          {fechas.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              No hay reportes registrados.
            </p>
          ) : (
            <>
              {/* Selector de fecha */}
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                  Selecciona una fecha
                </label>
                <div className="relative">
                  <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                  <select
                    value={fechaSeleccionada}
                    onChange={e => { setFechaSeleccionada(e.target.value); setConfirmando(false); setResultado(null); }}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400/40 appearance-none"
                  >
                    <option value="">— Elige una fecha —</option>
                    {fechas.map(f => (
                      <option key={f.fecha} value={f.fecha}>
                        {formatearFecha(f.fecha)}
                        {' '}({f.total} reporte{f.total !== 1 ? 's' : ''})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Resumen del lote seleccionado */}
              {itemSeleccionado && !confirmando && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
                  <FaExclamationTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={14} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-700">
                      Se eliminarán {itemSeleccionado.total} reporte{itemSeleccionado.total !== 1 ? 's' : ''}
                    </p>
                    <p className="text-[11px] text-red-500 mt-0.5">
                      Creados el {formatearFecha(itemSeleccionado.fecha)}.
                      Esta acción no se puede deshacer.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmando(true)}
                      className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Continuar →
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmación final */}
              {confirmando && itemSeleccionado && (
                <div className="bg-red-600 rounded-xl p-4 space-y-3">
                  <p className="text-white text-sm font-bold">
                    ¿Confirmas la eliminación permanente?
                  </p>
                  <p className="text-red-200 text-[11px]">
                    {itemSeleccionado.total} reporte{itemSeleccionado.total !== 1 ? 's' : ''} del{' '}
                    {formatearFecha(itemSeleccionado.fecha)} y todas sus evidencias y fotos
                    serán borrados para siempre.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleEliminar}
                      disabled={isPending}
                      className="flex-1 py-2.5 bg-white text-red-600 font-black text-sm rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {isPending ? (
                        <>
                          <span className="inline-block w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          Eliminando...
                        </>
                      ) : (
                        <><FaTrash size={11} /> Eliminar definitivamente</>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(false)}
                      disabled={isPending}
                      className="px-4 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-400 transition-colors disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Resultado */}
              {resultado && (
                <div className={`rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2 ${
                  resultado.ok
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  <span>{resultado.ok ? '✓' : '✗'}</span>
                  {resultado.msg}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
