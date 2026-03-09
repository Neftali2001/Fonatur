"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  char: string;
  size: number;
  alpha: number;
  
};

export default function AntigravityBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: Particle[] = [];
    let animationFrameId: number;
    const mouse = { x: -1000, y: -1000 };

    // Símbolos de código inspirados en la estética de Antigravity
    const symbols = ["FONATUR","✦" , "{ }", "< >", "+", "⌘", "/>", "#", "()", "[]", "⚡︎","1","0"];
   

    
    // Paleta combinada: Colores principales de Google + tus tonos cálidos

    const colors = [
      "#4285F4", // Azul
      "#EA4335", // Rojo
      "#FBBC05",
      "#5f3dc4", // Morado original
      "#ff8c42"  // Naranja original
    ];

    const COUNT = 110; // Reducimos la cantidad porque renderizamos texto

    // El resize toma en cuenta los monitores de alta densidad (Retina/4K)
    function resize() {
      const dpi = window.devicePixelRatio || 1;
      canvas!.width = window.innerWidth * dpi;
      canvas!.height = window.innerHeight * dpi;
      canvas!.style.width = window.innerWidth + "px";
      canvas!.style.height = window.innerHeight + "px";
      ctx!.scale(dpi, dpi);
    }

    resize();
    window.addEventListener("resize", resize);

for (let i = 0; i < COUNT; i++) {

  const char = symbols[Math.floor(Math.random() * symbols.length)];

  particles.push({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() * -1.2) - 0.5,
    char: char,
    color: char === "FONATUR"
      ? "#34A853"
      : colors[Math.floor(Math.random() * colors.length)],
   size: Math.random() * 12 + 10,
    alpha: Math.random() * 0.5 + 0.2,
  });

}







    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
    };

    const handleMouseOut = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("mouseout", handleMouseOut);

    function animate() {
      ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Repulsión magnética al acercar el cursor
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 150;

        if (distance < maxDistance) {
          const forceDirectionX = dx / distance;
          const forceDirectionY = dy / distance;
          const force = (maxDistance - distance) / maxDistance;
          
          p.x -= forceDirectionX * force * 3;
          p.y -= forceDirectionY * force * 3;
        }

        // Loop infinito al salir de la pantalla por arriba
        if (p.y < -50) {
          p.y = window.innerHeight + 50;
          p.x = Math.random() * window.innerWidth;
        }
        if (p.x < -50) p.x = window.innerWidth + 50;
        if (p.x > window.innerWidth + 50) p.x = -50;

        // Renderizado del carácter
        ctx!.font = `${p.size}px monospace`;
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = p.alpha;
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText(p.char, p.x, p.y);
      });

      animationFrameId = requestAnimationFrame(animate);
    }

    animate();

    // Limpieza estricta de eventos y frames
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("mouseout", handleMouseOut);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10" />;
}