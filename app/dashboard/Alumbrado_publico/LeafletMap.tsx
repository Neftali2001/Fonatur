'use client'

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Definimos la estructura de los datos que vienen de Neon
interface Reporte {
  id: string;
  folio: string;
  sector: string;
  latitud: number;
  longitud: number;
}

interface LeafletMapProps {
  gps: { lat: string | null; lon: string | null };
  reportes: Reporte[]; // <--- Agregamos la lista de reportes de la BD
}

const RecenterMap = ({ coords }: { coords: { lat: string | null; lon: string | null } }) => {
  const map = useMap()
  useEffect(() => {
    if (coords.lat && coords.lon) {
      map.setView([parseFloat(coords.lat), parseFloat(coords.lon)], 16)
    }
  }, [coords, map])
  return null
}

export default function LeafletMap({ gps, reportes }: LeafletMapProps) {
  useEffect(() => {
    // Solución para los iconos en Next.js
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    })
  }, [])

  // Si no hay GPS actual ni reportes, mostramos carga
  if (!gps.lat && reportes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 bg-slate-100 rounded-lg">
        Cargando mapa y puntos...
      </div>
    )
  }

  // Usamos el GPS actual como centro, o el primer reporte si el GPS falla
  const centerLat = gps.lat ? parseFloat(gps.lat) : (reportes[0]?.latitud || 23.6345);
  const centerLon = gps.lon ? parseFloat(gps.lon) : (reportes[0]?.longitud || -102.5528);

  return (
    <MapContainer
      center={[centerLat, centerLon]}
      zoom={16}
      style={{ height: "100%", width: "100%", borderRadius: '8px' }}
      zoomControl={true}
    >
      {/* Capa Satelital de Esri (Estilo Google Earth) */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles © Esri &mdash; Source: Esri, i-cubed, USDA, USGS"
      />

      {/* 1. PIN DEL GPS ACTUAL (Si existe) */}
      {gps.lat && (
        <Marker position={[parseFloat(gps.lat), parseFloat(gps.lon || "0")]}>
          <Popup>📍 Tu ubicación actual</Popup>
        </Marker>
      )}

      {/* 2. PINES DE LA BASE DE DATOS (Neon) */}
      {reportes.map((reporte) => (
        <Marker 
          key={reporte.id} 
          position={[Number(reporte.latitud), Number(reporte.longitud)]}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-bold border-b mb-1">Folio: {reporte.folio}</p>
              <p><b>Sector:</b> {reporte.sector}</p>
              <p className="text-xs text-blue-600 mt-1 cursor-pointer">Ver detalle →</p>
            </div>
          </Popup>
        </Marker>
      ))}

      <RecenterMap coords={gps} />
    </MapContainer>
  )
}


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