'use client';

import { useEffect, useMemo, useState } from 'react';
import { Producto } from '@/lib/types';
import { formatPrecio } from '@/lib/format';
import { normalizar } from '@/lib/texto';
import { Miniatura, BotonFoto, ChipsRubro, rubrosDe, claveRubro } from '@/app/components/FotoProducto';

// Catálogo para cargar las fotos: se recorre por rubro y se le saca foto a cada
// artículo. Pensado para hacerlo de una, con el celular, antes de que se vaya
// quien conoce los artículos de memoria.
export default function Articulos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [rubro, setRubro] = useState<string | null>(null);
  const [soloSinFoto, setSoloSinFoto] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    fetch('/api/productos')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProductos(data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, []);

  const rubros = useMemo(() => rubrosDe(productos), [productos]);
  const conFoto = productos.filter((p) => p.foto).length;

  const visibles = useMemo(() => {
    const palabras = normalizar(busqueda.trim()).split(/\s+/).filter(Boolean);
    return productos
      .filter((p) => !rubro || claveRubro(p.rubro) === rubro)
      .filter((p) => !soloSinFoto || !p.foto)
      .filter((p) => {
        if (!palabras.length) return true;
        const texto = normalizar([p.nombreComercial, p.otrosNombres, p.descripcion, p.rubro, p.cod].join(' '));
        return palabras.every((w) => texto.includes(w));
      })
      .sort((a, b) => a.nombreComercial.localeCompare(b.nombreComercial, 'es'));
  }, [productos, rubro, soloSinFoto, busqueda]);

  function alSubirFoto(cod: string, foto: { foto: string; miniatura: string }) {
    setProductos((ps) => ps.map((p) => (p.cod === cod ? { ...p, ...foto } : p)));
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
        <h1 className="font-display text-3xl font-normal text-tinta">Artículos</h1>
        {!cargando && productos.length > 0 && (
          <span className="text-sm text-tinta-suave tabular">
            {conFoto} de {productos.length} con foto
          </span>
        )}
      </div>

      <div className="panel p-4 sm:p-5 space-y-4 mb-4">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar artículo…"
          aria-label="Buscar artículo"
          className="w-full border border-borde rounded-panel bg-panel px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-marca focus:border-marca"
        />
        {rubros.length > 0 && <ChipsRubro rubros={rubros} elegido={rubro} alElegir={setRubro} />}
        <label className="inline-flex items-center gap-2 text-sm text-tinta-media cursor-pointer">
          <input
            type="checkbox"
            checked={soloSinFoto}
            onChange={(e) => setSoloSinFoto(e.target.checked)}
            className="h-4 w-4 accent-marca"
          />
          Mostrar sólo los que no tienen foto
        </label>
      </div>

      {cargando ? (
        <p className="text-sm text-tinta-suave">Cargando artículos…</p>
      ) : error ? (
        <p className="text-sm text-rojo">No se pudieron cargar los artículos. Recargá la página.</p>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-tinta-suave">
          {soloSinFoto && productos.length > 0 ? 'Todos los artículos de acá ya tienen foto.' : 'No hay artículos que coincidan.'}
        </p>
      ) : (
        <ul className="panel divide-y divide-borde-suave">
          {visibles.map((p) => (
            <li key={p.cod} className="flex items-center gap-3 p-3">
              <Miniatura producto={p} className="h-16 w-16" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-tinta break-words">{p.nombreComercial}</p>
                {p.descripcion && p.descripcion.trim() !== p.nombreComercial.trim() && (
                  <p className="text-xs text-tinta-suave break-words">{p.descripcion}</p>
                )}
                <p className="text-xs text-tinta-tenue">
                  {p.cod}
                  {p.rubro && ` · ${p.rubro}`}
                  {' · '}
                  <span className="tabular">{formatPrecio(p.precioEfectivo)}</span>
                </p>
              </div>
              <BotonFoto producto={p} alSubir={(f) => alSubirFoto(p.cod, f)} className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
