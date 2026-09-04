'use client';

// Tarjeta de indicador: etiqueta, valor y, si hay con qué comparar, la variación
// contra el período anterior.
//
// `destacado` ya no es un anillo: en este sistema el énfasis lo da el borde,
// que pasa del color de línea al color de marca.
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
    ? 'text-tinta-tenue'
    : (sube && subeEsBueno) || (baja && !subeEsBueno)
      ? 'text-verde'
      : 'text-rojo';

  return (
    <div className={`panel p-4 ${destacado ? 'border-marca' : ''}`}>
      <p className="text-[11px] uppercase tracking-wider text-tinta-suave mb-1.5">{etiqueta}</p>
      <p
        className={`font-display text-2xl sm:text-3xl leading-none break-words tabular ${
          colorValor ?? 'text-tinta'
        }`}
      >
        {valor}
      </p>
      {detalle && <p className="text-xs text-tinta-tenue mt-0.5 break-words">{detalle}</p>}
      {delta && (
        <p className={`text-xs mt-1 ${colorDelta}`}>
          {neutro ? '=' : sube ? '▲' : '▼'} {delta.texto}
          <span className="text-tinta-tenue"> {delta.contra}</span>
        </p>
      )}
    </div>
  );
}
