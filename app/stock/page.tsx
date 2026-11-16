'use client';

import { useState, useEffect, useMemo } from 'react';
import { FilaStock, MovimientoStock, TipoStock } from '@/lib/types';
import { formatPrecio, formatNumero } from '@/lib/format';
import { normalizar } from '@/lib/texto';

type Vista = 'todos' | 'conStock' | 'sinContar' | 'revisar';
type Accion = TipoStock;

interface Hecho extends MovimientoStock {
  nombre: string;
}

const hoy = () => new Date().toISOString().split('T')[0];

const ACCIONES: { tipo: Accion; etiqueta: string }[] = [
  { tipo: 'CONTEO', etiqueta: 'Contar' },
  { tipo: 'COMPRA', etiqueta: 'Entró' },
  { tipo: 'AJUSTE', etiqueta: 'Ajuste' },
];

const NOMBRE_TIPO: Record<TipoStock, string> = {
  CONTEO: 'Conteo',
  COMPRA: 'Entró mercadería',
  AJUSTE: 'Ajuste',
};

// Las cantidades se tipean en el celular: aceptar la coma decimal.
const aNumero = (txt: string) => parseFloat(txt.replace(',', '.'));

const PASO = 80;

export default function Stock() {
  const [filas, setFilas] = useState<FilaStock[]>([]);
  const [historial, setHistorial] = useState<Hecho[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [rubro, setRubro] = useState('');
  const [vista, setVista] = useState<Vista>('todos');
  const [limite, setLimite] = useState(PASO);

  // Carga de un artículo: se abre tocando la fila.
  const [abierto, setAbierto] = useState<string | null>(null);
  const [accion, setAccion] = useState<Accion>('CONTEO');
  const [cantidad, setCantidad] = useState('');
  const [detalle, setDetalle] = useState('');
  const [fecha, setFecha] = useState(hoy);

  // Conteo de varios artículos de una (para arrancar o para un rubro entero).
  const [contando, setContando] = useState(false);
  const [conteos, setConteos] = useState<Record<string, string>>({});
  const [fechaConteo, setFechaConteo] = useState(hoy);

  function traer() {
    return fetch('/api/stock')
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data.filas)) throw new Error(data.error || 'Respuesta inválida');
        setFilas(data.filas);
        setHistorial(data.historial || []);
        setErrorCarga(null);
      })
      .catch((e) => setErrorCarga(e.message))
      .finally(() => setLoading(false));
  }

  function cargar() {
    setLoading(true);
    traer();
  }

  useEffect(() => {
    traer();
  }, []);

  // ── Totales (de todo el catálogo, no del filtro) ───────────────────────────
  const resumen = useMemo(() => {
    let valor = 0;
    let unidades = 0;
    let conStock = 0;
    let sinContar = 0;
    let sinCosto = 0;
    let revisar = 0;
    for (const f of filas) {
      if (f.stock === null) sinContar++;
      else if (f.stock < 0) revisar++;
      else if (f.stock > 0) {
        conStock++;
        unidades += f.stock;
        valor += f.valor;
        if (f.costo <= 0) sinCosto++;
      }
    }
    return { valor, unidades, conStock, sinContar, sinCosto, revisar };
  }, [filas]);

  const rubros = useMemo(
    () => Array.from(new Set(filas.map((f) => f.rubro).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [filas]
  );

  const visibles = useMemo(() => {
    const palabras = normalizar(busqueda.trim()).split(/\s+/).filter(Boolean);
    return filas
      .filter((f) => !rubro || f.rubro === rubro)
      .filter((f) => {
        if (vista === 'conStock') return (f.stock ?? 0) > 0;
        if (vista === 'sinContar') return f.stock === null;
        if (vista === 'revisar') return f.stock !== null && f.stock < 0;
        return true;
      })
      .filter((f) => {
        if (!palabras.length) return true;
        const texto = normalizar(`${f.nombre} ${f.rubro} ${f.cod}`);
        return palabras.every((w) => texto.includes(w));
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [filas, rubro, vista, busqueda]);

  const valorVisible = visibles.reduce((a, f) => a + f.valor, 0);
  const hayFiltros = Boolean(busqueda || rubro || vista !== 'todos');

  function limpiarFiltros() {
    setBusqueda('');
    setRubro('');
    setVista('todos');
    setLimite(PASO);
  }

  // ── Cargar un artículo ─────────────────────────────────────────────────────
  function abrir(f: FilaStock) {
    if (contando) return;
    if (abierto === f.cod) {
      setAbierto(null);
      return;
    }
    setAbierto(f.cod);
    // Si todavía no se lo contó, lo natural es contarlo; si ya tiene stock, lo
    // más común es que haya entrado mercadería.
    setAccion(f.stock === null ? 'CONTEO' : 'COMPRA');
    setCantidad('');
    setDetalle('');
    setFecha(hoy());
    setMensaje(null);
  }

  async function enviar(movs: { cod: string; tipo: Accion; cantidad: number; fecha: string; detalle: string }[]) {
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error || data.detalle || 'Error al guardar' });
        return false;
      }
      setMensaje({
        tipo: 'ok',
        texto: movs.length === 1 ? '✅ Guardado' : `✅ ${movs.length} artículos guardados`,
      });
      traer();
      return true;
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión' });
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function guardarUno(f: FilaStock) {
    const n = aNumero(cantidad);
    if (!Number.isFinite(n)) return;
    const ok = await enviar([{ cod: f.cod, tipo: accion, cantidad: n, fecha, detalle: detalle.trim() }]);
    if (ok) setAbierto(null);
  }

  // ── Conteo de varios ───────────────────────────────────────────────────────
  const conteosCargados = Object.entries(conteos).filter(([, v]) => v.trim() !== '' && Number.isFinite(aNumero(v)));
  const conteoInvalido = conteosCargados.some(([, v]) => aNumero(v) < 0);

  async function guardarConteos() {
    if (conteosCargados.length === 0 || conteoInvalido) return;
    const ok = await enviar(
      conteosCargados.map(([cod, v]) => ({
        cod,
        tipo: 'CONTEO' as const,
        cantidad: aNumero(v),
        fecha: fechaConteo,
        detalle: '',
      }))
    );
    if (ok) {
      setConteos({});
      setContando(false);
    }
  }

  function salirDeConteo() {
    setContando(false);
    setConteos({});
  }

  // ── Deshacer un hecho cargado de más ───────────────────────────────────────
  async function borrarHecho(h: Hecho) {
    if (!confirm(`¿Borrar "${NOMBRE_TIPO[h.tipo]}" de ${h.nombre}?`)) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/stock?id=${h.id}`, { method: 'DELETE' });
      if (res.ok) traer();
      else alert('Error al borrar');
    } finally {
      setGuardando(false);
    }
  }

  const campo =
    'w-full border border-borde rounded-panel px-3 py-2 text-sm bg-panel focus:outline-none focus:ring-2 focus:ring-marca';

  const tarjetas: { vista: Vista; etiqueta: string; n: number; color: string }[] = [
    { vista: 'sinContar', etiqueta: 'Sin contar', n: resumen.sinContar, color: 'text-ocre' },
    { vista: 'revisar', etiqueta: 'Stock negativo', n: resumen.revisar, color: 'text-rojo' },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-normal text-tinta mb-4">Stock</h1>

      {/* Cuánta plata hay en mercadería */}
      <div className="rounded-panel bg-marca p-5 text-white mb-3">
        <p className="text-sm text-white/80">Mercadería en stock, a costo</p>
        <p className="mt-1 font-display text-4xl tabular">{formatPrecio(resumen.valor)}</p>
        <p className="mt-2 text-sm text-white/80 tabular">
          {formatNumero(resumen.conStock)} artículos con stock · {formatNumero(resumen.unidades)} unidades
        </p>
        {resumen.sinContar > 0 && !loading && (
          <p className="mt-3 rounded-panel bg-white/10 px-3 py-2 text-xs text-white/90">
            Es sólo lo que ya contaste: faltan <strong>{resumen.sinContar}</strong> de {filas.length} artículos.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {tarjetas.map((t) => (
          <button
            key={t.vista}
            type="button"
            onClick={() => {
              setVista(vista === t.vista ? 'todos' : t.vista);
              setLimite(PASO);
            }}
            className={`panel p-3 text-left ${vista === t.vista ? 'ring-2 ring-marca' : ''}`}
          >
            <p className="text-xs text-tinta-suave">{t.etiqueta}</p>
            <p className={`text-lg font-semibold tabular ${t.n > 0 ? t.color : 'text-tinta-tenue'}`}>{t.n}</p>
          </button>
        ))}
        <div className="panel p-3">
          <p className="text-xs text-tinta-suave">Sin costo</p>
          <p className={`text-lg font-semibold tabular ${resumen.sinCosto > 0 ? 'text-ocre' : 'text-tinta-tenue'}`}>
            {resumen.sinCosto}
          </p>
        </div>
      </div>
      {resumen.sinCosto > 0 && (
        <p className="mb-4 text-xs text-ocre-fuerte">
          Los artículos sin costo en BASE DE DATOS tienen unidades pero no suman al valor.
        </p>
      )}

      {mensaje && (
        <p
          role="status"
          className={`mb-4 rounded-panel px-3 py-2 text-sm font-medium ${
            mensaje.tipo === 'ok' ? 'bg-verde-suave text-verde' : 'bg-rojo-suave text-rojo'
          }`}
        >
          {mensaje.texto}
        </p>
      )}

      {/* Filtros */}
      <div className="panel p-3 mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_220px]">
          <input
            type="search"
            placeholder="Buscar artículo..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setLimite(PASO);
            }}
            className={`${campo} col-span-2 md:col-span-1`}
          />
          <select
            value={rubro}
            onChange={(e) => {
              setRubro(e.target.value);
              setLimite(PASO);
            }}
            className={campo}
            aria-label="Rubro"
          >
            <option value="">Todos los rubros</option>
            {rubros.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={vista}
            onChange={(e) => {
              setVista(e.target.value as Vista);
              setLimite(PASO);
            }}
            className={`${campo} md:hidden`}
            aria-label="Mostrar"
          >
            <option value="todos">Todos</option>
            <option value="conStock">Con stock</option>
            <option value="sinContar">Sin contar</option>
            <option value="revisar">Stock negativo</option>
          </select>
        </div>
        <div className="hidden md:flex gap-2" role="group" aria-label="Mostrar">
          {(
            [
              ['todos', 'Todos'],
              ['conStock', 'Con stock'],
              ['sinContar', 'Sin contar'],
              ['revisar', 'Stock negativo'],
            ] as [Vista, string][]
          ).map(([v, etiqueta]) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setVista(v);
                setLimite(PASO);
              }}
              className={`px-3 py-1.5 rounded-panel text-xs font-medium transition-colors ${
                vista === v ? 'bg-marca text-white' : 'bg-marca-suave text-tinta-media hover:bg-acento-suave'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        {hayFiltros && (
          <button onClick={limpiarFiltros} className="text-sm text-marca hover:underline">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Modo contar varios */}
      {contando ? (
        <div className="mb-4 rounded-panel border border-marca bg-marca-suave p-3 space-y-3">
          <p className="text-sm font-semibold text-marca">Contando varios artículos</p>
          <p className="text-xs text-tinta-media">
            Escribí cuántas unidades hay de cada uno. Lo que dejes vacío no se toca. El conteo vale{' '}
            <strong>al cierre de la fecha</strong>: si contás de mañana, antes de abrir, poné la fecha de ayer.
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-tinta-suave mb-1">Fecha del conteo</label>
              <input
                type="date"
                value={fechaConteo}
                onChange={(e) => setFechaConteo(e.target.value)}
                className={campo}
              />
            </div>
            <button type="button" onClick={salirDeConteo} className="pb-2 text-sm text-marca hover:underline">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        !loading &&
        !errorCarga && (
          <button
            type="button"
            onClick={() => {
              setContando(true);
              setAbierto(null);
              setMensaje(null);
              setFechaConteo(hoy());
            }}
            className="mb-4 w-full rounded-panel bg-marca py-3 text-sm font-semibold text-white active:bg-marca-fuerte md:w-auto md:px-6"
          >
            Contar varios artículos
          </button>
        )
      )}

      {/* Lista */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-normal text-tinta">
            {hayFiltros ? 'Artículos filtrados' : 'Artículos'}
            <span className="ml-2 font-normal text-tinta-tenue">({visibles.length})</span>
          </h2>
          {hayFiltros && (
            <span className="text-sm font-bold text-tinta shrink-0 tabular">{formatPrecio(valorVisible)}</span>
          )}
        </div>

        {loading ? (
          <p className="text-tinta-tenue text-sm text-center py-8">Cargando...</p>
        ) : errorCarga ? (
          <div className="px-5 py-8 text-center">
            <p className="text-rojo text-sm mb-3">Error al cargar: {errorCarga}</p>
            <button onClick={cargar} className="text-marca text-sm hover:underline">
              Reintentar
            </button>
          </div>
        ) : visibles.length === 0 ? (
          <p className="text-tinta-tenue text-sm text-center py-8">
            {hayFiltros ? 'Ningún artículo coincide con esos filtros' : 'No hay artículos en el catálogo'}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-borde-suave">
              {visibles.slice(0, limite).map((f) => {
                const esAbierto = abierto === f.cod;
                const n = aNumero(cantidad);
                const quedaria =
                  f.stock !== null && Number.isFinite(n) && accion !== 'CONTEO' ? f.stock + n : null;
                return (
                  <li key={f.cod} className={esAbierto ? 'bg-marca-suave' : ''}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => abrir(f)}
                        disabled={contando}
                        aria-expanded={esAbierto}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-tinta">{f.nombre}</span>
                          <span className="block truncate text-xs text-tinta-tenue">
                            {f.rubro || 'Sin rubro'} · {f.cod}
                            {f.costo <= 0 && ' · sin costo'}
                          </span>
                        </span>
                        {!contando && (
                          <span className="shrink-0 text-right">
                            {f.stock === null ? (
                              <span className="text-xs font-medium text-ocre">Sin contar</span>
                            ) : (
                              <>
                                <span
                                  className={`block text-sm font-semibold tabular ${
                                    f.stock < 0 ? 'text-rojo' : f.stock === 0 ? 'text-tinta-tenue' : 'text-tinta'
                                  }`}
                                >
                                  {formatNumero(f.stock)} u
                                </span>
                                {f.valor > 0 && (
                                  <span className="block text-xs text-tinta-suave tabular">{formatPrecio(f.valor)}</span>
                                )}
                              </>
                            )}
                          </span>
                        )}
                      </button>

                      {contando && (
                        <div className="shrink-0 text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Cantidad de ${f.nombre}`}
                            placeholder={f.stock === null ? '—' : formatNumero(f.stock)}
                            value={conteos[f.cod] ?? ''}
                            onChange={(e) => setConteos((c) => ({ ...c, [f.cod]: e.target.value }))}
                            className="w-20 rounded-panel border border-borde bg-panel px-2 py-2 text-right text-sm tabular focus:outline-none focus:ring-2 focus:ring-marca"
                          />
                        </div>
                      )}
                    </div>

                    {esAbierto && (
                      <div className="space-y-3 px-4 pb-4">
                        <div className="grid grid-cols-3 gap-1 rounded-panel bg-panel p-1 border border-borde">
                          {ACCIONES.map((a) => (
                            <button
                              key={a.tipo}
                              type="button"
                              onClick={() => setAccion(a.tipo)}
                              className={`rounded-panel py-2 text-sm font-semibold transition-colors ${
                                accion === a.tipo ? 'bg-marca text-white' : 'text-tinta-media hover:bg-acento-suave'
                              }`}
                            >
                              {a.etiqueta}
                            </button>
                          ))}
                        </div>

                        <p className="text-xs text-tinta-media">
                          {accion === 'CONTEO' &&
                            'Cuántas unidades hay ahora en total. Reemplaza lo anterior de este artículo.'}
                          {accion === 'COMPRA' && 'Cuántas unidades entraron. Se suman al stock.'}
                          {accion === 'AJUSTE' &&
                            'Corrección con signo: −2 si se rompieron o regalaron 2, +1 si faltaba sumar una.'}
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-tinta-suave mb-1">
                              {accion === 'CONTEO' ? 'Hay' : accion === 'COMPRA' ? 'Entraron' : 'Ajuste'}
                            </label>
                            <input
                              type="text"
                              inputMode={accion === 'AJUSTE' ? 'text' : 'decimal'}
                              value={cantidad}
                              onChange={(e) => setCantidad(e.target.value)}
                              placeholder="0"
                              autoFocus
                              className={campo}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-tinta-suave mb-1">
                              {accion === 'CONTEO' ? 'Al cierre del' : 'Fecha'}
                            </label>
                            <input
                              type="date"
                              value={fecha}
                              onChange={(e) => setFecha(e.target.value)}
                              className={campo}
                            />
                          </div>
                        </div>

                        {accion !== 'CONTEO' && (
                          <input
                            type="text"
                            value={detalle}
                            onChange={(e) => setDetalle(e.target.value)}
                            placeholder={accion === 'COMPRA' ? 'Proveedor o factura (opcional)' : 'Motivo (opcional)'}
                            className={campo}
                          />
                        )}

                        {f.stock === null && accion !== 'CONTEO' && (
                          <p className="text-xs text-ocre-fuerte">
                            Todavía no se lo contó: la cuenta va a arrancar desde esta fecha.
                          </p>
                        )}
                        {quedaria !== null && (
                          <p className="text-xs text-tinta-suave tabular">
                            Hay {formatNumero(f.stock ?? 0)} → quedaría en <strong>{formatNumero(quedaria)}</strong>
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => guardarUno(f)}
                          disabled={guardando || !Number.isFinite(n) || (accion === 'COMPRA' && n <= 0) || (accion === 'CONTEO' && n < 0) || (accion === 'AJUSTE' && n === 0)}
                          className="w-full rounded-panel bg-marca py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-marca-fuerte"
                        >
                          {guardando ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {visibles.length > limite && (
              <button
                type="button"
                onClick={() => setLimite((l) => l + PASO)}
                className="w-full border-t border-borde-suave py-3 text-sm font-medium text-marca"
              >
                Mostrar más ({visibles.length - limite} restantes)
              </button>
            )}
          </>
        )}
      </div>

      {/* Lo último que se cargó, por si hay que deshacer algo */}
      {historial.length > 0 && !contando && (
        <details className="panel mt-4 overflow-hidden">
          <summary className="cursor-pointer px-4 py-3 font-display text-lg text-tinta">
            Últimas cargas de stock
          </summary>
          <ul className="divide-y divide-borde-suave border-t border-borde-suave">
            {historial.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-tinta">{h.nombre}</p>
                  <p className="truncate text-xs text-tinta-tenue">
                    {h.fecha.slice(5).replace('-', '/')} · {NOMBRE_TIPO[h.tipo]}
                    {h.detalle && ` · ${h.detalle}`}
                    {h.usuario && ` · ${h.usuario}`}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tabular ${
                    h.tipo !== 'CONTEO' && h.cantidad < 0 ? 'text-rojo' : 'text-tinta'
                  }`}
                >
                  {h.tipo === 'CONTEO' ? '=' : h.cantidad > 0 ? '+' : '−'} {formatNumero(Math.abs(h.cantidad))}
                </span>
                <button
                  onClick={() => borrarHecho(h)}
                  disabled={guardando}
                  className="-my-2 -mr-2 p-2 text-tinta-suave hover:text-rojo transition-colors disabled:opacity-50 shrink-0"
                  title="Borrar"
                  aria-label="Borrar"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Barra de guardado del conteo: queda sobre la barra de navegación. */}
      {contando && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-borde bg-panel p-3 md:bottom-0">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <p className="flex-1 text-sm text-tinta-media tabular">
              {conteosCargados.length === 0
                ? 'Nada cargado todavía'
                : `${conteosCargados.length} ${conteosCargados.length === 1 ? 'artículo' : 'artículos'} para guardar`}
              {conteoInvalido && <span className="block text-xs text-rojo">Hay cantidades negativas.</span>}
            </p>
            <button
              type="button"
              onClick={guardarConteos}
              disabled={guardando || conteosCargados.length === 0 || conteoInvalido}
              className="rounded-panel bg-marca px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-marca-fuerte"
            >
              {guardando ? 'Guardando...' : 'Guardar conteo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
