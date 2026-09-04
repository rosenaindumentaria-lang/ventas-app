'use client';

// Barra de filtros compartida por Historial, Gastos y Movimientos: rango de
// fechas, busqueda por texto y, opcionalmente, un desplegable (categoria/tipo).
// Estaba duplicada en cada pantalla y se iban despegando entre si.

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
  const campo =
    'w-full border border-borde rounded-panel px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marca';

  return (
    <div className="panel p-4 mb-6 flex flex-wrap gap-4 items-end">
      <div>
        <label className="block text-xs font-medium text-tinta-suave mb-1">Desde</label>
        <input type="date" value={desde} onChange={(e) => onDesde(e.target.value)} className={campo} />
      </div>
      <div>
        <label className="block text-xs font-medium text-tinta-suave mb-1">Hasta</label>
        <input type="date" value={hasta} onChange={(e) => onHasta(e.target.value)} className={campo} />
      </div>

      {select && (
        <div className="min-w-[160px]">
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

      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-medium text-tinta-suave mb-1">{buscarLabel}</label>
        <input
          type="text"
          placeholder={buscarPlaceholder}
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          className={campo}
        />
      </div>

      {/* Solo tiene sentido ofrecer limpiar si hay algo puesto. */}
      {hayFiltros && (
        <button onClick={onLimpiar} className="text-sm text-marca hover:underline">
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
