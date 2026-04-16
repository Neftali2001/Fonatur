// app/types/css.d.ts
//
// Declara los módulos CSS que se importan como side-effects ("import 'x.css'").
// Sin esto, TypeScript 5+ lanza:
//   "Cannot find module or type declarations for side-effect import of 'leaflet/dist/leaflet.css'"
//
// Este archivo aplica a CUALQUIER .css importado en el proyecto,
// así que no hay que repetirlo por cada librería.

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}