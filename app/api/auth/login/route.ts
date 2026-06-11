import { NextResponse } from 'next/server';
import { buscarUsuario } from '@/lib/sheets';
import { crearSesion, verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { usuario, password } = await request.json();
    if (!usuario || !password) {
      return NextResponse.json({ error: 'Ingresá usuario y contraseña' }, { status: 400 });
    }

    const encontrado = await buscarUsuario(usuario);
    // Mensaje genérico: no revelamos si el usuario existe o no.
    if (!encontrado || !verifyPassword(password, encontrado.hash)) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    await crearSesion({
      usuario: encontrado.usuario,
      nombre: encontrado.nombre,
      rol: encontrado.rol,
    });

    return NextResponse.json({
      usuario: encontrado.usuario,
      nombre: encontrado.nombre,
      rol: encontrado.rol,
    });
  } catch (error) {
    console.error('Error en login:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al iniciar sesión', detalle }, { status: 500 });
  }
}
