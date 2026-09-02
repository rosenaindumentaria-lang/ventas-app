import { NextResponse } from 'next/server';
import {
  getCampanias,
  getPorPlataforma,
  getCuenta,
  metaConfigurada,
  rangoDelMes,
  MetaError,
} from '@/lib/meta';

function mesValido(mes: string | null): string {
  return mes && /^\d{4}-\d{2}$/.test(mes) ? mes : new Date().toISOString().slice(0, 7);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mes = mesValido(searchParams.get('mes'));

  // Sin credenciales no es un error: es que todavía no se conectó la cuenta. La
  // pantalla muestra las instrucciones en vez de un cartel rojo.
  if (!metaConfigurada()) {
    return NextResponse.json({ configurada: false, mes, campanias: [], plataformas: [] });
  }

  const { desde, hasta } = rangoDelMes(mes);

  try {
    // Las tres consultas son independientes entre sí, así que van juntas.
    const [cuenta, campanias, plataformas] = await Promise.all([
      getCuenta(),
      getCampanias(desde, hasta),
      getPorPlataforma(desde, hasta),
    ]);

    return NextResponse.json({ configurada: true, mes, desde, hasta, cuenta, campanias, plataformas });
  } catch (error) {
    if (error instanceof MetaError) {
      return NextResponse.json(
        { configurada: true, error: error.message, codigo: error.codigo },
        { status: 502 }
      );
    }
    console.error('Error consultando Meta:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al consultar Meta', detalle }, { status: 500 });
  }
}
