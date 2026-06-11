import { NextResponse } from 'next/server';
import { contarUsuarios, crearUsuario } from '@/lib/sheets';
import { crearSesion, hashPassword } from '@/lib/auth';

// Alta del PRIMER usuario administrador. Solo funciona cuando la hoja USUARIOS
// está vacía; una vez que existe al menos un usuario, los demás se crean desde
// la pantalla de administración (protegida).
export async function POST(request: Request) {
  try {
    if ((await contarUsuarios()) > 0) {
      return NextResponse.json(
        { error: 'Ya existen usuarios. Pedile a un administrador que te dé de alta.' },
        { status: 403 }
      );
    }

    const { usuario, nombre, password } = await request.json();
    if (!usuario || !password) {
      return NextResponse.json({ error: 'Ingresá usuario y contraseña' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const limpio = usuario.trim();
    await crearUsuario({
      usuario: limpio,
      hash: hashPassword(password),
      nombre: (nombre || limpio).trim(),
      rol: 'admin',
    });

    await crearSesion({ usuario: limpio, nombre: (nombre || limpio).trim(), rol: 'admin' });

    return NextResponse.json({ usuario: limpio, rol: 'admin' });
  } catch (error) {
    console.error('Error en setup:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al crear el primer usuario', detalle }, { status: 500 });
  }
}
