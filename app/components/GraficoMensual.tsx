'use client';

import { useState, useId } from 'react';
import { formatPrecio } from '@/lib/format';

export interface MesDato {
  ym: string; // YYYY-MM
  total: number;
  costo: number;
  ganancia: number;
  cantidad: number;
}

// Marcas del grafico. Validadas con el script de la guia de visualizacion:
// CVD ΔE 23.1 y vision normal 24.0 sobre blanco, muy por encima del piso.
// El aqua queda por debajo de 3:1 contra el blanco, asi que el grafico SIEMPRE
// muestra el total sobre cada columna y ofrece la vista de tabla: el color
// nunca es el unico canal para leer un valor.
const COLOR_COSTO = '#2a78d6';
const COLOR_GANANCIA = '#1baf7a';
const COLOR_GRID = '#e1e0d9';
const COLOR_EJE = '#c3c2b7';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function etiquetaMes(ym: string) {
  const [a, m] = ym.split('-');
  return { mes: MESES_CORTOS[parseInt(m, 10) - 1] ?? m, anio: a.slice(2) };
}

// Importes cortos para los ticks del eje, que no tienen lugar para el numero entero.
function compacto(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace('.', ',')}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

// Techo "redondo" para el eje: 1, 2, 2.5 o 5 por potencia de diez.
function techoLindo(max: number): { techo: number; paso: number } {
  if (max <= 0) return { techo: 1000, paso: 250 };
  const objetivo = max / 4;
  const magnitud = Math.pow(10, Math.floor(Math.log10(objetivo)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * magnitud).find((p) => p >= objetivo) ?? 10 * magnitud;
  return { techo: paso * 4, paso };
}

// Rectangulo con las esquinas de arriba redondeadas y la base recta: la punta
// del dato se redondea, el apoyo en la linea de base no.
function barraRedondeada(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return '';
  const radio = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + radio} Q${x},${y} ${x + radio},${y} L${x + w - radio},${y} Q${x + w},${y} ${x + w},${y + radio} L${x + w},${y + h} Z`;
}

export default function GraficoMensual({
  datos,
  mesSeleccionado,
  onSeleccionarMes,
}: {
  datos: MesDato[];
  mesSeleccionado: string;
  onSeleccionarMes: (ym: string) => void;
}) {
  const [activo, setActivo] = useState<string | null>(null);
  const [verTabla, setVerTabla] = useState(false);
  const idGrafico = useId();

  if (datos.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Evolución mensual</h2>
        <p className="text-gray-400 text-sm text-center py-8">Todavía no hay ventas registradas</p>
      </div>
    );
  }

  // Geometria. El alto del contenedor incluye la banda del eje X, para que las
  // etiquetas de los meses no queden fuera y aparezca un scroll interno.
  const banda = 64;
  const padIzq = 52;
  const padDer = 12;
  const padArriba = 26; // etiqueta del total sobre cada columna
  const alturaPlot = 190;
  const padAbajo = 38; // dos lineas: mes y año
  const ancho = padIzq + banda * datos.length + padDer;
  const alto = padArriba + alturaPlot + padAbajo;

  const maxTotal = Math.max(...datos.map((d) => d.total), 0);
  const { techo, paso } = techoLindo(maxTotal);
  const ticks = [0, paso, paso * 2, paso * 3, paso * 4];
  const y = (v: number) => padArriba + alturaPlot - (v / techo) * alturaPlot;

  const anchoBarra = Math.min(24, banda * 0.45);
  const dato = datos.find((d) => d.ym === activo);

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Evolución mensual</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Tocá un mes para ver su detalle abajo
          </p>
        </div>
        <button
          onClick={() => setVerTabla((v) => !v)}
          className="text-xs text-indigo-600 hover:underline shrink-0"
        >
          {verTabla ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>

      {/* Leyenda: identidad nunca depende solo del color */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_GANANCIA }} />
          Ganancia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_COSTO }} />
          Costo
        </span>
        <span className="text-gray-400">· la columna entera es el total vendido</span>
      </div>

      {verTabla ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Mes</th>
                <th className="px-3 py-2 text-center">Ventas</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Costo</th>
                <th className="px-3 py-2 text-right">Ganancia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {datos
                .slice()
                .reverse()
                .map((d) => {
                  const { mes, anio } = etiquetaMes(d.ym);
                  return (
                    <tr
                      key={d.ym}
                      onClick={() => onSeleccionarMes(d.ym)}
                      className={`cursor-pointer hover:bg-indigo-50 ${
                        d.ym === mesSeleccionado ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-medium text-gray-800">{`${mes} ${anio}`}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{d.cantidad}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">{formatPrecio(d.total)}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{formatPrecio(d.costo)}</td>
                      <td className="px-3 py-2 text-right text-green-700">{formatPrecio(d.ganancia)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          {/* En mobile no entran todos los meses: se desplaza en horizontal en vez
              de encoger las barras hasta volverlas ilegibles. */}
          <div className="overflow-x-auto -mx-1 px-1">
            <svg
              width={ancho}
              height={alto}
              viewBox={`0 0 ${ancho} ${alto}`}
              role="img"
              aria-labelledby={idGrafico}
              className="block"
              style={{ minWidth: '100%' }}
            >
              <title id={idGrafico}>
                Ventas por mes, separadas en costo y ganancia. Los valores están también en la vista
                de tabla.
              </title>

              {/* Grilla: hairline solida y recesiva */}
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={padIzq}
                    x2={ancho - padDer}
                    y1={y(t)}
                    y2={y(t)}
                    stroke={t === 0 ? COLOR_EJE : COLOR_GRID}
                    strokeWidth={1}
                  />
                  <text
                    x={padIzq - 8}
                    y={y(t) + 4}
                    textAnchor="end"
                    className="fill-gray-400"
                    style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {compacto(t)}
                  </text>
                </g>
              ))}

              {datos.map((d, i) => {
                const xBanda = padIzq + i * banda;
                const xBarra = xBanda + (banda - anchoBarra) / 2;
                const seleccionado = d.ym === mesSeleccionado;
                const { mes, anio } = etiquetaMes(d.ym);

                const altoTotal = (d.total / techo) * alturaPlot;
                const altoGanancia = d.total > 0 ? (Math.max(d.ganancia, 0) / techo) * alturaPlot : 0;
                // 2px de superficie separan los dos tramos: el hueco es el separador,
                // no un borde dibujado alrededor de la marca.
                const altoCosto = Math.max(altoTotal - altoGanancia - 2, 0);
                const yGanancia = y(0) - altoTotal;
                const yCosto = y(0) - altoCosto;

                return (
                  <g
                    key={d.ym}
                    onMouseEnter={() => setActivo(d.ym)}
                    onMouseLeave={() => setActivo(null)}
                    onFocus={() => setActivo(d.ym)}
                    onBlur={() => setActivo(null)}
                    onClick={() => onSeleccionarMes(d.ym)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${mes} 20${anio}: total ${formatPrecio(d.total)}, ganancia ${formatPrecio(d.ganancia)}`}
                    style={{ cursor: 'pointer', outline: 'none' }}
                  >
                    {/* Zona de contacto de toda la banda: el objetivo es mucho mas
                        grande que la barra, para poder tocarlo en el celular. */}
                    <rect
                      x={xBanda}
                      y={padArriba}
                      width={banda}
                      height={alturaPlot}
                      fill={seleccionado ? '#eef2ff' : activo === d.ym ? '#f7f7f6' : 'transparent'}
                    />

                    {/* Si no hay ganancia, la punta del dato es el tramo de costo y
                        le toca a el la esquina redondeada. */}
                    {altoCosto > 0 && (
                      <path
                        d={barraRedondeada(xBarra, yCosto, anchoBarra, altoCosto, altoGanancia > 0 ? 0 : 4)}
                        fill={COLOR_COSTO}
                      />
                    )}
                    {altoGanancia > 0 && (
                      <path
                        d={barraRedondeada(xBarra, yGanancia, anchoBarra, altoGanancia, 4)}
                        fill={COLOR_GANANCIA}
                      />
                    )}

                    {/* Total sobre la columna: el texto lleva tokens de texto, nunca
                        el color de la serie. */}
                    <text
                      x={xBanda + banda / 2}
                      y={yGanancia - 8}
                      textAnchor="middle"
                      className={seleccionado ? 'fill-gray-800' : 'fill-gray-500'}
                      style={{ fontSize: 10, fontWeight: seleccionado ? 700 : 500 }}
                    >
                      {compacto(d.total)}
                    </text>

                    <text
                      x={xBanda + banda / 2}
                      y={alto - padAbajo + 18}
                      textAnchor="middle"
                      className={seleccionado ? 'fill-gray-800' : 'fill-gray-500'}
                      style={{ fontSize: 11, fontWeight: seleccionado ? 700 : 400 }}
                    >
                      {mes}
                    </text>
                    <text
                      x={xBanda + banda / 2}
                      y={alto - padAbajo + 30}
                      textAnchor="middle"
                      className="fill-gray-400"
                      style={{ fontSize: 9 }}
                    >
                      {anio}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Detalle del mes apuntado. Ocupa un alto fijo y va debajo del grafico
              en vez de flotar encima: asi no tapa la columna mas alta ni su
              etiqueta, y la pagina no salta al pasar el mouse. Enriquece, no
              habilita: los totales ya estan sobre cada columna y el detalle
              completo esta en la vista de tabla. */}
          <div className="mt-2 h-9 border-t border-gray-100 pt-2 text-xs">
            {dato ? (
              <p className="text-gray-600">
                <span className="font-semibold text-gray-800">
                  {etiquetaMes(dato.ym).mes} 20{etiquetaMes(dato.ym).anio}
                </span>{' '}
                · {dato.cantidad} {dato.cantidad === 1 ? 'venta' : 'ventas'} · Total{' '}
                <span className="font-medium text-gray-800">{formatPrecio(dato.total)}</span> · Costo{' '}
                {formatPrecio(dato.costo)} · Ganancia{' '}
                <span className="font-medium text-green-700">{formatPrecio(dato.ganancia)}</span>
              </p>
            ) : (
              <p className="text-gray-400">Pasá el mouse o tocá una columna para ver el detalle</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
