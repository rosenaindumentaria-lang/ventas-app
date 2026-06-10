export interface Producto {
  cod: string;
  rubro: string;
  descripcion: string;
  nombreComercial: string;
  costo: number;
  margenFinan: number;
  margenEfectivo: number;
  margenMayor: number;
  iva: number;
  precioUnidad: number;
  precioEfectivo: number;
  precioMayor: number;
}

export interface Venta {
  id: string;
  origen: string;
  fecha: string;
  cod: string;
  nombreComercial: string;
  cantidad: number;
  tipoPrecio: 'UNIDAD' | 'EFECTIVO' | 'MAYOR';
  precioUnitario: number;
  total: number;
  costo: number;
  ganancia: number;
}
