import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

// Funciones puras de sesión y contraseñas (solo crypto nativo, sin next/headers).
// Se separan de lib/auth.ts para poder usarlas desde el Proxy, que corre fuera
// del scope de una request y no debe importar next/headers.

export const SESSION_COOKIE = 'sesion';
const SESSION_DURACION_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export const SESSION_MAX_AGE = SESSION_DURACION_MS / 1000;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Falta SESSION_SECRET en las variables de entorno');
  return secret;
}

// ── Contraseñas ───────────────────────────────────────────────────────────────
// Se guardan como "salt:hash" (ambos en hex). scrypt es lento a propósito.

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, almacenado: string): boolean {
  const [salt, hash] = (almacenado || '').split(':');
  if (!salt || !hash) return false;
  const intento = scryptSync(plain, salt, 64);
  const guardado = Buffer.from(hash, 'hex');
  if (intento.length !== guardado.length) return false;
  return timingSafeEqual(intento, guardado);
}

// ── Token de sesión ─────────────────────────────────────────────────────────
// Formato: base64url(payloadJSON).hmac  (firmado con SESSION_SECRET).
// No usa JWT/jose: con crypto nativo alcanza para firmar y verificar.

export interface Sesion {
  usuario: string;
  nombre: string;
  rol: 'admin' | 'vendedor';
  exp: number; // epoch ms
}

function firmar(data: string): string {
  return createHmac('sha256', getSecret()).update(data).digest('base64url');
}

export function crearToken(payload: Omit<Sesion, 'exp'>): string {
  const sesion: Sesion = { ...payload, exp: Date.now() + SESSION_DURACION_MS };
  const data = Buffer.from(JSON.stringify(sesion)).toString('base64url');
  return `${data}.${firmar(data)}`;
}

export function verificarToken(token: string | undefined): Sesion | null {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;

  // Comparación en tiempo constante de la firma
  const esperada = firmar(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const sesion = JSON.parse(Buffer.from(data, 'base64url').toString()) as Sesion;
    if (!sesion.exp || sesion.exp < Date.now()) return null;
    return sesion;
  } catch {
    return null;
  }
}
