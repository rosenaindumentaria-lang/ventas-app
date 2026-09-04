'use client';

import { useState, useEffect, useMemo, useRef, useId } from 'react';
import { Producto } from '@/lib/types';
import { formatPrecio } from '@/lib/format';
import { hoyISO, etiquetaFecha } from '@/lib/fecha';

type TipoPrecio = 'UNIDAD' | 'EFECTIVO' | 'MAYOR';

// Los tres precios que la planilla trae para cada producto. Antes se mostraban
// dos veces: como dato en la ficha y como botones sin importe en "Tipo de
// precio". Acá son una sola cosa, porque el precio ES la opción que se elige.
const PRECIOS: { tipo: TipoPrecio; etiqueta: string; campo: keyof Producto }[] = [
  { tipo: 'UNIDAD', etiqueta: 'Unidad', campo: 'precioUnidad' },
  { tipo: 'EFECTIVO', etiqueta: 'Efectivo', campo: 'precioEfectivo' },
  { tipo: 'MAYOR', etiqueta: 'Mayor', campo: 'precioMayor' },
];

const ORIGENES = ['Inta', 'Face', 'Local', 'Otro'] as const;

const campo =
  'w-full border border-borde rounded-panel px-3 py-2 text-sm bg-panel ' +
  'focus:outline-none focus:ring-2 focus:ring-marca focus:border-marca';

