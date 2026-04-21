// types.ts
export interface Reporte {
  id: string | number;
  folio: string;
  sector: string;
  latitud: number;
  longitud: number;
}

export interface GeoRefPin {
  lat: string;
  lon: string;
  label: string;
  pregunta: string;
  observation?: string;
  cumple?: string;
}