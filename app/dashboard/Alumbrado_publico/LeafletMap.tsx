'use client'

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Map } from 'lucide-react'

interface Reporte {
  id: string;
  folio: string;
  sector: string;
  latitud: number;
  longitud: number;
}

// Punto geo-ref de una evidencia específica
interface GeoRefPin {
  lat: string;
  lon: string;
  label: string;      // ej: "#3 — Evidencia 2"
  pregunta: string;
  observation?: string;
  cumple?: string;    // "SI" | "NO" | ""
}

interface LeafletMapProps {
  gps: { lat: string | null; lon: string | null };
  reportes: Reporte[];
  georefPins?: GeoRefPin[];   // ← nuevo: pins de evidencias
}

// ── Helpers de centrado ──────────────────────────────────
const RecenterMap = ({ coords }: { coords: { lat: string | null; lon: string | null } }) => {
  const map = useMap()
  useEffect(() => {
    if (coords.lat && coords.lon) {
      map.setView([parseFloat(coords.lat), parseFloat(coords.lon)], 17)
    }
  }, [coords, map])
  return null
}

const FitAllPins = ({ pins, reportes }: { pins: GeoRefPin[]; reportes: Reporte[] }) => {
  const map = useMap()
  useEffect(() => {
    const points: [number, number][] = [
      ...pins.map(p => [parseFloat(p.lat), parseFloat(p.lon)] as [number, number]),
      ...reportes.map(r => [Number(r.latitud), Number(r.longitud)] as [number, number]),
    ]
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 18 })
    }
  }, [pins, reportes, map])
  return null
}

