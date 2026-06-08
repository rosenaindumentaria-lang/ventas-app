import { NextResponse } from 'next/server';
import { getVentas, registrarVenta } from '@/lib/sheets';

export async function GET() {
  try {
    const ventas = await getVentas();
    return NextResponse.json(ventas);
  } catch (error) {
    console.error('Error fetching ventas:', error);
    return NextResponse.json({ error: 'Error al obtener ventas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cod, nombreComercial, cantidad, tipoPrecio, precioUnitario, costo } = body;

    if (!cod || !cantidad || !tipoPrecio || !precioUnitario) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const total = precioUnitario * cantidad;
    const ganancia = (precioUnitario - costo) * cantidad;
    const fecha = new Date().toISOString().split('T')[0];

    await registrarVenta({
      fecha,
      cod,
      nombreComercial,
      cantidad,
      tipoPrecio,
      precioUnitario,
      total,
      costo,
      ganancia,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error registrando venta:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al registrar venta', detalle }, { status: 500 });
  }
}
