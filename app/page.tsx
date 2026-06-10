'use client';

import { useState, useEffect, useMemo } from 'react';
import { Producto } from '@/lib/types';
import { formatPrecio } from '@/lib/format';

type TipoPrecio = 'UNIDAD' | 'EFECTIVO' | 'MAYOR';

export default function RegistrarVenta() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [tipoPrecio, setTipoPrecio] = useState<TipoPrecio>('EFECTIVO');
  const [origen, setOrigen] = useState('');
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [mostrarLista, setMostrarLista] = useState(false);

  useEffect(() => {
    fetch('/api/productos')
      .then((r) => r.json())
      .then((data) => {
        setProductos(data);
        setLoading(false);
      });
  }, []);

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

  const precioUnitario = productoSeleccionado
    ? tipoPrecio === 'UNIDAD'
      ? productoSeleccionado.precioUnidad
      : tipoPrecio === 'EFECTIVO'
      ? productoSeleccionado.precioEfectivo
      : productoSeleccionado.precioMayor
    : 0;

  const total = precioUnitario * cantidad;
  const ganancia = (precioUnitario - (productoSeleccionado?.costo || 0)) * cantidad;

  function seleccionarProducto(p: Producto) {
    setProductoSeleccionado(p);
    setBusqueda(p.nombreComercial);
    setMostrarLista(false);
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
          cod: productoSeleccionado.cod,
          nombreComercial: productoSeleccionado.nombreComercial,
          cantidad,
          tipoPrecio,
          precioUnitario,
          costo: productoSeleccionado.costo,
        }),
      });

      if (res.ok) {
        setMensaje({ tipo: 'ok', texto: '✅ Venta registrada correctamente' });
        setBusqueda('');
        setProductoSeleccionado(null);
        setCantidad(1);
        setTipoPrecio('EFECTIVO');
        setOrigen('');
      } else {
        const data = await res.json().catch(() => ({}));
        setMensaje({ tipo: 'error', texto: `❌ ${data.detalle || data.error || 'Error al registrar la venta'}` });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: '❌ Error de conexión' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Registrar Venta</h1>

      {loading ? (
        <p className="text-gray-500">Cargando productos...</p>
      ) : (
        <div className="bg-white rounded-xl shadow p-6 max-w-xl space-y-5">
          {/* Origen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origen</label>
            <div className="flex gap-2 flex-wrap">
              {(['Inta', 'Face', 'Local', 'Otro'] as const).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setOrigen(op === origen ? '' : op)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    origen === op
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {op}
                </button>
              ))}
              <input
                type="text"
                value={['Inta', 'Face', 'Local', 'Otro'].includes(origen) ? '' : origen}
                onChange={(e) => setOrigen(e.target.value)}
                placeholder="Otro origen..."
                className="flex-1 min-w-[120px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Buscador */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setMostrarLista(true);
                if (!e.target.value) setProductoSeleccionado(null);
              }}
              placeholder="Buscar por nombre, código o descripción..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {mostrarLista && productosFiltrados.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                {productosFiltrados.map((p) => (
                  <li
                    key={p.cod}
                    onClick={() => seleccionarProducto(p)}
                    className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm"
                  >
                    <span className="font-medium">{p.nombreComercial}</span>
                    <span className="text-gray-400 ml-2 text-xs">{p.cod}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Detalle del producto */}
          {productoSeleccionado && (
            <div className="bg-indigo-50 rounded-lg p-3 text-sm space-y-1">
              <p>
                <span className="text-gray-500">Código:</span>{' '}
                <strong>{productoSeleccionado.cod}</strong>
              </p>
              <p>
                <span className="text-gray-500">Rubro:</span> {productoSeleccionado.rubro}
              </p>
              <p>
                <span className="text-gray-500">Costo:</span>{' '}
                {formatPrecio(productoSeleccionado.costo)}
              </p>
              <div className="flex gap-4 mt-1">
                <p>
                  <span className="text-gray-500">Unidad:</span>{' '}
                  <strong>{formatPrecio(productoSeleccionado.precioUnidad)}</strong>
                </p>
                <p>
                  <span className="text-gray-500">Efectivo:</span>{' '}
                  <strong>{formatPrecio(productoSeleccionado.precioEfectivo)}</strong>
                </p>
                <p>
                  <span className="text-gray-500">Mayor:</span>{' '}
                  <strong>{formatPrecio(productoSeleccionado.precioMayor)}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Tipo de precio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de precio</label>
            <div className="flex gap-2">
              {(['UNIDAD', 'EFECTIVO', 'MAYOR'] as TipoPrecio[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipoPrecio(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tipoPrecio === t
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
            <input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Resumen */}
          {productoSeleccionado && (
            <div className="border-t pt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Precio unitario ({tipoPrecio})</span>
                <span className="font-medium">{formatPrecio(precioUnitario)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cantidad</span>
                <span className="font-medium">{cantidad}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-indigo-700">
                <span>Total</span>
                <span>{formatPrecio(total)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Ganancia estimada</span>
                <span>{formatPrecio(ganancia)}</span>
              </div>
            </div>
          )}

          {/* Botón */}
          <button
            onClick={registrarVenta}
            disabled={!productoSeleccionado || guardando}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {guardando ? 'Guardando...' : 'Registrar Venta'}
          </button>

          {mensaje && (
            <p
              className={`text-sm text-center font-medium ${
                mensaje.tipo === 'ok' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {mensaje.texto}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
