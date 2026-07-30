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

  const hoy = new Date().toISOString().split('T')[0];
  const [sentido, setSentido] = useState<Sentido>('entrada');
  const [detalle, setDetalle] = useState('');
  const [tipo, setTipo] = useState<string>(TIPOS_ENTRADA[0]);
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoy);

  const tipos = sentido === 'entrada' ? TIPOS_ENTRADA : TIPOS_SALIDA;

  function cambiarSentido(s: Sentido) {
    setSentido(s);
    setTipo(s === 'entrada' ? TIPOS_ENTRADA[0] : TIPOS_SALIDA[0]);
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

  async function registrar() {
    if (!detalle.trim() || !monto) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch('/api/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ detalle, tipo, monto: parseFloat(monto), fecha, sentido }),
      });

      if (res.ok) {
        setMensaje({ tipo: 'ok', texto: 'Movimiento registrado' });
        setDetalle('');
        setMonto('');
        setFecha(hoy);
        cargarMovimientos();
      } else {
        const data = await res.json().catch(() => ({}));
        setMensaje({ tipo: 'error', texto: data.detalle || 'Error al registrar' });
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
      if (res.ok) cargarMovimientos();
      else alert('Error al borrar');
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
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Movimientos de caja</h1>
      <p className="text-sm text-gray-500 mb-6">
        Plata que entra o sale sin ser una venta ni un gasto: préstamos, aportes, devoluciones,
        retiros. Mueven el saldo de caja pero no cuentan como ganancia ni como gasto del negocio.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="bg-white rounded-xl shadow p-6 space-y-4 h-fit">
          <h2 className="text-sm font-semibold text-gray-700">Registrar movimiento</h2>

          {/* Entra o sale */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => cambiarSentido('entrada')}
              className={`rounded-md py-2 text-sm font-semibold transition-colors ${
                sentido === 'entrada' ? 'bg-emerald-500 text-white' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              ↓ Entra plata
            </button>
            <button
              type="button"
              onClick={() => cambiarSentido('salida')}
              className={`rounded-md py-2 text-sm font-semibold transition-colors ${
                sentido === 'salida' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              ↑ Sale plata
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Detalle</label>
            <input
              type="text"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder={
                sentido === 'entrada'
                  ? 'Ej: Préstamo del banco, plata que puse yo...'
                  : 'Ej: Cuota 3 del préstamo del banco...'
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {tipos.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    tipo === t
                      ? sentido === 'entrada'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {AYUDA_TIPO[tipo] && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {AYUDA_TIPO[tipo]}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
              <input
                type="number"
                min={0}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>

          <button
            onClick={registrar}
            disabled={!detalle.trim() || !monto || guardando}
            className={`w-full disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors ${
              sentido === 'entrada'
                ? 'bg-emerald-500 hover:bg-emerald-600'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {guardando ? 'Guardando...' : sentido === 'entrada' ? 'Registrar entrada' : 'Registrar salida'}
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

          <div className="border-t pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Entradas</span>
              <span className="font-medium text-emerald-600">{formatPrecio(totalEntradas)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Salidas</span>
              <span className="font-medium text-amber-600">{formatPrecio(totalSalidas)}</span>
            </div>
            <div className="flex justify-between border-t pt-1.5">
              <span className="text-gray-500">Neto en caja</span>
              <span className={`font-bold ${neto >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
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

          <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-700">
              {hayFiltros ? 'Movimientos filtrados' : 'Últimos movimientos'}
              <span className="ml-2 font-normal text-gray-400">({movsFiltrados.length})</span>
            </h2>
            <span className={`text-sm font-bold shrink-0 ${neto >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {formatPrecio(neto)}
            </span>
          </div>
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-8">Cargando...</p>
          ) : movsFiltrados.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">
              {hayFiltros
                ? 'Ningún movimiento coincide con esos filtros'
                : 'No hay movimientos registrados'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
              {movsFiltrados.map((m) => {
                const entra = m.monto > 0;
                return (
                  <li key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.detalle}</p>
                      <p className="text-xs text-gray-400">
                        {m.fecha.slice(5).replace('-', '/')} · {m.tipo}
                        {m.usuario && ` · ${m.usuario}`}
                      </p>
                    </div>
                    <span
                      className={`font-semibold text-sm shrink-0 ${
                        entra ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {entra ? '+' : '−'} {formatPrecio(Math.abs(m.monto))}
                    </span>
                    <button
                      onClick={() => borrar(m.id)}
                      disabled={procesando}
                      className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50 shrink-0"
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
