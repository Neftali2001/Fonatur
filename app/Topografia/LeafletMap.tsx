'use client';

import React, { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';

// Corrige iconos por defecto de Leaflet con Vite/Next
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface RecenterMapProps {
  lat: string;
  lon: string;
}

const RecenterMap: React.FC<RecenterMapProps> = ({ lat, lon }) => {
  const map = useMap();
  useEffect(() => {
    if (lat && lon) map.setView([parseFloat(lat), parseFloat(lon)], 16);
  }, [lat, lon, map]);
  return null;
};

interface LeafletMapProps {
  lat:    string;
  lon:    string;
  mapRef: React.RefObject<HTMLDivElement | null>;
}

const LeafletMap: React.FC<LeafletMapProps> = ({ lat, lon, mapRef }) => (
  <div ref={mapRef} style={{ height: '100%', width: '100%' }}>
    <MapContainer
      center={lat && lon ? [parseFloat(lat), parseFloat(lon)] : [20.6597, -103.3496]}
      zoom={lat && lon ? 16 : 5}
      style={{ height: '100%', width: '100%' }}
      zoomControl
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles © Esri"
        crossOrigin="anonymous"
      />
      {lat && lon && <Marker position={[parseFloat(lat), parseFloat(lon)]} />}
      <RecenterMap lat={lat} lon={lon} />
    </MapContainer>
  </div>
);

export default LeafletMap;
