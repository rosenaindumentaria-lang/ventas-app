// Cliente de la Marketing API de Meta (anuncios de Facebook e Instagram).
//
// A diferencia del resto de la app, estos datos NO viven en la planilla: son de
// Meta y se leen en vivo. La app nunca escribe en Meta, sólo lee informes.
//
// La única excepción es la inversión, que sí se copia a la hoja Gastos desde
// /api/campanias/gasto, para que el resultado del mes en Reportes ya tenga la
// publicidad descontada.

// La versión va fija en la URL a propósito: si se omite, Meta atiende con la
// versión más vieja que tenga viva, y los nombres de las métricas cambian entre
// versiones. Cuando Meta deprecie la v26 se cambia acá o con META_API_VERSION,
// sin tocar el resto del código.
const API_VERSION = process.env.META_API_VERSION?.trim() || 'v26.0';
const TOKEN = process.env.META_ACCESS_TOKEN?.trim();
const CUENTA_RAW = process.env.META_AD_ACCOUNT_ID?.trim();

// El id de la cuenta publicitaria se usa como "act_123456". En el Administrador
// de anuncios a veces aparece con el prefijo y a veces sin él, así que se
// aceptan las dos formas y se normaliza.
function idCuenta(): string {
  const limpio = (CUENTA_RAW || '').replace(/\s/g, '');
  return limpio.startsWith('act_') ? limpio : `act_${limpio}`;
}

export function metaConfigurada(): boolean {
  return !!TOKEN && !!CUENTA_RAW;
}

// Error con un mensaje que se le pueda mostrar al usuario tal cual. Los errores
// crudos de Meta vienen en inglés y hablan de "OAuthException", que no le dice
// nada a nadie: acá se traducen a qué hay que hacer para destrabarlo.
export class MetaError extends Error {
  codigo: number;
  constructor(mensaje: string, codigo = 0) {
    super(mensaje);
    this.name = 'MetaError';
    this.codigo = codigo;
  }
}

interface ErrorMeta {
  message?: string;
  code?: number;
  error_subcode?: number;
  type?: string;
}

function traducirError(err: ErrorMeta): MetaError {
  const codigo = err.code ?? 0;
  const original = err.message || 'Error desconocido de Meta';

  // 190 = token vencido, revocado, o cambió la contraseña de Facebook.
  if (codigo === 190) {
    return new MetaError(
      'El token de Meta venció o se revocó. Generá uno nuevo en el Explorador de la API de Graph y actualizá META_ACCESS_TOKEN.',
      codigo
    );
  }
  // Meta también usa el código 200 cuando bloquea la app entera, no cuando falta
  // un permiso. Se distinguen por el texto: si se confunden, el mensaje manda a
  // regenerar el token, que no arregla nada porque el problema es de la app.
  if (/api access blocked|app.*(blocked|restricted)|application.*(blocked|restricted)/i.test(original)) {
    return new MetaError(
      'Meta bloqueó el acceso de la app a la API (no es el token ni la cuenta). Entrá a developers.facebook.com, abrí la app y mirá "Acciones requeridas" y la bandeja de alertas: suele faltar la verificación del negocio.',
      codigo
    );
  }
  // 10 y 200 = el token existe pero le falta el permiso ads_read.
  if (codigo === 10 || codigo === 200) {
    return new MetaError(
      'El token no tiene permiso para leer anuncios. Volvé a generarlo marcando el permiso ads_read.',
      codigo
    );
  }
  // 4, 17, 613 y 80004 = límite de llamadas de la cuenta.
  if ([4, 17, 613, 80004].includes(codigo)) {
    return new MetaError(
      'Meta está limitando las consultas por exceso de llamadas. Esperá unos minutos y volvé a intentar.',
      codigo
    );
  }
  // 100 sobre una cuenta inexistente o ajena.
  if (codigo === 100 && /unsupported get request|does not exist|nonexisting field/i.test(original)) {
    return new MetaError(
      `Meta no encuentra la cuenta publicitaria ${idCuenta()}, o el token no tiene acceso a ella. Revisá META_AD_ACCOUNT_ID.`,
      codigo
    );
  }
  return new MetaError(`Meta rechazó la consulta: ${original}`, codigo);
}

interface RespuestaMeta<T> {
  data?: T[];
  error?: ErrorMeta;
  paging?: { next?: string };
}

async function pedir<T>(ruta: string, params: Record<string, string>): Promise<T[]> {
  if (!metaConfigurada()) {
    throw new MetaError(
      'Falta configurar la conexión con Meta: cargá META_ACCESS_TOKEN y META_AD_ACCOUNT_ID en .env.local.'
    );
  }

  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${ruta}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', TOKEN!);

  const juntadas: T[] = [];
  let siguiente: string | null = url.toString();
  let vueltas = 0;

  // Meta pagina de a ~25 filas. Se sigue el cursor, con un tope de vueltas para
  // que un `next` que nunca termina no cuelgue el pedido para siempre.
  while (siguiente && vueltas < 20) {
    vueltas++;
    let res: Response;
    try {
      res = await fetch(siguiente, { cache: 'no-store' });
    } catch {
      throw new MetaError('No se pudo contactar a Meta. Revisá la conexión a internet.');
    }

    const json: RespuestaMeta<T> | null = await res.json().catch(() => null);
    if (!json) throw new MetaError('Meta devolvió una respuesta que no se pudo leer.');
    if (json.error) throw traducirError(json.error);

    if (Array.isArray(json.data)) juntadas.push(...json.data);
    else juntadas.push(json as T);

    siguiente = json.paging?.next ?? null;
  }

  return juntadas;
}

