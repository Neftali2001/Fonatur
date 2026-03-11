'use client';

import { useRouter } from 'next/navigation';
import { FaSync } from 'react-icons/fa';
import { useState } from 'react';

export default function BotonActualizar() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh(); // Esto le dice a Next.js que vuelva a ejecutar el Server Component
    
    // Quitamos la animación de giro después de un momento
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      className="w-full lg:w-auto flex justify-center items-center gap-2 px-6 py-3 md:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-all border border-slate-300"
      title="Actualizar registros"
    >
      <FaSync className={isRefreshing ? 'animate-spin' : ''} />
      <span className="lg:hidden">Actualizar</span>
    </button>
  );
}