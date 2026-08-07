'use client';

import { useState, useEffect, useMemo } from 'react';
import { Venta, Gasto } from '@/lib/types';
import { formatPrecio } from '@/lib/format';
import { agrupar } from '@/lib/agrupar';
import GraficoMensual, { MesDato } from '@/app/components/GraficoMensual';
import Tarjeta, { Delta } from '@/app/components/Tarjeta';

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function nombreMes(ym: string): string {
  const [a, m] = ym.split('-');
  return `${NOMBRES_MES[parseInt(m, 10) - 1] ?? m} ${a}`;
}

function mesAnterior(ym: string): string {
  const [a, m] = ym.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

const pct = (n: number) => `${(n * 100).toFixed(1).replace('.', ',')}%`;
const pts = (n: number) => `${(n * 100).toFixed(1).replace('.', ',')} pts`;

// Variación relativa. Devuelve null cuando no hay base contra la cual comparar:
// pasar de $0 a $100 no es "+100%", es un mes que antes no existía, y mostrar un
// porcentaje inventado ahí es peor que no mostrar nada.
function deltaRelativo(actual: number, previo: number, contra: string): Delta | null {
  if (!previo) return null;
  const v = (actual - previo) / Math.abs(previo);
  return { valor: v, texto: `${v > 0 ? '+' : '−'}${pct(Math.abs(v))}`, contra };
}

// Para ratios, la variación va en puntos porcentuales, no en porcentaje del
// porcentaje: de 40% a 45% son "+5 pts", no "+12,5%".
function deltaPuntos(actual: number, previo: number, contra: string, hayPrevio: boolean): Delta | null {
  if (!hayPrevio) return null;
  const v = actual - previo;
  return { valor: v, texto: `${v > 0 ? '+' : '−'}${pts(Math.abs(v))}`, contra };
}

interface Metricas {
  total: number;
  ganancia: number;
  costo: number;
  gastos: number;
  unidades: number;
  nVentas: number;
  margenBruto: number;
  ticket: number;
  resultado: number;
  gastosSobreVentas: number;
  margenNeto: number;
  equilibrio: number; // cuánto hay que vender para que la ganancia cubra los gastos
}

function calcular(ventas: Venta[], gastos: Gasto[], ym: string): Metricas {
  const vs = ventas.filter((v) => v.fecha.startsWith(ym));
  const gs = gastos.filter((g) => g.fecha.startsWith(ym));

  const total = vs.reduce((a, v) => a + v.total, 0);
  const ganancia = vs.reduce((a, v) => a + v.ganancia, 0);
  const costo = vs.reduce((a, v) => a + v.costo * v.cantidad, 0);
  const gastosTot = gs.reduce((a, g) => a + g.monto, 0);
  const margenBruto = total ? ganancia / total : 0;

  return {
    total,
    ganancia,
    costo,
    gastos: gastosTot,
    unidades: vs.reduce((a, v) => a + v.cantidad, 0),
    nVentas: vs.length,
    margenBruto,
    ticket: vs.length ? total / vs.length : 0,
    resultado: ganancia - gastosTot,
    gastosSobreVentas: total ? gastosTot / total : 0,
    margenNeto: total ? (ganancia - gastosTot) / total : 0,
    // Sin margen no hay equilibrio posible: cada venta no deja nada para gastos.
    equilibrio: margenBruto > 0 ? gastosTot / margenBruto : 0,
  };
}

export default function Reportes() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    Promise.all([
      fetch('/api/ventas').then((r) => r.json()),
      fetch('/api/gastos').then((r) => r.json()),
    ]).then(([v, g]) => {
      setVentas(Array.isArray(v) ? v : []);
      setGastos(Array.isArray(g) ? g : []);
      setLoading(false);
    });
  }, []);

  const ventasMes = useMemo(() => ventas.filter((v) => v.fecha.startsWith(mes)), [ventas, mes]);

  const previo = mesAnterior(mes);
  const m = useMemo(() => calcular(ventas, gastos, mes), [ventas, gastos, mes]);
  const mPrev = useMemo(() => calcular(ventas, gastos, previo), [ventas, gastos, previo]);
  const hayPrevio = mPrev.nVentas > 0 || mPrev.gastos > 0;
  const contra = `vs ${NOMBRES_MES[parseInt(previo.split('-')[1], 10) - 1]?.toLowerCase() ?? previo}`;

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
    // separados por medio año aparecen pegados y el gráfico miente sobre el paso
    // del tiempo. Se llega hasta el mes actual para poder ver el mes en curso.
    const hoyYm = new Date().toISOString().slice(0, 7);
    const fin = hoyYm > conVentas[conVentas.length - 1] ? hoyYm : conVentas[conVentas.length - 1];
    const [anioIni, mesIni] = conVentas[0].split('-').map(Number);
    const [anioFin, mesFin] = fin.split('-').map(Number);

    const serie: MesDato[] = [];
    for (let a = anioIni, mm = mesIni; a < anioFin || (a === anioFin && mm <= mesFin); ) {
      const ym = `${a}-${String(mm).padStart(2, '0')}`;
      serie.push(mapa[ym] ?? { ym, total: 0, costo: 0, ganancia: 0, cantidad: 0 });
      mm++;
      if (mm > 12) { mm = 1; a++; }
    }
    return serie;
  }, [ventas]);

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

  const ventasPorDia = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const v of ventasMes) mapa[v.fecha] = (mapa[v.fecha] || 0) + v.total;
    return Object.entries(mapa).sort((a, b) => a[0].localeCompare(b[0]));
  }, [ventasMes]);
  const maxDia = Math.max(...ventasPorDia.map(([, t]) => t), 1);

  // Canal de venta y rubro se agrupan ignorando mayúsculas y espacios: en la
  // planilla conviven "Face" y "FACE", y "Vestido" con y sin espacio al final.
  const porCanal = useMemo(() => {
    return agrupar(ventasMes, (v) => v.origen)
      .map((g) => ({
        etiqueta: g.etiqueta || 'Sin dato',
        total: g.items.reduce((a, v) => a + v.total, 0),
        ganancia: g.items.reduce((a, v) => a + v.ganancia, 0),
        n: g.items.length,
      }))
      .sort((a, b) => b.total - a.total);
  }, [ventasMes]);

  const porRubro = useMemo(() => {
    return agrupar(ventasMes, (v) => v.rubro)
      .map((g) => ({
        etiqueta: g.etiqueta || 'Sin rubro',
        total: g.items.reduce((a, v) => a + v.total, 0),
        ganancia: g.items.reduce((a, v) => a + v.ganancia, 0),
        cantidad: g.items.reduce((a, v) => a + v.cantidad, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [ventasMes]);
  const maxRubro = Math.max(...porRubro.map((r) => r.total), 1);

  const porTipo = useMemo(() => {
    return agrupar(ventasMes, (v) => v.tipoPrecio)
      .map((g) => ({
        etiqueta: g.etiqueta || 'Sin dato',
        total: g.items.reduce((a, v) => a + v.total, 0),
        ganancia: g.items.reduce((a, v) => a + v.ganancia, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [ventasMes]);

  if (loading) return <p className="text-gray-500">Cargando reportes...</p>;

  const avanceEquilibrio = m.equilibrio > 0 ? Math.min(m.total / m.equilibrio, 1) : 0;
  const faltaEquilibrio = Math.max(m.equilibrio - m.total, 0);
  const cubierto = m.equilibrio > 0 && m.total >= m.equilibrio;

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

      <h2 className="text-sm font-semibold text-gray-700 mb-3">{nombreMes(mes)}</h2>

      {/* Indicadores del mes, con la variación contra el mes anterior */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Tarjeta
          etiqueta="Vendido"
          valor={formatPrecio(m.total)}
          detalle={`${m.nVentas} ${m.nVentas === 1 ? 'venta' : 'ventas'} · ${m.unidades} u`}
          delta={deltaRelativo(m.total, mPrev.total, contra)}
          colorValor="text-indigo-700"
        />
        <Tarjeta
          etiqueta="Ganancia bruta"
          valor={formatPrecio(m.ganancia)}
          detalle={`Costo ${formatPrecio(m.costo)}`}
          delta={deltaRelativo(m.ganancia, mPrev.ganancia, contra)}
          colorValor="text-green-600"
        />
        <Tarjeta
          etiqueta="Margen bruto"
          valor={pct(m.margenBruto)}
          detalle="De cada venta, antes de gastos"
          delta={deltaPuntos(m.margenBruto, mPrev.margenBruto, contra, hayPrevio && mPrev.total > 0)}
        />
        <Tarjeta
          etiqueta="Ticket promedio"
          valor={formatPrecio(m.ticket)}
          detalle="Por venta"
          delta={deltaRelativo(m.ticket, mPrev.ticket, contra)}
        />
      </div>

      {/* Rentabilidad: de la ganancia bruta a lo que queda de verdad */}
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Resultado del mes</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Ganancia bruta</span>
              <span className="font-medium text-green-600 tabular-nums">{formatPrecio(m.ganancia)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Gastos</span>
              <span className="font-medium text-rose-600 tabular-nums">− {formatPrecio(m.gastos)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium text-gray-700">Resultado</span>
              <span
                className={`font-bold tabular-nums ${m.resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {formatPrecio(m.resultado)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t">
            <div>
              <p className="text-xs text-gray-500">Gastos sobre ventas</p>
              <p
                className={`text-base font-bold ${
                  m.gastosSobreVentas > m.margenBruto ? 'text-red-500' : 'text-gray-800'
                }`}
              >
                {m.total ? pct(m.gastosSobreVentas) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Margen neto</p>
              <p className={`text-base font-bold ${m.margenNeto >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {m.total ? pct(m.margenNeto) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Punto de equilibrio */}
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Punto de equilibrio</h3>
          <p className="text-xs text-gray-400 mb-4">
            Cuánto hay que vender para que la ganancia cubra los gastos del mes
          </p>

          {m.gastos === 0 ? (
            <p className="text-gray-400 text-sm py-6 text-center">Sin gastos cargados este mes</p>
          ) : m.margenBruto <= 0 ? (
            <p className="text-gray-400 text-sm py-6 text-center">
              Sin margen no hay equilibrio posible: cada venta no deja nada para cubrir gastos
            </p>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-800 break-words">{formatPrecio(m.equilibrio)}</p>
              <p className="text-xs text-gray-400 mb-3">
                con un margen de {pct(m.margenBruto)}
              </p>

              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full ${cubierto ? 'bg-green-500' : 'bg-indigo-500'}`}
                  style={{ width: `${avanceEquilibrio * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs mt-1.5">
                <span className="text-gray-500">
                  Vendido {formatPrecio(m.total)} ({pct(avanceEquilibrio)})
                </span>
                {cubierto ? (
                  <span className="font-medium text-green-600">Cubierto ✓</span>
                ) : (
                  <span className="font-medium text-gray-700">Faltan {formatPrecio(faltaEquilibrio)}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* De dónde vienen las ventas */}
        <div className="bg-white rounded-xl shadow p-5 h-fit">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Por canal</h3>
          <p className="text-xs text-gray-400 mb-4">Dónde se vende y con qué margen</p>
          {porCanal.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sin ventas este mes</p>
          ) : (
            <div className="space-y-3">
              {porCanal.map((c) => {
                const share = m.total ? c.total / m.total : 0;
                return (
                  <div key={c.etiqueta}>
                    <div className="flex flex-wrap justify-between gap-x-3 text-sm mb-1">
                      <span className="text-gray-700 font-medium">{c.etiqueta}</span>
                      <span className="text-gray-500 text-xs sm:text-sm">
                        {formatPrecio(c.total)} · {pct(share)} ·{' '}
                        <span className="text-green-600">margen {pct(c.total ? c.ganancia / c.total : 0)}</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className="bg-indigo-500 h-3 rounded-full" style={{ width: `${share * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Por tipo de precio */}
        <div className="bg-white rounded-xl shadow p-5 h-fit">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Por tipo de precio</h3>
          <p className="text-xs text-gray-400 mb-4">Cómo pagan y qué margen deja cada forma</p>
          {porTipo.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sin ventas este mes</p>
          ) : (
            <div className="space-y-3">
              {porTipo.map((t) => {
                const share = m.total ? t.total / m.total : 0;
                return (
                  <div key={t.etiqueta}>
                    <div className="flex flex-wrap justify-between gap-x-3 text-sm mb-1">
                      <span className="text-gray-600">{t.etiqueta}</span>
                      <span className="text-gray-500 text-xs sm:text-sm">
                        {formatPrecio(t.total)} ({pct(share)}) ·{' '}
                        <span className="text-green-600">margen {pct(t.total ? t.ganancia / t.total : 0)}</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className="bg-indigo-400 h-3 rounded-full" style={{ width: `${share * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ventas por día */}
      <div className="bg-white rounded-xl shadow p-5 mt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Ventas por día</h3>
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
                <span className="text-gray-700 font-medium text-right shrink-0 tabular-nums text-xs sm:text-sm">
                  {formatPrecio(total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ventas por rubro */}
      <div className="bg-white rounded-xl shadow mt-6 overflow-hidden">
        <div className="px-5 py-4 border-b flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-700">Ventas por rubro</h3>
          {porRubro.length > 0 && (
            <span className="text-xs text-gray-400">
              Más vendido: <span className="font-semibold text-indigo-600">{porRubro[0].etiqueta}</span>
            </span>
          )}
        </div>
        {porRubro.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Sin ventas este mes</p>
        ) : (
          <div className="p-5 space-y-3">
            {porRubro.map((r) => (
              <div key={r.etiqueta}>
                <div className="flex flex-wrap justify-between gap-x-3 text-sm mb-1">
                  <span className="text-gray-700 font-medium">{r.etiqueta}</span>
                  <span className="text-gray-500 text-xs sm:text-sm">
                    {r.cantidad} u · {formatPrecio(r.total)} ·{' '}
                    <span className="text-green-600">margen {pct(r.total ? r.ganancia / r.total : 0)}</span>
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
          <h3 className="text-sm font-semibold text-gray-700">Top 10 Productos</h3>
        </div>
        {topProductos.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Sin ventas este mes</p>
        ) : (
          <>
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-5 py-3 text-left">#</th>
                  <th className="px-5 py-3 text-left">Producto</th>
                  <th className="px-5 py-3 text-center">Unidades</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Ganancia</th>
                  <th className="px-5 py-3 text-right">Margen</th>
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
                    <td className="px-5 py-3 text-right text-gray-500 tabular-nums">
                      {p.total ? pct(p.ganancia / p.total) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="md:hidden divide-y divide-gray-100">
              {topProductos.map((p, i) => (
                <li key={p.cod} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="text-gray-300 font-bold text-sm shrink-0 w-5">{i + 1}</span>
                    <p className="font-medium text-gray-800 text-sm break-words flex-1">{p.nombre}</p>
                  </div>
                  <div className="mt-1.5 pl-7 grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="block text-gray-400">Unid.</span>
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
                    <div>
                      <span className="block text-gray-400">Margen</span>
                      <span className="font-medium text-gray-700">{p.total ? pct(p.ganancia / p.total) : '—'}</span>
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
