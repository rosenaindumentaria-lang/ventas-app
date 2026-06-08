// Formatea números al estilo argentino: 42248 → $42.248 / 1234.56 → $1.234,56
export function formatPrecio(valor: number): string {
  return valor.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatNumero(valor: number): string {
  return valor.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
