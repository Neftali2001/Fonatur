'use server';

import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';

// 1️⃣ MODIFICACIÓN: Agregamos "categoria" como parámetro (por defecto le pongo 'Alumbrado_publico' por si acaso)
export async function crearReporte(formData: any, checklist: any, gps: any, categoria: string = 'Alumbrado_publico') {
  
  // ✅ FIX 1: Fecha en formato correcto
  const ahora = new Date();
  
  const fechaMX = ahora.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const [dia, mes, anio] = fechaMX.split('/');
  const fechaParaFolio = `${anio}-${mes}-${dia}`;

  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const folio = `REV-${fechaParaFolio}-${random}`;

  const sectorFinal = formData.sector === 'Otro' 
    ? formData.sectorPersonalizado 
    : formData.sector;
    
  const tramoFinal = formData.sector === 'Otro' 
    ? formData.tramoPersonalizado 
    : formData.Tramo;

  const tipoMantenimiento = formData.tipoMantenimiento || 'Ordinario';
  const latitud  = gps?.lat ? parseFloat(gps.lat) : null;
  const longitud = gps?.lon ? parseFloat(gps.lon) : null;

  try {
    await sql`
      INSERT INTO reportes_alumbrado (
        folio, 
        sector, 
        tramo, 
        acceso_publico, 
        tipo_mantenimiento, 
        latitud, 
        longitud, 
        checklist, 
        fecha,
        categoria -- 👈 A) Agregamos la columna de categoría
      )
      VALUES (
        ${folio}, 
        ${sectorFinal ?? ''}, 
        ${tramoFinal ?? ''}, 
        ${formData.accesoPublico || ''}, 
        ${tipoMantenimiento}, 
        ${latitud}, 
        ${longitud}, 
        ${JSON.stringify(checklist)},
        NOW(),
        ${categoria} -- 👈 B) Insertamos la categoría (ej: 'Areas_verdes')
      )
    `;
  } catch (error) {
    console.error('Error al guardar en BD:', error);
    throw new Error('Fallo al crear el reporte.');
  }

  revalidatePath('/dashboard/Historial');
}

