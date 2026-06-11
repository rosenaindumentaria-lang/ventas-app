import { NextResponse } from 'next/server';
import { borrarSesion } from '@/lib/auth';

export async function POST() {
  await borrarSesion();
  return NextResponse.json({ success: true });
}
