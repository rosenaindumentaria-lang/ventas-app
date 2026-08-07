import { NextResponse } from 'next/server';
import { getVentas, registrarVenta, borrarVenta, editarVenta, getProductos } from '@/lib/sheets';
import { getSesion } from '@/lib/auth';

export async function GET() {
  try {
    const [ventas, productos] = await Promise.all([getVentas(), getProductos()]);
    const porCod = new Map(productos.map((p) => [p.cod, p]));

    const ventasConGanancia = ventas.map((v) => {
      const prod = porCod.get(v.cod);
      const costo = v.costo > 0 ? v.costo : (prod?.costo ?? 0);
      // La ganancia sale del TOTAL cobrado, no del precio de lista: cuando se
      // hace un descuento, el total de la planilla es menor que
      // precioUnitario x cantidad, y calcularla sobre la lista inventa una
      // ganancia que nunca entró. Pasaba con el Vestido Dubai del 16/2, vendido
      // a $69.300 sobre una lista de $84.403: sobrestimaba $15.103 y subía el
      // margen de febrero de 49,1% a 55,6%.
      const ganancia = v.total - costo * v.cantidad;
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
    const { origen, fecha: fechaBody, cod, nombreComercial, cantidad, tipoPrecio, precioUnitario, costo } = body;

    if (!cod || !cantidad || !tipoPrecio || !precioUnitario) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const sesion = await getSesion();
    const total = precioUnitario * cantidad;
    // Misma cuenta que en el GET, para que no se separen si un dia el alta
    // permite cargar un total distinto al precio por la cantidad.
    const ganancia = total - costo * cantidad;
    const fecha = fechaBody || new Date().toISOString().split('T')[0];

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
      usuario: sesion?.usuario || '',
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
    const { id, cantidad, fecha } = body;
    if (!id || !cantidad || cantidad < 1) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    await editarVenta(id, cantidad, fecha);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error editando venta:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al editar venta', detalle }, { status: 500 });
  }
}
