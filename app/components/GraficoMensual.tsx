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

// Marcas del grafico. Al pasar la app a la paleta calida hubo que reelegirlas:
// el par obvio (terracota + verde) se cae en protanopia, ΔE 14.5, o sea que
// medio grafico deja de leerse. Se volvio a correr la verificacion (simulacion
// Vienot 1999, ΔE CIE76 en Lab) sobre los candidatos y este par es el que pasa:
//
//   vision normal  ΔE 47.3   deuteranopia ΔE 77.1   protanopia ΔE 63.6
//   contraste contra el panel: costo 6.9:1, ganancia 5.7:1
//
// Ademas mejora lo de antes: el aqua viejo quedaba en 2.7:1, por debajo del
// piso de 3:1. Aun asi el grafico SIEMPRE muestra el total sobre cada columna y
// ofrece la vista de tabla: el color nunca es el unico canal para leer un valor.
//
// La ganancia usa exactamente --color-verde, el token semantico de "entra
// plata", para que el grafico diga lo mismo que el resto de la app.
const COLOR_COSTO = '#35597f';
const COLOR_GANANCIA = '#4a6b45';
const COLOR_GRID = '#e8e1d5';
const COLOR_EJE = '#dcd4c6';

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
      <div className="panel p-5">
        <h2 className="font-display text-lg font-normal text-tinta mb-4">Evolución mensual</h2>
        <p className="text-tinta-tenue text-sm text-center py-8">Todavía no hay ventas registradas</p>
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
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="font-display text-lg font-normal text-tinta">Evolución mensual</h2>
          <p className="text-xs text-tinta-tenue mt-0.5">
            Tocá un mes para ver su detalle abajo
          </p>
        </div>
        <button
          onClick={() => setVerTabla((v) => !v)}
          className="text-xs text-marca hover:underline shrink-0"
        >
          {verTabla ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>

      {/* Leyenda: identidad nunca depende solo del color */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave mb-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_GANANCIA }} />
          Ganancia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_COSTO }} />
          Costo
        </span>
        <span className="text-tinta-tenue">· la columna entera es el total vendido</span>
      </div>

      {verTabla ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-panel-2 text-tinta-suave uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Mes</th>
                <th className="px-3 py-2 text-center">Ventas</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Costo</th>
                <th className="px-3 py-2 text-right">Ganancia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde-suave">
              {datos
                .slice()
                .reverse()
                .map((d) => {
                  const { mes, anio } = etiquetaMes(d.ym);
                  return (
                    <tr
                      key={d.ym}
                      onClick={() => onSeleccionarMes(d.ym)}
                      className={`cursor-pointer hover:bg-marca-suave ${
                        d.ym === mesSeleccionado ? 'bg-marca-suave' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-medium text-tinta">{`${mes} ${anio}`}</td>
                      <td className="px-3 py-2 text-center text-tinta-suave">{d.cantidad}</td>
                      <td className="px-3 py-2 text-right font-semibold text-tinta">{formatPrecio(d.total)}</td>
                      <td className="px-3 py-2 text-right text-tinta-suave">{formatPrecio(d.costo)}</td>
                      <td className="px-3 py-2 text-right text-verde">{formatPrecio(d.ganancia)}</td>
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
                    className="fill-tinta-tenue"
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
                      fill={seleccionado ? '#ece4d8' : activo === d.ym ? '#f5f1e9' : 'transparent'}
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
                      className={seleccionado ? 'fill-tinta' : 'fill-tinta-suave'}
                      style={{ fontSize: 10, fontWeight: seleccionado ? 700 : 500 }}
                    >
                      {compacto(d.total)}
                    </text>

                    <text
                      x={xBanda + banda / 2}
                      y={alto - padAbajo + 18}
                      textAnchor="middle"
                      className={seleccionado ? 'fill-tinta' : 'fill-tinta-suave'}
                      style={{ fontSize: 11, fontWeight: seleccionado ? 700 : 400 }}
                    >
                      {mes}
                    </text>
                    <text
                      x={xBanda + banda / 2}
                      y={alto - padAbajo + 30}
                      textAnchor="middle"
                      className="fill-tinta-tenue"
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
          <div className="mt-2 h-9 border-t border-borde-suave pt-2 text-xs">
            {dato ? (
              <p className="text-tinta-media">
                <span className="font-semibold text-tinta">
                  {etiquetaMes(dato.ym).mes} 20{etiquetaMes(dato.ym).anio}
                </span>{' '}
                · {dato.cantidad} {dato.cantidad === 1 ? 'venta' : 'ventas'} · Total{' '}
                <span className="font-medium text-tinta">{formatPrecio(dato.total)}</span> · Costo{' '}
                {formatPrecio(dato.costo)} · Ganancia{' '}
                <span className="font-medium text-verde">{formatPrecio(dato.ganancia)}</span>
              </p>
            ) : (
              <p className="text-tinta-tenue">Pasá el mouse o tocá una columna para ver el detalle</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
