import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    console.log('Archivo recibido:', file?.name, file?.size);
    console.log('Token disponible:', !!process.env.BLOB_READ_WRITE_TOKEN);

    if (!file) {
      return NextResponse.json({ error: 'No file received' }, { status: 400 });
    }

    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN, // ← forzar el token explícitamente
    });

    console.log('URL generada:', blob.url);
    return NextResponse.json({ url: blob.url });

  } catch (error: any) {
    console.error('Error en /api/upload:', error.message ?? error);
    return NextResponse.json({ error: error.message ?? 'Error desconocido' }, { status: 500 });
  }
}