// ── Métricas ──────────────────────────────────────────────────────────────────

// Una "conversación iniciada" en Meta es esta acción. Hay varias parecidas y
// sumarlas todas contaría la misma conversación más de una vez, así que se toma
// la primera que aparezca por orden de preferencia y se ignoran las demás.
const ACCIONES_CONVERSACION = [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.total_messaging_connection',
  'onsite_conversion.messaging_first_reply',
];

interface AccionMeta {
  action_type: string;
  value: string;
}

function num(v: string | number | undefined): number {
  const n = typeof v === 'number' ? v : parseFloat(v || '0');
  return Number.isFinite(n) ? n : 0;
}

function contarConversaciones(acciones: AccionMeta[] | undefined): number {
  if (!acciones?.length) return 0;
  for (const tipo of ACCIONES_CONVERSACION) {
    const encontrada = acciones.find((a) => a.action_type === tipo);
    if (encontrada) return num(encontrada.value);
  }
  return 0;
}

interface FilaInsight {
  campaign_id?: string;
  campaign_name?: string;
  objective?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  inline_link_clicks?: string;
  ctr?: string;
  actions?: AccionMeta[];
  publisher_platform?: string;
}

export interface Campania {
  id: string;
  nombre: string;
  objetivo: string;
  inversion: number;
  impresiones: number;
  alcance: number;
  frecuencia: number;
  clics: number;
  conversaciones: number;
  /** Cuánto costó cada conversación. 0 si no hubo ninguna. */
  costoPorConversacion: number;
  /** Proporción 0..1, no porcentaje. */
  ctr: number;
}

export interface InsightPlataforma {
  plataforma: string;
  inversion: number;
  conversaciones: number;
  alcance: number;
  clics: number;
}

export interface CuentaMeta {
  id: string;
  nombre: string;
  moneda: string;
}

const CAMPOS = [
  'campaign_id',
  'campaign_name',
  'objective',
  'spend',
  'impressions',
  'reach',
  'frequency',
  'clicks',
  'inline_link_clicks',
  'ctr',
  'actions',
].join(',');

function rangoJson(desde: string, hasta: string): string {
  return JSON.stringify({ since: desde, until: hasta });
}

// Primer y último día del mes YYYY-MM. El "hasta" se recorta a hoy porque pedir
// días que todavía no pasaron no aporta nada y hace más lenta la consulta.
export function rangoDelMes(mes: string): { desde: string; hasta: string } {
  const [anio, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10);
  const hoy = new Date().toISOString().slice(0, 10);
  return { desde: `${mes}-01`, hasta: ultimo > hoy ? hoy : ultimo };
}

export async function getCuenta(): Promise<CuentaMeta> {
  const [cuenta] = await pedir<{ id?: string; name?: string; currency?: string }>(idCuenta(), {
    fields: 'id,name,currency',
  });
  return {
    id: cuenta?.id || idCuenta(),
    nombre: cuenta?.name || '',
    moneda: cuenta?.currency || '',
  };
}

export async function getCampanias(desde: string, hasta: string): Promise<Campania[]> {
  const filas = await pedir<FilaInsight>(`${idCuenta()}/insights`, {
    level: 'campaign',
    fields: CAMPOS,
    time_range: rangoJson(desde, hasta),
    // Sin esto Meta usa la ventana de atribución vieja y los números no
    // coinciden con lo que muestra el Administrador de anuncios.
    use_unified_attribution_setting: 'true',
    limit: '100',
  });

  return filas
    .map((f) => {
      const inversion = num(f.spend);
      const conversaciones = contarConversaciones(f.actions);
      return {
        id: f.campaign_id || '',
        nombre: f.campaign_name || 'Sin nombre',
        objetivo: f.objective || '',
        inversion,
        impresiones: num(f.impressions),
        alcance: num(f.reach),
        frecuencia: num(f.frequency),
        // inline_link_clicks son los clics en el enlace; `clicks` cuenta también
        // los "me gusta" y los clics en la foto, que no son interés real.
        clics: num(f.inline_link_clicks ?? f.clicks),
        conversaciones,
        costoPorConversacion: conversaciones > 0 ? inversion / conversaciones : 0,
        ctr: num(f.ctr) / 100,
      };
    })
    .sort((a, b) => b.inversion - a.inversion);
}

export async function getPorPlataforma(desde: string, hasta: string): Promise<InsightPlataforma[]> {
  const filas = await pedir<FilaInsight>(`${idCuenta()}/insights`, {
    level: 'account',
    fields: 'spend,reach,clicks,inline_link_clicks,actions',
    breakdowns: 'publisher_platform',
    time_range: rangoJson(desde, hasta),
    use_unified_attribution_setting: 'true',
    limit: '100',
  });

  return filas
    .map((f) => ({
      plataforma: f.publisher_platform || 'otra',
      inversion: num(f.spend),
      conversaciones: contarConversaciones(f.actions),
      alcance: num(f.reach),
      clics: num(f.inline_link_clicks ?? f.clicks),
    }))
    .sort((a, b) => b.inversion - a.inversion);
}
