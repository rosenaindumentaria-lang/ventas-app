import type { FilaStock, MovimientoStock, Producto, Venta } from './types';

// Cuenta el stock de cada artículo a partir del libro de hechos (hoja STOCK) y
// las ventas. No guarda nada: se recalcula cada vez, así corregir una venta o
// borrar un hecho equivocado se refleja solo.
//
// Regla por artículo:
//  1. Si hay un CONTEO, manda el más reciente: su cantidad es la existencia al
//     CIERRE de esa fecha, y sólo cuentan los hechos y ventas de días POSTERIORES.
//  2. Si nunca se lo contó, la cuenta arranca en el primer hecho cargado (una
//     compra, por ejemplo) y cuenta desde ese día inclusive. Las ventas de antes
//     no se restan: salieron de un stock que acá nunca se registró.
//  3. Sin ningún hecho, el artículo está "sin contar" (stock null).
export function calcularStock(
  productos: Producto[],
  ventas: Pick<Venta, 'cod' | 'fecha' | 'cantidad'>[],
  movs: MovimientoStock[]
): FilaStock[] {
  const movsPorCod = new Map<string, MovimientoStock[]>();
  for (const m of movs) {
    const lista = movsPorCod.get(m.cod) ?? [];
    lista.push(m);
    movsPorCod.set(m.cod, lista);
  }
  const ventasPorCod = new Map<string, Pick<Venta, 'fecha' | 'cantidad'>[]>();
  for (const v of ventas) {
    const cod = String(v.cod).trim();
    const lista = ventasPorCod.get(cod) ?? [];
    lista.push(v);
    ventasPorCod.set(cod, lista);
  }

  return productos.map((p) => {
    const cod = String(p.cod).trim();
    const hechos = movsPorCod.get(cod) ?? [];
    const base = {
      cod,
      nombre: p.nombreComercial || p.descripcion || cod,
      rubro: p.rubro,
      costo: p.costo,
    };
    if (hechos.length === 0) return { ...base, stock: null, valor: 0, desde: '', ultimoMov: '' };

    // El conteo más reciente; a igual fecha, el último cargado (id = nº de fila).
    const conteos = hechos
      .filter((h) => h.tipo === 'CONTEO')
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || Number(a.id) - Number(b.id));
    const ultimoConteo = conteos[conteos.length - 1];

    let stock: number;
    let desde: string;
    let cuentaDesde: (fecha: string) => boolean;
    if (ultimoConteo) {
      stock = ultimoConteo.cantidad;
      desde = ultimoConteo.fecha;
      cuentaDesde = (f) => f > ultimoConteo.fecha;
    } else {
      stock = 0;
      desde = hechos.map((h) => h.fecha).sort()[0];
      cuentaDesde = (f) => f >= desde;
    }

    for (const h of hechos) {
      if (h.tipo !== 'CONTEO' && cuentaDesde(h.fecha)) stock += h.cantidad;
    }
    for (const v of ventasPorCod.get(cod) ?? []) {
      if (cuentaDesde(v.fecha)) stock -= v.cantidad;
    }

    const ultimoMov = hechos.map((h) => h.fecha).sort().pop() ?? '';
    const valor = stock > 0 && p.costo > 0 ? stock * p.costo : 0;
    return { ...base, stock, valor, desde, ultimoMov };
  });
}
