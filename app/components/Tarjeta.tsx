'use client';

// Tarjeta de indicador: etiqueta, valor y, si hay con qué comparar, la variación
// contra el período anterior.
//
// El color de la variación NO sale del signo sino de si es buena noticia: que
// suban las ventas es verde, que suba "gastos sobre ventas" es rojo. Por eso
// `subeEsBueno`. Y nunca queda sólo en el color: siempre va la flecha y el texto.

export interface Delta {
  /** Signo y magnitud del cambio. Sólo el signo decide el color. */
  valor: number;
  /** Ya formateado por quien llama: "+12,5%" o "−7,7 pts". */
  texto: string;
  /** Contra qué se compara, ej. "vs junio". */
  contra: string;
}

export default function Tarjeta({
  etiqueta,
  valor,
  detalle,
  delta,
  subeEsBueno = true,
  destacado = false,
  colorValor,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  delta?: Delta | null;
  subeEsBueno?: boolean;
  destacado?: boolean;
  colorValor?: string;
}) {
  const sube = delta ? delta.valor > 0 : false;
  const baja = delta ? delta.valor < 0 : false;
  const neutro = !delta || delta.valor === 0;

  const colorDelta = neutro
    ? 'text-gray-400'
    : (sube && subeEsBueno) || (baja && !subeEsBueno)
      ? 'text-green-600'
      : 'text-red-500';

  return (
    <div className={`bg-white rounded-xl shadow p-4 ${destacado ? 'ring-2 ring-indigo-200' : ''}`}>
      <p className="text-xs text-gray-500 mb-1">{etiqueta}</p>
      <p className={`text-lg sm:text-2xl font-bold break-words ${colorValor ?? 'text-gray-800'}`}>
        {valor}
      </p>
      {detalle && <p className="text-xs text-gray-400 mt-0.5 break-words">{detalle}</p>}
      {delta && (
        <p className={`text-xs mt-1 ${colorDelta}`}>
          {neutro ? '=' : sube ? '▲' : '▼'} {delta.texto}
          <span className="text-gray-400"> {delta.contra}</span>
        </p>
      )}
    </div>
  );
}
