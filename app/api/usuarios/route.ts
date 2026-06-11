import { NextResponse } from 'next/server';
import { getUsuarios, crearUsuario, setUsuarioActivo } from '@/lib/sheets';
import { getSesion, hashPassword } from '@/lib/auth';
import type { RolUsuario } from '@/lib/types';

// Todas las operaciones requieren sesión de administrador.
async function requireAdmin() {
  const sesion = await getSesion();
  if (!sesion) return { error: 'No autenticado', status: 401 as const };
  if (sesion.rol !== 'admin') return { error: 'Necesitás permisos de administrador', status: 403 as const };
  return { sesion };
}

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const usuarios = await getUsuarios();
  return NextResponse.json(usuarios);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { usuario, nombre, password, rol } = await request.json();
    if (!usuario || !password) {
      return NextResponse.json({ error: 'Ingresá usuario y contraseña' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const limpio = usuario.trim();
    const rolFinal: RolUsuario = rol === 'admin' ? 'admin' : 'vendedor';
    await crearUsuario({
      usuario: limpio,
      hash: hashPassword(password),
      nombre: (nombre || limpio).trim(),
      rol: rolFinal,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creando usuario:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: detalle }, { status: 400 });
  }
}

// Activa/desactiva un usuario. ?usuario=xxx&activo=false
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { usuario, activo } = await request.json();
    if (!usuario) return NextResponse.json({ error: 'Falta el usuario' }, { status: 400 });

    if (usuario.toLowerCase() === auth.sesion.usuario.toLowerCase() && !activo) {
      return NextResponse.json({ error: 'No podés desactivarte a vos mismo' }, { status: 400 });
    }

    await setUsuarioActivo(usuario, !!activo);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: detalle }, { status: 400 });
  }
}
