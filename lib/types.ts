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

export interface Gasto {
  id: string;
  fecha: string;
  descripcion: string;
  categoria: string;
  monto: number;
  usuario?: string;
}

export interface Venta {
  id: string;
  origen: string;
  fecha: string;
  cod: string;
  rubro?: string;
  nombreComercial: string;
  cantidad: number;
  tipoPrecio: 'UNIDAD' | 'EFECTIVO' | 'MAYOR';
  precioUnitario: number;
  total: number;
  costo: number;
  ganancia: number;
  usuario?: string;
}

export type RolUsuario = 'admin' | 'vendedor';

export interface Usuario {
  usuario: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
}
