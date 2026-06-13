import { NextResponse } from 'next/server';
import { getGastos, registrarGasto, borrarGasto } from '@/lib/sheets';
import { getSesion } from '@/lib/auth';

export async function GET() {
  try {
    const gastos = await getGastos();
    return NextResponse.json(gastos);
  } catch (error) {
    console.error('Error fetching gastos:', error);
    return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { descripcion, categoria, monto, fecha: fechaBody } = body;

    if (!descripcion || !monto || monto <= 0) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const sesion = await getSesion();
    const fecha = fechaBody || new Date().toISOString().split('T')[0];
    await registrarGasto({
      fecha,
      descripcion,
      categoria: categoria || 'Gasto Adm',
      monto,
      usuario: sesion?.usuario || '',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error registrando gasto:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al registrar gasto', detalle }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta el ID' }, { status: 400 });

    await borrarGasto(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error borrando gasto:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al borrar gasto', detalle }, { status: 500 });
  }
}
