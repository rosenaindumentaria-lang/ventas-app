import { NextResponse } from 'next/server';
import {
  getMovimientos,
  registrarMovimiento,
  editarMovimiento,
  borrarMovimiento,
} from '@/lib/sheets';
import { getSesion } from '@/lib/auth';
import { TIPOS_SALIDA } from '@/lib/types';

// El sentido viaja explícito y NO se deduce del nombre del tipo: los tipos
// llevan acento ("Devolución de préstamo") y si la codificación se altera en el
// camino, la comparación falla y una salida se guardaría como entrada, inflando
// la caja sin que nadie se entere. El match por nombre queda sólo como respaldo
// para llamadas viejas que no manden `sentido`.
function esSalida(sentido: unknown, tipo: string): boolean {
  if (sentido === 'salida') return true;
  if (sentido === 'entrada') return false;
  return (TIPOS_SALIDA as readonly string[]).includes(tipo);
}

// Normaliza la fecha: si no viene en YYYY-MM-DD, se usa hoy.
function normalizarFecha(fecha: unknown): string {
  return typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ? fecha
    : new Date().toISOString().split('T')[0];
}

export async function GET() {
  try {
    const movimientos = await getMovimientos();
    return NextResponse.json(movimientos);
  } catch (error) {
    console.error('Error fetching movimientos:', error);
    return NextResponse.json({ error: 'Error al obtener movimientos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tipo, detalle, monto, fecha, sentido } = body;

    const importe = Math.abs(Number(monto));
    if (!detalle || !importe) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const sesion = await getSesion();
    await registrarMovimiento({
      // El préstamo puede haber entrado otro día, así que la fecha es editable.
      fecha: normalizarFecha(fecha),
      tipo: tipo || 'Otro',
      detalle,
      monto: esSalida(sentido, tipo) ? -importe : importe,
      usuario: sesion?.usuario || '',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error registrando movimiento:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al registrar movimiento', detalle }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, tipo, detalle, monto, fecha, sentido } = body;

    const importe = Math.abs(Number(monto));
    if (!id || !detalle || !importe) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    await editarMovimiento(id, {
      fecha: normalizarFecha(fecha),
      tipo: tipo || 'Otro',
      detalle,
      monto: esSalida(sentido, tipo) ? -importe : importe,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error editando movimiento:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al editar movimiento', detalle }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta el ID' }, { status: 400 });

    await borrarMovimiento(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error borrando movimiento:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al borrar movimiento', detalle }, { status: 500 });
  }
}