// ── Iconos SVG ────────────────────────────────────────────
const createPinIcon = (color: string, label: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42"
         style="filter:drop-shadow(0 3px 4px rgba(0,0,0,0.35));overflow:visible">
      <!-- Pin body -->
      <path d="M16 0 C7.16 0 0 7.16 0 16 C0 27 16 42 16 42 C16 42 32 27 32 16 C32 7.16 24.84 0 16 0Z"
            fill="${color}" stroke="white" stroke-width="1.5"/>
      <!-- Inner circle -->
      <circle cx="16" cy="16" r="9" fill="white" opacity="0.92"/>
      <!-- Label text -->
      <text x="16" y="20.5" text-anchor="middle"
            font-family="system-ui,sans-serif" font-size="${label.length > 2 ? '7' : '9'}"
            font-weight="800" fill="${color}">${label}</text>
    </svg>`
  return L.divIcon({
    className: 'bg-transparent border-none',
    html: svg,
    iconSize:   [32, 42],
    iconAnchor: [16, 42],
    popupAnchor:[0, -44],
  })
}

// Colores por estado de cumplimiento
const colorPin = (cumple?: string) => {
  if (cumple === 'SI')  return '#10b981'  // emerald
  if (cumple === 'NO')  return '#ef4444'  // red
  return '#f59e0b'                         // amber (sin responder)
}

const iconDB   = createPinIcon('#6366f1', '◉')   // reportes BD — violet

export default function LeafletMap({ gps, reportes, georefPins = [] }: LeafletMapProps) {

  const noPins = !gps.lat && reportes.length === 0 && georefPins.length === 0

  if (noPins) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100 rounded-lg gap-2">
        <Map className="w-8 h-8 opacity-40" />
        <p className="text-xs font-medium">Las geo-referencias aparecerán aquí</p>
      </div>
    )
  }

  // Centro inicial: primera georef capturada, o GPS general, o primer reporte
  const centerLat = georefPins[0]
    ? parseFloat(georefPins[0].lat)
    : gps.lat ? parseFloat(gps.lat)
    : (reportes[0]?.latitud || 16.8637)
  const centerLon = georefPins[0]
    ? parseFloat(georefPins[0].lon)
    : gps.lon ? parseFloat(gps.lon)
    : (reportes[0]?.longitud || -99.8869)

  return (
    <MapContainer
      center={[centerLat, centerLon]}
      zoom={17}
      style={{ height: '100%', width: '100%', borderRadius: '8px', zIndex: 0 }}
      zoomControl={true}
    >
      {/* Capa híbrida Google (satélite + calles) */}
      <TileLayer
        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
        attribution="&copy; Google Maps"
        maxZoom={20}
      />

      {/* Ajustar vista a todos los pins si hay más de uno */}
      {(georefPins.length + reportes.length) > 1 && (
        <FitAllPins pins={georefPins} reportes={reportes} />
      )}

      {/* Re-centrar si solo hay un pin */}
      {georefPins.length <= 1 && (
        <RecenterMap coords={
          georefPins[0]
            ? { lat: georefPins[0].lat, lon: georefPins[0].lon }
            : gps
        } />
      )}

      {/* ── PINS DE EVIDENCIAS ── */}
      {georefPins.map((pin, i) => (
        <Marker
          key={`ev-${i}`}
          position={[parseFloat(pin.lat), parseFloat(pin.lon)]}
          icon={createPinIcon(colorPin(pin.cumple), pin.label)}
        >
          <Popup className="rounded-xl shadow-lg">
            <div className="text-sm text-slate-700 min-w-[180px] space-y-1.5">
              <p className="font-bold text-slate-900 border-b pb-1.5 text-[13px]">
                {pin.cumple === 'SI'
                  ? '✅'
                  : pin.cumple === 'NO'
                  ? '❌'
                  : '⏳'} {pin.label}
              </p>
              <p className="text-slate-600 text-[12px] leading-snug">{pin.pregunta}</p>
              {pin.observation && (
                <p className="text-slate-500 text-[11px] italic">"{pin.observation}"</p>
              )}
              <p className="text-[10px] font-mono text-slate-400 mt-1">
                {pin.lat}, {pin.lon}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* ── PINS DE REPORTES DE LA BD ── */}
      {reportes.map(r => (
        <Marker
          key={r.id}
          position={[Number(r.latitud), Number(r.longitud)]}
          icon={iconDB}
        >
          <Popup className="rounded-xl shadow-lg">
            <div className="text-sm text-slate-700 space-y-1 min-w-[140px]">
              <p className="font-bold border-b pb-1">{r.folio}</p>
              <p><b>Sector:</b> {r.sector}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}





// 'use client'

// import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
// import { useEffect } from 'react'
// import L from 'leaflet'
// import 'leaflet/dist/leaflet.css'
// import { Map } from "lucide-react"
// import Link from 'next/link'

// interface Reporte {
//   id: string;
//   folio: string;
//   sector: string;
//   latitud: number;
//   longitud: number;
// }

// interface LeafletMapProps {
//   gps: { lat: string | null; lon: string | null };
//   reportes: Reporte[];
// }

// const RecenterMap = ({ coords }: { coords: { lat: string | null; lon: string | null } }) => {
//   const map = useMap()
//   useEffect(() => {
//     if (coords.lat && coords.lon) {
//       map.setView([parseFloat(coords.lat), parseFloat(coords.lon)], 16)
//     }
//   }, [coords, map])
//   return null
// }

// const FitMarkers = ({ reportes }: { reportes: Reporte[] }) => {
//   const map = useMap()
//   useEffect(() => {
//     if (reportes.length > 0) {
//       const bounds = L.latLngBounds(
//         reportes.map((r) => [Number(r.latitud), Number(r.longitud)])
//       )
//       map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 })
//     }
//   }, [reportes, map])
//   return null
// }

// // Función para crear pines modernos SVG personalizados
// const createCustomMarker = (color: string) => {
//   const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 36px; height: 36px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.3));">
//     <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 15 4 10a8 8 0 0 1 16 0"/>
//     <circle cx="12" cy="10" r="3" fill="white"/>
//   </svg>`

//   return L.divIcon({
//     className: 'bg-transparent border-none',
//     html: svgIcon,
//     iconSize: [36, 36],
//     iconAnchor: [18, 36], // Punto exacto que apunta a la coordenada
//     popupAnchor: [0, -32], // Dónde se abre el popup respecto al icono
//   })
// }

// // Definimos los colores para diferenciar GPS vs Reportes
// const gpsIcon = createCustomMarker('#3b82f6') // Azul moderno
// const reporteIcon = createCustomMarker('#ef4444') // Rojo moderno

// export default function LeafletMap({ gps, reportes }: LeafletMapProps) {
  
//   if (!gps.lat && reportes.length === 0) {
//     return (
//       <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100 rounded-lg">
//         <Map className="w-10 h-10 mb-2" />
//         <p>Esperando datos de ubicación...</p>
//       </div>
//     )
//   }

//   const centerLat = gps.lat ? parseFloat(gps.lat) : (reportes[0]?.latitud || 23.6345)
//   const centerLon = gps.lon ? parseFloat(gps.lon) : (reportes[0]?.longitud || -102.5528)

//   return (
//     <MapContainer
//       center={[centerLat, centerLon]}
//       zoom={16}
//       style={{ height: "100%", width: "100%", borderRadius: '8px', zIndex: 0 }}
//       zoomControl={true}
//     >
//       {/* Capa Híbrida de Google (Satelital + Calles) */}
//       <TileLayer
//         url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
//         attribution="&copy; Google Maps"
//         maxZoom={20}
//       />

//       <FitMarkers reportes={reportes} />

//       {/* 1. PIN DEL GPS ACTUAL */}
//       {gps.lat && (
//         <Marker 
//           position={[parseFloat(gps.lat), parseFloat(gps.lon || "0")]}
//           icon={gpsIcon}
//         >
//           <Popup className="rounded-lg shadow-lg">
//             <span className="font-semibold text-slate-700">📍 Tu ubicación actual</span>
//           </Popup>
//         </Marker>
//       )}

//       {/* 2. PINES DE LA BASE DE DATOS */}
//       {reportes.map((reporte) => (
//         <Marker 
//           key={reporte.id} 
//           position={[Number(reporte.latitud), Number(reporte.longitud)]}
//           icon={reporteIcon}
//         >
//           <Popup className="rounded-lg shadow-lg">
//             <div className="text-sm text-slate-700 flex flex-col gap-2 min-w-[150px]">
//               <p className="font-bold border-b pb-1 text-slate-900">Folio: {reporte.folio}</p>
//               <p><b>Sector:</b> {reporte.sector}</p>
//               <Link
//                 href="/dashboard/Historial"
//                 className="mt-2 text-center rounded-md  px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-100"
//               >
//                 Ver detalles
//               </Link>
//             </div>
//           </Popup>
//         </Marker>
//       ))}

//       <RecenterMap coords={gps} />
//     </MapContainer>
//   )
// }




// 'use client'

// import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
// import { useEffect } from 'react'
// import L from 'leaflet'
// import 'leaflet/dist/leaflet.css'
// import { Map } from "lucide-react";
// import Link from 'next/link';


// // Definimos la estructura de los datos que vienen de Neon
// interface Reporte {
//   id: string;
//   folio: string;
//   sector: string;
//   latitud: number;
//   longitud: number;
// }

// interface LeafletMapProps {
//   gps: { lat: string | null; lon: string | null };
//   reportes: Reporte[]; // <--- Agregamos la lista de reportes de la BD
// }

// const RecenterMap = ({ coords }: { coords: { lat: string | null; lon: string | null } }) => {
//   const map = useMap()
//   useEffect(() => {
//     if (coords.lat && coords.lon) {
//       map.setView([parseFloat(coords.lat), parseFloat(coords.lon)], 16)
//     }
//   }, [coords, map])
//   return null
// }


// // Nuevo componente de ayuda dentro de LeafletMap.tsx
// const FitMarkers = ({ reportes }: { reportes: Reporte[] }) => {
//   const map = useMap();

//   useEffect(() => {
//     if (reportes.length > 0) {
//       // Creamos un "límite" (bounds) basado en las coordenadas de los reportes
//       const bounds = L.latLngBounds(
//         reportes.map((r) => [Number(r.latitud), Number(r.longitud)])
//       );
      
//       // Ajustamos el mapa para que quepan todos los puntos con un poco de margen (padding)
//       map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
//     }
//   }, [reportes, map]);

//   return null;
// };





// export default function LeafletMap({ gps, reportes }: LeafletMapProps) {
//   useEffect(() => {
//     // Solución para los iconos en Next.js
//     delete (L.Icon.Default.prototype as any)._getIconUrl
//     L.Icon.Default.mergeOptions({
//       iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//       iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//       shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
//     })
//   }, [])

//   // Si no hay GPS actual ni reportes, mostramos carga
//   if (!gps.lat && reportes.length === 0) {
//     return (
//      <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100 rounded-lg">
//   <Map className="w-10 h-10 mb-2" />
// </div>
//     )
//   }

//   // Usamos el GPS actual como centro, o el primer reporte si el GPS falla
//   const centerLat = gps.lat ? parseFloat(gps.lat) : (reportes[0]?.latitud || 23.6345);
//   const centerLon = gps.lon ? parseFloat(gps.lon) : (reportes[0]?.longitud || -102.5528);

//   return (
//     <MapContainer
//       center={[centerLat, centerLon]}
//       zoom={16}
//       style={{ height: "100%", width: "100%", borderRadius: '8px' }}
//       zoomControl={true}
//     >
//       {/* Capa Satelital de Esri (Estilo Google Earth) */}
//       <TileLayer
//         url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
//         attribution=""
//       />

//       <FitMarkers reportes={reportes} />

//       {/* 1. PIN DEL GPS ACTUAL (Si existe) */}
//       {gps.lat && (
//         <Marker position={[parseFloat(gps.lat), parseFloat(gps.lon || "0")]}>
//           <Popup>📍 Tu ubicación actual</Popup>
//         </Marker>
//       )}

//       {/* 2. PINES DE LA BASE DE DATOS (Neon) */}
//       {reportes.map((reporte) => (
//         <Marker 
//           key={reporte.id} 
//           position={[Number(reporte.latitud), Number(reporte.longitud)]}
//         >
//           <Popup>
//             <div className="text-sm">
//               <p className="font-bold border-b mb-1">Folio: {reporte.folio}</p>
//               <p><b>Sector:</b> {reporte.sector}</p>
//                <Link
//             href="/dashboard/Historial"
//             className="flex items-center gap-5 self-start rounded-lg custom-background px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-400 md:text-base"
//           >
//             <span>Ver detalles</span> 
//           </Link>
//             </div>
//           </Popup>
//         </Marker>
//       ))}

//       <RecenterMap coords={gps} />
//     </MapContainer>
//   )
// }


// 'use client'

// import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
// import { useEffect } from 'react'
// import L from 'leaflet'
// import 'leaflet/dist/leaflet.css'

// interface GpsCoords {
//   lat: string | null
//   lon: string | null
// }

// const RecenterMap = ({ coords }: { coords: GpsCoords }) => {
//   const map = useMap()

//   useEffect(() => {
//     if (coords.lat && coords.lon) {
//       map.setView([parseFloat(coords.lat), parseFloat(coords.lon)], 16)
//     }
//   }, [coords, map])

//   return null
// }

// export default function LeafletMap({ gps }: { gps: GpsCoords }) {

//   useEffect(() => {
//     delete (L.Icon.Default.prototype as any)._getIconUrl

//     L.Icon.Default.mergeOptions({
//       iconRetinaUrl:
//         'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//       iconUrl:
//         'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//       shadowUrl:
//         'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
//     })
//   }, [])

//   if (!gps.lat) {
//     return (
//       <div className="h-full flex items-center justify-center text-slate-400">
//         Esperando señal GPS...
//       </div>
//     )
//   }

//   return (
//     <MapContainer
//       center={[parseFloat(gps.lat), parseFloat(gps.lon || "0")]}
//       zoom={16}
//       style={{ height: "100%", width: "100%" }}
//       zoomControl={false}
//     >
//       <TileLayer
//         url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
//         attribution="Tiles © Esri"
//       />

//       <Marker
//         position={[parseFloat(gps.lat), parseFloat(gps.lon || "0")]}
//       />

//       <RecenterMap coords={gps} />
//     </MapContainer>
//   )
// }