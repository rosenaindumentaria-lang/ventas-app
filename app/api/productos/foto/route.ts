import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { guardarFoto } from '@/lib/sheets';
import { getSesion } from '@/lib/auth';

// Las fotos llegan ya achicadas desde el celular (lib/foto-cliente.ts), así que
// estos topes sólo frenan algo raro, no una foto normal.
const MAX_FOTO = 1_500_000;
const MAX_MINIATURA = 300_000;

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Falta conectar el almacenamiento de fotos (Vercel Blob) al proyecto.' },
      { status: 503 }
    );
  }

  try {
    const form = await request.formData();
    const cod = (form.get('cod') || '').toString().trim();
    const foto = form.get('foto');
    const miniatura = form.get('miniatura');

    if (!cod || cod.length > 60 || !(foto instanceof File) || !(miniatura instanceof File)) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }
    if (foto.type !== 'image/jpeg' || miniatura.type !== 'image/jpeg') {
      return NextResponse.json({ error: 'La foto tiene que ser una imagen' }, { status: 400 });
    }
    if (foto.size > MAX_FOTO || miniatura.size > MAX_MINIATURA) {
      return NextResponse.json({ error: 'La foto es demasiado pesada' }, { status: 400 });
    }

    // El código va en el nombre sólo para reconocer el archivo en el Blob; el
    // sufijo al azar hace que una foto nueva tenga otra dirección y el celular
    // no siga mostrando la vieja que tenía guardada.
    const base = `productos/${cod.replace(/[^\w-]+/g, '_')}`;
    const opciones = { access: 'public' as const, addRandomSuffix: true, contentType: 'image/jpeg' };
    const [grande, chica] = await Promise.all([
      put(`${base}.jpg`, foto, opciones),
      put(`${base}-mini.jpg`, miniatura, opciones),
    ]);

    const sesion = await getSesion();
    const nueva = { foto: grande.url, miniatura: chica.url };
    const anterior = await guardarFoto(cod, nueva, sesion?.usuario || '');

    // Si falla, queda una imagen huérfana en el Blob: ocupa lugar pero no
    // rompe nada, así que no vale la pena hacer fallar la subida por eso.
    if (anterior) {
      const viejas = [anterior.foto, anterior.miniatura].filter(Boolean);
      if (viejas.length) await del(viejas).catch((e) => console.error('No se borró la foto vieja:', e));
    }

    return NextResponse.json(nueva);
  } catch (error) {
    console.error('Error subiendo foto:', error);
    return NextResponse.json({ error: 'No se pudo guardar la foto. Probá de nuevo.' }, { status: 500 });
  }
}
