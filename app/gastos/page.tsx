'use client';

import { useState, useEffect } from 'react';
import { Gasto, GastoPendiente } from '@/lib/types';
import { formatPrecio } from '@/lib/format';
import { EVENTO_PENDIENTES } from '@/app/components/NavBar';

const CATEGORIAS = ['Gasto Adm', 'Gasto Comercializacion', 'Gasto Fiscal', 'Gasto Financiero'];

export default function Gastos() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [pendientes, setPendientes] = useState<GastoPendiente[]>([]);
  const [pendienteId, setPendienteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('Gasto Adm');
  const [monto, setMonto] = useState('');

  function cargarGastos() {
    setLoading(true);
    fetch('/api/gastos')
      .then((r) => r.json())
      .then((data) => {
        setGastos(data.reverse());
        setLoading(false);
      });
  }

  function cargarPendientes() {
    fetch('/api/gastos/pendientes')
      .then((r) => r.json())
      .then((data) => setPendientes(Array.isArray(data) ? data : []))
      .catch(() => setPendientes([]));
  }

  // Avisa a la nav para que recalcule el globito.
  function avisarNav() {
    window.dispatchEvent(new Event(EVENTO_PENDIENTES));
  }

  useEffect(() => {
    cargarGastos();
    cargarPendientes();
  }, []);

  // Cargar un pendiente en el formulario para terminar de registrarlo.
  function completarPendiente(p: GastoPendiente) {
    setPendienteId(p.id);
    setMonto(String(p.monto));
    setMensaje(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function descartarPendiente(id: string) {
    if (!confirm('¿Descartar este importe a medio cargar?')) return;
    setProcesando(true);
    try {
      const res = await fetch(`/api/gastos?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPendientes((prev) => prev.filter((p) => p.id !== id));
        if (pendienteId === id) setPendienteId(null);
        avisarNav();
      } else alert('Error al descartar');
    } finally {
      setProcesando(false);
    }
  }

  async function registrar() {
    if (!descripcion.trim() || !monto) return;
    setGuardando(true);
    setMensaje(null);

    try {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descripcion, categoria, monto: parseFloat(monto) }),
      });

      if (res.ok) {
        setMensaje({ tipo: 'ok', texto: '✅ Gasto registrado' });
        setDescripcion('');
        setMonto('');
        setCategoria('Gasto Adm');
        // Si veníamos completando un pendiente, borramos la fila huérfana.
        if (pendienteId) {
          await fetch(`/api/gastos?id=${pendienteId}`, { method: 'DELETE' }).catch(() => {});
          setPendienteId(null);
          cargarPendientes();
          avisarNav();
        }
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

      {pendientes.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            ⚠️ {pendientes.length === 1 ? 'Hay un gasto' : `Hay ${pendientes.length} gastos`} a medio
            registrar
          </p>
          <p className="text-xs text-amber-700 mb-3">
            Tienen importe pero les falta la fecha y el detalle. Completalos o descartalos.
          </p>
          <ul className="space-y-2">
            {pendientes.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
              >
                <span className="text-sm font-semibold text-gray-800">
                  {formatPrecio(p.monto)}
                  {p.usuario && <span className="ml-2 text-xs font-normal text-gray-400">{p.usuario}</span>}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => completarPendiente(p)}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
                  >
                    Completar
                  </button>
                  <button
                    onClick={() => descartarPendiente(p.id)}
                    disabled={procesando}
                    className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                  >
                    Descartar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="bg-white rounded-xl shadow p-6 space-y-4 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Registrar gasto</h2>
            {pendienteId && (
              <button
                type="button"
                onClick={() => {
                  setPendienteId(null);
                  setMonto('');
                }}
                className="text-xs text-amber-600 hover:underline"
              >
                Completando pendiente · cancelar
              </button>
            )}
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
