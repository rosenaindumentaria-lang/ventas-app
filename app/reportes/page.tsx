'use client';

import { useState, useEffect, useMemo } from 'react';
import { Venta } from '@/lib/types';
import { formatPrecio } from '@/lib/format';
import GraficoMensual, { MesDato } from '@/app/components/GraficoMensual';

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function nombreMes(ym: string): string {
  const [a, m] = ym.split('-');
  return `${NOMBRES_MES[parseInt(m, 10) - 1] ?? m} ${a}`;
}

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

  // Serie mensual completa, para ver todo el historial de una sin ir mes por mes.
  const porMes = useMemo<MesDato[]>(() => {
    const mapa: Record<string, MesDato> = {};
    for (const v of ventas) {
      const ym = v.fecha.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      if (!mapa[ym]) mapa[ym] = { ym, total: 0, costo: 0, ganancia: 0, cantidad: 0 };
      mapa[ym].total += v.total;
      mapa[ym].costo += v.costo * v.cantidad;
      mapa[ym].ganancia += v.ganancia;
      mapa[ym].cantidad += 1;
    }

    const conVentas = Object.keys(mapa).sort();
    if (conVentas.length === 0) return [];

    // Se rellenan los meses sin ventas en vez de saltearlos: si no, dos meses
    // separados por medio año aparecen pegados y el grafico miente sobre el paso
    // del tiempo. Se llega hasta el mes actual para poder ver el mes en curso.
    const hoyYm = new Date().toISOString().slice(0, 7);
    const fin = hoyYm > conVentas[conVentas.length - 1] ? hoyYm : conVentas[conVentas.length - 1];
    const [anioIni, mesIni] = conVentas[0].split('-').map(Number);
    const [anioFin, mesFin] = fin.split('-').map(Number);

    const serie: MesDato[] = [];
    for (let a = anioIni, m = mesIni; a < anioFin || (a === anioFin && m <= mesFin); ) {
      const ym = `${a}-${String(m).padStart(2, '0')}`;
      serie.push(mapa[ym] ?? { ym, total: 0, costo: 0, ganancia: 0, cantidad: 0 });
      m++;
      if (m > 12) { m = 1; a++; }
    }
    return serie;
  }, [ventas]);

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

  // Ventas por rubro
  const porRubro = useMemo(() => {
    const mapa: Record<string, { total: number; cantidad: number; ganancia: number }> = {};
    for (const v of ventasMes) {
      const rubro = v.rubro || 'Sin rubro';
      if (!mapa[rubro]) mapa[rubro] = { total: 0, cantidad: 0, ganancia: 0 };
      mapa[rubro].total += v.total;
      mapa[rubro].cantidad += v.cantidad;
      mapa[rubro].ganancia += v.ganancia;
    }
    return Object.entries(mapa)
      .map(([rubro, data]) => ({ rubro, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [ventasMes]);

  const maxRubro = Math.max(...porRubro.map((r) => r.total), 1);

  // Ventas por tipo de precio
  const porTipo = useMemo(() => {
    const mapa: Record<string, number> = { UNIDAD: 0, EFECTIVO: 0, MAYOR: 0 };
    for (const v of ventasMes) mapa[v.tipoPrecio] = (mapa[v.tipoPrecio] || 0) + v.total;
    return mapa;
  }, [ventasMes]);

  if (loading) return <p className="text-gray-500">Cargando reportes...</p>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div className="mb-6">
        <GraficoMensual datos={porMes} mesSeleccionado={mes} onSeleccionarMes={setMes} />
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Detalle de {nombreMes(mes)}</h2>

      {/* KPIs. Los importes se achican en mobile y parten palabra: un $1.283.519
          a text-3xl en media pantalla se desborda. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Ventas registradas</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-800">{cantidadVentas}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Total vendido</p>
          <p className="text-lg sm:text-2xl md:text-3xl font-bold text-indigo-700 break-words">{formatPrecio(totalVendido)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Ganancia</p>
          <p className="text-lg sm:text-2xl md:text-3xl font-bold text-green-600 break-words">{formatPrecio(totalGanancia)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Costo total</p>
          <p className="text-lg sm:text-2xl md:text-3xl font-bold text-red-500 break-words">{formatPrecio(totalCosto)}</p>
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
                <div key={fecha} className="flex items-center gap-2 sm:gap-3 text-sm">
                  <span className="text-gray-500 w-11 shrink-0 tabular-nums">{fecha.slice(5).replace('-', '/')}</span>
                  <div className="flex-1 min-w-0 bg-gray-100 rounded-full h-4 sm:h-5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full"
                      style={{ width: `${(total / maxDia) * 100}%` }}
                    />
                  </div>
                  {/* Sin ancho fijo: un $357.900 no entra en w-20 y quedaba cortado. */}
                  <span className="text-gray-700 font-medium text-right shrink-0 tabular-nums text-xs sm:text-sm">
                    {formatPrecio(total)}
                  </span>
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
                    <span className="font-medium">{formatPrecio(val)} ({pct.toFixed(0)}%)</span>
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

      {/* Ventas por rubro */}
      <div className="bg-white rounded-xl shadow mt-6 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Ventas por rubro</h2>
          {porRubro.length > 0 && (
            <span className="text-xs text-gray-400">
              Más vendido:{' '}
              <span className="font-semibold text-indigo-600">{porRubro[0].rubro}</span>
            </span>
          )}
        </div>
        {porRubro.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Sin ventas este mes</p>
        ) : (
          <div className="p-5 space-y-3">
            {porRubro.map((r) => (
              <div key={r.rubro}>
                <div className="flex flex-wrap justify-between gap-x-3 text-sm mb-1">
                  <span className="text-gray-700 font-medium">{r.rubro}</span>
                  <span className="text-gray-500 text-xs sm:text-sm">
                    {r.cantidad} u · {formatPrecio(r.total)} ·{' '}
                    <span className="text-green-600">{formatPrecio(r.ganancia)}</span>
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className="bg-indigo-500 h-3 rounded-full"
                    style={{ width: `${(r.total / maxRubro) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top productos */}
      <div className="bg-white rounded-xl shadow mt-6 overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-gray-700">Top 10 Productos</h2>
        </div>
        {topProductos.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Sin ventas este mes</p>
        ) : (
          <>
            {/* Tabla en escritorio */}
            <table className="hidden md:table w-full text-sm">
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
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatPrecio(p.total)}</td>
                    <td className="px-5 py-3 text-right text-green-600 tabular-nums">{formatPrecio(p.ganancia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Tarjetas en mobile: cinco columnas no entran en un celular */}
            <ul className="md:hidden divide-y divide-gray-100">
              {topProductos.map((p, i) => (
                <li key={p.cod} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="text-gray-300 font-bold text-sm shrink-0 w-5">{i + 1}</span>
                    <p className="font-medium text-gray-800 text-sm break-words flex-1">{p.nombre}</p>
                  </div>
                  <div className="mt-1.5 pl-7 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="block text-gray-400">Unidades</span>
                      <span className="font-medium text-gray-700">{p.cantidad}</span>
                    </div>
                    <div>
                      <span className="block text-gray-400">Total</span>
                      <span className="font-semibold text-gray-800 break-words">{formatPrecio(p.total)}</span>
                    </div>
                    <div>
                      <span className="block text-gray-400">Ganancia</span>
                      <span className="font-medium text-green-600 break-words">{formatPrecio(p.ganancia)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
