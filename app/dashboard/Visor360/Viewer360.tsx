'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  FaCrosshairs, FaExpand, FaCompress, FaSync,
  FaSearchPlus, FaSearchMinus, FaFolderOpen, FaTrash,
} from 'react-icons/fa';

// ─── Types ───────────────────────────────────────────────────────────────────
interface PanoramaEntry {
  url: string;
  label: string;
  sector: string;
  coords: string;
  mediaType: 'image' | 'video'; // NUEVO: distingue foto vs vídeo
  isDualFisheye?: boolean;
}

interface Viewer360Props {
  initialImages?: PanoramaEntry[];
  projectName?: string;
}

const DEFAULT_IMAGES: PanoramaEntry[] = [
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Saint_Chapelle_Interior_Panorama.jpg/2560px-Saint_Chapelle_Interior_Panorama.jpg',
    label: 'Demo · Interior',
    sector: 'Demo - Patrimonio',
    coords: '48.8554°N, 2.3450°E',
    mediaType: 'image',
  },
];

const SPEED_LABELS = ['', 'Lenta', 'Normal', 'Rápida', 'Muy Rápida', 'Máxima'];

// Extensiones reconocidas de Insta360
const INSTA360_IMAGE_EXTS = ['.insp'];           // foto equirectangular (JPEG renombrado)
const INSTA360_VIDEO_EXTS = ['.insv', '.lrv'];   // vídeo 360° / baja resolución

const DEFAULT_FOV = 60;
const MIN_FOV     = 25;
const MAX_FOV     = 90;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getExtension(name: string) {
  return name.slice(name.lastIndexOf('.')).toLowerCase();
}

function resolveMediaType(file: File): 'image' | 'video' {
  const ext = getExtension(file.name);
  if (INSTA360_VIDEO_EXTS.includes(ext)) return 'video';
  if (INSTA360_IMAGE_EXTS.includes(ext)) return 'image';
  // Fallback al MIME type para formatos estándar
  return file.type.startsWith('video/') ? 'video' : 'image';
}

function friendlyLabel(name: string) {
  // Extrae fecha/hora del nombre Insta360: IMG_20260421_111329_00_190.insp
  const m = name.match(/(\d{8})_(\d{6})/);
  if (m) {
    const d = m[1], t = m[2];
    const fecha = `${d.slice(6)}/${d.slice(4,6)}/${d.slice(0,4)}`;
    const hora  = `${t.slice(0,2)}:${t.slice(2,4)}`;
    return `${fecha} ${hora}`;
  }
  return name.replace(/\.[^.]+$/, '');
}

