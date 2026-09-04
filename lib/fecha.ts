// Fechas en horario local, no en UTC.
//
// `new Date().toISOString().slice(0, 10)` parece "hoy" pero es hoy EN UTC. Con
// el huso de Argentina (UTC−3), toda venta cargada después de las 21:00 se
// guardaba con la fecha del día siguiente. Estas funciones corren el reloj por
// el offset local antes de recortar, así el día que se guarda es el día que
// vive quien está cargando.

/** Hoy en formato YYYY-MM-DD, según el reloj de quien usa la app. */
export function hoyISO(d: Date = new Date()): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Mes en curso en formato YYYY-MM, misma corrección. */
export function mesISO(d: Date = new Date()): string {
  return hoyISO(d).slice(0, 7);
}

/**
 * Nombre corto para mostrar una fecha ya elegida: "Hoy" y "Ayer" son las dos
 * respuestas que sirven casi siempre; el resto va como 04/09/2026.
 */
export function etiquetaFecha(iso: string): string {
  const hoy = hoyISO();
  if (iso === hoy) return 'Hoy';

  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  if (iso === hoyISO(ayer)) return 'Ayer';

  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
