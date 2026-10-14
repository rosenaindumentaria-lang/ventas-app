// Minúsculas y sin tildes: "pantalón" y "PANTALON" tienen que dar lo mismo.
export function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
