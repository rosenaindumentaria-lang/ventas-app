'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Gasto,
  GastoPendiente,
  MovimientoCaja,
  CATEGORIAS_GASTO,
  TIPOS_ENTRADA,
  TIPOS_SALIDA,
} from '@/lib/types';
import { formatPrecio } from '@/lib/format';
import { EVENTO_PENDIENTES } from '@/app/components/NavBar';
import Filtros from '@/app/components/Filtros';

type Sentido = 'entrada' | 'salida';
type Clase = 'gasto' | 'movimiento';

// Una fila de la lista: los gastos y los movimientos viven en hojas distintas
// (los gastos bajan la ganancia, los movimientos no), pero acá se ven juntos.
// El monto va con signo: positivo entra a la caja, negativo sale.
interface Operacion {
  clase: Clase;
  id: string;
  fecha: string;
  tipo: string;
  detalle: string;
  monto: number;
  usuario?: string;
}

const esCategoriaGasto = (tipo: string) => (CATEGORIAS_GASTO as readonly string[]).includes(tipo);

// Aclaraciones para los tipos que suelen confundirse con un gasto.
const AYUDA_TIPO: Record<string, React.ReactNode> = {
  'Compra de mercadería': (
    <>
      No la cargues como gasto: el costo de la mercadería se descuenta solo cuando la vendés, porque
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
      Cargá acá <strong>sólo la parte de capital</strong> de la cuota. Los intereses van como{' '}
      <strong>Gasto Financiero</strong>, porque ésos sí son un costo del negocio.
    </>
  ),
};

const hoy = () => new Date().toISOString().split('T')[0];

