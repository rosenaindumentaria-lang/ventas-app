import { NextResponse } from 'next/server';
import { getCampanias, getCuenta, metaConfigurada, rangoDelMes, MetaError } from '@/lib/meta';
import { getGastos, registrarGasto, editarGasto } from '@/lib/sheets';
import { getSesion } from '@/lib/auth';

// La inversión en anuncios vive en Meta, pero el resultado del mes se calcula en
// Reportes con la hoja Gastos. Esta ruta copia una en la otra.
//
// Es a pedido y no automática: escribir en la planilla cada vez que alguien abre
// el panel dejaría la hoja llena de ediciones que nadie pidió.

const CATEGORIA = 'Gasto Comercializacion';
const PREFIJO = 'Publicidad Meta';

const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function descripcionDelMes(mes: string): string {
  const [anio, m] = mes.split('-');
  return `${PREFIJO} — ${NOMBRES_MES[parseInt(m, 10) - 1] ?? m} ${anio}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const mes: string = /^\d{4}-\d{2}$/.test(body?.mes) ? body.mes : new Date().toISOString().slice(0, 7);

    if (!metaConfigurada()) {
      return NextResponse.json({ error: 'La cuenta de Meta todavía no está conectada.' }, { status: 400 });
    }

    const { desde, hasta } = rangoDelMes(mes);
    const [cuenta, campanias] = await Promise.all([getCuenta(), getCampanias(desde, hasta)]);

    // La app lleva todo en pesos. Si la cuenta publicitaria factura en otra
    // moneda, copiar el número tal cual metería dólares en la columna de pesos y
    // rompería el resultado del mes sin que se note. Mejor frenar acá.
    if (cuenta.moneda && cuenta.moneda !== 'ARS') {
      return NextResponse.json(
        {
          error: `La cuenta de Meta factura en ${cuenta.moneda} y la app lleva los gastos en pesos. Cargá el gasto a mano convertido, para no mezclar monedas.`,
        },
        { status: 400 }
      );
    }

    const inversion = Math.round(campanias.reduce((a, c) => a + c.inversion, 0) * 100) / 100;
    if (inversion <= 0) {
      return NextResponse.json({ error: 'No hubo inversión en anuncios este mes.' }, { status: 400 });
    }

    // Se busca un gasto de publicidad ya cargado en ese mes en vez de agregar
    // uno nuevo: apretar el botón dos veces tiene que dejar un solo gasto, no
    // duplicar la publicidad del mes.
    const gastos = await getGastos();
    const existente = gastos.find(
      (g) => g.fecha.startsWith(mes) && g.descripcion.trim().toLowerCase().startsWith(PREFIJO.toLowerCase())
    );

    const descripcion = descripcionDelMes(mes);
    const sesion = await getSesion();

    if (existente) {
      if (Math.abs(existente.monto - inversion) < 0.01) {
        return NextResponse.json({ accion: 'sin-cambios', monto: inversion, descripcion: existente.descripcion });
      }
      await editarGasto(existente.id, { fecha: hasta, descripcion: existente.descripcion, categoria: CATEGORIA, monto: inversion });
      return NextResponse.json({
        accion: 'actualizado',
        monto: inversion,
        anterior: existente.monto,
        descripcion: existente.descripcion,
      });
    }

    await registrarGasto({
      fecha: hasta,
      descripcion,
      categoria: CATEGORIA,
      monto: inversion,
      usuario: sesion?.usuario || '',
    });

    return NextResponse.json({ accion: 'creado', monto: inversion, descripcion });
  } catch (error) {
    if (error instanceof MetaError) {
      return NextResponse.json({ error: error.message, codigo: error.codigo }, { status: 502 });
    }
    console.error('Error registrando la inversión como gasto:', error);
    const detalle = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al registrar el gasto', detalle }, { status: 500 });
  }
}
