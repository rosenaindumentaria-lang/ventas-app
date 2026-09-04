'use client';

import { useState, useEffect, useMemo } from 'react';
import { Venta } from '@/lib/types';
import { formatPrecio } from '@/lib/format';
import Filtros from '@/app/components/Filtros';

export default function Historial() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nuevaCantidad, setNuevaCantidad] = useState(1);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  function cargarVentas() {
    setLoading(true);
    fetch('/api/ventas')
      .then((r) => r.json())
      .then((data) => {
        setVentas(data.reverse()); // más recientes primero
        setLoading(false);
      });
  }

  useEffect(() => {
    cargarVentas();
  }, []);

  const ventasFiltradas = useMemo(() => {
    return ventas.filter((v) => {
      const cumpleFecha =
        (!fechaDesde || v.fecha >= fechaDesde) && (!fechaHasta || v.fecha <= fechaHasta);
      const cumpleBusqueda =
        !busqueda ||
        v.nombreComercial.toLowerCase().includes(busqueda.toLowerCase()) ||
        v.cod.toLowerCase().includes(busqueda.toLowerCase());
      return cumpleFecha && cumpleBusqueda;
    });
  }, [ventas, fechaDesde, fechaHasta, busqueda]);

  const totalFiltrado = ventasFiltradas.reduce((acc, v) => acc + v.total, 0);
  const gananciaFiltrada = ventasFiltradas.reduce((acc, v) => acc + v.ganancia, 0);

  async function borrarVenta(id: string) {
    if (!confirm('¿Seguro que querés borrar esta venta?')) return;
    setProcesando(true);
    try {
      const res = await fetch(`/api/ventas?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setVentas((prev) => prev.filter((v) => v.id !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Error al borrar: ${data.detalle || data.error || 'desconocido'}`);
      }
    } finally {
      setProcesando(false);
    }
  }

  function empezarEdicion(v: Venta) {
    setEditandoId(v.id);
    setNuevaCantidad(v.cantidad);
    setNuevaFecha(v.fecha);
  }

  async function guardarEdicion(id: string) {
    setProcesando(true);
    setErrorEdicion(null);
    try {
      const res = await fetch('/api/ventas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cantidad: nuevaCantidad, fecha: nuevaFecha }),
      });
      if (res.ok) {
        setEditandoId(null);
        cargarVentas();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorEdicion(data.detalle || data.error || 'Error desconocido');
      }
    } catch {
      setErrorEdicion('Error de conexión');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-normal text-tinta mb-6">Historial de Ventas</h1>

      <Filtros
        desde={fechaDesde}
        hasta={fechaHasta}
        onDesde={setFechaDesde}
        onHasta={setFechaHasta}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        buscarLabel="Producto"
        buscarPlaceholder="Buscar producto..."
        onLimpiar={() => {
          setFechaDesde('');
          setFechaHasta('');
          setBusqueda('');
        }}
        hayFiltros={Boolean(fechaDesde || fechaHasta || busqueda)}
      />

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        <div className="panel p-3 sm:p-4 text-center">
          <p className="text-xs text-tinta-suave mb-1">Ventas</p>
          <p className="text-lg sm:font-display text-3xl font-normal text-tinta">{ventasFiltradas.length}</p>
        </div>
        <div className="panel p-3 sm:p-4 text-center">
          <p className="text-xs text-tinta-suave mb-1">Total vendido</p>
          <p className="text-lg sm:text-2xl font-bold text-marca break-words">{formatPrecio(totalFiltrado)}</p>
        </div>
        <div className="panel p-3 sm:p-4 text-center">
          <p className="text-xs text-tinta-suave mb-1">Ganancia</p>
          <p className="text-lg sm:text-2xl font-bold text-verde break-words">{formatPrecio(gananciaFiltrada)}</p>
        </div>
      </div>

      {errorEdicion && (
        <div className="mb-4 bg-rojo-suave border border-rojo text-rojo-fuerte text-sm rounded-panel px-4 py-3">
          ❌ Error al guardar: {errorEdicion}
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <p className="text-tinta-suave">Cargando ventas...</p>
      ) : ventasFiltradas.length === 0 ? (
        <p className="text-tinta-tenue text-center py-12">No hay ventas registradas con esos filtros.</p>
      ) : (
        <>
        {/* Tabla (escritorio) */}
        <div className="hidden md:block panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-tinta-suave uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Origen</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Usuario</th>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-center">Cant.</th>
                <th className="px-4 py-3 text-center">Tipo</th>
                <th className="px-4 py-3 text-right">P. Unit.</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Ganancia</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde-suave">
              {ventasFiltradas.map((v) => (
                <tr key={v.id} className="hover:bg-panel-2">
                  <td className="px-4 py-3 text-tinta-suave">{v.origen}</td>
                  <td className="px-4 py-3 text-tinta-suave">
                    {editandoId === v.id ? (
                      <input
                        type="date"
                        value={nuevaFecha}
                        onChange={(e) => setNuevaFecha(e.target.value)}
                        className="border border-marca rounded px-2 py-1 text-sm"
                      />
                    ) : (
                      v.fecha
                    )}
                  </td>
                  <td className="px-4 py-3 text-tinta-suave">{v.usuario || '—'}</td>
                  <td className="px-4 py-3 font-medium text-tinta">{v.nombreComercial}</td>
                  <td className="px-4 py-3 text-tinta-suave">{v.cod}</td>
                  <td className="px-4 py-3 text-center">
                    {editandoId === v.id ? (
                      <input
                        type="number"
                        min={1}
                        value={nuevaCantidad}
                        onChange={(e) => setNuevaCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 border border-marca rounded px-2 py-1 text-center"
                      />
                    ) : (
                      v.cantidad
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-marca-suave text-marca px-2 py-0.5 text-[11px] font-medium tracking-wider">
                      {v.tipoPrecio}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatPrecio(v.precioUnitario)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPrecio(v.total)}</td>
                  <td className="px-4 py-3 text-right text-verde">{formatPrecio(v.ganancia)}</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {editandoId === v.id ? (
                      <>
                        <button
                          onClick={() => guardarEdicion(v.id)}
                          disabled={procesando}
                          className="text-verde hover:text-verde-fuerte font-medium mr-2 disabled:opacity-50"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditandoId(null)}
                          className="text-tinta-tenue hover:text-tinta-media"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => empezarEdicion(v)}
                          disabled={procesando}
                          className="text-marca hover:text-marca-fuerte mr-3 disabled:opacity-50"
                          title="Editar cantidad"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => borrarVenta(v.id)}
                          disabled={procesando}
                          className="text-rojo hover:text-rojo-fuerte disabled:opacity-50"
                          title="Borrar venta"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tarjetas (mobile) */}
        <div className="md:hidden space-y-3">
          {ventasFiltradas.map((v) => (
            <div key={v.id} className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-tinta break-words">{v.nombreComercial}</p>
                  <div className="text-xs text-tinta-tenue mt-0.5">
                    {editandoId === v.id ? (
                      <input
                        type="date"
                        value={nuevaFecha}
                        onChange={(e) => setNuevaFecha(e.target.value)}
                        className="border border-marca rounded px-2 py-1 text-sm text-tinta-media"
                      />
                    ) : (
                      <span>{v.fecha}{v.cod && ` · ${v.cod}`}{v.origen && ` · ${v.origen}`}</span>
                    )}
                  </div>
                </div>
                <span className="bg-marca-suave text-marca px-2 py-0.5 text-[11px] font-medium tracking-wider shrink-0">
                  {v.tipoPrecio}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-tinta-tenue">Cant.</p>
                  {editandoId === v.id ? (
                    <input
                      type="number"
                      min={1}
                      value={nuevaCantidad}
                      onChange={(e) => setNuevaCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 border border-marca rounded px-2 py-1 text-center"
                    />
                  ) : (
                    <p className="font-medium text-tinta-media">
                      {v.cantidad} <span className="text-tinta-tenue">× {formatPrecio(v.precioUnitario)}</span>
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-tinta-tenue">Total</p>
                  <p className="font-semibold text-tinta">{formatPrecio(v.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-tinta-tenue">Ganancia</p>
                  <p className="font-medium text-verde">{formatPrecio(v.ganancia)}</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-borde-suave flex items-center justify-between">
                <span className="text-xs text-tinta-tenue">{v.usuario || '—'}</span>
                <div className="flex items-center gap-4">
                  {editandoId === v.id ? (
                    <>
                      <button
                        onClick={() => guardarEdicion(v.id)}
                        disabled={procesando}
                        className="text-verde font-medium text-sm disabled:opacity-50"
                      >
                        {procesando ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button onClick={() => setEditandoId(null)} className="text-tinta-tenue text-sm">
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => empezarEdicion(v)}
                        disabled={procesando}
                        className="text-marca text-sm disabled:opacity-50"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => borrarVenta(v.id)}
                        disabled={procesando}
                        className="text-rojo text-sm disabled:opacity-50"
                      >
                        🗑️ Borrar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
