import { NextResponse } from 'next/server';
import { getSesion } from '@/lib/auth';
import { contarUsuarios } from '@/lib/sheets';

// Estado para la pantalla de login: si hay sesión activa y si ya existe algún
// usuario (para habilitar el alta del primer admin cuando la hoja está vacía).
export async function GET() {
  const sesion = await getSesion();
  let hayUsuarios = true;
  try {
    hayUsuarios = (await contarUsuarios()) > 0;
  } catch {
    // Si falla la lectura de la hoja, asumimos que sí hay usuarios para no
    // exponer el alta del primer admin por error.
    hayUsuarios = true;
  }

  return NextResponse.json({
    hayUsuarios,
    sesion: sesion ? { usuario: sesion.usuario, nombre: sesion.nombre, rol: sesion.rol } : null,
  });
}
