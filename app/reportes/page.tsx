'use client';

import { useState, useEffect, useMemo } from 'react';
import { Venta } from '@/lib/types';

export default function Reportes() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM

  useEffect(() => {
    fetch('/api/ventas')
      .then((r) => r.json())
      .then((data) => {
        setVentas(data);
        setLoading(false);
      });
  }, []);

  const ventasMes = useMemo(
    () => ventas.filter((v) => v.fecha.startsWith(mes)),
    [ventas, mes]
  );

  const totalVendido = ventasMes.reduce((a, v) => a + v.total, 0);
  const totalGanancia = ventasMes.reduce((a, v) => a + v.ganancia, 0);
  const totalCosto = ventasMes.reduce((a, v) => a + v.costo * v.cantidad, 0);
  const cantidadVentas = ventasMes.length;

  // Top productos por total vendido
  const topProductos = useMemo(() => {
    const mapa: Record<string, { nombre: string; total: number; cantidad: number; ganancia: number }> = {};
    for (const v of ventasMes) {
      if (!mapa[v.cod]) mapa[v.cod] = { nombre: v.nombreComercial, total: 0, cantidad: 0, ganancia: 0 };
      mapa[v.cod].total += v.total;
      mapa[v.cod].cantidad += v.cantidad;
      mapa[v.cod].ganancia += v.ganancia;
    }
    return Object.entries(mapa)
      .map(([cod, data]) => ({ cod, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [ventasMes]);

  // Ventas por día del mes
  const ventasPorDia = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const v of ventasMes) {
      mapa[v.fecha] = (mapa[v.fecha] || 0) + v.total;
    }
    return Object.entries(mapa).sort((a, b) => a[0].localeCompare(b[0]));
  }, [ventasMes]);

  const maxDia = Math.max(...ventasPorDia.map(([, t]) => t), 1);

  // Ventas por tipo de precio
  const porTipo = useMemo(() => {
    const mapa: Record<string, number> = { UNIDAD: 0, EFECTIVO: 0, MAYOR: 0 };
    for (const v of ventasMes) mapa[v.tipoPrecio] = (mapa[v.tipoPrecio] || 0) + v.total;
    return mapa;
  }, [ventasMes]);

  if (loading) return <p className="text-gray-500">Cargando reportes...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Ventas registradas</p>
          <p className="text-3xl font-bold text-gray-800">{cantidadVentas}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Total vendido</p>
          <p className="text-3xl font-bold text-indigo-700">${totalVendido.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Ganancia</p>
          <p className="text-3xl font-bold text-green-600">${totalGanancia.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Costo total</p>
          <p className="text-3xl font-bold text-red-500">${totalCosto.toFixed(0)}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Ventas por día */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Ventas por día</h2>
          {ventasPorDia.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sin datos para este mes</p>
          ) : (
            <div className="space-y-2">
              {ventasPorDia.map(([fecha, total]) => (
                <div key={fecha} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500 w-24 shrink-0">{fecha.slice(5)}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full"
                      style={{ width: `${(total / maxDia) * 100}%` }}
                    />
                  </div>
                  <span className="text-gray-700 font-medium w-20 text-right">${total.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Por tipo de precio */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Por tipo de precio</h2>
          <div className="space-y-3">
            {(['EFECTIVO', 'UNIDAD', 'MAYOR'] as const).map((tipo) => {
              const val = porTipo[tipo] || 0;
              const pct = totalVendido > 0 ? (val / totalVendido) * 100 : 0;
              return (
                <div key={tipo}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{tipo}</span>
                    <span className="font-medium">${val.toFixed(0)} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className="bg-indigo-400 h-3 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top productos */}
      <div className="bg-white rounded-xl shadow mt-6 overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-gray-700">Top 10 Productos</h2>
        </div>
        {topProductos.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Sin ventas este mes</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-5 py-3 text-left">#</th>
                <th className="px-5 py-3 text-left">Producto</th>
                <th className="px-5 py-3 text-center">Unidades</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Ganancia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topProductos.map((p, i) => (
                <tr key={p.cod} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{p.nombre}</td>
                  <td className="px-5 py-3 text-center">{p.cantidad}</td>
                  <td className="px-5 py-3 text-right font-semibold">${p.total.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right text-green-600">${p.ganancia.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