export default function Movimientos() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [pendientes, setPendientes] = useState<GastoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  // En el celular el formulario está plegado hasta que se lo pide; en escritorio
  // siempre se ve. Editar o completar un pendiente lo abre solo.
  const [formAbierto, setFormAbierto] = useState(false);

  // Filtros de la lista
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  // Formulario (alta o edición). `editando` guarda de qué hoja es la fila: una
  // fila no cambia de hoja al editarla, así que de ahí salen los tipos posibles.
  const [editando, setEditando] = useState<{ clase: Clase; id: string } | null>(null);
  const [sentido, setSentido] = useState<Sentido>('entrada');
  const [detalle, setDetalle] = useState('');
  const [tipo, setTipo] = useState<string>(TIPOS_ENTRADA[0]);
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoy);

  // Qué se está cargando: al editar manda la fila original; al dar de alta, el tipo.
  const claseForm: Clase = editando
    ? editando.clase
    : sentido === 'salida' && esCategoriaGasto(tipo)
      ? 'gasto'
      : 'movimiento';
  const editandoGasto = editando?.clase === 'gasto';

  // Tipos que se ofrecen. Si la fila que se edita tiene un tipo viejo que ya no
  // está en la lista de alta, se agrega igual para no perderlo al guardar.
  const gruposTipos = useMemo(() => {
    let grupos: { titulo?: string; tipos: readonly string[] }[];
    if (sentido === 'entrada') grupos = [{ tipos: TIPOS_ENTRADA }];
    else if (editando?.clase === 'gasto') grupos = [{ tipos: CATEGORIAS_GASTO }];
    else if (editando) grupos = [{ tipos: TIPOS_SALIDA }];
    else
      grupos = [
        { titulo: 'Gastos del negocio', tipos: CATEGORIAS_GASTO },
        { titulo: 'Salidas que no son gasto', tipos: TIPOS_SALIDA },
      ];
    if (grupos.some((g) => g.tipos.includes(tipo))) return grupos;
    const ultimo = grupos[grupos.length - 1];
    return [...grupos.slice(0, -1), { ...ultimo, tipos: [...ultimo.tipos, tipo] }];
  }, [sentido, editando, tipo]);

  function cambiarSentido(s: Sentido) {
    setSentido(s);
    // La salida más común es un gasto, así que arranca ahí; al editar un
    // movimiento no se ofrecen gastos (son otra hoja).
    setTipo(
      s === 'entrada' ? TIPOS_ENTRADA[0] : editando ? TIPOS_SALIDA[0] : CATEGORIAS_GASTO[0]
    );
  }

  function empezarEdicion(o: Operacion) {
    setEditando({ clase: o.clase, id: o.id });
    setFormAbierto(true);
    // El sentido sale del signo guardado, no del nombre del tipo.
    setSentido(o.monto >= 0 ? 'entrada' : 'salida');
    setTipo(o.tipo);
    setDetalle(o.detalle);
    setMonto(String(Math.abs(o.monto)));
    setFecha(o.fecha);
    setMensaje(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Deja el formulario en blanco SIN tocar el mensaje, para poder mostrar el
  // "guardado" despues de limpiar. cancelarEdicion sí lo borra, porque ahi el
  // usuario esta descartando lo que estaba haciendo.
  function limpiarFormulario() {
    setEditando(null);
    setFormAbierto(false);
    setSentido('entrada');
    setTipo(TIPOS_ENTRADA[0]);
    setDetalle('');
    setMonto('');
    setFecha(hoy());
  }

  function cancelarEdicion() {
    limpiarFormulario();
    setMensaje(null);
  }

  // Avisa a la nav para que recalcule el globito.
  function avisarNav() {
    window.dispatchEvent(new Event(EVENTO_PENDIENTES));
  }

  function cargarPendientes() {
    fetch('/api/gastos/pendientes')
      .then((r) => r.json())
      .then((data) => setPendientes(Array.isArray(data) ? data : []))
      .catch(() => setPendientes([]));
  }

  // Las dos hojas o ninguna: con una sola, los totales saldrían incompletos y
  // nadie se daría cuenta.
  function cargar() {
    setLoading(true);
    setErrorCarga(null);
    Promise.all([
      fetch('/api/gastos').then((r) => r.json()),
      fetch('/api/movimientos').then((r) => r.json()),
    ])
      .then(([g, m]) => {
        if (!Array.isArray(g)) throw new Error(g.error || 'Respuesta inválida (gastos)');
        if (!Array.isArray(m)) throw new Error(m.error || 'Respuesta inválida (movimientos)');
        setGastos(g);
        setMovimientos(m);
      })
      .catch((e) => setErrorCarga(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargar();
    cargarPendientes();
  }, []);

  // Cargar un pendiente en el formulario para terminar de registrarlo. Se edita
  // la fila que ya existe en vez de crear una nueva y borrar la vieja: una sola
  // escritura, y no hay riesgo de que se corran las filas en el medio.
  function completarPendiente(p: GastoPendiente) {
    setEditando({ clase: 'gasto', id: p.id });
    setFormAbierto(true);
    setSentido('salida');
    setTipo(CATEGORIAS_GASTO[0]);
    setDetalle('');
    setMonto(String(p.monto));
    setFecha(hoy());
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
        if (editando?.clase === 'gasto' && editando.id === id) cancelarEdicion();
        avisarNav();
      } else alert('Error al descartar');
    } finally {
      setProcesando(false);
    }
  }

  // La fila que estamos editando sigue siendo un pendiente mientras no tenga fecha.
  const completandoPendiente =
    editando?.clase === 'gasto' && pendientes.some((p) => p.id === editando.id);

  async function guardar() {
    if (!detalle.trim() || !monto) return;
    setGuardando(true);
    setMensaje(null);

    const esEdicion = editando !== null;
    const importe = parseFloat(monto);
    const esGasto = claseForm === 'gasto';

    const url = esGasto ? '/api/gastos' : '/api/movimientos';
    const cuerpo = esGasto
      ? { fecha, descripcion: detalle, categoria: tipo, monto: importe }
      : { fecha, detalle, tipo, monto: importe, sentido };

    try {
      const res = await fetch(url, {
        method: esEdicion ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(esEdicion ? { ...cuerpo, id: editando.id } : cuerpo),
      });

      if (res.ok) {
        const que = esGasto ? 'Gasto' : 'Movimiento';
        setMensaje({
          tipo: 'ok',
          texto: esEdicion ? `✅ ${que} actualizado` : `✅ ${que} registrado`,
        });
        limpiarFormulario();
        // Si lo que se guardó era un pendiente, ya tiene fecha y deja de serlo.
        cargarPendientes();
        avisarNav();
        cargar();
      } else {
        const data = await res.json().catch(() => ({}));
        setMensaje({ tipo: 'error', texto: data.detalle || data.error || 'Error al guardar' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión' });
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(o: Operacion) {
    if (!confirm(o.clase === 'gasto' ? '¿Borrar este gasto?' : '¿Borrar este movimiento?')) return;
    setProcesando(true);
    try {
      const base = o.clase === 'gasto' ? '/api/gastos' : '/api/movimientos';
      const res = await fetch(`${base}?id=${o.id}`, { method: 'DELETE' });
      if (res.ok) {
        if (editando?.clase === o.clase && editando.id === o.id) cancelarEdicion();
        // Borrar una fila de la hoja corre las que le siguen: se recarga todo
        // en vez de quitarla de la lista a mano.
        cargar();
        cargarPendientes();
      } else alert('Error al borrar');
    } finally {
      setProcesando(false);
    }
  }

  // Todo junto. Los ids son número de fila de cada hoja, así que se repiten
  // entre hojas: la clave de la lista es clase + id.
  const operaciones = useMemo<Operacion[]>(() => {
    const deGastos: Operacion[] = gastos.map((g) => ({
      clase: 'gasto',
      id: g.id,
      fecha: g.fecha,
      tipo: g.categoria,
      detalle: g.descripcion,
      monto: -g.monto,
      usuario: g.usuario,
    }));
    const deMovs: Operacion[] = movimientos.map((m) => ({ clase: 'movimiento', ...m }));
    // Más recientes primero; a igual fecha, lo último cargado en cada hoja.
    return [...deGastos, ...deMovs].sort(
      (a, b) => b.fecha.localeCompare(a.fecha) || Number(b.id) - Number(a.id)
    );
  }, [gastos, movimientos]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return operaciones.filter((o) => {
      const cumpleFecha =
        (!fechaDesde || o.fecha >= fechaDesde) && (!fechaHasta || o.fecha <= fechaHasta);
      const cumpleTipo = !filtroTipo || o.tipo === filtroTipo;
      const cumpleTexto =
        !texto ||
        o.detalle.toLowerCase().includes(texto) ||
        o.tipo.toLowerCase().includes(texto) ||
        (o.usuario || '').toLowerCase().includes(texto);
      return cumpleFecha && cumpleTipo && cumpleTexto;
    });
  }, [operaciones, fechaDesde, fechaHasta, filtroTipo, busqueda]);

  // Los totales siguen al filtro: si mirás un mes, ves el neto de ese mes.
  const totalEntradas = filtradas.filter((o) => o.monto > 0).reduce((a, o) => a + o.monto, 0);
  const totalGastos = filtradas
    .filter((o) => o.clase === 'gasto')
    .reduce((a, o) => a - o.monto, 0);
  const totalOtrasSalidas = filtradas
    .filter((o) => o.clase === 'movimiento' && o.monto < 0)
    .reduce((a, o) => a - o.monto, 0);
  const neto = totalEntradas - totalGastos - totalOtrasSalidas;
  const hayFiltros = Boolean(fechaDesde || fechaHasta || busqueda || filtroTipo);

  const mesActual = hoy().slice(0, 7);
  const gastosDelMes = gastos
    .filter((g) => g.fecha.startsWith(mesActual))
    .reduce((a, g) => a + g.monto, 0);

  // Del dato y no de las constantes, para que sigan siendo filtrables los tipos
  // viejos que ya no estan en las listas de alta (ej. "Pago Mercadería").
  const tiposPresentes = useMemo(
    () => Array.from(new Set(operaciones.map((o) => o.tipo).filter(Boolean))).sort(),
    [operaciones]
  );

  function limpiarFiltros() {
    setFechaDesde('');
    setFechaHasta('');
    setBusqueda('');
    setFiltroTipo('');
  }

  // Rojo = gasto (baja la ganancia), ocre = otra salida, verde = entrada.
  const colorBoton =
    sentido === 'entrada'
      ? 'bg-verde hover:bg-verde-fuerte'
      : claseForm === 'gasto'
        ? 'bg-rojo hover:bg-rojo-fuerte'
        : 'bg-ocre hover:bg-ocre-fuerte';
  const colorChip = (t: string) =>
    sentido === 'entrada' ? 'bg-verde' : esCategoriaGasto(t) || editandoGasto ? 'bg-rojo' : 'bg-ocre';

  const tituloForm = completandoPendiente
    ? 'Completar gasto pendiente'
    : editando
      ? editandoGasto
        ? 'Editar gasto'
        : 'Editar movimiento'
      : 'Registrar movimiento';

  return (
    <div>
      <h1 className="font-display text-3xl font-normal text-tinta mb-2">Movimientos</h1>
      <p className="text-xs md:text-sm text-tinta-suave mb-4 md:mb-6">
        Toda la plata que entra o sale sin ser una venta. Los <strong>gastos</strong> del negocio
        bajan la ganancia; el resto (préstamos, aportes, devoluciones, retiros, compras de
        mercadería o bienes) mueve el saldo de caja pero no cuenta como gasto.
      </p>

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
                  {p.usuario && (
                    <span className="ml-2 text-xs font-normal text-tinta-tenue">{p.usuario}</span>
                  )}
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

      {/* Resumen: va arriba y sigue a los filtros de la lista. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        <div className="panel p-3 md:p-4">
          <p className="text-xs text-tinta-suave">Entradas</p>
          <p className="mt-0.5 text-base md:text-lg font-semibold text-verde tabular">{formatPrecio(totalEntradas)}</p>
        </div>
        <div className="panel p-3 md:p-4">
          <p className="text-xs text-tinta-suave">Gastos</p>
          <p className="mt-0.5 text-base md:text-lg font-semibold text-rojo tabular">{formatPrecio(totalGastos)}</p>
          <p className="text-[11px] text-tinta-tenue">{formatPrecio(gastosDelMes)} este mes</p>
        </div>
        <div className="panel p-3 md:p-4">
          <p className="text-xs text-tinta-suave">Otras salidas</p>
          <p className="mt-0.5 text-base md:text-lg font-semibold text-ocre tabular">{formatPrecio(totalOtrasSalidas)}</p>
        </div>
        <div className="panel p-3 md:p-4">
          <p className="text-xs text-tinta-suave">Neto en caja</p>
          <p className={`mt-0.5 text-base md:text-lg font-semibold tabular ${neto >= 0 ? 'text-verde' : 'text-ocre'}`}>
            {formatPrecio(neto)}
          </p>
        </div>
      </div>

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

      {/* Celular: el formulario se despliega con este botón. */}
      {!formAbierto && (
        <button
          type="button"
          onClick={() => setFormAbierto(true)}
          className="md:hidden mb-4 w-full rounded-panel bg-marca py-3 text-sm font-semibold text-white active:bg-marca-fuerte"
        >
          + Cargar movimiento
        </button>
      )}

      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
        {/* Formulario */}
        <div
          className={`${formAbierto ? 'block' : 'hidden'} md:block panel p-4 md:p-6 space-y-4 h-fit ${editando ? 'ring-2 ring-marca' : ''}`}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-normal text-tinta">{tituloForm}</h2>
            <button
              type="button"
              onClick={cancelarEdicion}
              className={`${editando ? '' : 'md:hidden'} py-1 pl-3 text-sm text-marca hover:underline`}
            >
              {editando ? 'Cancelar' : 'Cerrar'}
            </button>
          </div>

          {completandoPendiente && (
            <p className="rounded-panel bg-ocre-suave px-3 py-2 text-xs text-ocre-fuerte">
              Poné la fecha y el detalle que le faltaban. El importe ya estaba cargado.
            </p>
          )}

          {/* Entra o sale. Un gasto siempre es una salida: no se puede cambiar. */}
          <div className="grid grid-cols-2 gap-2 rounded-panel bg-marca-suave p-1">
            <button
              type="button"
              onClick={() => cambiarSentido('entrada')}
              disabled={editandoGasto}
              className={`rounded-panel py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
                sentido === 'entrada' ? 'bg-verde text-white' : 'text-tinta-media hover:bg-acento-suave'
              }`}
            >
              ↓ Entra plata
            </button>
            <button
              type="button"
              onClick={() => cambiarSentido('salida')}
              disabled={editandoGasto}
              className={`rounded-panel py-2 text-sm font-semibold transition-colors ${
                sentido === 'salida'
                  ? `${claseForm === 'gasto' ? 'bg-rojo' : 'bg-ocre'} text-white`
                  : 'text-tinta-media hover:bg-acento-suave'
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
                  : 'Ej: Packaging, envío a cliente, cuota 3 del préstamo...'
              }
              className="w-full border border-borde rounded-panel px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tinta-media mb-1">Tipo</label>
            <div className="space-y-2">
              {gruposTipos.map((g, i) => (
                <div key={g.titulo ?? i}>
                  {g.titulo && <p className="mb-1 text-xs text-tinta-tenue">{g.titulo}</p>}
                  <div className="flex flex-wrap gap-2">
                    {g.tipos.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipo(t)}
                        className={`px-3 py-1.5 rounded-panel text-xs font-medium transition-colors ${
                          tipo === t
                            ? `${colorChip(t)} text-white`
                            : 'bg-marca-suave text-tinta-media hover:bg-acento-suave'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {editando && (
              <p className="mt-2 text-xs text-tinta-tenue">
                Un gasto no se puede pasar a otro tipo de movimiento ni al revés: si te equivocaste,
                borralo y cargalo de nuevo.
              </p>
            )}
          </div>

          {claseForm === 'gasto' && (
            <p className="rounded-panel bg-rojo-suave px-3 py-2 text-xs text-rojo">
              Cuenta como <strong>gasto del negocio</strong>: baja la ganancia.
            </p>
          )}
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
            className={`w-full disabled:opacity-50 text-white font-semibold py-2.5 rounded-panel transition-colors ${colorBoton}`}
          >
            {guardando
              ? 'Guardando...'
              : editando
                ? 'Guardar cambios'
                : sentido === 'entrada'
                  ? 'Registrar entrada'
                  : claseForm === 'gasto'
                    ? 'Registrar gasto'
                    : 'Registrar salida'}
          </button>
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
                <span className="ml-2 font-normal text-tinta-tenue">({filtradas.length})</span>
              </h2>
              <span className={`text-sm font-bold shrink-0 ${neto >= 0 ? 'text-verde' : 'text-ocre'}`}>
                {formatPrecio(neto)}
              </span>
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
            ) : filtradas.length === 0 ? (
              <p className="text-tinta-tenue text-sm text-center py-8">
                {hayFiltros
                  ? 'Ningún movimiento coincide con esos filtros'
                  : 'No hay movimientos registrados'}
              </p>
            ) : (
              <ul className="divide-y divide-borde-suave md:max-h-[520px] md:overflow-y-auto">
                {filtradas.map((o) => {
                  const entra = o.monto > 0;
                  const color = entra ? 'text-verde' : o.clase === 'gasto' ? 'text-rojo' : 'text-ocre';
                  const enEdicion = editando?.clase === o.clase && editando.id === o.id;
                  return (
                    <li
                      key={`${o.clase}-${o.id}`}
                      className={`px-4 md:px-5 py-3 flex items-center justify-between gap-2 md:gap-3 ${
                        enEdicion ? 'bg-marca-suave' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-tinta truncate">{o.detalle}</p>
                        <p className="text-xs text-tinta-tenue">
                          {o.fecha.slice(5).replace('-', '/')} · {o.tipo}
                          {o.usuario && ` · ${o.usuario}`}
                        </p>
                      </div>
                      <span className={`font-semibold text-sm shrink-0 ${color}`}>
                        {entra ? '+' : '−'} {formatPrecio(Math.abs(o.monto))}
                      </span>
                      <button
                        onClick={() => empezarEdicion(o)}
                        disabled={procesando}
                        className="-my-2 p-2 text-tinta-suave hover:text-marca-fuerte transition-colors disabled:opacity-50 shrink-0"
                        title="Editar"
                        aria-label="Editar"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => borrar(o)}
                        disabled={procesando}
                        className="-my-2 -mr-2 p-2 text-tinta-suave hover:text-rojo transition-colors disabled:opacity-50 shrink-0"
                        title="Borrar"
                        aria-label="Borrar"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                        </svg>
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
