"use client";

import React, { useRef, useEffect } from 'react';

const DoublePendulum: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Parámetros físicos constantes
  const m1 = 15, m2 = 15;
  const l1 = 125, l2 = 125;
  const g = 9.81;
  const dt = 0.15; // Velocidad de la simulación

  // Estado físico interno
  const physics = useRef({
    theta1: Math.PI / 2,
    theta2: Math.PI / 2,
    omega1: 0,
    omega2: 0,
    trail: [] as { x: number; y: number }[],
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      let { theta1, theta2, omega1, omega2, trail } = physics.current;
      const centerX = canvas.width / 2;
      const centerY = 150;

      // Cálculo de aceleraciones (Ecuaciones de movimiento)
      const num1 = -g * (2 * m1 + m2) * Math.sin(theta1);
      const num2 = -m2 * g * Math.sin(theta1 - 2 * theta2);
      const num3 = -2 * Math.sin(theta1 - theta2) * m2 * (omega2 * omega2 * l2 + omega1 * omega1 * l1 * Math.cos(theta1 - theta2));
      const den1 = l1 * (2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2));
      const alpha1 = (num1 + num2 + num3) / den1;

      const num4 = 2 * Math.sin(theta1 - theta2) * (omega1 * omega1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(theta1) + omega2 * omega2 * l2 * m2 * Math.cos(theta1 - theta2));
      const den2 = l2 * (2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2));
      const alpha2 = num4 / den2;

      // Integración numérica (Euler semi-implícito)
      omega1 += alpha1 * dt;
      omega2 += alpha2 * dt;
      theta1 += omega1 * dt;
      theta2 += omega2 * dt;

      // Posiciones para el dibujo
      const x1 = centerX + l1 * Math.sin(theta1);
      const y1 = centerY + l1 * Math.cos(theta1);
      const x2 = x1 + l2 * Math.sin(theta2);
      const y2 = y1 + l2 * Math.cos(theta2);

      trail.push({ x: x2, y: y2 });
      if (trail.length > 250) trail.shift();

      physics.current = { theta1, theta2, omega1, omega2, trail };

      // Renderizado
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dibujar rastro
      if (trail.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 2;
        ctx.moveTo(trail[0].x, trail[0].y);
        trail.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      }

      // Dibujar péndulo
      ctx.beginPath();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Masas
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath(); ctx.arc(x1, y1, 10, 0, 7); ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(x2, y2, 10, 0, 7); ctx.fill();

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      width={600} 
      height={500} 
      style={{ display: 'block', background: '#f8fafc', borderRadius: '8px' }} 
    />
  );
};

export default DoublePendulum;