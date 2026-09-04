'use client';

import { useState, useEffect, useMemo } from 'react';
import { Venta, Gasto, MovimientoCaja } from '@/lib/types';
import { formatPrecio } from '@/lib/format';

type Linea = {
  tipo: 'venta' | 'gasto' | 'entrada' | 'salida';
  fecha: string;
  descripcion: string;
  monto: number;
  detalle: string;
};

// Color y signo de cada tipo de línea en el timeline de movimientos.
const ESTILO_LINEA: Record<Linea['tipo'], { punto: string; texto: string; signo: string }> = {
  venta: { punto: 'bg-acento-claro', texto: 'text-marca', signo: '+' },
  entrada: { punto: 'bg-verde', texto: 'text-verde', signo: '+' },
  salida: { punto: 'bg-ocre', texto: 'text-ocre', signo: '−' },
  gasto: { punto: 'bg-rojo', texto: 'text-rojo', signo: '−' },
};

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function nombreMes(ym: string): string {
  const [a, m] = ym.split('-');
  return `${NOMBRES_MES[parseInt(m) - 1]} ${a}`;
}

export default function Caja() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [movs, setMovs] = useState<MovimientoCaja[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(''); // '' = sin filtro (detalle muestra todo)

  useEffect(() => {
    Promise.all([
      fetch('/api/ventas').then((r) => r.json()),
      fetch('/api/gastos').then((r) => r.json()),
      fetch('/api/movimientos').then((r) => r.json()),
    ]).then(([v, g, m]) => {
      setVentas(v);
      setGastos(g);
      setMovs(Array.isArray(m) ? m : []);
      setLoading(false);
    });
  }, []);

  // ── Acumulado total (la caja real) ──
  const totalVentasHist = ventas.reduce((a, v) => a + v.total, 0);
  const totalGananciaHist = ventas.reduce((a, v) => a + v.ganancia, 0);
  const totalGastosHist = gastos.reduce((a, g) => a + g.monto, 0);
  // Los movimientos ya vienen con signo: entradas en positivo, salidas en
  // negativo. Sumarlos da el neto que aportaron a la caja.
  const netoMovsHist = movs.reduce((a, m) => a + m.monto, 0);
  const saldoCaja = totalVentasHist + netoMovsHist - totalGastosHist;
  // Los movimientos NO tocan el resultado neto: un préstamo no es ganancia y
  // devolver su capital no es un gasto (cancelás una deuda, no consumís nada).
  // Sólo los intereses son un costo real, y ésos se cargan en Gastos.
  const resultadoNetoHist = totalGananciaHist - totalGastosHist;

  // ── Evolución mes a mes, con saldo acumulado corriendo ──
  const evolucion = useMemo(() => {
    const mapa: Record<string, { ventas: number; ganancia: number; gastos: number; movs: number }> = {};
    const nuevoMes = () => ({ ventas: 0, ganancia: 0, gastos: 0, movs: 0 });
    for (const v of ventas) {
      const ym = v.fecha.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      if (!mapa[ym]) mapa[ym] = nuevoMes();
      mapa[ym].ventas += v.total;
      mapa[ym].ganancia += v.ganancia;
    }
    for (const g of gastos) {
      const ym = g.fecha.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      if (!mapa[ym]) mapa[ym] = nuevoMes();
      mapa[ym].gastos += g.monto;
    }
    for (const m of movs) {
      const ym = m.fecha.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      if (!mapa[ym]) mapa[ym] = nuevoMes();
      mapa[ym].movs += m.monto;
    }
    let acum = 0;
    return Object.keys(mapa)
      .sort()
      .map((ym) => {
        const d = mapa[ym];
        acum += d.ventas + d.movs - d.gastos;
        return { ym, ...d, saldoAcum: acum };
      });
  }, [ventas, gastos, movs]);

  // ── Detalle filtrado (por mes seleccionado, o todo) ──
  const ventasFiltradas = useMemo(
    () => (mes ? ventas.filter((v) => v.fecha.startsWith(mes)) : ventas),
    [ventas, mes]
  );
  const gastosFiltrados = useMemo(
    () => (mes ? gastos.filter((g) => g.fecha.startsWith(mes)) : gastos),
    [gastos, mes]
  );
  const movsFiltrados = useMemo(
    () => (mes ? movs.filter((m) => m.fecha.startsWith(mes)) : movs),
    [movs, mes]
  );

  const ventasFiltradasTotal = ventasFiltradas.reduce((a, v) => a + v.total, 0);
  const gastosFiltradosTotal = gastosFiltrados.reduce((a, g) => a + g.monto, 0);
  const movsFiltradosTotal = movsFiltrados.reduce((a, m) => a + m.monto, 0);
  const resultadoFiltrado = ventasFiltradasTotal + movsFiltradosTotal - gastosFiltradosTotal;
  // Si nunca se cargó un movimiento, la caja se ve igual que antes: sin columnas
  // de más. Se mira la cantidad y no el neto, porque el neto puede dar 0 (un
  // préstamo ya devuelto del todo) y las filas igual existen.
  const hayMovs = movs.length > 0;

  const gastosPorCategoria = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const g of gastosFiltrados) {
      mapa[g.categoria] = (mapa[g.categoria] || 0) + g.monto;
    }
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [gastosFiltrados]);

  const lineas: Linea[] = useMemo(() => {
    const v: Linea[] = ventasFiltradas.map((v) => ({
      tipo: 'venta',
      fecha: v.fecha,
      descripcion: v.nombreComercial,
      monto: v.total,
      detalle: `${v.cantidad} u · ${v.tipoPrecio} · ${v.origen || '—'}`,
    }));
    const g: Linea[] = gastosFiltrados.map((g) => ({
      tipo: 'gasto',
      fecha: g.fecha,
      descripcion: g.descripcion,
      monto: g.monto,
      detalle: g.categoria,
    }));
    const m: Linea[] = movsFiltrados.map((m) => ({
      tipo: m.monto >= 0 ? 'entrada' : 'salida',
      fecha: m.fecha,
      descripcion: m.detalle,
      monto: Math.abs(m.monto),
      detalle: m.tipo,
    }));
    return [...v, ...g, ...m].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [ventasFiltradas, gastosFiltrados, movsFiltrados]);

  return (
    <div>
      <h1 className="font-display text-3xl font-normal text-tinta mb-6">Caja de Rosena</h1>

      {loading ? (
        <p className="text-tinta-suave">Cargando...</p>
      ) : (
        <>
          {/* Saldo acumulado: la caja real */}
          <div className="bg-gradient-to-br from-marca to-marca-fuerte rounded-panel p-6 mb-6 text-white">
            <p className="text-sm text-marca-suave mb-1">💰 Saldo acumulado en caja</p>
            <p className="text-3xl sm:text-4xl font-bold break-words">{formatPrecio(saldoCaja)}</p>
            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4 text-sm">
              <span className="text-marca-suave">
                Ventas históricas: <strong className="text-white">{formatPrecio(totalVentasHist)}</strong>
              </span>
              {hayMovs && (
                <span className="text-marca-suave">
                  Otros movimientos: <strong className="text-white">{formatPrecio(netoMovsHist)}</strong>
                </span>
              )}
              <span className="text-marca-suave">
                Gastos históricos: <strong className="text-white">{formatPrecio(totalGastosHist)}</strong>
              </span>
              <span className="text-marca-suave">
                Resultado neto (ganancia − gastos):{' '}
                <strong className="text-white">{formatPrecio(resultadoNetoHist)}</strong>
              </span>
            </div>
          </div>

          {/* Filtro por mes + totales del período */}
          <div className="panel p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="font-display text-lg font-normal text-tinta">
                {mes ? `Resumen de ${nombreMes(mes)}` : 'Resumen de todos los meses'}
              </h2>
              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-full sm:w-auto border border-borde rounded-panel px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marca"
              >
                <option value="">Todos los meses</option>
                {evolucion
                  .slice()
                  .reverse()
                  .map((e) => (
                    <option key={e.ym} value={e.ym}>
                      {nombreMes(e.ym)}
                    </option>
                  ))}
              </select>
            </div>
            <div className={`grid gap-2 sm:gap-4 ${hayMovs ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
              <div className="text-center">
                <p className="text-xs text-tinta-suave mb-1">Ventas</p>
                <p className="text-base sm:text-xl font-bold text-marca break-words">{formatPrecio(ventasFiltradasTotal)}</p>
              </div>
              {hayMovs && (
                <div className="text-center">
                  <p className="text-xs text-tinta-suave mb-1">Otros movimientos</p>
                  <p className={`text-base sm:text-xl font-bold break-words ${movsFiltradosTotal >= 0 ? 'text-verde' : 'text-ocre'}`}>
                    {formatPrecio(movsFiltradosTotal)}
                  </p>
                </div>
              )}
              <div className="text-center">
                <p className="text-xs text-tinta-suave mb-1">Gastos</p>
                <p className="text-base sm:text-xl font-bold text-rojo break-words">{formatPrecio(gastosFiltradosTotal)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-tinta-suave mb-1">Resultado</p>
                <p className={`text-base sm:text-xl font-bold break-words ${resultadoFiltrado >= 0 ? 'text-verde' : 'text-rojo'}`}>
                  {formatPrecio(resultadoFiltrado)}
                </p>
              </div>
            </div>
          </div>

          {/* Evolución mes a mes */}
          <div className="panel mb-6 overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="font-display text-lg font-normal text-tinta">Evolución mes a mes</h2>
            </div>
            {evolucion.length === 0 ? (
              <p className="text-tinta-tenue text-sm text-center py-8">Sin movimientos registrados</p>
            ) : (
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-panel-2 text-tinta-suave uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3 text-left">Mes</th>
                      <th className="px-5 py-3 text-right">Ventas</th>
                      {hayMovs && <th className="px-5 py-3 text-right">Otros movim.</th>}
                      <th className="px-5 py-3 text-right">Gastos</th>
                      <th className="px-5 py-3 text-right">Resultado mes</th>
                      <th className="px-5 py-3 text-right">Saldo acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde-suave">
                    {evolucion.map((e) => {
                      const resultadoMes = e.ventas + e.movs - e.gastos;
                      return (
                        <tr
                          key={e.ym}
                          onClick={() => setMes(mes === e.ym ? '' : e.ym)}
                          className={`cursor-pointer hover:bg-marca-suave transition-colors ${
                            mes === e.ym ? 'bg-marca-suave' : ''
                          }`}
                        >
                          <td className="px-5 py-3 font-medium text-tinta">{nombreMes(e.ym)}</td>
                          <td className="px-5 py-3 text-right text-marca">{formatPrecio(e.ventas)}</td>
                          {hayMovs && (
                            <td className={`px-5 py-3 text-right ${e.movs >= 0 ? 'text-verde' : 'text-ocre'}`}>
                              {e.movs === 0 ? '—' : formatPrecio(e.movs)}
                            </td>
                          )}
                          <td className="px-5 py-3 text-right text-rojo">{formatPrecio(e.gastos)}</td>
                          <td className={`px-5 py-3 text-right font-medium ${resultadoMes >= 0 ? 'text-verde' : 'text-rojo'}`}>
                            {formatPrecio(resultadoMes)}
                          </td>
                          <td className={`px-5 py-3 text-right font-bold ${e.saldoAcum >= 0 ? 'text-tinta' : 'text-rojo'}`}>
                            {formatPrecio(e.saldoAcum)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Evolución como tarjetas en mobile (más reciente primero) */}
            {evolucion.length > 0 && (
              <div className="md:hidden divide-y divide-borde-suave">
                {evolucion
                  .slice()
                  .reverse()
                  .map((e) => {
                    const resultadoMes = e.ventas + e.movs - e.gastos;
                    return (
                      <button
                        key={e.ym}
                        onClick={() => setMes(mes === e.ym ? '' : e.ym)}
                        className={`w-full text-left px-4 py-3 ${mes === e.ym ? 'bg-marca-suave' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <span className="font-medium text-tinta">{nombreMes(e.ym)}</span>
                          <span className="text-right">
                            <span className={`block text-sm font-bold ${e.saldoAcum >= 0 ? 'text-tinta' : 'text-rojo'}`}>
                              {formatPrecio(e.saldoAcum)}
                            </span>
                            <span className="block text-[10px] text-tinta-tenue">saldo acum.</span>
                          </span>
                        </div>
                        <div className={`grid gap-2 text-xs ${e.movs !== 0 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                          <div>
                            <span className="block text-tinta-tenue">Ventas</span>
                            <span className="font-medium text-marca break-words">{formatPrecio(e.ventas)}</span>
                          </div>
                          {e.movs !== 0 && (
                            <div>
                              <span className="block text-tinta-tenue">Otros movim.</span>
                              <span className={`font-medium break-words ${e.movs > 0 ? 'text-verde' : 'text-ocre'}`}>
                                {formatPrecio(e.movs)}
                              </span>
                            </div>
                          )}
                          <div>
                            <span className="block text-tinta-tenue">Gastos</span>
                            <span className="font-medium text-rojo break-words">{formatPrecio(e.gastos)}</span>
                          </div>
                          <div>
                            <span className="block text-tinta-tenue">Resultado</span>
                            <span className={`font-medium break-words ${resultadoMes >= 0 ? 'text-verde' : 'text-rojo'}`}>
                              {formatPrecio(resultadoMes)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Detalle (filtrable por mes) */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-normal text-tinta">
              Detalle {mes ? `· ${nombreMes(mes)}` : '· Todos los movimientos'}
            </h2>
            {mes && (
              <button onClick={() => setMes('')} className="text-xs text-marca hover:underline">
                Ver todo
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Gastos por categoría */}
            <div className="panel p-5 h-fit">
              <h2 className="font-display text-lg font-normal text-tinta mb-4">Gastos por categoría</h2>
              {gastosPorCategoria.length === 0 ? (
                <p className="text-tinta-tenue text-sm text-center py-6">Sin gastos</p>
              ) : (
                <div className="space-y-3">
                  {gastosPorCategoria.map(([cat, monto]) => (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-tinta-media">{cat}</span>
                        <span className="font-medium text-rojo">{formatPrecio(monto)}</span>
                      </div>
                      <div className="w-full bg-marca-suave h-1.5">
                        <div
                          className="bg-rojo h-1.5"
                          style={{ width: `${gastosFiltradosTotal > 0 ? (monto / gastosFiltradosTotal) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="md:col-span-2 panel overflow-hidden h-fit">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h2 className="font-display text-lg font-normal text-tinta">Movimientos</h2>
                <div className="flex gap-3 text-xs text-tinta-tenue">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-acento-claro inline-block" /> Venta
                  </span>
                  {hayMovs && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-verde inline-block" /> Entrada
                    </span>
                  )}
                  {hayMovs && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-ocre inline-block" /> Salida
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rojo inline-block" /> Gasto
                  </span>
                </div>
              </div>
              {lineas.length === 0 ? (
                <p className="text-tinta-tenue text-sm text-center py-8">Sin movimientos</p>
              ) : (
                <ul className="divide-y divide-borde-suave max-h-[480px] overflow-y-auto">
                  {lineas.map((l, i) => (
                    <li key={i} className="px-5 py-3 flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${ESTILO_LINEA[l.tipo].punto}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-tinta truncate">{l.descripcion}</p>
                        <p className="text-xs text-tinta-tenue">
                          {l.fecha.slice(5).replace('-', '/')} · {l.detalle}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold shrink-0 ${ESTILO_LINEA[l.tipo].texto}`}>
                        {ESTILO_LINEA[l.tipo].signo} {formatPrecio(l.monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
