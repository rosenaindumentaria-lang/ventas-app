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

// Gasto a medio cargar: tiene importe pero le falta la fecha. Se muestra como
// alerta en /gastos para que alguien lo termine de registrar o lo descarte.
export interface GastoPendiente {
  id: string;
  monto: number;
  usuario?: string;
}

// Plata que entra o sale de la caja sin ser una venta ni un gasto del negocio:
// un préstamo, un aporte propio, la devolución de ese préstamo, un retiro.
//
// Mueven el saldo de caja pero NO tocan el resultado neto: devolver el capital
// de un préstamo no te empobrece (cancelás una deuda), igual que recibirlo no
// te hizo ganar plata. Los intereses sí son un gasto y van en Gastos como
// "Gasto Financiero".
export interface MovimientoCaja {
  id: string;
  fecha: string;
  tipo: string;
  detalle: string;
  monto: number; // positivo = entra a la caja, negativo = sale
  usuario?: string;
}

export const TIPOS_ENTRADA = ['Préstamo', 'Aporte de socio', 'Devolución', 'Otro'] as const;

export const TIPOS_SALIDA = [
  'Devolución de préstamo',
  'Retiro de socio',
  'Otra salida',
] as const;

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
