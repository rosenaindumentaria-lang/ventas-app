import { NextResponse } from 'next/server';
import { getProductos } from '@/lib/sheets';

export async function GET() {
  try {
    const productos = await getProductos();
    return NextResponse.json(productos);
  } catch (error) {
    console.error('Error fetching productos:', error);
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}