// ─── Component ────────────────────────────────────────────────────────────────
const Viewer360: React.FC<Viewer360Props> = ({
  initialImages,
  projectName = 'CIP Acapulco-Coyuca',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const threeRef  = useRef<{
    scene: any; camera: any; renderer: any; sphere: any; animId: number;
  } | null>(null);
  // Referencia al elemento <video> activo (para limpiarlo correctamente)
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  const [images, setImages]             = useState<PanoramaEntry[]>(initialImages ?? DEFAULT_IMAGES);
  const [activeIdx, setActiveIdx]       = useState(0);
  const [isAutoRot, setIsAutoRot]       = useState(true);
  const [fov, setFov]                   = useState(DEFAULT_FOV);
  const [speed, setSpeed]               = useState(2);
  const [isLoading, setIsLoading]       = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHotspots, setShowHotspots] = useState(false);
  const [compassAngle, setCompassAngle] = useState(0);
  const [isPlaying, setIsPlaying]       = useState(false); // control play/pause para vídeo

  const stateRef     = useRef({ lon: 0, lat: 0, fov: DEFAULT_FOV, speed: 2, autoRot: true, dragging: false });
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const prevTouchRef = useRef<{ x: number; y: number } | null>(null);
  const pinchDistRef = useRef<number | null>(null);

  useEffect(() => { stateRef.current.fov     = fov;       }, [fov]);
  useEffect(() => { stateRef.current.speed   = speed;     }, [speed]);
  useEffect(() => { stateRef.current.autoRot = isAutoRot; }, [isAutoRot]);

  // ── Init Three.js ─────────────────────────────────────────────────────────
  const initViewer = useCallback(async (entry: PanoramaEntry) => {
    const THREE = await import('three');
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;

    // Limpia sesión anterior
    if (threeRef.current) {
      cancelAnimationFrame(threeRef.current.animId);
      threeRef.current.renderer.dispose();
      threeRef.current.scene.clear();
    }
    // Detiene y libera el vídeo anterior si existía
    if (videoElRef.current) {
      videoElRef.current.pause();
      videoElRef.current.src = '';
      videoElRef.current = null;
    }

    setIsLoading(true);
    setIsPlaying(false);

    const W = wrap.clientWidth;
    const H = wrap.clientHeight;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(stateRef.current.fov, W / H, 0.01, 1000);
    camera.position.set(0, 0, 0.001);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const geo = new THREE.SphereGeometry(500, 128, 64);
    geo.scale(-1, 1, 1);

    let texture: any;

    if (entry.mediaType === 'video') {
      // ── Vídeo 360° (.insv / .lrv) ────────────────────────────────────────
      const video = document.createElement('video');
      video.src     = entry.url;
      video.loop    = true;
      video.muted   = true;          // necesario para autoplay en navegadores
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      videoElRef.current = video;

      // Espera a tener datos suficientes para mostrar el primer frame
      await new Promise<void>(resolve => {
        video.onloadeddata = () => resolve();
        video.onerror      = () => resolve(); // sigue aunque falle
        video.load();
      });

      texture = new THREE.VideoTexture(video);
      if ((THREE as any).SRGBColorSpace) texture.colorSpace = (THREE as any).SRGBColorSpace;

      // Inicia reproducción automática y actualiza estado
      video.play().then(() => setIsPlaying(true)).catch(() => {});

    } else {
      // ── Imagen 360° (.insp / jpg / png) ──────────────────────────────────
      const loadTexture = () =>
        new Promise<any>((resolve, reject) => {
          const loader = new THREE.TextureLoader();
          loader.crossOrigin = 'anonymous';
          loader.load(entry.url, resolve, undefined, reject);
        });

      try {
        texture = await loadTexture();
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        if ((THREE as any).SRGBColorSpace) texture.colorSpace = (THREE as any).SRGBColorSpace;
      } catch {
        texture = buildFallbackTexture(THREE);
      }
    }

   // Shaders para convertir Dual Fisheye a Equirectangular
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform sampler2D map;
      varying vec2 vUv;
      #define PI 3.141592653589793

      void main() {
        // 1. Convertir de UV (equirectangular) a coordenadas polares de la esfera
        float theta = (vUv.x - 0.5) * 2.0 * PI;
        float phi = (vUv.y - 0.5) * PI;

        // 2. Proyectar a un vector direccional 3D
        vec3 dir = vec3(
          cos(phi) * sin(theta),
          sin(phi),
          cos(phi) * cos(theta)
        );

        // 3. Identificar qué lente usar (z positivo = lente frontal, z negativo = lente trasero)
        float isBack = step(dir.z, 0.0); // Devuelve 1.0 si es trasero, 0.0 si es frontal

        // 4. Calcular el radio y el ángulo respecto al centro del lente fisheye
        float r = atan(length(dir.xy), abs(dir.z)) / (PI / 2.0);
        float alpha = atan(dir.y, dir.x);

        // 5. Mapear la coordenada al círculo unitario de Fisheye
        vec2 uvLens = vec2(r * cos(alpha), r * sin(alpha));

        // 6. Traducir el círculo unitario a la textura Dual (mitad izquierda o derecha)
        vec2 finalUv = vec2(
          (uvLens.x * 0.25) + 0.25 + (isBack * 0.5),
          (uvLens.y * 0.5) + 0.5
        );

        gl_FragColor = texture2D(map, finalUv);
      }
    `;

    let mat;
    if (entry.isDualFisheye) {
      // Aplicar Shader de reproyección para crudos de Insta360
      mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: texture } },
        vertexShader,
        fragmentShader
      });
    } else {
      // Aplicar proyección estándar equirectangular para fotos y MP4 procesados
      mat = new THREE.MeshBasicMaterial({ map: texture });
    }

   
    const sphere = new THREE.Mesh(geo, mat);
    scene.add(sphere);
    setIsLoading(false);

    const animate = () => {
      const id = requestAnimationFrame(animate);
      threeRef.current!.animId = id;

      // Para VideoTexture, necesita marcarla como necesitada de actualización
      if (entry.mediaType === 'video' && texture) texture.needsUpdate = true;

      const s = stateRef.current;
      if (s.autoRot && !s.dragging) s.lon += s.speed * 0.0004 * 50;

      const phi   = (90 - Math.max(-85, Math.min(85, s.lat))) * (Math.PI / 180);
      const theta = s.lon * (Math.PI / 180);
      camera.lookAt(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      );
      setCompassAngle(-s.lon);
      renderer.render(scene, camera);
    };

    threeRef.current = { scene, camera, renderer, sphere, animId: 0 };
    animate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildFallbackTexture(THREE: any) {
    const c   = document.createElement('canvas');
    c.width   = 2048; c.height = 1024;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createLinearGradient(0, 0, 0, 1024);
    grd.addColorStop(0,   '#0f172a');
    grd.addColorStop(0.4, '#065f46');
    grd.addColorStop(1,   '#1e293b');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 2048, 1024);
    ctx.strokeStyle = 'rgba(16,185,129,0.1)'; ctx.lineWidth = 1;
    for (let x = 0; x < 2048; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
    for (let y = 0; y < 1024; y += 64)  { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2048, y); ctx.stroke(); }
    ctx.font = 'bold 40px monospace'; ctx.fillStyle = 'rgba(16,185,129,0.35)';
    ctx.textAlign = 'center';
    ctx.fillText('360° · ' + projectName.toUpperCase(), 1024, 220);
    ctx.font = '22px monospace'; ctx.fillStyle = 'rgba(16,185,129,0.2)';
    ctx.fillText('Carga tu imagen equirectangular', 1024, 290);
    return new THREE.CanvasTexture(c);
  }

  useEffect(() => {
    stateRef.current.lon = 0;
    stateRef.current.lat = 0;
    initViewer(images[activeIdx]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, images]);

  useEffect(() => {
    const handler = () => {
      const t = threeRef.current; const wrap = wrapRef.current;
      if (!t || !wrap) return;
      t.renderer.setSize(wrap.clientWidth, wrap.clientHeight);
      t.camera.aspect = wrap.clientWidth / wrap.clientHeight;
      t.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => () => {
    const t = threeRef.current;
    if (t) { cancelAnimationFrame(t.animId); t.renderer.dispose(); }
    if (videoElRef.current) { videoElRef.current.pause(); videoElRef.current.src = ''; }
  }, []);

  useEffect(() => {
    const t = threeRef.current;
    if (!t) return;
    t.camera.fov = fov;
    t.camera.updateProjectionMatrix();
  }, [fov]);

  // ── Play / Pause para vídeo ───────────────────────────────────────────────
  const toggleVideoPlayback = () => {
    const v = videoElRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else          { v.pause(); setIsPlaying(false); }
  };

  // ── Mouse ─────────────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    stateRef.current.dragging = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!stateRef.current.dragging) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    stateRef.current.lon -= dx * 0.15;
    stateRef.current.lat  = Math.max(-85, Math.min(85, stateRef.current.lat + dy * 0.15));
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseUp = useCallback(() => { stateRef.current.dragging = false; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setFov(f => Math.max(MIN_FOV, Math.min(MAX_FOV, f + (e.deltaY > 0 ? 2 : -2))));
  };

  // ── Touch ─────────────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      stateRef.current.dragging = true;
      prevTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && prevTouchRef.current) {
      const dx = e.touches[0].clientX - prevTouchRef.current.x;
      const dy = e.touches[0].clientY - prevTouchRef.current.y;
      stateRef.current.lon -= dx * 0.18;
      stateRef.current.lat  = Math.max(-85, Math.min(85, stateRef.current.lat + dy * 0.18));
      prevTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && pinchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setFov(f => Math.max(MIN_FOV, Math.min(MAX_FOV, f * (pinchDistRef.current! / dist))));
      pinchDistRef.current = dist;
    }
  };
  const onTouchEnd = () => { stateRef.current.dragging = false; prevTouchRef.current = null; pinchDistRef.current = null; };

  // ── Actions ───────────────────────────────────────────────────────────────
  const zoomIn    = () => setFov(f => Math.max(MIN_FOV, f - 6));
  const zoomOut   = () => setFov(f => Math.min(MAX_FOV, f + 6));
  const resetView = () => { stateRef.current.lon = 0; stateRef.current.lat = 0; setFov(DEFAULT_FOV); };

  const toggleFullscreen = () => {
    const el = wrapRef.current as any;
    if (!document.fullscreenElement) { el?.requestFullscreen?.(); setIsFullscreen(true); }
    else { document.exitFullscreen?.(); setIsFullscreen(false); }
  };

  // ── Carga de archivos ─────────────────────────────────────────────────────
 const buildEntry = (file: File): PanoramaEntry => {
  const ext = getExtension(file.name);
  return {
    url:       URL.createObjectURL(file),
    label:     friendlyLabel(file.name),
    sector:    'Insta360',
    coords:    'No capturadas',
    mediaType: resolveMediaType(file),
    // Marcar como Dual Fisheye si es insv o lrv
    isDualFisheye: INSTA360_VIDEO_EXTS.includes(ext), 
  };
};

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const entries = files.map(buildEntry);
    setImages(prev => {
      const next = [...prev, ...entries];
      setActiveIdx(next.length - 1);
      return next;
    });
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => {
      const ext = getExtension(f.name);
      return f.type.startsWith('image/') || f.type.startsWith('video/')
        || INSTA360_IMAGE_EXTS.includes(ext) || INSTA360_VIDEO_EXTS.includes(ext);
    });
    if (!files.length) return;
    const entries = files.map(buildEntry);
    setImages(prev => {
      const next = [...prev, ...entries];
      setActiveIdx(next.length - 1);
      return next;
    });
  };

  const removeImage = (idx: number) => {
    if (images.length <= 1) return;
    setImages(prev => prev.filter((_, i) => i !== idx));
    setActiveIdx(prev => Math.max(0, idx <= prev ? prev - 1 : prev));
  };

  const active    = images[activeIdx];
  const isVideo   = active?.mediaType === 'video';
  const fovLabel  = fov <= 40 ? 'Teleobjetivo' : fov <= 65 ? 'Normal · sin distorsión' : 'Gran angular';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#eef2f6] min-h-screen font-sans text-gray-700">

      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-slate-800 px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-extrabold text-white text-xl sm:text-2xl tracking-wide">VISOR DE IMÁGENES 360°</h1>
          <p className="text-slate-300 text-xs mt-0.5">Registro visual inmersivo · {projectName}</p>
        </div>
        <span className="text-xs font-bold tracking-widest uppercase bg-white/10 border border-white/20 text-white px-3 py-1.5 rounded-full">⬤ En línea</span>
      </header>

      {/* Body */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">

        {/* Left */}
        <div className="flex flex-col gap-5">

          {/* Viewer card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200">
              <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
              </div>
              <span className="font-bold text-slate-700 text-xs uppercase tracking-widest">Vista Panorámica 360°</span>
              {/* Badge tipo de medio */}
              {isVideo
                ? <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-600 text-white uppercase tracking-widest">VÍDEO</span>
                : <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-600 text-white uppercase tracking-widest">FOTO</span>
              }
              <div className="ml-auto flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_theme(colors.emerald.500)] animate-pulse" />
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Activo</span>
              </div>
            </div>

            {/* Canvas */}
            <div
              ref={wrapRef}
              className="relative w-full bg-slate-900 overflow-hidden cursor-grab active:cursor-grabbing"
              style={{ aspectRatio: '16/9' }}
              onMouseDown={onMouseDown}
              onWheel={onWheel}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <canvas ref={canvasRef} className="w-full h-full block" />

              {isLoading && (
                <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center gap-3 z-10">
                  <div className="w-12 h-12 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                  <p className="text-xs font-bold tracking-widest uppercase text-white/40 animate-pulse">
                    {isVideo ? 'Cargando vídeo 360°…' : 'Cargando panorama…'}
                  </p>
                </div>
              )}

              <div className="absolute top-2 left-2 bg-slate-900/70 backdrop-blur border border-white/10 text-white/80 text-[10px] font-bold tracking-widest px-2 py-1 rounded z-10">
                FOV <span className="text-emerald-400">{Math.round(fov)}°</span>
              </div>

              <div
                className="absolute top-2 right-2 w-10 h-10 bg-slate-900/70 backdrop-blur border border-white/15 rounded-full flex items-center justify-center z-10"
                style={{ transform: `rotate(${compassAngle}deg)`, transition: 'transform 0.08s linear' }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"/>
                  <polygon points="12,4 10,12 12,11 14,12" fill="#ef4444"/>
                  <polygon points="12,20 10,12 12,13 14,12" fill="rgba(255,255,255,0.35)"/>
                  <circle cx="12" cy="12" r="1.5" fill="white"/>
                </svg>
              </div>

              {/* Botón Play/Pause solo para vídeo */}
              {isVideo && !isLoading && (
                <button
                  onClick={toggleVideoPlayback}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-14 h-14 bg-black/50 border border-white/20 rounded-full flex items-center justify-center hover:bg-black/70 transition opacity-70 hover:opacity-100"
                  title={isPlaying ? 'Pausar' : 'Reproducir'}
                >
                  {isPlaying
                    ? <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    : <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  }
                </button>
              )}

              {showHotspots && (
                <div className="absolute w-6 h-6 border-2 border-orange-400 rounded-full bg-orange-400/30 cursor-pointer z-10 animate-ping" style={{ top: '45%', left: '38%' }} title="Incidencia detectada" />
              )}

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {[
                  { icon: <FaSync size={11}/>,     label: isAutoRot ? 'Auto ✓' : 'Auto', action: () => setIsAutoRot(r => !r), active: isAutoRot },
                  { icon: <FaSearchPlus size={11}/>,  label: 'Zoom +', action: zoomIn,         active: false },
                  { icon: <FaSearchMinus size={11}/>, label: 'Zoom −', action: zoomOut,        active: false },
                  { icon: <FaCrosshairs size={11}/>,  label: 'Reset',  action: resetView,      active: false },
                  { icon: isFullscreen ? <FaCompress size={11}/> : <FaExpand size={11}/>, label: 'FS', action: toggleFullscreen, active: false },
                ].map((b, i) => (
                  <button key={i} onClick={b.action}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all backdrop-blur
                      ${b.active ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900/70 border-white/10 text-white hover:bg-emerald-600/60 hover:-translate-y-0.5'}`}>
                    {b.icon} {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* FOV slider */}
            <div className="px-5 py-4 border-t border-slate-100">
              <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                <span>Campo de visión</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[10px]">{fovLabel}</span>
                  <span className="text-emerald-600 font-extrabold">{Math.round(fov)}°</span>
                </div>
              </div>
              <input type="range" min={MIN_FOV} max={MAX_FOV} value={fov}
                onChange={e => setFov(+e.target.value)}
                className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-emerald-600 cursor-pointer" />
              <div className="flex justify-between text-[9px] text-slate-300 mt-1 px-0.5">
                <span>{MIN_FOV}° teleobjetivo</span>
                <span className="text-emerald-500 font-bold">60° óptimo</span>
                <span>{MAX_FOV}° gran angular</span>
              </div>
            </div>
          </div>

          {/* Info card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200">
              <div className="w-7 h-7 bg-slate-700 rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
              </div>
              <span className="font-bold text-slate-700 text-xs uppercase tracking-widest">Datos del Registro</span>
            </div>
            <div className="grid grid-cols-3 gap-3 p-4 border-b border-slate-100">
              {[
                { n: images.length,      l: 'Archivos'  },
                { n: images.filter(i => i.mediaType === 'image').length, l: 'Fotos' },
                { n: images.filter(i => i.mediaType === 'video').length, l: 'Vídeos' },
              ].map((s, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <div className="font-extrabold text-emerald-600 text-xl leading-none">{s.n}</div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
              {[
                { k: 'Sector',        v: active?.sector ?? '—',                    c: '' },
                { k: 'Tipo',          v: isVideo ? 'Vídeo 360°' : 'Foto 360°',     c: isVideo ? 'text-blue-600 font-bold' : 'text-emerald-600 font-bold' },
                { k: 'Imagen activa', v: active?.label  ?? '—',                    c: 'text-orange-500 font-bold' },
              ].map((r, i) => (
                <div key={i} className="flex justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider">{r.k}</span>
                  <span className={`text-slate-700 text-right ${r.c}`}>{r.v}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-100 flex items-center gap-2 text-[11px] text-emerald-700 font-medium">
              <svg className="w-3.5 h-3.5 fill-emerald-600 flex-shrink-0" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              Arrastra para explorar · Scroll para zoom · Pinch en móvil
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-5">

          {/* Gallery */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24"><path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-2 2-2zm-11-4 2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/></svg>
              </div>
              <span className="font-bold text-slate-700 text-xs uppercase tracking-widest">Galería</span>
              <span className="ml-auto text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{images.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 p-3">
              {images.map((img, i) => (
                <div key={i} onClick={() => setActiveIdx(i)}
                  className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all
                    ${i === activeIdx ? 'border-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]' : 'border-transparent hover:border-slate-300 hover:-translate-y-0.5'}`}>
                  <div className={`absolute inset-0 flex items-center justify-center ${img.mediaType === 'video' ? 'bg-gradient-to-br from-blue-900 to-slate-900' : 'bg-gradient-to-br from-slate-800 to-emerald-900'}`}>
                    <span className="text-2xl opacity-40">{img.mediaType === 'video' ? '🎥' : '🌐'}</span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                    <p className="text-white text-[9px] font-bold uppercase truncate">{img.label}</p>
                  </div>
                  {/* Badge tipo: foto o vídeo */}
                  <div className={`absolute top-1 right-1 text-white text-[8px] font-black px-1.5 py-0.5 rounded ${img.mediaType === 'video' ? 'bg-blue-600' : 'bg-orange-500'}`}>
                    {img.mediaType === 'video' ? 'VID' : '360°'}
                  </div>
                  {images.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); removeImage(i); }}
                      className="absolute top-1 left-1 bg-red-500/80 text-white p-1 rounded-lg opacity-0 hover:opacity-100 transition-opacity">
                      <FaTrash size={8}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Upload */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
                <FaFolderOpen className="text-white" size={12}/>
              </div>
              <span className="font-bold text-slate-700 text-xs uppercase tracking-widest">Cargar Archivos</span>
            </div>
            <div className="relative m-3 border-2 border-dashed border-slate-300 rounded-xl p-5 flex flex-col items-center gap-2 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-400 transition cursor-pointer"
              onDragOver={e => e.preventDefault()} onDrop={handleFileDrop}>
              {/* CLAVE: multiple + accept con formatos Insta360 */}
              <input
                type="file"
                accept="image/*,video/*,.insp,.insv,.lrv"
                multiple
                onChange={handleFileUpload}
                onClick={e => { (e.target as HTMLInputElement).value = ''; }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <FaFolderOpen className="text-slate-400" size={28}/>
              <p className="text-xs font-semibold text-slate-500 text-center">Arrastra o haz clic para cargar</p>
              <p className="text-[10px] text-slate-400 text-center">
                Fotos: JPG · PNG · <strong>.insp</strong><br/>
                Vídeos: MP4 · <strong>.insv</strong> · <strong>.lrv</strong>
              </p>
            </div>
          </div>

          {/* Settings */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="w-7 h-7 bg-slate-800 rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
              </div>
              <span className="font-bold text-slate-700 text-xs uppercase tracking-widest">Ajustes</span>
            </div>
            <div className="p-4 flex flex-col gap-4">
              {[
                { label: 'Auto-rotación', val: isAutoRot,    set: () => setIsAutoRot(r  => !r)   },
                { label: 'Hotspots',      val: showHotspots, set: () => setShowHotspots(h => !h) },
              ].map((t, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{t.label}</span>
                  <button onClick={t.set} className={`relative w-10 h-[22px] rounded-full transition-colors ${t.val ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                    <span className={`absolute top-[3px] w-4 h-4 bg-white rounded-full shadow transition-all ${t.val ? 'right-[3px]' : 'left-[3px]'}`} />
                  </button>
                </div>
              ))}
              <div>
                <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  <span>Velocidad rotación</span>
                  <span className="text-emerald-600 font-extrabold">{SPEED_LABELS[speed]}</span>
                </div>
                <input type="range" min={1} max={5} value={speed} onChange={e => setSpeed(+e.target.value)}
                  className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-emerald-600 cursor-pointer" />
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile bar */}
      <div className="fixed bottom-0 left-0 right-0 sm:hidden bg-slate-900/95 backdrop-blur border-t border-white/10 flex gap-2 px-3 py-2 z-50">
        {[
          { icon: <FaSync size={14}/>,        label: 'Auto',   action: () => setIsAutoRot(r => !r), on: isAutoRot },
          { icon: <FaSearchPlus size={14}/>,  label: 'Zoom +', action: zoomIn,           on: false },
          { icon: <FaSearchMinus size={14}/>, label: 'Zoom −', action: zoomOut,          on: false },
          { icon: <FaCrosshairs size={14}/>,  label: 'Reset',  action: resetView,        on: false },
          { icon: <FaExpand size={14}/>,      label: 'Full',   action: toggleFullscreen,  on: false },
        ].map((b, i) => (
          <button key={i} onClick={b.action}
            className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide border transition-colors
              ${b.on ? 'bg-emerald-600/40 border-emerald-500 text-white' : 'bg-white/5 border-white/10 text-white/70'}`}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Viewer360;