// 2️⃣ NUEVO: Función para ACTUALIZAR un reporte existente
export async function actualizarReporte(id: string, formData: any, checklist: any, gps: any) {
  const sectorFinal = formData.sector === 'Otro' 
    ? formData.sectorPersonalizado 
    : formData.sector;
    
  const tramoFinal = formData.sector === 'Otro' 
    ? formData.tramoPersonalizado 
    : formData.Tramo;

  const tipoMantenimiento = formData.tipoMantenimiento || 'Ordinario';
  const latitud  = gps?.lat ? parseFloat(gps.lat) : null;
  const longitud = gps?.lon ? parseFloat(gps.lon) : null;

  try {
    // Nota: Aquí no actualizamos ni el folio, ni la fecha, ni la categoría porque eso no suele cambiar
    await sql`
      UPDATE reportes_alumbrado
      SET 
        sector = ${sectorFinal ?? ''}, 
        tramo = ${tramoFinal ?? ''}, 
        acceso_publico = ${formData.accesoPublico || ''}, 
        tipo_mantenimiento = ${tipoMantenimiento}, 
        latitud = ${latitud}, 
        longitud = ${longitud}, 
        checklist = ${JSON.stringify(checklist)}
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error('Error al actualizar en BD:', error);
    throw new Error('Fallo al actualizar el reporte.');
  }

  revalidatePath('/dashboard/Historial');
}

// 3️⃣ NUEVO: Función para OBTENER un reporte (útil para rellenar el formulario al editar)
export async function obtenerReportePorId(id: string) {
  try {
    const data = await sql`
      SELECT * FROM reportes_alumbrado 
      WHERE id = ${id}
    `;
    return data.rows[0]; // Retorna el reporte si existe
  } catch (error) {
    console.error('Error al obtener reporte:', error);
    throw new Error('Fallo al obtener los datos del reporte.');
  }
}

// La función eliminar se queda exactamente igual
export async function eliminarReporte(id: string) {
  try {
    await sql`DELETE FROM reportes_alumbrado WHERE id = ${id}`;
    revalidatePath('/dashboard/Historial');
  } catch (error) {
    console.error('Error al eliminar:', error);
    throw new Error('Fallo al eliminar el reporte.');
  }
}


// 'use server';

// import { sql } from '@vercel/postgres';
// import { revalidatePath } from 'next/cache';

// export async function crearReporte(formData: any, checklist: any, gps: any) {
  
//   // ✅ FIX 1: Fecha en formato correcto
//   const ahora = new Date();
  
//   const fechaMX = ahora.toLocaleDateString('es-MX', {
//     timeZone: 'America/Mexico_City',
//     year: 'numeric',
//     month: '2-digit',
//     day: '2-digit',
//   });

//   const [dia, mes, anio] = fechaMX.split('/');
//   const fechaParaFolio = `${anio}-${mes}-${dia}`;

//   const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
//   const folio = `REV-${fechaParaFolio}-${random}`;

//   const sectorFinal = formData.sector === 'Otro' 
//     ? formData.sectorPersonalizado 
//     : formData.sector;
    
//   const tramoFinal = formData.sector === 'Otro' 
//     ? formData.tramoPersonalizado 
//     : formData.Tramo;

//   // ✅ Extraemos el nuevo campo de tipo de mantenimiento
//   const tipoMantenimiento = formData.tipoMantenimiento || 'Ordinario';

//   const latitud  = gps?.lat ? parseFloat(gps.lat) : null;
//   const longitud = gps?.lon ? parseFloat(gps.lon) : null;

//   try {
//     await sql`
//       INSERT INTO reportes_alumbrado (
//         folio, 
//         sector, 
//         tramo, 
//         acceso_publico, 
//         tipo_mantenimiento, -- 👈 1. Agregamos la columna
//         latitud, 
//         longitud, 
//         checklist, 
//         fecha
//       )
//       VALUES (
//         ${folio}, 
//         ${sectorFinal ?? ''}, 
//         ${tramoFinal ?? ''}, 
//         ${formData.accesoPublico || ''}, 
//         ${tipoMantenimiento}, -- 👈 2. Agregamos el valor
//         ${latitud}, 
//         ${longitud}, 
//         ${JSON.stringify(checklist)},
//         NOW()
//       )
//     `;
//   } catch (error) {
//     console.error('Error al guardar en BD:', error);
//     throw new Error('Fallo al crear el reporte.');
//   }

//   revalidatePath('/dashboard/Historial');
// }

// // ... resto de funciones (eliminarReporte) se mantienen igual

// export async function eliminarReporte(id: string) {
//   try {
//     await sql`DELETE FROM reportes_alumbrado WHERE id = ${id}`;
//     revalidatePath('/dashboard/Historial');
//   } catch (error) {
//     console.error('Error al eliminar:', error);
//     throw new Error('Fallo al eliminar el reporte.');
//   }
// }





// // 'use server';

// // import { sql } from '@vercel/postgres';
// // import { revalidatePath } from 'next/cache';
// // import { redirect } from 'next/navigation';

// // export async function crearReporte(formData: any, checklist: any, gps: any) {
// //   // Generamos un folio único
// //   const folio = `REV-${new Date().toISOString().split('T')[0]}-${Math.floor(Math.random() * 1000)}`;
  
// //   // Procesamos datos
// //   const sectorFinal = formData.sector === 'Otro' ? formData.sectorPersonalizado : formData.sector;
// //   const tramoFinal = formData.sector === 'Otro' ? formData.tramoPersonalizado : formData.Tramo;
  
// //   try {
// //     await sql`
// //       INSERT INTO reportes_alumbrado (folio, sector, tramo, acceso_publico, latitud, longitud, checklist)
// //       VALUES (
// //         ${folio}, 
// //         ${sectorFinal}, 
// //         ${tramoFinal}, 
// //         ${formData.accesoPublico || ''}, 
// //         ${gps.lat ? parseFloat(gps.lat) : null}, 
// //         ${gps.lon ? parseFloat(gps.lon) : null}, 
// //         ${JSON.stringify(checklist)}
// //       )
// //     `;
// //   } catch (error) {
// //     console.error('Error al guardar en BD:', error);
// //     throw new Error('Fallo al crear el reporte.');
// //   }

// //   // Refresca la página del historial para que muestre el nuevo dato
// //   revalidatePath('/dashboard/Historial');
// // }

// // export async function eliminarReporte(id: string) {
// //   try {
// //     await sql`DELETE FROM reportes_alumbrado WHERE id = ${id}`;
// //     revalidatePath('/dashboard/Historial');
// //   } catch (error) {
// //     console.error('Error al eliminar:', error);
// //     throw new Error('Fallo al eliminar el reporte.');
// //   }
// // }