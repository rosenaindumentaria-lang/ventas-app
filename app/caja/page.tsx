'use client';

import { useState, useEffect, useMemo } from 'react';
import { Venta, Gasto } from '@/lib/types';
import { formatPrecio } from '@/lib/format';

type Movimiento =
  | { tipo: 'venta'; fecha: string; descripcion: string; monto: number; detalle: string }
  | { tipo: 'gasto'; fecha: string; descripcion: string; monto: number; detalle: string };

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
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(''); // '' = sin filtro (detalle muestra todo)

  useEffect(() => {
    Promise.all([
      fetch('/api/ventas').then((r) => r.json()),
      fetch('/api/gastos').then((r) => r.json()),
    ]).then(([v, g]) => {
      setVentas(v);
      setGastos(g);
      setLoading(false);
    });
  }, []);

  // ── Acumulado total (la caja real) ──
  const totalVentasHist = ventas.reduce((a, v) => a + v.total, 0);
  const totalGananciaHist = ventas.reduce((a, v) => a + v.ganancia, 0);
  const totalGastosHist = gastos.reduce((a, g) => a + g.monto, 0);
  const saldoCaja = totalVentasHist - totalGastosHist;
  const resultadoNetoHist = totalGananciaHist - totalGastosHist;

  // ── Evolución mes a mes, con saldo acumulado corriendo ──
  const evolucion = useMemo(() => {
    const mapa: Record<string, { ventas: number; ganancia: number; gastos: number }> = {};
    for (const v of ventas) {
      const ym = v.fecha.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      if (!mapa[ym]) mapa[ym] = { ventas: 0, ganancia: 0, gastos: 0 };
      mapa[ym].ventas += v.total;
      mapa[ym].ganancia += v.ganancia;
    }
    for (const g of gastos) {
      const ym = g.fecha.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      if (!mapa[ym]) mapa[ym] = { ventas: 0, ganancia: 0, gastos: 0 };
      mapa[ym].gastos += g.monto;
    }
    let acum = 0;
    return Object.keys(mapa)
      .sort()
      .map((ym) => {
        const d = mapa[ym];
        acum += d.ventas - d.gastos;
        return { ym, ...d, saldoAcum: acum };
      });
  }, [ventas, gastos]);

  // ── Detalle filtrado (por mes seleccionado, o todo) ──
  const ventasFiltradas = useMemo(
    () => (mes ? ventas.filter((v) => v.fecha.startsWith(mes)) : ventas),
    [ventas, mes]
  );
  const gastosFiltrados = useMemo(
    () => (mes ? gastos.filter((g) => g.fecha.startsWith(mes)) : gastos),
    [gastos, mes]
  );

  const ventasFiltradasTotal = ventasFiltradas.reduce((a, v) => a + v.total, 0);
  const gastosFiltradosTotal = gastosFiltrados.reduce((a, g) => a + g.monto, 0);
  const resultadoFiltrado = ventasFiltradasTotal - gastosFiltradosTotal;

  const gastosPorCategoria = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const g of gastosFiltrados) {
      mapa[g.categoria] = (mapa[g.categoria] || 0) + g.monto;
    }
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [gastosFiltrados]);

  const movimientos: Movimiento[] = useMemo(() => {
    const v: Movimiento[] = ventasFiltradas.map((v) => ({
      tipo: 'venta',
      fecha: v.fecha,
      descripcion: v.nombreComercial,
      monto: v.total,
      detalle: `${v.cantidad} u · ${v.tipoPrecio} · ${v.origen || '—'}`,
    }));
    const g: Movimiento[] = gastosFiltrados.map((g) => ({
      tipo: 'gasto',
      fecha: g.fecha,
      descripcion: g.descripcion,
      monto: g.monto,
      detalle: g.categoria,
    }));
    return [...v, ...g].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [ventasFiltradas, gastosFiltrados]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Caja de Rosena</h1>

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <>
          {/* Saldo acumulado: la caja real */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl shadow-lg p-6 mb-6 text-white">
            <p className="text-sm text-indigo-200 mb-1">💰 Saldo acumulado en caja</p>
            <p className="text-4xl font-bold">{formatPrecio(saldoCaja)}</p>
            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4 text-sm">
              <span className="text-indigo-100">
                Ventas históricas: <strong className="text-white">{formatPrecio(totalVentasHist)}</strong>
              </span>
              <span className="text-indigo-100">
                Gastos históricos: <strong className="text-white">{formatPrecio(totalGastosHist)}</strong>
              </span>
              <span className="text-indigo-100">
                Resultado neto (ganancia − gastos):{' '}
                <strong className="text-white">{formatPrecio(resultadoNetoHist)}</strong>
              </span>
            </div>
          </div>

          {/* Filtro por mes + totales del período */}
          <div className="bg-white rounded-xl shadow p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                {mes ? `Resumen de ${nombreMes(mes)}` : 'Resumen de todos los meses'}
              </h2>
              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Ventas</p>
                <p className="text-xl font-bold text-indigo-700">{formatPrecio(ventasFiltradasTotal)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Gastos</p>
                <p className="text-xl font-bold text-rose-600">{formatPrecio(gastosFiltradosTotal)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Resultado</p>
                <p className={`text-xl font-bold ${resultadoFiltrado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPrecio(resultadoFiltrado)}
                </p>
              </div>
            </div>
          </div>

          {/* Evolución mes a mes */}
          <div className="bg-white rounded-xl shadow mb-6 overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="text-sm font-semibold text-gray-700">Evolución mes a mes</h2>
            </div>
            {evolucion.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Sin movimientos registrados</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                    <tr>
                      <th className="px-5 py-3 text-left">Mes</th>
                      <th className="px-5 py-3 text-right">Ventas</th>
                      <th className="px-5 py-3 text-right">Gastos</th>
                      <th className="px-5 py-3 text-right">Resultado mes</th>
                      <th className="px-5 py-3 text-right">Saldo acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {evolucion.map((e) => {
                      const resultadoMes = e.ventas - e.gastos;
                      return (
                        <tr
                          key={e.ym}
                          onClick={() => setMes(mes === e.ym ? '' : e.ym)}
                          className={`cursor-pointer hover:bg-indigo-50 transition-colors ${
                            mes === e.ym ? 'bg-indigo-50' : ''
                          }`}
                        >
                          <td className="px-5 py-3 font-medium text-gray-800">{nombreMes(e.ym)}</td>
                          <td className="px-5 py-3 text-right text-indigo-600">{formatPrecio(e.ventas)}</td>
                          <td className="px-5 py-3 text-right text-rose-600">{formatPrecio(e.gastos)}</td>
                          <td className={`px-5 py-3 text-right font-medium ${resultadoMes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPrecio(resultadoMes)}
                          </td>
                          <td className={`px-5 py-3 text-right font-bold ${e.saldoAcum >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                            {formatPrecio(e.saldoAcum)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detalle (filtrable por mes) */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Detalle {mes ? `· ${nombreMes(mes)}` : '· Todos los movimientos'}
            </h2>
            {mes && (
              <button onClick={() => setMes('')} className="text-xs text-indigo-600 hover:underline">
                Ver todo
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Gastos por categoría */}
            <div className="bg-white rounded-xl shadow p-5 h-fit">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Gastos por categoría</h2>
              {gastosPorCategoria.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Sin gastos</p>
              ) : (
                <div className="space-y-3">
                  {gastosPorCategoria.map(([cat, monto]) => (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{cat}</span>
                        <span className="font-medium text-rose-600">{formatPrecio(monto)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-rose-400 h-2 rounded-full"
                          style={{ width: `${gastosFiltradosTotal > 0 ? (monto / gastosFiltradosTotal) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="md:col-span-2 bg-white rounded-xl shadow overflow-hidden h-fit">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Movimientos</h2>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" /> Venta
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Gasto
                  </span>
                </div>
              </div>
              {movimientos.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Sin movimientos</p>
              ) : (
                <ul className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
                  {movimientos.map((m, i) => (
                    <li key={i} className="px-5 py-3 flex items-center gap-3">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          m.tipo === 'venta' ? 'bg-indigo-400' : 'bg-rose-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.descripcion}</p>
                        <p className="text-xs text-gray-400">
                          {m.fecha.slice(5).replace('-', '/')} · {m.detalle}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold shrink-0 ${
                          m.tipo === 'venta' ? 'text-indigo-600' : 'text-rose-600'
                        }`}
                      >
                        {m.tipo === 'venta' ? '+' : '−'} {formatPrecio(m.monto)}
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
