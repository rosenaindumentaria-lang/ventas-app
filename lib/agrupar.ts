// Agrupa textos que son "lo mismo" escrito distinto: mayúsculas, espacios de
// más, o un typo conocido. NO toca la planilla — es sólo cómo se agrupa al
// mostrar, así que arreglar el dato de origen sigue siendo posible después.
//
// La etiqueta que se muestra es la grafía más frecuente del grupo, para no
// inventar nombres que nadie escribió: "Face" (31 ventas) y "FACE" (1) se
// muestran como "Face", no como "face" ni "FACE".

// Typos confirmados con el usuario. La clave y el valor van en minúscula,
// porque se comparan contra el texto ya normalizado.
const ALIAS: Record<string, string> = {
  inta: 'insta', // "Inta" es Instagram mal tipeado
};

export function claveAgrupacion(raw: string | undefined): string {
  const limpio = (raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return ALIAS[limpio] ?? limpio;
}

export interface Grupo<T> {
  clave: string;
  etiqueta: string;
  items: T[];
}

export function agrupar<T>(
  items: T[],
  obtener: (t: T) => string | undefined,
  etiquetaVacia = 'Sin dato'
): Grupo<T>[] {
  const grupos = new Map<string, { items: T[]; grafias: Map<string, number> }>();

  for (const item of items) {
    const original = (obtener(item) || '').trim();
    const clave = claveAgrupacion(original);
    if (!grupos.has(clave)) grupos.set(clave, { items: [], grafias: new Map() });
    const g = grupos.get(clave)!;
    g.items.push(item);
    if (original) g.grafias.set(original, (g.grafias.get(original) || 0) + 1);
  }

  return [...grupos.entries()].map(([clave, g]) => {
    // Grafía más frecuente; si empatan, la primera alfabéticamente para que el
    // resultado no dependa del orden en que vinieron las filas.
    const etiqueta =
      [...g.grafias.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
      etiquetaVacia;
    return { clave, etiqueta, items: g.items };
  });
}
