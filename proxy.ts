import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verificarToken, SESSION_COOKIE } from '@/lib/session-token';

// Rutas públicas (no requieren sesión).
const PAGINAS_PUBLICAS = ['/login'];
const API_PUBLICA = '/api/auth';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sesion = verificarToken(request.cookies.get(SESSION_COOKIE)?.value);

  const esApi = pathname.startsWith('/api');
  const esApiPublica = pathname.startsWith(API_PUBLICA);
  const esPaginaPublica = PAGINAS_PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // API: si no hay sesión y no es pública, devolvemos 401 (no redirigimos, para
  // que los fetch del front reciban un error claro en vez de HTML de /login).
  if (esApi) {
    if (!esApiPublica && !sesion) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Páginas: sin sesión → al login.
  if (!sesion && !esPaginaPublica) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  // Con sesión activa, el login no tiene sentido → al inicio.
  if (sesion && esPaginaPublica) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Corre en todo salvo assets estáticos, imágenes y favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)'],
};
