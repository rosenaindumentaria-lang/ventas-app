'use client';

import { useState, useEffect } from 'react';
import { Gasto } from '@/lib/types';
import { formatPrecio } from '@/lib/format';

const CATEGORIAS = ['Gasto Adm', 'Gasto Comercializacion', 'Gasto Fiscal', 'Gasto Financiero', 'Pago Mercadería'];

export default function Gastos() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('Gasto Adm');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);

  function cargarGastos() {
    setLoading(true);
    fetch('/api/gastos')
      .then((r) => r.json())
      .then((data) => {
        setGastos(data.reverse());
        setLoading(false);
      });
  }

  useEffect(() => {
    cargarGastos();
  }, []);

  async function registrar() {
    if (!descripcion.trim() || !monto) return;
    setGuardando(true);
    setMensaje(null);

    try {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descripcion, categoria, monto: parseFloat(monto), fecha }),
      });

      if (res.ok) {
        setMensaje({ tipo: 'ok', texto: '✅ Gasto registrado' });
        setDescripcion('');
        setMonto('');
        setCategoria('Gasto Adm');
        setFecha(new Date().toISOString().split('T')[0]);
        cargarGastos();
      } else {
        const data = await res.json().catch(() => ({}));
        setMensaje({ tipo: 'error', texto: `❌ ${data.detalle || data.error || 'Error'}` });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: '❌ Error de conexión' });
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: string) {
    if (!confirm('¿Borrar este gasto?')) return;
    setProcesando(true);
    try {
      const res = await fetch(`/api/gastos?id=${id}`, { method: 'DELETE' });
      if (res.ok) setGastos((prev) => prev.filter((g) => g.id !== id));
      else alert('Error al borrar');
    } finally {
      setProcesando(false);
    }
  }

  const totalMes = gastos
    .filter((g) => g.fecha.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((a, g) => a + g.monto, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Gastos</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="bg-white rounded-xl shadow p-6 space-y-4 h-fit">
          <h2 className="text-sm font-semibold text-gray-700">Registrar gasto</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Compra de packaging, envío a cliente..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoria(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    categoria === cat
                      ? 'bg-rose-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
            <input
              type="number"
              min={0}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <button
            onClick={registrar}
            disabled={!descripcion.trim() || !monto || guardando}
            className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {guardando ? 'Guardando...' : 'Registrar Gasto'}
          </button>

          {mensaje && (
            <p className={`text-sm text-center font-medium ${mensaje.tipo === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
              {mensaje.texto}
            </p>
          )}

          <div className="border-t pt-3 flex justify-between text-sm">
            <span className="text-gray-500">Gastos del mes actual</span>
            <span className="font-bold text-rose-600">{formatPrecio(totalMes)}</span>
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow overflow-hidden h-fit">
          <div className="px-5 py-4 border-b">
            <h2 className="text-sm font-semibold text-gray-700">Últimos gastos</h2>
          </div>
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-8">Cargando...</p>
          ) : gastos.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No hay gastos registrados</p>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
              {gastos.map((g) => (
                <li key={g.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{g.descripcion}</p>
                    <p className="text-xs text-gray-400">
                      {g.fecha.slice(5).replace('-', '/')} · {g.categoria}
                      {g.usuario && ` · ${g.usuario}`}
                    </p>
                  </div>
                  <span className="text-rose-600 font-semibold text-sm shrink-0">
                    {formatPrecio(g.monto)}
                  </span>
                  <button
                    onClick={() => borrar(g.id)}
                    disabled={procesando}
                    className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50 shrink-0"
                    title="Borrar"
                  >
                    🗑️
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
