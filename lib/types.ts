export interface Producto {
  cod: string;
  rubro: string;
  descripcion: string;
  nombreComercial: string;
  // Otras formas de llamarlo (columna E de BASE DE DATOS): cómo lo nombra la
  // gente del local o cómo lo describiría alguien que lo ve en la mano. El
  // buscador las usa, así no hace falta saberse el nombre de la planilla.
  otrosNombres: string;
  // Fotos del artículo (pestaña FOTOS). La miniatura es para listas y grillas;
  // la foto, para verlo grande. Vacías si todavía nadie le sacó una.
  foto: string;
  miniatura: string;
  costo: number;
  margenFinan: number;
  margenEfectivo: number;
  margenMayor: number;
  iva: number;
  precioUnidad: number;
  precioEfectivo: number;
  precioMayor: number;
}

// "Pago Mercadería" ya no está: la compra de mercadería no es un gasto, es una
// salida de caja. Su costo se descuenta solo al vender, dentro de la ganancia
// de cada venta, así que cargarla como gasto la restaba dos veces. Va en
// TIPOS_SALIDA → Compra de mercadería.
export const CATEGORIAS_GASTO = [
  'Gasto Adm',
  'Gasto Comercializacion',
  'Gasto Fiscal',
  'Gasto Financiero',
] as const;

export interface Gasto {
  id: string;
  fecha: string;
  descripcion: string;
  categoria: string;
  monto: number;
  usuario?: string;
}

// Gasto a medio cargar: tiene importe pero le falta la fecha. Se muestra como
// alerta en /movimientos para que alguien lo termine de registrar o lo descarte.
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

// Salidas de caja que NO son gasto. En todas, la plata se convierte en algo que
// seguís teniendo (stock, muebles) o cancela una deuda, en vez de consumirse:
//  - Compra de mercadería: se vuelve gasto recién cuando la vendés, y eso ya lo
//    descuenta la ganancia de cada venta (el CMV). Cargarla también como gasto
//    la restaría dos veces.
//  - Compra de bienes: muebles, instalaciones, equipos. Se gastan de a poco por
//    desgaste; la app no calcula depreciación, así que no tocan la ganancia.
export const TIPOS_SALIDA = [
  'Compra de mercadería',
  'Compra de bienes',
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

// ── STOCK ─────────────────────────────────────────────────────────────────────
//
// El stock no se guarda: se calcula. Lo que se guarda es un libro de hechos
// (hoja STOCK) y el stock de hoy sale de sumarlos y restarle las ventas.
//  - CONTEO: se contó el artículo y había `cantidad`. Es una foto al CIERRE de
//    esa fecha y reemplaza todo lo anterior de ese artículo.
//  - COMPRA: entraron `cantidad` unidades (positivo).
//  - AJUSTE: corrección con signo (rotura, regalo, error de carga).
export type TipoStock = 'CONTEO' | 'COMPRA' | 'AJUSTE';

export const TIPOS_STOCK: readonly TipoStock[] = ['CONTEO', 'COMPRA', 'AJUSTE'];

export interface MovimientoStock {
  id: string;
  fecha: string;
  cod: string;
  tipo: TipoStock;
  cantidad: number;
  detalle: string;
  usuario?: string;
}

// Una fila de la pantalla de stock: el artículo con su existencia calculada.
export interface FilaStock {
  cod: string;
  nombre: string;
  rubro: string;
  costo: number;
  // null = nadie lo contó ni lo compró todavía: no se sabe cuánto hay.
  stock: number | null;
  // stock x costo; 0 si no se sabe, no hay costo o el stock es negativo.
  valor: number;
  // Fecha desde la que se lleva la cuenta (último conteo o primera compra).
  desde: string;
  ultimoMov: string;
}
