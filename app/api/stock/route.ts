import { NextResponse } from 'next/server';
import {
  getProductos,
  getVentas,
  getMovimientosStock,
  registrarMovimientosStock,
  borrarMovimientoStock,
} from '@/lib/sheets';
import { getSesion } from '@/lib/auth';
import { calcularStock } from '@/lib/stock';
import { TIPOS_STOCK, type TipoStock } from '@/lib/types';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  try {
    const [productos, ventas, movs] = await Promise.all([
      getProductos(),
      getVentas(),
      getMovimientosStock(),
    ]);
    const filas = calcularStock(productos, ventas, movs);

    // Últimos hechos con el nombre del artículo, para poder revisarlos y
    // deshacer un error de carga.
    const nombres = new Map(filas.map((f) => [f.cod, f.nombre]));
    const historial = [...movs]
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || Number(b.id) - Number(a.id))
      .slice(0, 40)
      .map((m) => ({ ...m, nombre: nombres.get(m.cod) || m.cod }));

    return NextResponse.json({ filas, historial });
  } catch (error) {
    console.error('Error calculando stock:', error);
    return NextResponse.json({ error: 'Error al calcular el stock' }, { status: 500 });
  }
}

// Acepta uno o varios hechos: { movs: [{ cod, tipo, cantidad, fecha, detalle }] }.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entrada: unknown[] = Array.isArray(body.movs) ? body.movs : [];
    if (entrada.length === 0 || entrada.length > 500) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const productos = await getProductos();
    const codigos = new Set(productos.map((p) => String(p.cod).trim()));
    const sesion = await getSesion();
    const hoy = new Date().toISOString().split('T')[0];

    const movs = [];
    for (const raw of entrada) {
      const m = raw as Record<string, unknown>;
      const cod = String(m.cod ?? '').trim();
      const tipo = m.tipo as TipoStock;
      const cantidad = Number(m.cantidad);

      if (!codigos.has(cod)) {
        return NextResponse.json({ error: `El código ${cod} no existe en el catálogo` }, { status: 400 });
      }
      if (!TIPOS_STOCK.includes(tipo) || !Number.isFinite(cantidad)) {
        return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
      }
      // Un conteo no puede ser negativo, una compra tiene que sumar y un ajuste
      // en cero no corrige nada.
      const invalida =
        (tipo === 'CONTEO' && cantidad < 0) ||
        (tipo === 'COMPRA' && cantidad <= 0) ||
        (tipo === 'AJUSTE' && cantidad === 0);
      if (invalida) {
        return NextResponse.json(
          { error: `Cantidad inválida para ${tipo.toLowerCase()} (${cod})` },
          { status: 400 }
        );
      }

      movs.push({
        fecha: typeof m.fecha === 'string' && FECHA.test(m.fecha) ? m.fecha : hoy,
        cod,
        tipo,
        cantidad,
        detalle: typeof m.detalle === 'string' ? m.detalle.slice(0, 200) : '',
        usuario: sesion?.usuario || '',
      });
    }

    await registrarMovimientosStock(movs);
    return NextResponse.json({ success: true, cargados: movs.length });
  } catch (error) {
    console.error('Error registrando stock:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al registrar stock', detalle }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta el ID' }, { status: 400 });

    await borrarMovimientoStock(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error borrando movimiento de stock:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al borrar', detalle }, { status: 500 });
  }
}
