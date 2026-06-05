'use client';

import { useState, useEffect, useMemo } from 'react';
import { Venta } from '@/lib/sheets';

export default function Historial() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    fetch('/api/ventas')
      .then((r) => r.json())
      .then((data) => {
        setVentas(data.reverse()); // más recientes primero
        setLoading(false);
      });
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Historial de Ventas</h1>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Producto</label>
          <input
            type="text"
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <button
          onClick={() => { setFechaDesde(''); setFechaHasta(''); setBusqueda(''); }}
          className="text-sm text-indigo-600 hover:underline"
        >
          Limpiar filtros
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Ventas</p>
          <p className="text-2xl font-bold text-gray-800">{ventasFiltradas.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Total vendido</p>
          <p className="text-2xl font-bold text-indigo-700">${totalFiltrado.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Ganancia</p>
          <p className="text-2xl font-bold text-green-600">${gananciaFiltrada.toFixed(2)}</p>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <p className="text-gray-500">Cargando ventas...</p>
      ) : ventasFiltradas.length === 0 ? (
        <p className="text-gray-400 text-center py-12">No hay ventas registradas con esos filtros.</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-center">Cant.</th>
                <th className="px-4 py-3 text-center">Tipo</th>
                <th className="px-4 py-3 text-right">P. Unit.</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Ganancia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ventasFiltradas.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{v.fecha}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{v.nombreComercial}</td>
                  <td className="px-4 py-3 text-gray-500">{v.cod}</td>
                  <td className="px-4 py-3 text-center">{v.cantidad}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 text-xs font-medium">
                      {v.tipoPrecio}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">${v.precioUnitario.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold">${v.total.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-green-600">${v.ganancia.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
