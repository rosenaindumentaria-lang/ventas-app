'use client';

import { useState } from 'react';

// Barra de filtros compartida por Historial, Gastos y Movimientos: rango de
// fechas, busqueda por texto y, opcionalmente, un desplegable (categoria/tipo).
// Estaba duplicada en cada pantalla y se iban despegando entre si.
//
// En el celular sólo queda a la vista el buscador y un botón "Filtros" que
// despliega el resto: cuatro campos fijos empujaban la lista fuera de pantalla.

export interface FiltroSelect {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  opciones: readonly string[];
  /** Texto de la opcion vacia, que no filtra nada. */
  etiquetaTodas: string;
}

export default function Filtros({
  desde,
  hasta,
  onDesde,
  onHasta,
  busqueda,
  onBusqueda,
  buscarLabel = 'Buscar',
  buscarPlaceholder = 'Buscar...',
  select,
  onLimpiar,
  hayFiltros,
}: {
  desde: string;
  hasta: string;
  onDesde: (v: string) => void;
  onHasta: (v: string) => void;
  busqueda: string;
  onBusqueda: (v: string) => void;
  buscarLabel?: string;
  buscarPlaceholder?: string;
  select?: FiltroSelect;
  onLimpiar: () => void;
  hayFiltros: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const campo =
    'w-full border border-borde rounded-panel px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marca';

  const buscador = (
    <input
      type="text"
      placeholder={buscarPlaceholder}
      value={busqueda}
      onChange={(e) => onBusqueda(e.target.value)}
      className={campo}
    />
  );

  return (
    <div className="panel p-3 md:p-4 mb-4 md:mb-6">
      {/* Celular: buscador + botón que despliega el resto. */}
      <div className="flex items-end gap-2 md:hidden">
        <div className="flex-1">
          <label className="block text-xs font-medium text-tinta-suave mb-1">{buscarLabel}</label>
          {buscador}
        </div>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="relative h-[38px] shrink-0 rounded-panel border border-borde bg-panel px-3 text-sm font-medium text-tinta-media"
        >
          Filtros {abierto ? '▴' : '▾'}
          {hayFiltros && !abierto && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-marca" />
          )}
        </button>
      </div>

      <div
        className={`${abierto ? 'grid' : 'hidden'} grid-cols-2 gap-3 mt-3 md:mt-0 md:flex md:flex-wrap md:gap-4 md:items-end`}
      >
        <div>
          <label className="block text-xs font-medium text-tinta-suave mb-1">Desde</label>
          <input type="date" value={desde} onChange={(e) => onDesde(e.target.value)} className={campo} />
        </div>
        <div>
          <label className="block text-xs font-medium text-tinta-suave mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => onHasta(e.target.value)} className={campo} />
        </div>

        {select && (
          <div className="col-span-2 md:col-span-1 md:min-w-[160px]">
            <label className="block text-xs font-medium text-tinta-suave mb-1">{select.label}</label>
            <select value={select.valor} onChange={(e) => select.onChange(e.target.value)} className={campo}>
              <option value="">{select.etiquetaTodas}</option>
              {select.opciones.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Escritorio: el buscador va en la misma fila que el resto. */}
        <div className="hidden md:block flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-tinta-suave mb-1">{buscarLabel}</label>
          {buscador}
        </div>

        {/* Solo tiene sentido ofrecer limpiar si hay algo puesto. */}
        {hayFiltros && (
          <button
            onClick={onLimpiar}
            className="col-span-2 md:col-span-1 text-left text-sm text-marca hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