export default function RegistrarVenta() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [tipoPrecio, setTipoPrecio] = useState<TipoPrecio>('EFECTIVO');
  const [origen, setOrigen] = useState('');
  // null = todavía vale el precio de lista. Sólo guarda lo que se escribió a
  // mano, así no hay que re-sincronizarlo cada vez que cambia el producto.
  const [precioEscrito, setPrecioEscrito] = useState<number | null>(null);
  const [descuento, setDescuento] = useState(0);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(0);
  const [fecha, setFecha] = useState(hoyISO);
  const [editandoFecha, setEditandoFecha] = useState(false);

  const cajaBusqueda = useRef<HTMLDivElement>(null);
  const inputBusqueda = useRef<HTMLInputElement>(null);
  const opcionesRef = useRef<(HTMLLIElement | null)[]>([]);
  const idLista = useId();

  useEffect(() => {
    fetch('/api/productos')
      .then((r) => r.json())
      .then((data) => {
        setProductos(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const precioBase = productoSeleccionado
    ? tipoPrecio === 'UNIDAD'
      ? productoSeleccionado.precioUnidad
      : tipoPrecio === 'EFECTIVO'
        ? productoSeleccionado.precioEfectivo
        : productoSeleccionado.precioMayor
    : 0;

  const precioManual = precioEscrito ?? precioBase;

  const productosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return [];
    const q = busqueda.toLowerCase();
    return productos
      .filter(
        (p) =>
          p.nombreComercial.toLowerCase().includes(q) ||
          p.cod.toLowerCase().includes(q) ||
          p.descripcion.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [busqueda, productos]);

  const listaAbierta = mostrarLista && productosFiltrados.length > 0;

  // La opción marcada tiene que quedar a la vista aunque se navegue con flechas.
  useEffect(() => {
    if (listaAbierta) opcionesRef.current[indiceActivo]?.scrollIntoView({ block: 'nearest' });
  }, [indiceActivo, listaAbierta]);

  // Tocar fuera del buscador cierra la lista. Con `blur` no alcanza: al hacer
  // clic en una opción el input pierde el foco antes de que el clic llegue.
  useEffect(() => {
    if (!listaAbierta) return;
    function alTocarAfuera(e: PointerEvent) {
      if (!cajaBusqueda.current?.contains(e.target as Node)) setMostrarLista(false);
    }
    document.addEventListener('pointerdown', alTocarAfuera);
    return () => document.removeEventListener('pointerdown', alTocarAfuera);
  }, [listaAbierta]);

  const descuentoMonto = descuento > 0 ? Math.round(precioManual * (descuento / 100)) : 0;
  const precioFinal = precioManual - descuentoMonto;
  const total = precioFinal * cantidad;
  const ganancia = (precioFinal - (productoSeleccionado?.costo || 0)) * cantidad;
  const precioEspecial = precioManual !== precioBase;

  function elegirTipoPrecio(t: TipoPrecio) {
    setTipoPrecio(t);
    setPrecioEscrito(null);
    setDescuento(0);
  }

  function seleccionarProducto(p: Producto) {
    setProductoSeleccionado(p);
    setPrecioEscrito(null);
    setDescuento(0);
    setBusqueda(p.nombreComercial);
    setMostrarLista(false);
    setMensaje(null);
  }

  function limpiarProducto() {
    setProductoSeleccionado(null);
    setBusqueda('');
    setMostrarLista(false);
    setPrecioEscrito(null);
    setDescuento(0);
    inputBusqueda.current?.focus();
  }

  // El buscador se maneja con el teclado: es la forma más rápida de cargar una
  // venta atrás del mostrador, sin soltar la mano del teclado para ir al mouse.
  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setMostrarLista(false);
      return;
    }
    if (!listaAbierta) {
      if (e.key === 'ArrowDown' && productosFiltrados.length > 0) setMostrarLista(true);
      return;
    }
    const n = productosFiltrados.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceActivo((i) => (i + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceActivo((i) => (i - 1 + n) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const p = productosFiltrados[indiceActivo];
      if (p) seleccionarProducto(p);
    }
  }

  async function registrarVenta() {
    if (!productoSeleccionado) return;
    setGuardando(true);
    setMensaje(null);

    try {
      const res = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origen,
          fecha,
          cod: productoSeleccionado.cod,
          nombreComercial: productoSeleccionado.nombreComercial,
          cantidad,
          tipoPrecio,
          precioUnitario: precioFinal,
          costo: productoSeleccionado.costo,
        }),
      });

      if (res.ok) {
        setMensaje({
          tipo: 'ok',
          texto: `${cantidad} × ${productoSeleccionado.nombreComercial} · ${formatPrecio(total)}`,
        });
        setBusqueda('');
        setProductoSeleccionado(null);
        setCantidad(1);
        setTipoPrecio('EFECTIVO');
        setOrigen('');
        setPrecioEscrito(null);
        setDescuento(0);
        // La fecha NO se reinicia: si alguien está cargando ventas de ayer, las
        // está cargando todas de ayer.
        inputBusqueda.current?.focus();
      } else {
        const data = await res.json().catch(() => ({}));
        setMensaje({
          tipo: 'error',
          texto: data.detalle || data.error || 'No se pudo guardar la venta. Probá de nuevo.',
        });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Sin conexión. La venta no se guardó.' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      {/* La fecha vive en la cabecera y no como campo: el 95% de las veces es
          hoy, y ocupar un campo entero para confirmarlo es ruido. */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
        <h1 className="font-display text-3xl font-normal text-tinta">Registrar venta</h1>

        {editandoFecha ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fecha}
              autoFocus
              onChange={(e) => setFecha(e.target.value || hoyISO())}
              onBlur={() => setEditandoFecha(false)}
              className="border border-borde rounded-panel px-2 py-1 text-sm bg-panel focus:outline-none focus:ring-2 focus:ring-marca"
            />
            {fecha !== hoyISO() && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setFecha(hoyISO());
                  setEditandoFecha(false);
                }}
                className="text-xs text-marca hover:underline"
              >
                Volver a hoy
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditandoFecha(true)}
            className={`text-sm rounded-panel px-2.5 py-1 transition-colors hover:bg-marca-suave ${
              fecha === hoyISO() ? 'text-tinta-suave' : 'text-marca font-medium'
            }`}
          >
            {etiquetaFecha(fecha)} <span className="text-tinta-tenue">· cambiar</span>
          </button>
        )}
      </div>

      {mensaje?.tipo === 'ok' && (
        <div className="mb-4 flex items-start gap-2.5 border border-verde bg-verde-suave rounded-panel px-4 py-3 max-w-xl">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-verde mt-0.5 shrink-0"
            aria-hidden="true"
          >
            <path d="M3 8.5l3.5 3.5L13 4.5" />
          </svg>
          <div className="min-w-0 text-sm">
            <p className="font-medium text-verde-fuerte">Venta registrada</p>
            <p className="text-tinta-media break-words">{mensaje.texto}</p>
          </div>
        </div>
      )}

      <div className="max-w-xl">
        <div className="panel p-5 sm:p-6 space-y-6">
          {/* ── Buscador: es la pantalla, no un campo más ─────────────────── */}
          <div ref={cajaBusqueda} className="relative">
            <label htmlFor="buscador" className="block text-sm font-medium text-tinta-media mb-1.5">
              Producto
            </label>
            <div className="relative">
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta-tenue pointer-events-none"
                aria-hidden="true"
              >
                <circle cx="8" cy="8" r="5.5" />
                <path d="M12.5 12.5L16 16" />
              </svg>
              <input
                id="buscador"
                ref={inputBusqueda}
                type="text"
                role="combobox"
                aria-expanded={listaAbierta}
                aria-controls={listaAbierta ? idLista : undefined}
                aria-autocomplete="list"
                aria-activedescendant={listaAbierta ? `${idLista}-op-${indiceActivo}` : undefined}
                autoComplete="off"
                autoFocus
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setMostrarLista(true);
                  // Cada búsqueda nueva vuelve a apuntar al primer resultado.
                  setIndiceActivo(0);
                  if (!e.target.value) setProductoSeleccionado(null);
                }}
                onFocus={() => setMostrarLista(true)}
                onKeyDown={alTeclear}
                placeholder={loading ? 'Cargando productos…' : 'Nombre, código o descripción'}
                className="w-full border border-borde rounded-panel bg-panel pl-10 pr-10 py-3 text-base focus:outline-none focus:ring-2 focus:ring-marca focus:border-marca"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={limpiarProducto}
                  aria-label="Borrar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-tinta-tenue hover:text-tinta transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M2 2l10 10M12 2L2 12" />
                  </svg>
                </button>
              )}
            </div>

            {listaAbierta && (
              <ul
                id={idLista}
                role="listbox"
                aria-label="Productos encontrados"
                className="absolute z-20 w-full bg-panel border border-borde rounded-panel shadow-flotante mt-1 max-h-72 overflow-y-auto"
              >
                {productosFiltrados.map((p, i) => (
                  <li
                    key={p.cod}
                    id={`${idLista}-op-${i}`}
                    role="option"
                    aria-selected={i === indiceActivo}
                    ref={(el) => {
                      opcionesRef.current[i] = el;
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      seleccionarProducto(p);
                    }}
                    onPointerEnter={() => setIndiceActivo(i)}
                    className={`flex items-baseline justify-between gap-3 px-3 py-2.5 cursor-pointer border-b border-borde-suave last:border-b-0 ${
                      i === indiceActivo ? 'bg-marca-suave' : ''
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-tinta truncate">
                        {p.nombreComercial}
                      </span>
                      <span className="block text-xs text-tinta-tenue truncate">
                        {p.cod}
                        {p.rubro && ` · ${p.rubro}`}
                      </span>
                    </span>
                    {/* El precio de efectivo va en la lista: es el que más se
                        usa y evita elegir a ciegas y tener que volver atrás. */}
                    <span className="text-sm font-medium text-tinta shrink-0 tabular">
                      {formatPrecio(p.precioEfectivo)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {busqueda.trim() && !productoSeleccionado && productosFiltrados.length === 0 && !loading && (
              <p className="mt-2 text-sm text-tinta-suave">
                Ningún producto coincide con “{busqueda}”.
              </p>
            )}
          </div>

          {!productoSeleccionado ? (
            <p className="text-sm text-tinta-suave border-t border-borde-suave pt-5">
              Elegí un producto para cargar la venta. Se navega con ↑ ↓ y se elige con Enter.
            </p>
          ) : (
            <>
              {/* ── Precio: los tres de la planilla, elegibles ────────────── */}
              <div>
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <span className="text-sm font-medium text-tinta-media">Precio</span>
                  <span className="text-xs text-tinta-tenue">
                    Costo {formatPrecio(productoSeleccionado.costo)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Tipo de precio">
                  {PRECIOS.map(({ tipo, etiqueta, campo: c }) => {
                    const valor = productoSeleccionado[c] as number;
                    const elegido = tipoPrecio === tipo;
                    return (
                      <button
                        key={tipo}
                        type="button"
                        aria-pressed={elegido}
                        onClick={() => elegirTipoPrecio(tipo)}
                        className={`rounded-panel border px-2 py-2.5 text-left transition-colors ${
                          elegido
                            ? 'border-marca bg-marca-suave'
                            : 'border-borde hover:border-marca'
                        }`}
                      >
                        <span
                          className={`block text-[11px] uppercase tracking-wider ${
                            elegido ? 'text-marca' : 'text-tinta-tenue'
                          }`}
                        >
                          {etiqueta}
                        </span>
                        <span className="block font-display text-lg leading-tight text-tinta tabular">
                          {formatPrecio(valor)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Ajustes finos ────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="precio" className="block text-sm font-medium text-tinta-media mb-1.5">
                    Precio unitario
                  </label>
                  <input
                    id="precio"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={precioManual || ''}
                    onChange={(e) => setPrecioEscrito(parseFloat(e.target.value) || 0)}
                    className={`${campo} tabular`}
                  />
                  {precioEspecial && (
                    <p className="mt-1 text-xs text-ocre">
                      Precio especial · de lista {formatPrecio(precioBase)}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="descuento" className="block text-sm font-medium text-tinta-media mb-1.5">
                    Descuento
                  </label>
                  <div className="relative">
                    <input
                      id="descuento"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      value={descuento || ''}
                      onChange={(e) =>
                        setDescuento(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))
                      }
                      placeholder="0"
                      className={`${campo} pr-7 tabular`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tinta-tenue text-sm">
                      %
                    </span>
                  </div>
                  {descuento > 0 && (
                    <p className="mt-1 text-xs text-ocre">− {formatPrecio(descuentoMonto)} por unidad</p>
                  )}
                </div>
              </div>

              {/* Cantidad con botones: se carga con el dedo, parado atrás del
                  mostrador, no con el teclado numérico. */}
              <div>
                <span className="block text-sm font-medium text-tinta-media mb-1.5">Cantidad</span>
                <div className="inline-flex items-stretch border border-borde rounded-panel overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                    disabled={cantidad <= 1}
                    aria-label="Una unidad menos"
                    className="px-4 text-lg text-tinta-media hover:bg-marca-suave disabled:text-tinta-tenue disabled:hover:bg-transparent transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={cantidad}
                    onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                    aria-label="Cantidad"
                    className="w-16 border-x border-borde px-2 py-2 text-center text-sm bg-panel tabular focus:outline-none focus:ring-2 focus:ring-marca focus:ring-inset"
                  />
                  <button
                    type="button"
                    onClick={() => setCantidad((c) => c + 1)}
                    aria-label="Una unidad más"
                    className="px-4 text-lg text-tinta-media hover:bg-marca-suave transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* ── Origen ───────────────────────────────────────────────── */}
              <div>
                <span className="block text-sm font-medium text-tinta-media mb-1.5">Origen</span>
                <div className="flex gap-2 flex-wrap">
                  {ORIGENES.map((op) => (
                    <button
                      key={op}
                      type="button"
                      aria-pressed={origen === op}
                      onClick={() => setOrigen(op === origen ? '' : op)}
                      className={`px-3 py-1.5 rounded-panel border text-sm transition-colors ${
                        origen === op
                          ? 'border-marca bg-marca text-white'
                          : 'border-borde text-tinta-media hover:border-marca'
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={ORIGENES.includes(origen as (typeof ORIGENES)[number]) ? '' : origen}
                    onChange={(e) => setOrigen(e.target.value)}
                    placeholder="Otro origen…"
                    aria-label="Otro origen"
                    className="flex-1 min-w-[120px] border border-borde rounded-panel bg-panel px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-marca focus:border-marca"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Barra de cierre ──────────────────────────────────────────────
            Se queda pegada abajo mientras se completa el formulario: el total y
            el botón tienen que estar a la vista siempre, sin scrollear hasta el
            fondo para saber cuánto se está por cobrar. */}
        {productoSeleccionado && (
          <div
            className="sticky bottom-0 z-10 mt-3 border border-borde bg-panel rounded-panel px-4 pt-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {mensaje?.tipo === 'error' && (
              <p className="mb-2 text-sm text-rojo" role="alert">
                {mensaje.texto}
              </p>
            )}
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <span className="block text-[11px] uppercase tracking-wider text-tinta-suave">
                  Total
                </span>
                <span className="block font-display text-3xl leading-none text-tinta tabular">
                  {formatPrecio(total)}
                </span>
                <span className="block mt-1 text-xs text-tinta-suave break-words">
                  {cantidad} × {formatPrecio(precioFinal)}
                  {descuento > 0 && ` (−${descuento}% de ${formatPrecio(precioManual)})`}
                  {' · '}
                  <span className="text-verde">Ganancia {formatPrecio(ganancia)}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={registrarVenta}
                disabled={guardando}
                className="shrink-0 bg-marca hover:bg-marca-fuerte disabled:opacity-50 text-white text-sm font-medium px-5 py-3 rounded-panel transition-colors"
              >
                {guardando ? 'Guardando…' : 'Registrar venta'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
