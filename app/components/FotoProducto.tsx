'use client';

import { useRef, useState } from 'react';
import { Producto } from '@/lib/types';
import { prepararFoto } from '@/lib/foto-cliente';
import { normalizar } from '@/lib/texto';

// La miniatura del artículo, o un hueco con la percha si todavía no tiene foto.
// `className` define el tamaño (el contenedor es cuadrado y recorta la foto).
export function Miniatura({
  producto,
  grande = false,
  className = '',
}: {
  producto: Producto;
  grande?: boolean;
  className?: string;
}) {
  const src = grande ? producto.foto : producto.miniatura;
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-panel bg-panel-2 border border-borde-suave ${className}`}
    >
      {src ? (
        // Las fotos ya llegan achicadas del celular: no pasan por next/image,
        // que en Vercel cuenta cada transformación contra el límite del plan.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={producto.nombreComercial}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute inset-0 m-auto h-1/2 w-1/2 text-tinta-tenue"
          aria-hidden="true"
        >
          <path d="M12 7.5a1.75 1.75 0 1 1 1.75-1.75c0 .9-.6 1.3-1.15 1.7-.4.3-.6.55-.6 1.05v.5" />
          <path d="M12 9l8.6 6.1a1 1 0 0 1-.58 1.81H3.98a1 1 0 0 1-.58-1.81L12 9z" />
        </svg>
      )}
    </span>
  );
}

// Botón para sacar o elegir la foto de un artículo. En el celular abre la
// cámara o la galería, a elección. Avisa con `alSubir` para que la pantalla
// muestre la foto nueva sin recargar.
export function BotonFoto({
  producto,
  alSubir,
  className = '',
}: {
  producto: Producto;
  alSubir: (foto: { foto: string; miniatura: string }) => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // Para poder volver a elegir la misma foto si falló.
    if (!archivo) return;
    setSubiendo(true);
    setError('');
    try {
      const { foto, miniatura } = await prepararFoto(archivo);
      const datos = new FormData();
      datos.append('cod', producto.cod);
      datos.append('foto', foto, 'foto.jpg');
      datos.append('miniatura', miniatura, 'miniatura.jpg');
      const res = await fetch('/api/productos/foto', { method: 'POST', body: datos });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la foto.');
      alSubir(data);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'No se pudo guardar la foto.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <span className={`inline-flex flex-col items-start ${className}`}>
      <input ref={input} type="file" accept="image/*" onChange={alElegir} className="hidden" />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={subiendo}
        className="inline-flex items-center gap-1.5 rounded-panel border border-borde px-2.5 py-1.5 text-xs font-medium text-tinta-media transition-colors hover:border-marca hover:text-marca disabled:opacity-50"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 5.5h2.5L6 3.5h4l1.5 2H14v7H2z" />
          <circle cx="8" cy="9" r="2.25" />
        </svg>
        {subiendo ? 'Subiendo…' : producto.foto ? 'Cambiar foto' : 'Agregar foto'}
      </button>
      {error && (
        <span className="mt-1 text-xs text-rojo" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

// Los rubros de la planilla, sin repetir aunque estén escritos distinto
// ("Corset" y "CORSET " son el mismo), en orden alfabético y con cuántos hay.
export function rubrosDe(productos: Producto[]) {
  const porClave = new Map<string, { nombre: string; cantidad: number }>();
  for (const p of productos) {
    const nombre = p.rubro.trim() || 'Sin rubro';
    const clave = claveRubro(p.rubro);
    const r = porClave.get(clave);
    if (r) r.cantidad++;
    else porClave.set(clave, { nombre, cantidad: 1 });
  }
  return [...porClave.entries()]
    .map(([clave, r]) => ({ clave, ...r }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function claveRubro(rubro: string) {
  return normalizar(rubro.trim()) || 'sin rubro';
}

// Fila de botones para elegir un rubro. Tocar el elegido lo suelta.
export function ChipsRubro({
  rubros,
  elegido,
  alElegir,
}: {
  rubros: { clave: string; nombre: string; cantidad: number }[];
  elegido: string | null;
  alElegir: (clave: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Rubros">
      {rubros.map((r) => {
        const activo = elegido === r.clave;
        return (
          <button
            key={r.clave}
            type="button"
            aria-pressed={activo}
            onClick={() => alElegir(activo ? null : r.clave)}
            className={`rounded-panel border px-3 py-1.5 text-sm transition-colors ${
              activo ? 'border-marca bg-marca text-white' : 'border-borde text-tinta-media hover:border-marca'
            }`}
          >
            {r.nombre}
            <span className={`ml-1.5 text-xs ${activo ? 'text-white/75' : 'text-tinta-tenue'}`}>{r.cantidad}</span>
          </button>
        );
      })}
    </div>
  );
}
