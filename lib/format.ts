// Formatea plata al estilo argentino, SIEMPRE con 2 decimales: $42.248,00.
// Con minimumFractionDigits en 0 el mismo formateador devolvía "$125.302,5",
// "$761.132,48" y "$49.180" en la misma columna, y así ninguna tabla alinea.
export function formatPrecio(valor: number): string {
  return valor.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatNumero(valor: number): string {
  return valor.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
