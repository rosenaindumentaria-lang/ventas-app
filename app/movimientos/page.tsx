'use client';

import { useState, useEffect, useMemo } from 'react';
import { MovimientoCaja, TIPOS_ENTRADA, TIPOS_SALIDA } from '@/lib/types';
import { formatPrecio } from '@/lib/format';
import Filtros from '@/app/components/Filtros';

type Sentido = 'entrada' | 'salida';

// Aclaraciones para los tipos que suelen confundirse con un gasto.
const AYUDA_TIPO: Record<string, React.ReactNode> = {
  'Compra de mercadería': (
    <>
      No la cargues en Gastos: el costo de la mercadería se descuenta solo cuando la vendés, porque
      ya está metido en la <strong>ganancia de cada venta</strong>. Cargarla en los dos lados la
      restaría dos veces.
    </>
  ),
  'Compra de bienes': (
    <>
      Muebles, instalaciones, equipos. No es un gasto: convertís plata en algo que seguís teniendo.
      Sale de la caja pero no baja la ganancia.
    </>
  ),
  'Devolución de préstamo': (
    <>
      Cargá acá <strong>sólo la parte de capital</strong> de la cuota. Los intereses van en{' '}
      <strong>Gastos → Gasto Financiero</strong>, porque ésos sí son un costo del negocio.
    </>
  ),
};

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Filtros de la lista
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  // Formulario (alta o edición)
  const hoy = new Date().toISOString().split('T')[0];
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [sentido, setSentido] = useState<Sentido>('entrada');
  const [detalle, setDetalle] = useState('');
  const [tipo, setTipo] = useState<string>(TIPOS_ENTRADA[0]);
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoy);

  // Si el movimiento que se edita tiene un tipo viejo que ya no está en la lista
  // de alta, se agrega igual para no perderlo al guardar.
  const tipos = useMemo(() => {
    const base = sentido === 'entrada' ? TIPOS_ENTRADA : TIPOS_SALIDA;
    return (base as readonly string[]).includes(tipo) ? base : [...base, tipo];
  }, [sentido, tipo]);

  function cambiarSentido(s: Sentido) {
    setSentido(s);
    setTipo(s === 'entrada' ? TIPOS_ENTRADA[0] : TIPOS_SALIDA[0]);
  }

  function empezarEdicion(m: MovimientoCaja) {
    setEditandoId(m.id);
    // El sentido sale del signo guardado, no del nombre del tipo.
    setSentido(m.monto >= 0 ? 'entrada' : 'salida');
    setTipo(m.tipo);
    setDetalle(m.detalle);
    setMonto(String(Math.abs(m.monto)));
    setFecha(m.fecha);
    setMensaje(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Deja el formulario en blanco SIN tocar el mensaje, para poder mostrar el
  // "guardado" despues de limpiar. cancelarEdicion sí lo borra, porque ahi el
  // usuario esta descartando lo que estaba haciendo.
  function limpiarFormulario() {
    setEditandoId(null);
    setSentido('entrada');
    setTipo(TIPOS_ENTRADA[0]);
    setDetalle('');
    setMonto('');
    setFecha(hoy);
  }

  function cancelarEdicion() {
    limpiarFormulario();
    setMensaje(null);
  }

  function cargarMovimientos() {
    setLoading(true);
    fetch('/api/movimientos')
      .then((r) => r.json())
      .then((data) => {
        setMovimientos(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    cargarMovimientos();
  }, []);

  async function guardar() {
    if (!detalle.trim() || !monto) return;
    setGuardando(true);
    setMensaje(null);

    const esEdicion = editandoId !== null;
    const cuerpo = { detalle, tipo, monto: parseFloat(monto), fecha, sentido };

    try {
      const res = await fetch('/api/movimientos', {
        method: esEdicion ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(esEdicion ? { ...cuerpo, id: editandoId } : cuerpo),
      });

      if (res.ok) {
        setMensaje({
          tipo: 'ok',
          texto: esEdicion ? '✅ Movimiento actualizado' : '✅ Movimiento registrado',
        });
        limpiarFormulario();
        cargarMovimientos();
      } else {
        const data = await res.json().catch(() => ({}));
        setMensaje({ tipo: 'error', texto: data.detalle || 'Error al guardar' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión' });
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: string) {
    if (!confirm('¿Borrar este movimiento?')) return;
    setProcesando(true);
    try {
      const res = await fetch(`/api/movimientos?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (editandoId === id) cancelarEdicion();
        cargarMovimientos();
      } else alert('Error al borrar');
    } finally {
      setProcesando(false);
    }
  }

  const movsFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return movimientos
      .filter((m) => {
        const cumpleFecha =
          (!fechaDesde || m.fecha >= fechaDesde) && (!fechaHasta || m.fecha <= fechaHasta);
        const cumpleTipo = !filtroTipo || m.tipo === filtroTipo;
        const cumpleTexto =
          !texto ||
          m.detalle.toLowerCase().includes(texto) ||
          m.tipo.toLowerCase().includes(texto) ||
          (m.usuario || '').toLowerCase().includes(texto);
        return cumpleFecha && cumpleTipo && cumpleTexto;
      })
      // Más recientes primero, igual que Historial y Gastos.
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [movimientos, fechaDesde, fechaHasta, filtroTipo, busqueda]);

  // Los totales siguen al filtro: si mirás un mes, ves el neto de ese mes.
  const totalEntradas = movsFiltrados.filter((m) => m.monto > 0).reduce((a, m) => a + m.monto, 0);
  const totalSalidas = movsFiltrados.filter((m) => m.monto < 0).reduce((a, m) => a - m.monto, 0);
  const neto = totalEntradas - totalSalidas;
  const hayFiltros = Boolean(fechaDesde || fechaHasta || busqueda || filtroTipo);

  // Del dato y no de las constantes, para que sigan siendo filtrables los tipos
  // viejos que ya no estan en la lista de alta.
  const tiposPresentes = useMemo(
    () => Array.from(new Set(movimientos.map((m) => m.tipo).filter(Boolean))).sort(),
    [movimientos]
  );

  function limpiarFiltros() {
    setFechaDesde('');
    setFechaHasta('');
    setBusqueda('');
    setFiltroTipo('');
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-normal text-tinta mb-2">Movimientos de caja</h1>
      <p className="text-sm text-tinta-suave mb-6">
        Plata que entra o sale sin ser una venta ni un gasto: préstamos, aportes, devoluciones,
        retiros. Mueven el saldo de caja pero no cuentan como ganancia ni como gasto del negocio.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className={`panel p-6 space-y-4 h-fit ${editandoId ? 'ring-2 ring-marca' : ''}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-normal text-tinta">
              {editandoId ? 'Editar movimiento' : 'Registrar movimiento'}
            </h2>
            {editandoId && (
              <button type="button" onClick={cancelarEdicion} className="text-xs text-marca hover:underline">
                Cancelar
              </button>
            )}
          </div>

          {/* Entra o sale */}
          <div className="grid grid-cols-2 gap-2 rounded-panel bg-marca-suave p-1">
            <button
              type="button"
              onClick={() => cambiarSentido('entrada')}
              className={`rounded-panel py-2 text-sm font-semibold transition-colors ${
                sentido === 'entrada' ? 'bg-verde text-white' : 'text-tinta-media hover:bg-acento-suave'
              }`}
            >
              ↓ Entra plata
            </button>
            <button
              type="button"
              onClick={() => cambiarSentido('salida')}
              className={`rounded-panel py-2 text-sm font-semibold transition-colors ${
                sentido === 'salida' ? 'bg-ocre text-white' : 'text-tinta-media hover:bg-acento-suave'
              }`}
            >
              ↑ Sale plata
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-tinta-media mb-1">Detalle</label>
            <input
              type="text"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder={
                sentido === 'entrada'
                  ? 'Ej: Préstamo del banco, plata que puse yo...'
                  : 'Ej: Cuota 3 del préstamo del banco...'
              }
              className="w-full border border-borde rounded-panel px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tinta-media mb-1">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {tipos.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`px-3 py-1.5 rounded-panel text-xs font-medium transition-colors ${
                    tipo === t
                      ? sentido === 'entrada'
                        ? 'bg-verde text-white'
                        : 'bg-ocre text-white'
                      : 'bg-marca-suave text-tinta-media hover:bg-acento-suave'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {AYUDA_TIPO[tipo] && (
            <div className="rounded-panel border border-ocre bg-ocre-suave px-3 py-2 text-xs text-ocre-fuerte">
              {AYUDA_TIPO[tipo]}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-tinta-media mb-1">Monto</label>
              <input
                type="number"
                min={0}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
                className="w-full border border-borde rounded-panel px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-tinta-media mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-borde rounded-panel px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde"
              />
            </div>
          </div>

          <button
            onClick={guardar}
            disabled={!detalle.trim() || !monto || guardando}
            className={`w-full disabled:opacity-50 text-white font-semibold py-2.5 rounded-panel transition-colors ${
              sentido === 'entrada'
                ? 'bg-verde hover:bg-verde-fuerte'
                : 'bg-ocre hover:bg-ocre-fuerte'
            }`}
          >
            {guardando
              ? 'Guardando...'
              : editandoId
                ? 'Guardar cambios'
                : sentido === 'entrada'
                  ? 'Registrar entrada'
                  : 'Registrar salida'}
          </button>

          {mensaje && (
            <p
              className={`text-sm text-center font-medium ${
                mensaje.tipo === 'ok' ? 'text-verde' : 'text-rojo'
              }`}
            >
              {mensaje.texto}
            </p>
          )}

          <div className="border-t pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-tinta-suave">Entradas</span>
              <span className="font-medium text-verde">{formatPrecio(totalEntradas)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-tinta-suave">Salidas</span>
              <span className="font-medium text-ocre">{formatPrecio(totalSalidas)}</span>
            </div>
            <div className="flex justify-between border-t pt-1.5">
              <span className="text-tinta-suave">Neto en caja</span>
              <span className={`font-bold ${neto >= 0 ? 'text-verde' : 'text-ocre'}`}>
                {formatPrecio(neto)}
              </span>
            </div>
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
            buscarPlaceholder="Detalle, tipo o usuario..."
            select={{
              label: 'Tipo',
              valor: filtroTipo,
              onChange: setFiltroTipo,
              opciones: tiposPresentes,
              etiquetaTodas: 'Todos',
            }}
            onLimpiar={limpiarFiltros}
            hayFiltros={hayFiltros}
          />

          <div className="panel overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-normal text-tinta">
              {hayFiltros ? 'Movimientos filtrados' : 'Últimos movimientos'}
              <span className="ml-2 font-normal text-tinta-tenue">({movsFiltrados.length})</span>
            </h2>
            <span className={`text-sm font-bold shrink-0 ${neto >= 0 ? 'text-verde' : 'text-ocre'}`}>
              {formatPrecio(neto)}
            </span>
          </div>
          {loading ? (
            <p className="text-tinta-tenue text-sm text-center py-8">Cargando...</p>
          ) : movsFiltrados.length === 0 ? (
            <p className="text-tinta-tenue text-sm text-center py-8">
              {hayFiltros
                ? 'Ningún movimiento coincide con esos filtros'
                : 'No hay movimientos registrados'}
            </p>
          ) : (
            <ul className="divide-y divide-borde-suave max-h-[520px] overflow-y-auto">
              {movsFiltrados.map((m) => {
                const entra = m.monto > 0;
                return (
                  <li
                    key={m.id}
                    className={`px-5 py-3 flex items-center justify-between gap-3 ${
                      editandoId === m.id ? 'bg-marca-suave' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-tinta truncate">{m.detalle}</p>
                      <p className="text-xs text-tinta-tenue">
                        {m.fecha.slice(5).replace('-', '/')} · {m.tipo}
                        {m.usuario && ` · ${m.usuario}`}
                      </p>
                    </div>
                    <span
                      className={`font-semibold text-sm shrink-0 ${
                        entra ? 'text-verde' : 'text-ocre'
                      }`}
                    >
                      {entra ? '+' : '−'} {formatPrecio(Math.abs(m.monto))}
                    </span>
                    <button
                      onClick={() => empezarEdicion(m)}
                      disabled={procesando}
                      className="text-tinta-tenue hover:text-marca-fuerte transition-colors disabled:opacity-50 shrink-0"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => borrar(m.id)}
                      disabled={procesando}
                      className="text-tinta-tenue hover:text-rojo transition-colors disabled:opacity-50 shrink-0"
                      title="Borrar"
                    >
                      🗑️
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
