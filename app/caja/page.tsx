'use client';

import { useState, useEffect, useMemo } from 'react';
import { Venta, Gasto } from '@/lib/types';
import { formatPrecio } from '@/lib/format';

type Movimiento =
  | { tipo: 'venta'; fecha: string; descripcion: string; monto: number; detalle: string }
  | { tipo: 'gasto'; fecha: string; descripcion: string; monto: number; detalle: string };

export default function Caja() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));

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

  const ventasMes = useMemo(
    () => ventas.filter((v) => v.fecha.startsWith(mes)),
    [ventas, mes]
  );
  const gastosMes = useMemo(
    () => gastos.filter((g) => g.fecha.startsWith(mes)),
    [gastos, mes]
  );

  const totalVentas = ventasMes.reduce((a, v) => a + v.total, 0);
  const totalGanancia = ventasMes.reduce((a, v) => a + v.ganancia, 0);
  const totalGastos = gastosMes.reduce((a, g) => a + g.monto, 0);
  const saldo = totalVentas - totalGastos;
  const resultadoNeto = totalGanancia - totalGastos;

  // Gastos por categoría
  const gastosPorCategoria = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const g of gastosMes) {
      mapa[g.categoria] = (mapa[g.categoria] || 0) + g.monto;
    }
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [gastosMes]);

  // Timeline unificada
  const movimientos: Movimiento[] = useMemo(() => {
    const v: Movimiento[] = ventasMes.map((v) => ({
      tipo: 'venta',
      fecha: v.fecha,
      descripcion: v.nombreComercial,
      monto: v.total,
      detalle: `${v.cantidad} u · ${v.tipoPrecio} · ${v.origen || '—'}`,
    }));
    const g: Movimiento[] = gastosMes.map((g) => ({
      tipo: 'gasto',
      fecha: g.fecha,
      descripcion: g.descripcion,
      monto: g.monto,
      detalle: g.categoria,
    }));
    return [...v, ...g].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [ventasMes, gastosMes]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Caja</h1>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Ventas</p>
              <p className="text-2xl font-bold text-indigo-700">{formatPrecio(totalVentas)}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Gastos</p>
              <p className="text-2xl font-bold text-rose-600">{formatPrecio(totalGastos)}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Saldo (ventas − gastos)</p>
              <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPrecio(saldo)}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Resultado neto</p>
              <p className={`text-2xl font-bold ${resultadoNeto >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {formatPrecio(resultadoNeto)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">ganancia − gastos</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Gastos por categoría */}
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Gastos por categoría</h2>
              {gastosPorCategoria.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Sin gastos este mes</p>
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
                          style={{ width: `${totalGastos > 0 ? (monto / totalGastos) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="md:col-span-2 bg-white rounded-xl shadow overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Movimientos del mes</h2>
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
                <p className="text-gray-400 text-sm text-center py-8">Sin movimientos este mes</p>
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
