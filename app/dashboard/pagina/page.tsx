'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Sparkles, Ban } from 'lucide-react';

export default function LovePageMobile() {
  const [accepted, setAccepted] = useState(false);
  const [yesScale, setYesScale] = useState(1);
  const [noCount, setNoCount] = useState(0);

  // Mensajes que cambian mientras el botón SÍ invade la pantalla
  const getNoText = () => {
    const phrases = [
      "No...",
      "¿Segura?",
      "Piénsalo bien...",
      "¿En serio? 🤨",
      "¡Intenta otra vez!",
      "Casi lo tienes...",
      "Ya no hay espacio para el No"
    ];
    return phrases[Math.min(noCount, phrases.length - 1)];
  };

  const handleNoInteraction = () => {
    setNoCount(prev => prev + 1);
    // Crecimiento exponencial: 1.5 -> 2.5 -> 4.5 -> 8...
    setYesScale(prev => prev + (prev * 0.8) + 1);
  };

  return (
    <div className="fixed inset-0 bg-[#fff5f7] flex items-center justify-center p-6 overflow-hidden touch-none font-sans">
      <AnimatePresence mode="wait">
        {!accepted ? (
          <motion.div 
            key="question-box"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="w-full max-w-sm text-center z-10"
          >
            {/* Cabecera Creativa */}
            <div className="mb-8">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="inline-block bg-rose-500 p-4 rounded-3xl shadow-lg mb-4"
              >
                <Heart className="text-white w-10 h-10 fill-current" />
              </motion.div>
              <h2 className="text-rose-400 font-bold tracking-[0.3em] text-[10px] uppercase mb-2">Petición Especial</h2>
              <h1 className="text-4xl font-black text-slate-800 leading-tight">
                ¿Quieres salir <br/> a comer?
              </h1>
            </div>

            <div className="flex flex-col gap-4 items-center justify-center min-h-[300px] relative">
              
              {/* BOTÓN SÍ: El invasor de pantalla */}
              <motion.button
                onClick={() => setAccepted(true)}
                animate={{ 
                  scale: yesScale,
                  boxShadow: yesScale > 1 ? "0 20px 50px rgba(225, 29, 72, 0.3)" : "0 10px 20px rgba(225, 29, 72, 0.1)"
                }}
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
                className="z-50 bg-rose-500 text-white px-12 py-5 rounded-2xl font-black text-2xl flex items-center gap-3 whitespace-nowrap overflow-hidden"
              >
                {yesScale > 10 ? <Heart className="fill-current w-8 h-8 animate-pulse" /> : "¡SÍ!"}
                {yesScale < 5 && <Sparkles className="w-6 h-6" />}
              </motion.button>

              {/* BOTÓN NO: La víctima */}
              <motion.button
                onPointerDown={handleNoInteraction} // Mejor que onClick para móviles
                animate={{ 
                  opacity: Math.max(0.1, 1 - noCount * 0.2),
                  scale: Math.max(0.5, 1 - noCount * 0.1),
                  y: noCount > 0 ? 20 : 0
                }}
                className="z-0 bg-slate-200 text-slate-500 px-8 py-4 rounded-xl font-bold text-lg flex items-center gap-2"
              >
                <Ban className="w-4 h-4" />
                {getNoText()}
              </motion.button>
            </div>

            <p className="mt-8 text-[10px] text-slate-400 font-medium uppercase tracking-widest">
              Protocolo de Invasión Romántica Activo
            </p>
          </motion.div>
        ) : (
          <motion.div 
            key="success-screen"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="fixed inset-0 bg-rose-500 flex flex-col items-center justify-center p-10 z-[100] text-center"
          >
            <motion.div
              animate={{ 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.2, 1]
              }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <Heart className="text-white w-32 h-32 fill-current mb-6 drop-shadow-2xl" />
            </motion.div>
            <h1 className="text-white text-5xl font-black mb-4 italic tracking-tighter">¡LO SABÍA! 💖</h1>
            <p className="text-rose-100 text-xl font-light">Fue la decisión más fácil, ¿verdad?</p>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-12 text-white/50 text-[10px] uppercase tracking-widest"
            >
              A comel
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decoración de fondo */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-10 left-10 rotate-12 text-rose-300"><Heart /></div>
        <div className="absolute bottom-20 right-10 -rotate-12 text-rose-300"><Heart /></div>
        <div className="absolute top-1/2 left-5 text-rose-300"><Sparkles /></div>
      </div>
    </div>
  );
}