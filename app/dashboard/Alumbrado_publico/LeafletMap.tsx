'use client'

import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface GpsCoords {
  lat: string | null
  lon: string | null
}

const RecenterMap = ({ coords }: { coords: GpsCoords }) => {
  const map = useMap()

  useEffect(() => {
    if (coords.lat && coords.lon) {
      map.setView([parseFloat(coords.lat), parseFloat(coords.lon)], 16)
    }
  }, [coords, map])

  return null
}

export default function LeafletMap({ gps }: { gps: GpsCoords }) {

  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl

    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    })
  }, [])

  if (!gps.lat) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        Esperando señal GPS...
      </div>
    )
  }

  return (
    <MapContainer
      center={[parseFloat(gps.lat), parseFloat(gps.lon || "0")]}
      zoom={16}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles © Esri"
      />

      <Marker
        position={[parseFloat(gps.lat), parseFloat(gps.lon || "0")]}
      />

      <RecenterMap coords={gps} />
    </MapContainer>
  )
}