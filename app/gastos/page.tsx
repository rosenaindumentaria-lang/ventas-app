'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Gasto, GastoPendiente } from '@/lib/types';
import { formatPrecio } from '@/lib/format';
import { EVENTO_PENDIENTES } from '@/app/components/NavBar';
import Filtros from '@/app/components/Filtros';

// "Pago Mercadería" ya no está: la compra de mercadería no es un gasto, es una
// salida de caja. Su costo se descuenta solo al vender, dentro de la ganancia
// de cada venta, asi que cargarla acá tambien la restaba dos veces. Va en
// Movimientos → Sale plata → Compra de mercadería.
const CATEGORIAS = ['Gasto Adm', 'Gasto Comercializacion', 'Gasto Fiscal', 'Gasto Financiero'];

export default function Gastos() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [pendientes, setPendientes] = useState<GastoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Filtros de la lista
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  // Formulario (nuevo o edición)
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('Gasto Adm');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);

  function cargarGastos() {
    setLoading(true);
    setErrorCarga(null);
    fetch('/api/gastos')
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) throw new Error(data.error || 'Respuesta inválida');
        setGastos(data.reverse());
      })
      .catch((e) => setErrorCarga(e.message))
      .finally(() => setLoading(false));
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

  function empezarEdicion(g: Gasto) {
    setEditandoId(g.id);
    setDescripcion(g.descripcion);
    setCategoria(g.categoria || 'Gasto Adm');
    setMonto(String(g.monto));
    setFecha(g.fecha);
    setMensaje(null);
  }

  // Deja el formulario en blanco SIN tocar el mensaje, para poder mostrar el
  // "guardado" despues de limpiar. cancelarEdicion sí lo borra, porque ahi el
  // usuario esta descartando lo que estaba haciendo.
  function limpiarFormulario() {
    setEditandoId(null);
    setDescripcion('');
    setCategoria('Gasto Adm');
    setMonto('');
    setFecha(new Date().toISOString().split('T')[0]);
  }

  function cancelarEdicion() {
    limpiarFormulario();
    setMensaje(null);
  }

  // Cargar un pendiente en el formulario para terminar de registrarlo. Se edita
  // la fila que ya existe en vez de crear una nueva y borrar la vieja: una sola
  // escritura, y no hay riesgo de que se corran las filas en el medio.
  function completarPendiente(p: GastoPendiente) {
    setEditandoId(p.id);
    setDescripcion('');
    setCategoria('Gasto Adm');
    setMonto(String(p.monto));
    setFecha(new Date().toISOString().split('T')[0]);
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
        if (editandoId === id) cancelarEdicion();
        avisarNav();
      } else alert('Error al descartar');
    } finally {
      setProcesando(false);
    }
  }

  // La fila que estamos editando sigue siendo un pendiente mientras no tenga fecha.
  const completandoPendiente =
    editandoId !== null && pendientes.some((p) => p.id === editandoId);

  async function guardar() {
    if (!descripcion.trim() || !monto) return;
    setGuardando(true);
    setMensaje(null);

    const esEdicion = editandoId !== null;
    const url = '/api/gastos';
    const method = esEdicion ? 'PUT' : 'POST';
    const body = esEdicion
      ? { id: editandoId, fecha, descripcion, categoria, monto: parseFloat(monto) }
      : { fecha, descripcion, categoria, monto: parseFloat(monto) };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setMensaje({ tipo: 'ok', texto: esEdicion ? '✅ Gasto actualizado' : '✅ Gasto registrado' });
        limpiarFormulario();
        // Si lo que se guardó era un pendiente, ya tiene fecha y deja de serlo.
        cargarPendientes();
        avisarNav();
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
      if (res.ok) {
        setGastos((prev) => prev.filter((g) => g.id !== id));
        if (editandoId === id) cancelarEdicion();
      } else {
        alert('Error al borrar');
      }
    } finally {
      setProcesando(false);
    }
  }

  const totalMes = gastos
    .filter((g) => g.fecha.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((a, g) => a + g.monto, 0);

  const gastosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return gastos.filter((g) => {
      const cumpleFecha = (!fechaDesde || g.fecha >= fechaDesde) && (!fechaHasta || g.fecha <= fechaHasta);
      const cumpleCategoria = !filtroCategoria || g.categoria === filtroCategoria;
      const cumpleTexto =
        !texto ||
        g.descripcion.toLowerCase().includes(texto) ||
        g.categoria.toLowerCase().includes(texto) ||
        (g.usuario || '').toLowerCase().includes(texto);
      return cumpleFecha && cumpleCategoria && cumpleTexto;
    });
  }, [gastos, fechaDesde, fechaHasta, filtroCategoria, busqueda]);

  const totalFiltrado = gastosFiltrados.reduce((a, g) => a + g.monto, 0);
  const hayFiltros = Boolean(fechaDesde || fechaHasta || busqueda || filtroCategoria);

  // Las categorias del selector salen de los datos y no de CATEGORIAS, para que
  // sigan siendo filtrables las que quedaron de antes (ej. "Pago Mercadería").
  const categoriasPresentes = useMemo(
    () => Array.from(new Set(gastos.map((g) => g.categoria).filter(Boolean))).sort(),
    [gastos]
  );

  function limpiarFiltros() {
    setFechaDesde('');
    setFechaHasta('');
    setBusqueda('');
    setFiltroCategoria('');
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-normal text-tinta mb-6">Gastos</h1>

      {pendientes.length > 0 && (
        <div className="mb-6 rounded-panel border border-ocre bg-ocre-suave p-4">
          <p className="text-sm font-semibold text-ocre-fuerte">
            ⚠️ {pendientes.length === 1 ? 'Hay un gasto' : `Hay ${pendientes.length} gastos`} a medio
            registrar
          </p>
          <p className="text-xs text-ocre-fuerte mb-3">
            Tienen importe pero les falta la fecha y el detalle. Completalos o descartalos.
          </p>
          <ul className="space-y-2">
            {pendientes.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-panel bg-panel px-3 py-2"
              >
                <span className="text-sm font-semibold text-tinta">
                  {formatPrecio(p.monto)}
                  {p.usuario && <span className="ml-2 text-xs font-normal text-tinta-tenue">{p.usuario}</span>}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => completarPendiente(p)}
                    className="rounded-panel bg-ocre px-3 py-1.5 text-xs font-medium text-white hover:bg-ocre-fuerte"
                  >
                    Completar
                  </button>
                  <button
                    onClick={() => descartarPendiente(p.id)}
                    disabled={procesando}
                    className="rounded-panel bg-marca-suave px-3 py-1.5 text-xs font-medium text-tinta-media hover:bg-acento-suave disabled:opacity-50"
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
        <div className="panel p-6 space-y-4 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-normal text-tinta">
              {completandoPendiente
                ? 'Completar gasto pendiente'
                : editandoId
                  ? 'Editar gasto'
                  : 'Registrar gasto'}
            </h2>
            {editandoId && (
              <button
                type="button"
                onClick={cancelarEdicion}
                className="text-xs text-ocre hover:underline"
              >
                Cancelar
              </button>
            )}
          </div>

          {completandoPendiente && (
            <p className="rounded-panel bg-ocre-suave px-3 py-2 text-xs text-ocre-fuerte">
              Poné la fecha y el detalle que le faltaban. El importe ya estaba cargado.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-tinta-media mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-borde rounded-panel px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marca"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tinta-media mb-1">Descripción</label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Compra de packaging, envío a cliente..."
              className="w-full border border-borde rounded-panel px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marca"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tinta-media mb-1">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoria(cat)}
                  className={`px-3 py-1.5 rounded-panel text-xs font-medium transition-colors ${
                    categoria === cat
                      ? 'bg-rojo text-white'
                      : 'bg-marca-suave text-tinta-media hover:bg-acento-suave'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-tinta-tenue">
              ¿Compraste mercadería, muebles o instalaciones? No van acá: son salidas de caja, no
              gastos.{' '}
              <Link href="/movimientos" className="text-marca hover:underline">
                Cargalas en Movimientos
              </Link>
              .
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-tinta-media mb-1">Monto</label>
            <input
              type="number"
              min={0}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              className="w-full border border-borde rounded-panel px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marca"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={!descripcion.trim() || !monto || guardando}
              className="flex-1 bg-rojo hover:bg-rojo-fuerte disabled:opacity-50 text-white font-semibold py-2.5 rounded-panel transition-colors"
            >
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Registrar Gasto'}
            </button>
            {editandoId && (
              <button
                onClick={cancelarEdicion}
                className="px-4 py-2.5 rounded-panel border border-borde text-tinta-media hover:bg-panel-2 text-sm"
              >
                Cancelar
              </button>
            )}
          </div>

          {mensaje && (
            <p className={`text-sm text-center font-medium ${mensaje.tipo === 'ok' ? 'text-verde' : 'text-rojo'}`}>
              {mensaje.texto}
            </p>
          )}

          <div className="border-t pt-3 flex justify-between text-sm">
            <span className="text-tinta-suave">Gastos del mes actual</span>
            <span className="font-bold text-rojo">{formatPrecio(totalMes)}</span>
          </div>
        </div>

        {/* Lista */}
        <div className="h-fit">
          <Filtros
            desde={fechaDesde}
            hasta={fechaHasta}
            onDesde={setFechaDesde}
            onHasta={setFechaHasta}
            busqueda={busqueda}
            onBusqueda={setBusqueda}
            buscarLabel="Buscar"
            buscarPlaceholder="Descripción, categoría o usuario..."
            select={{
              label: 'Categoría',
              valor: filtroCategoria,
              onChange: setFiltroCategoria,
              opciones: categoriasPresentes,
              etiquetaTodas: 'Todas',
            }}
            onLimpiar={limpiarFiltros}
            hayFiltros={hayFiltros}
          />

          <div className="panel overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-normal text-tinta">
              {hayFiltros ? 'Gastos filtrados' : 'Últimos gastos'}
              <span className="ml-2 font-normal text-tinta-tenue">({gastosFiltrados.length})</span>
            </h2>
            <span className="text-sm font-bold text-rojo shrink-0">{formatPrecio(totalFiltrado)}</span>
          </div>
          {loading ? (
            <p className="text-tinta-tenue text-sm text-center py-8">Cargando...</p>
          ) : errorCarga ? (
            <div className="px-5 py-8 text-center">
              <p className="text-rojo text-sm mb-3">Error al cargar: {errorCarga}</p>
              <button onClick={cargarGastos} className="text-marca text-sm hover:underline">
                Reintentar
              </button>
            </div>
          ) : gastosFiltrados.length === 0 ? (
            <p className="text-tinta-tenue text-sm text-center py-8">
              {hayFiltros ? 'Ningún gasto coincide con esos filtros' : 'No hay gastos registrados'}
            </p>
          ) : (
            <ul className="divide-y divide-borde-suave max-h-[520px] overflow-y-auto">
              {gastosFiltrados.map((g) => (
                <li
                  key={g.id}
                  className={`px-5 py-3 flex items-center justify-between gap-3 ${
                    editandoId === g.id ? 'bg-rojo-suave' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-tinta truncate">{g.descripcion}</p>
                    <p className="text-xs text-tinta-tenue">
                      {g.fecha.slice(5).replace('-', '/')} · {g.categoria}
                      {g.usuario && ` · ${g.usuario}`}
                    </p>
                  </div>
                  <span className="text-rojo font-semibold text-sm shrink-0">
                    {formatPrecio(g.monto)}
                  </span>
                  <button
                    onClick={() => empezarEdicion(g)}
                    disabled={procesando}
                    className="text-tinta-tenue hover:text-marca-fuerte transition-colors disabled:opacity-50 shrink-0"
                    title="Editar"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => borrar(g.id)}
                    disabled={procesando}
                    className="text-tinta-tenue hover:text-rojo transition-colors disabled:opacity-50 shrink-0"
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
    </div>
  );
}
