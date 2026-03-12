'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, useMap, LayersControl } from 'react-leaflet';

// 1. FIX: Asegurar que el hack de los íconos solo se ejecute en el navegador (evita crasheos SSR)
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

interface RecenterMapProps {
  lat: string;
  lon: string;
}

const RecenterMap: React.FC<RecenterMapProps> = ({ lat, lon }) => {
  const map = useMap();
  useEffect(() => {
    if (lat && lon) {
      const numLat = parseFloat(lat);
      const numLon = parseFloat(lon);
      // Validar que las coordenadas sean números reales antes de mover la cámara
      if (!isNaN(numLat) && !isNaN(numLon)) {
        map.setView([numLat, numLon], 16);
      }
    }
  }, [lat, lon, map]);
  return null;
};

interface LeafletMapProps {
  lat: string;
  lon: string;
}

const LeafletMap: React.FC<LeafletMapProps> = ({ lat, lon }) => {
  const defaultCenter: [number, number] = [20.6597, -103.3496];
  
  // Procesamiento seguro de coordenadas
  const center: [number, number] = lat && lon && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon)) 
    ? [parseFloat(lat), parseFloat(lon)] 
    : defaultCenter;

  return (
    // 2. FIX: Z-index controlado para evitar superposiciones con tu dashboard (UI/UX)
    <div style={{ height: '100%', width: '100%', minHeight: '400px', position: 'relative', zIndex: 0 }}>
      <MapContainer
        center={center}
        zoom={lat && lon ? 16 : 5}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        zoomControl
      >
        {/* 3. NUEVO: Control para seleccionar entre distintas capas base */}
        <LayersControl position="topright">
          
          <LayersControl.BaseLayer name="Google Híbrido (Satélite + Calles)" checked>
            <TileLayer
              url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              attribution="&copy; Google Maps"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Google Satélite">
            <TileLayer
              url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              attribution="&copy; Google Maps"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Google Calles">
            <TileLayer
              url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
              attribution="&copy; Google Maps"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Esri World Imagery">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
              crossOrigin="anonymous"
            />
          </LayersControl.BaseLayer>
          
        </LayersControl>

        {lat && lon && !isNaN(parseFloat(lat)) && <Marker position={center} />}
        <RecenterMap lat={lat} lon={lon} />
      </MapContainer>
    </div>
  );
};

export default LeafletMap;