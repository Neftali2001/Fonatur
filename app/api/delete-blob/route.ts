import { del } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { url } = await request.json();
  
  if (!url) {
    return NextResponse.json({ error: 'No URL received' }, { status: 400 });
  }

  await del(url);
  return NextResponse.json({ success: true });
}