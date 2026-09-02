'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Venta } from '@/lib/types';
import type { Campania, InsightPlataforma, CuentaMeta } from '@/lib/meta';
import { formatPrecio, formatNumero } from '@/lib/format';
import { claveAgrupacion } from '@/lib/agrupar';
import Tarjeta, { Delta } from '@/app/components/Tarjeta';

// Mismo azul que el gráfico de Reportes, ya validado con el script de la guía de
// visualización. Acá las barras son de una sola serie (magnitud), así que va un
// solo tono; el valor siempre está escrito al lado, porque este azul no llega a
// 3:1 contra el blanco y el color no puede ser la única forma de leer el dato.
const COLOR_BARRA = '#2a78d6';

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function nombreMes(ym: string): string {
  const [a, m] = ym.split('-');
  return `${NOMBRES_MES[parseInt(m, 10) - 1] ?? m} ${a}`;
}

function mesAnterior(ym: string): string {
  const [a, m] = ym.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

const pct = (n: number) => `${(n * 100).toFixed(1).replace('.', ',')}%`;

// Igual que en Reportes: sin base contra la cual comparar no se inventa un
// porcentaje. Pasar de 0 a 30 conversaciones no es "+100%", es un mes que antes
// no existía.
function deltaRelativo(actual: number, previo: number, contra: string): Delta | null {
  if (!previo) return null;
  const v = (actual - previo) / Math.abs(previo);
  return { valor: v, texto: `${v > 0 ? '+' : '−'}${pct(Math.abs(v))}`, contra };
}

// Nombres de las plataformas de Meta, y con qué canal de la planilla se cruzan.
// Sólo se cruzan Instagram y Facebook porque son los únicos que alguien carga
// como origen al registrar una venta; el resto se muestra pero sin ventas.
const PLATAFORMAS: Record<string, { etiqueta: string; canal?: string }> = {
  instagram: { etiqueta: 'Instagram', canal: 'insta' },
  facebook: { etiqueta: 'Facebook', canal: 'face' },
  messenger: { etiqueta: 'Messenger' },
  audience_network: { etiqueta: 'Audience Network' },
  threads: { etiqueta: 'Threads' },
  whatsapp: { etiqueta: 'WhatsApp' },
};

interface Respuesta {
  configurada: boolean;
  cuenta?: CuentaMeta;
  campanias: Campania[];
  plataformas: InsightPlataforma[];
  desde?: string;
  hasta?: string;
  error?: string;
}

function totales(campanias: Campania[]) {
  const inversion = campanias.reduce((a, c) => a + c.inversion, 0);
  const conversaciones = campanias.reduce((a, c) => a + c.conversaciones, 0);
  const impresiones = campanias.reduce((a, c) => a + c.impresiones, 0);
  const clics = campanias.reduce((a, c) => a + c.clics, 0);
  return {
    inversion,
    conversaciones,
    impresiones,
    clics,
    // El alcance NO se suma entre campañas: la misma persona puede haber visto
    // dos campañas y se contaría dos veces. Se muestra el de la campaña que más
    // llegó, como piso, y se aclara en la pantalla.
    alcanceMax: campanias.reduce((a, c) => Math.max(a, c.alcance), 0),
    costoPorConversacion: conversaciones > 0 ? inversion / conversaciones : 0,
    ctr: impresiones > 0 ? clics / impresiones : 0,
  };
}

// Barra de magnitud: una sola serie, un solo tono. El valor siempre va escrito
// al lado, así el color nunca es la única forma de leer el dato.
function Barra({ proporcion, titulo }: { proporcion: number; titulo: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2" title={titulo}>
      <div
        className="h-2 rounded-full"
        style={{
          width: `${Math.max(proporcion * 100, proporcion > 0 ? 3 : 0)}%`,
          backgroundColor: COLOR_BARRA,
        }}
      />
    </div>
  );
}

function SinConectar() {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-2">Falta conectar la cuenta de Meta</h2>
      <p className="text-sm text-gray-500 mb-4">
        El panel lee los datos directo del Administrador de anuncios. Para eso necesita un token de
        acceso y el id de la cuenta publicitaria:
      </p>
      <ol className="text-sm text-gray-600 space-y-2 list-decimal pl-5">
        <li>
          Entrá a <span className="font-medium">developers.facebook.com</span> y creá una app de tipo
          &quot;Empresa&quot;.
        </li>
        <li>
          En el Explorador de la API de Graph, generá un token con el permiso{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">ads_read</code> y convertilo en token de
          larga duración.
        </li>
        <li>
          Copiá el id de la cuenta publicitaria (arriba de todo en el Administrador de anuncios, con
          el formato <code className="bg-gray-100 px-1 rounded text-xs">act_123456789</code>).
        </li>
        <li>
          Pegá los dos valores en el archivo{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">.env.local</code> de la app — ese es el
          archivo secreto que git ignora, no{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">.env.example</code>:
          <pre className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto">
{`META_ACCESS_TOKEN=tu-token-largo
META_AD_ACCOUNT_ID=act_123456789`}
          </pre>
        </li>
        <li>Reiniciá la app para que tome las variables nuevas.</li>
      </ol>
    </div>
  );
}

export default function Campanias() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [previo, setPrevio] = useState<Respuesta | null>(null);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [avisoSync, setAvisoSync] = useState('');

  useEffect(() => {
    fetch('/api/ventas')
      .then((r) => r.json())
      .then((v) => setVentas(Array.isArray(v) ? v : []))
      .catch(() => setVentas([]));
  }, []);

  // Cambiar de mes vuelve a consultar Meta, así que el "cargando" se prende acá
  // y no dentro del efecto: prenderlo en el efecto encadena un render de más.
  const cambiarMes = useCallback((nuevo: string) => {
    if (!/^\d{4}-\d{2}$/.test(nuevo)) return;
    setMes(nuevo);
    setLoading(true);
    setError('');
    setAvisoSync('');
  }, []);

  useEffect(() => {
    let cancelado = false;

    const traer = (m: string) => fetch(`/api/campanias?mes=${m}`).then((r) => r.json());

    Promise.all([traer(mes), traer(mesAnterior(mes))])
      .then(([actual, anterior]) => {
        if (cancelado) return;
        if (actual?.error) setError(actual.error);
        setDatos(actual ?? null);
        // Si falla el mes anterior no se rompe la pantalla: simplemente no se
        // muestran las comparaciones.
        setPrevio(anterior?.error ? null : (anterior ?? null));
        setLoading(false);
      })
      .catch(() => {
        if (cancelado) return;
        setError('No se pudo consultar Meta.');
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [mes]);

  // Meta informa el gasto en la moneda de la cuenta publicitaria, que no tiene
  // por qué ser la de la app. La de Rosena factura en USD: si se formatearan
  // esos importes con formatPrecio, dólares se mostrarían como pesos.
  const moneda = datos?.cuenta?.moneda || 'ARS';
  const enPesos = moneda === 'ARS';

  const formatImporte = useCallback(
    (n: number) =>
      enPesos
        ? formatPrecio(n)
        : n.toLocaleString('es-AR', {
            style: 'currency',
            currency: moneda,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          }),
    [enPesos, moneda]
  );

  const campanias = useMemo(() => datos?.campanias ?? [], [datos]);
  const t = useMemo(() => totales(campanias), [campanias]);
  const tPrev = useMemo(() => totales(previo?.campanias ?? []), [previo]);
  const hayPrevio = (previo?.campanias?.length ?? 0) > 0;
  const contra = `vs ${NOMBRES_MES[parseInt(mesAnterior(mes).split('-')[1], 10) - 1]?.toLowerCase() ?? ''}`;

  const ventasMes = useMemo(() => ventas.filter((v) => v.fecha.startsWith(mes)), [ventas, mes]);

  // Cruce de plata gastada contra plata vendida, canal por canal.
  const porCanal = useMemo(() => {
    return (datos?.plataformas ?? []).map((p) => {
      const info = PLATAFORMAS[p.plataforma] ?? { etiqueta: p.plataforma };
      const delCanal = info.canal
        ? ventasMes.filter((v) => claveAgrupacion(v.origen) === info.canal)
        : [];
      const vendido = delCanal.reduce((a, v) => a + v.total, 0);
      const ganancia = delCanal.reduce((a, v) => a + v.ganancia, 0);
      return {
        clave: p.plataforma,
        etiqueta: info.etiqueta,
        cruzable: !!info.canal,
        inversion: p.inversion,
        conversaciones: p.conversaciones,
        costoPorConversacion: p.conversaciones > 0 ? p.inversion / p.conversaciones : 0,
        nVentas: delCanal.length,
        vendido,
        ganancia,
        // Lo que de verdad importa: si la publicidad se pagó sola. La ganancia
        // bruta del canal ya descontó el costo de la mercadería, así que restarle
        // la inversión da lo que quedó limpio.
        //
        // Sólo tiene sentido si las dos puntas están en la misma moneda. Con una
        // cuenta en USD, restarle dólares a pesos daría un número inventado, así
        // que en ese caso no se calcula y la pantalla explica por qué.
        resultado: ganancia - p.inversion,
        roas: p.inversion > 0 ? vendido / p.inversion : 0,
      };
    });
  }, [datos, ventasMes]);

  const maxRoas = Math.max(...porCanal.map((c) => c.roas), 1);
  const maxConversaciones = Math.max(...campanias.map((c) => c.conversaciones), 1);

  const sincronizarGasto = useCallback(async () => {
    setSincronizando(true);
    setAvisoSync('');
    try {
      const res = await fetch('/api/campanias/gasto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAvisoSync(data?.error || 'No se pudo registrar el gasto.');
        return;
      }
      const monto = formatPrecio(data.monto);
      if (data.accion === 'creado') setAvisoSync(`Listo: se cargó ${monto} en Gastos.`);
      else if (data.accion === 'actualizado')
        setAvisoSync(`Actualizado: el gasto pasó de ${formatPrecio(data.anterior)} a ${monto}.`);
      else setAvisoSync(`Ya estaba cargado por ${monto}, no hizo falta cambiar nada.`);
    } catch {
      setAvisoSync('No se pudo registrar el gasto.');
    } finally {
      setSincronizando(false);
    }
  }, [mes]);

  const selectorMes = (
    <input
      type="month"
      value={mes}
      onChange={(e) => cambiarMes(e.target.value)}
      className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
    />
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Campañas</h1>
        {selectorMes}
      </div>

      {loading ? (
        <p className="text-gray-500">Consultando Meta...</p>
      ) : datos && !datos.configurada ? (
        <SinConectar />
      ) : error ? (
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-red-400">
          <p className="text-sm font-medium text-gray-800 mb-1">No se pudieron traer los datos</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-700">{nombreMes(mes)}</h2>
            {datos?.cuenta?.nombre && (
              <span className="text-xs text-gray-400">
                {datos.cuenta.nombre}
                {datos.cuenta.moneda && datos.cuenta.moneda !== 'ARS' && (
                  <span className="ml-1 text-amber-600">· importes en {datos.cuenta.moneda}</span>
                )}
              </span>
            )}
          </div>

          {/* Los cuatro números que resumen el mes publicitario */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <Tarjeta
              etiqueta="Invertido"
              valor={formatImporte(t.inversion)}
              detalle={`${campanias.length} ${campanias.length === 1 ? 'campaña' : 'campañas'}`}
              delta={hayPrevio ? deltaRelativo(t.inversion, tPrev.inversion, contra) : null}
              // Gastar más no es en sí una buena noticia: lo bueno o malo se ve
              // en el costo por conversación y en el resultado por canal.
              subeEsBueno={false}
              colorValor="text-indigo-700"
            />
            <Tarjeta
              etiqueta="Conversaciones iniciadas"
              valor={formatNumero(t.conversaciones)}
              detalle="Gente que te escribió"
              delta={hayPrevio ? deltaRelativo(t.conversaciones, tPrev.conversaciones, contra) : null}
              destacado
              colorValor="text-green-600"
            />
            <Tarjeta
              etiqueta="Costo por conversación"
              valor={t.conversaciones > 0 ? formatImporte(t.costoPorConversacion) : '—'}
              detalle="Cuánto cuesta que te escriban"
              delta={
                hayPrevio && tPrev.conversaciones > 0
                  ? deltaRelativo(t.costoPorConversacion, tPrev.costoPorConversacion, contra)
                  : null
              }
              subeEsBueno={false}
            />
            <Tarjeta
              etiqueta="Clics en el enlace"
              valor={formatNumero(t.clics)}
              detalle={`${formatNumero(t.impresiones)} impresiones · CTR ${pct(t.ctr)}`}
              delta={hayPrevio ? deltaRelativo(t.clics, tPrev.clics, contra) : null}
            />
          </div>

          {campanias.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-8 text-center">
              <p className="text-gray-500 text-sm">No hubo campañas con actividad en {nombreMes(mes)}.</p>
            </div>
          ) : (
            <>
              {/* Campaña por campaña */}
              <div className="bg-white rounded-xl shadow p-5 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Campaña por campaña</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Ordenadas por inversión. El alcance no se suma entre campañas: la misma persona
                  puede haber visto más de una.
                </p>

                {/* Tabla en escritorio */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                        <th className="pb-2 pr-3 font-medium">Campaña</th>
                        <th className="pb-2 px-2 font-medium text-right">Invertido</th>
                        <th className="pb-2 px-2 font-medium">Conversaciones</th>
                        <th className="pb-2 px-2 font-medium text-right">Costo c/u</th>
                        <th className="pb-2 px-2 font-medium text-right">Alcance</th>
                        <th className="pb-2 pl-2 font-medium text-right">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campanias.map((c) => (
                        <tr key={c.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-2.5 pr-3 text-gray-700 font-medium max-w-[240px] truncate" title={c.nombre}>
                            {c.nombre}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-gray-700">
                            {formatImporte(c.inversion)}
                          </td>
                          <td className="py-2.5 px-2 w-[160px]">
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums text-gray-700 w-8 shrink-0">
                                {formatNumero(c.conversaciones)}
                              </span>
                              <Barra
                                proporcion={c.conversaciones / maxConversaciones}
                                titulo={`${formatNumero(c.conversaciones)} conversaciones`}
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-gray-700">
                            {c.conversaciones > 0 ? formatImporte(c.costoPorConversacion) : '—'}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-gray-500">
                            {formatNumero(c.alcance)}
                          </td>
                          <td className="py-2.5 pl-2 text-right tabular-nums text-gray-500">{pct(c.ctr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Fichas en mobile */}
                <div className="md:hidden space-y-3">
                  {campanias.map((c) => (
                    <div key={c.id} className="border border-gray-100 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-700 mb-2 break-words">{c.nombre}</p>
                      <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                        <span className="text-gray-500">Invertido</span>
                        <span className="text-right tabular-nums text-gray-700">
                          {formatImporte(c.inversion)}
                        </span>
                        <span className="text-gray-500">Conversaciones</span>
                        <span className="text-right tabular-nums text-gray-700">
                          {formatNumero(c.conversaciones)}
                        </span>
                        <span className="text-gray-500">Costo c/u</span>
                        <span className="text-right tabular-nums text-gray-700">
                          {c.conversaciones > 0 ? formatImporte(c.costoPorConversacion) : '—'}
                        </span>
                        <span className="text-gray-500">Alcance · CTR</span>
                        <span className="text-right tabular-nums text-gray-500">
                          {formatNumero(c.alcance)} · {pct(c.ctr)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cruce con las ventas */}
              {porCanal.length > 0 && (
                <div className="bg-white rounded-xl shadow p-5 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Publicidad contra ventas</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Las ventas se cruzan por el canal que cargás a mano al registrarlas, no por el
                    clic: una venta de Instagram cuenta acá aunque la persona te haya escrito la
                    semana pasada. Sirve para ver la tendencia, no para atribuir venta por venta.
                  </p>

                  <div className="space-y-4">
                    {porCanal.map((c) => (
                      <div key={c.clave} className="border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
                          <span className="text-sm font-medium text-gray-700">{c.etiqueta}</span>
                          <span className="text-xs text-gray-500">
                            {formatImporte(c.inversion)} invertidos ·{' '}
                            {formatNumero(c.conversaciones)} conversaciones
                            {c.conversaciones > 0 && ` · ${formatImporte(c.costoPorConversacion)} c/u`}
                          </span>
                        </div>

                        {!c.cruzable ? (
                          <p className="text-xs text-gray-400">
                            No se puede cruzar con ventas: no hay un canal con este nombre en la
                            planilla.
                          </p>
                        ) : c.nVentas === 0 ? (
                          <p className="text-xs text-gray-400">
                            Sin ventas cargadas con este origen en {nombreMes(mes)}.
                          </p>
                        ) : !enPesos ? (
                          // Comparar dólares invertidos contra pesos vendidos daría
                          // un ROAS inventado. Se muestran las ventas del canal,
                          // que sí son un dato, pero no la división entre las dos.
                          <div className="text-xs">
                            <p className="text-amber-700 mb-2">
                              No se puede comparar con las ventas: la cuenta de Meta factura en{' '}
                              {moneda} y las ventas están en pesos.
                            </p>
                            <p className="text-gray-400">
                              Vendido por este canal:{' '}
                              <span className="tabular-nums font-medium text-gray-700">
                                {formatPrecio(c.vendido)}
                              </span>{' '}
                              · ganancia bruta{' '}
                              <span className="tabular-nums font-medium text-green-600">
                                {formatPrecio(c.ganancia)}
                              </span>
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 mb-2">
                              <Barra
                                proporcion={c.roas / maxRoas}
                                titulo={`${c.roas.toFixed(1).replace('.', ',')} pesos vendidos por peso invertido`}
                              />
                              <span className="text-xs tabular-nums text-gray-600 shrink-0 w-24 text-right">
                                {c.roas.toFixed(1).replace('.', ',')}× vendido
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <p className="text-gray-400">Vendido</p>
                                <p className="tabular-nums font-medium text-gray-700">
                                  {formatPrecio(c.vendido)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400">Ganancia bruta</p>
                                <p className="tabular-nums font-medium text-green-600">
                                  {formatPrecio(c.ganancia)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400">Menos publicidad</p>
                                {/* La flecha y la palabra dicen lo mismo que el
                                    color, así que el importe va en valor
                                    absoluto: "▼ −$9.650" tiene el signo dos
                                    veces y se lee peor. */}
                                <p
                                  className={`tabular-nums font-bold ${
                                    c.resultado >= 0 ? 'text-green-600' : 'text-red-500'
                                  }`}
                                >
                                  {c.resultado >= 0 ? '▲ Quedaron ' : '▼ Faltaron '}
                                  {formatPrecio(Math.abs(c.resultado))}
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pasar la inversión a Gastos */}
              <div className="bg-white rounded-xl shadow p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Descontar la publicidad</h3>
                {enPesos ? (
                  <p className="text-xs text-gray-400 mb-4">
                    Reportes calcula el resultado del mes con la hoja Gastos. Este botón carga ahí
                    los {formatImporte(t.inversion)} de {nombreMes(mes)} como{' '}
                    <span className="font-medium">Gasto Comercializacion</span>. Si ya lo cargaste
                    antes, lo actualiza en vez de duplicarlo.
                  </p>
                ) : (
                  // Se avisa antes y no al apretar: el botón no va a funcionar
                  // nunca con esta cuenta, y enterarse después del clic es peor.
                  <p className="text-xs text-amber-700 mb-4">
                    La cuenta de Meta factura en {moneda} y la hoja Gastos lleva pesos. Copiar{' '}
                    {formatImporte(t.inversion)} tal cual metería {moneda} en la columna de pesos y
                    ensuciaría el resultado del mes en Reportes, así que la carga automática queda
                    deshabilitada. Cargá el gasto a mano en Gastos, convertido al tipo de cambio que
                    te cobraron.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={sincronizarGasto}
                    disabled={sincronizando || t.inversion <= 0 || !enPesos}
                    className="rounded-lg bg-[#6b4423] px-4 py-2 text-sm font-medium text-white hover:bg-[#553619] disabled:opacity-50 transition-colors"
                  >
                    {sincronizando ? 'Cargando...' : 'Cargar en Gastos'}
                  </button>
                  {avisoSync && <span className="text-sm text-gray-600">{avisoSync}</span>}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
