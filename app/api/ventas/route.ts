import { NextResponse } from 'next/server';
import { getVentas, registrarVenta, borrarVenta, editarVenta, getProductos } from '@/lib/sheets';

export async function GET() {
  try {
    const [ventas, productos] = await Promise.all([getVentas(), getProductos()]);
    const porCod = new Map(productos.map((p) => [p.cod, p]));

    const ventasConGanancia = ventas.map((v) => {
      const prod = porCod.get(v.cod);
      const costo = prod?.costo ?? v.costo;
      const ganancia = (v.precioUnitario - costo) * v.cantidad;
      return { ...v, costo, ganancia, rubro: prod?.rubro || 'Sin rubro' };
    });

    return NextResponse.json(ventasConGanancia);
  } catch (error) {
    console.error('Error fetching ventas:', error);
    return NextResponse.json({ error: 'Error al obtener ventas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { origen, cod, nombreComercial, cantidad, tipoPrecio, precioUnitario, costo } = body;

    if (!cod || !cantidad || !tipoPrecio || !precioUnitario) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const total = precioUnitario * cantidad;
    const ganancia = (precioUnitario - costo) * cantidad;
    const fecha = new Date().toISOString().split('T')[0];

    await registrarVenta({
      origen: origen || '',
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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta el ID' }, { status: 400 });

    await borrarVenta(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error borrando venta:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al borrar venta', detalle }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, cantidad } = body;
    if (!id || !cantidad || cantidad < 1) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    await editarVenta(id, cantidad);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error editando venta:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al editar venta', detalle }, { status: 500 });
  }
}
