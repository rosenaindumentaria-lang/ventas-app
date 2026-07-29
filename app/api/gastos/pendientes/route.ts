import { NextResponse } from 'next/server';
import { getGastosPendientes } from '@/lib/sheets';

export async function GET() {
  try {
    const pendientes = await getGastosPendientes();
    return NextResponse.json(pendientes);
  } catch (error) {
    console.error('Error fetching gastos pendientes:', error);
    return NextResponse.json([]);
  }
}
