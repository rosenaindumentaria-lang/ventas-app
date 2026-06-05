import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const SHEET_PRODUCTOS = 'BASE DE DATOS';
const SHEET_VENTAS = 'Ventas';

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

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

export async function getProductos(): Promise<Producto[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_PRODUCTOS}!A2:L1000`,
  });

  const rows = response.data.values || [];

  return rows
    .filter((row) => row[0]) // filtrar filas vacías
    .map((row) => ({
      cod: row[0] || '',
      rubro: row[1] || '',
      descripcion: row[2] || '',
      nombreComercial: row[3] || '',
      costo: parseFloat(row[4]) || 0,
      margenFinan: parseFloat(row[5]) || 0,
      margenEfectivo: parseFloat(row[6]) || 0,
      margenMayor: parseFloat(row[7]) || 0,
      iva: parseFloat(row[8]) || 0,
      precioUnidad: parseFloat(row[9]) || 0,
      precioEfectivo: parseFloat(row[10]) || 0,
      precioMayor: parseFloat(row[11]) || 0,
    }));
}

export async function getVentas(): Promise<Venta[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_VENTAS}!A2:J10000`,
    });

    const rows = response.data.values || [];
    return rows
      .filter((row) => row[0])
      .map((row) => ({
        id: row[0] || '',
        fecha: row[1] || '',
        cod: row[2] || '',
        nombreComercial: row[3] || '',
        cantidad: parseFloat(row[4]) || 0,
        tipoPrecio: row[5] as 'UNIDAD' | 'EFECTIVO' | 'MAYOR',
        precioUnitario: parseFloat(row[6]) || 0,
        total: parseFloat(row[7]) || 0,
        costo: parseFloat(row[8]) || 0,
        ganancia: parseFloat(row[9]) || 0,
      }));
  } catch {
    return [];
  }
}

export async function registrarVenta(venta: Omit<Venta, 'id'>): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Asegurar que existe la hoja Ventas con encabezados
  await ensureVentasSheet(sheets);

  const id = Date.now().toString();
  const row = [
    id,
    venta.fecha,
    venta.cod,
    venta.nombreComercial,
    venta.cantidad,
    venta.tipoPrecio,
    venta.precioUnitario,
    venta.total,
    venta.costo,
    venta.ganancia,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_VENTAS}!A:J`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

async function ensureVentasSheet(sheets: ReturnType<typeof google.sheets>) {
  // Verificar si existe la hoja Ventas
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const hojas = spreadsheet.data.sheets?.map((s) => s.properties?.title) || [];

  if (!hojas.includes(SHEET_VENTAS)) {
    // Crear la hoja
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_VENTAS } } }],
      },
    });

    // Agregar encabezados
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_VENTAS}!A1:J1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['ID', 'FECHA', 'COD', 'NOMBRE COMERCIAL', 'CANTIDAD', 'TIPO PRECIO', 'PRECIO UNITARIO', 'TOTAL', 'COSTO', 'GANANCIA']],
      },
    });
  }
}
