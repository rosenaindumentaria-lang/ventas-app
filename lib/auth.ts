import { cookies } from 'next/headers';
import {
  crearToken,
  verificarToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  type Sesion,
} from './session-token';

// Re-exporto las utilidades puras para que el resto de la app importe todo desde
// '@/lib/auth' (el Proxy usa directamente '@/lib/session-token').
export { hashPassword, verifyPassword, verificarToken, SESSION_COOKIE } from './session-token';
export type { Sesion } from './session-token';

// ── Cookie de sesión (server components / route handlers) ─────────────────────

export async function crearSesion(payload: Omit<Sesion, 'exp'>): Promise<void> {
  const token = crearToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getSesion(): Promise<Sesion | null> {
  const cookieStore = await cookies();
  return verificarToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function borrarSesion(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
