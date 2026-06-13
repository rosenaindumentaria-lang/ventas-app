import { google } from 'googleapis';
import type { Producto, Venta, Gasto, Usuario, RolUsuario } from './types';

export type { Producto, Venta, Gasto, Usuario, RolUsuario };

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const SHEET_PRODUCTOS = 'BASE DE DATOS';
const SHEET_VENTAS = 'Ventas';
const SHEET_GASTOS = 'Gastos';
const SHEET_USUARIOS = 'USUARIOS';

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// Normaliza fecha a YYYY-MM-DD.
// Soporta: "YYYY-MM-DD", "DD/MM/YYYY", "DD/MM" (infiere año desde el id timestamp)
function normalizarFecha(fecha: string, id: string): string {
  if (!fecha) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  const partes3 = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (partes3) return `${partes3[3]}-${partes3[2].padStart(2, '0')}-${partes3[1].padStart(2, '0')}`;
  const partes2 = fecha.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (partes2) {
    const anio = /^\d{13}$/.test(id) ? new Date(parseInt(id)).getFullYear() : new Date().getFullYear();
    return `${anio}-${partes2[2].padStart(2, '0')}-${partes2[1].padStart(2, '0')}`;
  }
  return fecha;
}

// Parsea precios en formato argentino: $42.248 → 42248, $1.234,56 → 1234.56
function parsePrecio(val: string | undefined): number {
  if (!val) return 0;
  const str = val.toString().replace(/\s/g, '').replace('$', '');
  // Si tiene coma → es separador decimal (ej: 1.234,56)
  if (str.includes(',')) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // Sin coma → el punto es separador de miles (ej: 42.248)
  return parseFloat(str.replace(/\./g, '')) || 0;
}

export async function getProductos(): Promise<Producto[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_PRODUCTOS}!A2:N1000`,
  });

  const rows = response.data.values || [];

  // Columnas: A=COD, B=RUBRO, C=DESCRIPCION, D=NOMBRE COMERCIAL, E=vacía,
  // F=COSTO, G=vacía, H=FINAN, I=EFECTIVO(margen), J=MAYOR(margen),
  // K=IVA, L=UNIDAD(precio), M=EFECTIVO(precio), N=MAYOR(precio)
  return rows
    .filter((row) => row[0]) // filtrar filas vacías
    .map((row) => ({
      cod: row[0] || '',
      rubro: row[1] || '',
      descripcion: row[2] || '',
      nombreComercial: row[3] || '',
      costo: parsePrecio(row[5]),
      margenFinan: parseFloat(row[7]) || 0,
      margenEfectivo: parseFloat(row[8]) || 0,
      margenMayor: parseFloat(row[9]) || 0,
      iva: parseFloat(row[10]) || 0,
      precioUnidad: parsePrecio(row[11]),
      precioEfectivo: parsePrecio(row[12]),
      precioMayor: parsePrecio(row[13]),
    }));
}

// Estructura real de la hoja VENTAS:
// A=FECHA, B=MODALIDAD(origen), C=COMPROBANTE, D=ARTICULO(nombre), E=COD,
// F=CANTIDAD, G=LISTA DE PRECIO(tipo), H=PRECIO, I=TOTAL, J=OBSERVACIONES,
// K=(vacía), L=COSTO, M=MG BR, N=ID (agregada por la app para editar/borrar),
// O=USUARIO (agregada por la app: quién cargó la venta)

// Asegura que cada fila con FECHA tenga un ID en la columna N.
// Hace backfill de los IDs faltantes en una sola escritura y devuelve el array.
async function ensureVentaIds(
  sheets: ReturnType<typeof google.sheets>,
  rows: string[][]
): Promise<string[]> {
  const base = Date.now();
  let faltan = false;
  const ids: string[][] = rows.map((row, i) => {
    const tieneFecha = !!row[0];
    let id = (row[13] || '').toString().trim();
    if (tieneFecha && !id) {
      id = String(base + i);
      faltan = true;
    }
    return [id];
  });

  if (faltan) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_VENTAS}!N1:N${ids.length + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['ID'], ...ids] },
    });
  }

  return ids.map((r) => r[0]);
}

export async function getVentas(): Promise<Venta[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_VENTAS}!A2:O10000`,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const rows = response.data.values || [];
    const ids = await ensureVentaIds(sheets, rows);

    return rows
      .map((row, i) => ({ row, id: ids[i] }))
      .filter(({ row }) => row[0]) // tiene FECHA
      .map(({ row, id }) => ({
        id,
        origen: row[1] || '',
        fecha: normalizarFecha(row[0] || '', id),
        nombreComercial: row[3] || '',
        cod: row[4] || '',
        cantidad: parsePrecio(row[5]),
        tipoPrecio: (row[6] || '') as Venta['tipoPrecio'],
        precioUnitario: parsePrecio(row[7]),
        total: parsePrecio(row[8]),
        costo: parsePrecio(row[11]),
        ganancia: 0, // se recalcula en la API cruzando con el costo del producto
        usuario: row[14] || '',
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
  // Orden real: FECHA, MODALIDAD, COMPROBANTE, ARTICULO, COD, CANTIDAD,
  //             LISTA DE PRECIO, PRECIO, TOTAL, OBSERVACIONES, (vacía), COSTO, MG BR, ID, USUARIO
  const row = [
    venta.fecha,           // A FECHA
    venta.origen,          // B MODALIDAD
    '',                    // C COMPROBANTE
    venta.nombreComercial, // D ARTICULO
    venta.cod,             // E COD
    venta.cantidad,        // F CANTIDAD
    venta.tipoPrecio,      // G LISTA DE PRECIO
    venta.precioUnitario,  // H PRECIO
    venta.total,           // I TOTAL
    '',                    // J OBSERVACIONES
    '',                    // K
    venta.costo,           // L COSTO
    '',                    // M MG BR
    id,                    // N ID
    venta.usuario || '',   // O USUARIO
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_VENTAS}!A:O`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

// Devuelve el número de fila (1-based) de una venta según su ID, o null si no existe
async function buscarFilaVenta(
  sheets: ReturnType<typeof google.sheets>,
  id: string
): Promise<number | null> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_VENTAS}!N2:N10000`,
  });
  const ids = response.data.values || [];
  const index = ids.findIndex((r) => (r[0] || '').toString() === id.toString());
  return index === -1 ? null : index + 2; // +2 porque empieza en fila 2
}

// Obtiene el ID interno (gid) de la hoja Ventas
async function getSheetIdVentas(sheets: ReturnType<typeof google.sheets>): Promise<number> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const hoja = (spreadsheet.data.sheets || []).find(
    (s) => (s.properties?.title || '').trim().toLowerCase() === SHEET_VENTAS.toLowerCase()
  );
  return hoja?.properties?.sheetId ?? 0;
}

export async function borrarVenta(id: string): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const fila = await buscarFilaVenta(sheets, id);
  if (!fila) throw new Error('No se encontró la venta');

  const sheetId = await getSheetIdVentas(sheets);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: fila - 1, // 0-based
              endIndex: fila,
            },
          },
        },
      ],
    },
  });
}

export async function editarVenta(id: string, cantidad: number, fecha?: string): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const fila = await buscarFilaVenta(sheets, id);
  if (!fila) throw new Error('No se encontró la venta');

  // Leer la fila para obtener el precio unitario (H) y recalcular el total (I)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_VENTAS}!A${fila}:N${fila}`,
  });
  const row = response.data.values?.[0] || [];
  const precioUnitario = parsePrecio(row[7]);
  const total = precioUnitario * cantidad;

  if (fecha) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_VENTAS}!A${fila}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[fecha]] },
    });
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_VENTAS}!F${fila}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[cantidad]] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_VENTAS}!I${fila}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[total]] },
  });
}

async function ensureVentasSheet(sheets: ReturnType<typeof google.sheets>) {
  // Verificar si existe la hoja Ventas (comparando sin espacios y sin distinguir mayúsculas)
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const hojas = (spreadsheet.data.sheets || []).map((s) =>
    (s.properties?.title || '').trim().toLowerCase()
  );

  if (hojas.includes(SHEET_VENTAS.toLowerCase())) {
    return; // La hoja ya existe, no hacer nada
  }

  // Crear la hoja (si falla porque ya existe, lo ignoramos)
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_VENTAS } } }],
      },
    });

    // Agregar encabezados (estructura real + columnas ID y USUARIO al final)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_VENTAS}!A1:O1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['FECHA', 'MODALIDAD', 'COMPROBANTE', 'ARTICULO', 'COD', 'CANTIDAD', 'LISTA DE PRECIO', 'PRECIO', 'TOTAL', 'OBSERVACIONES', '', 'COSTO', 'MG BR', 'ID', 'USUARIO']],
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Si el error es porque la hoja ya existe, lo ignoramos y seguimos
    if (!msg.includes('already exists')) {
      throw error;
    }
  }
}

// ── GASTOS ──────────────────────────────────────────────────────────────────

// Estructura real de la hoja GASTOS: A=FECHA, B=CUENTA, C=OBSERVACION, D=IMPORTE
// E=USUARIO (agregada por la app: quién cargó el gasto).
// (sin columna ID; usamos el número de fila como identificador para borrar)
export async function getGastos(): Promise<Gasto[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_GASTOS}!A2:E10000`,
    });

    const rows = response.data.values || [];
    return rows
      .map((row, i) => ({ row, sheetRow: i + 2 }))
      .filter(({ row }) => row[0] && parsePrecio(row[3]) > 0)
      .map(({ row, sheetRow }) => ({
        id: String(sheetRow),
        fecha: normalizarFecha(row[0] || '', ''),
        categoria: row[1] || '',
        descripcion: row[2] || '',
        monto: parsePrecio(row[3]),
        usuario: row[4] || '',
      }));
  } catch {
    return [];
  }
}

export async function registrarGasto(gasto: Omit<Gasto, 'id'>): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await ensureGastosSheet(sheets);

  // Orden real de columnas: FECHA, CUENTA, OBSERVACION, IMPORTE, USUARIO
  const row = [gasto.fecha, gasto.categoria, gasto.descripcion, gasto.monto, gasto.usuario || ''];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_GASTOS}!A:E`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

export async function borrarGasto(id: string): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const fila = parseInt(id, 10);
  if (!fila || fila < 2) throw new Error('Gasto inválido');

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const hoja = (spreadsheet.data.sheets || []).find(
    (s) => (s.properties?.title || '').trim().toLowerCase() === SHEET_GASTOS.toLowerCase()
  );
  const sheetId = hoja?.properties?.sheetId ?? 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: fila - 1, endIndex: fila },
          },
        },
      ],
    },
  });
}

async function ensureGastosSheet(sheets: ReturnType<typeof google.sheets>) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const hojas = (spreadsheet.data.sheets || []).map((s) =>
    (s.properties?.title || '').trim().toLowerCase()
  );
  if (hojas.includes(SHEET_GASTOS.toLowerCase())) return;

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_GASTOS } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_GASTOS}!A1:E1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['FECHA', 'CUENTA', 'OBSERVACION', 'IMPORTE', 'USUARIO']] },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('already exists')) throw error;
  }
}

// ── USUARIOS ──────────────────────────────────────────────────────────────────

// Estructura de la hoja USUARIOS: A=USUARIO, B=HASH, C=NOMBRE, D=ROL, E=ACTIVO
// La contraseña NUNCA se guarda en texto plano: B contiene el hash (salt:hash).

interface UsuarioRaw extends Usuario {
  hash: string;
  sheetRow: number;
}

async function ensureUsuariosSheet(sheets: ReturnType<typeof google.sheets>) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const hojas = (spreadsheet.data.sheets || []).map((s) =>
    (s.properties?.title || '').trim().toLowerCase()
  );
  if (hojas.includes(SHEET_USUARIOS.toLowerCase())) return;

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_USUARIOS } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_USUARIOS}!A1:E1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['USUARIO', 'HASH', 'NOMBRE', 'ROL', 'ACTIVO']] },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('already exists')) throw error;
  }
}

// Lee todas las filas crudas (incluye el hash). Uso interno: nunca exponer a la UI.
async function getUsuariosRaw(): Promise<UsuarioRaw[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await ensureUsuariosSheet(sheets);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_USUARIOS}!A2:E1000`,
  });

  const rows = response.data.values || [];
  return rows
    .map((row, i) => ({ row, sheetRow: i + 2 }))
    .filter(({ row }) => (row[0] || '').toString().trim())
    .map(({ row, sheetRow }) => ({
      usuario: (row[0] || '').toString().trim(),
      hash: (row[1] || '').toString(),
      nombre: (row[2] || '').toString(),
      rol: ((row[3] || 'vendedor').toString().trim().toLowerCase() === 'admin'
        ? 'admin'
        : 'vendedor') as RolUsuario,
      activo: (row[4] ?? 'TRUE').toString().trim().toUpperCase() !== 'FALSE',
      sheetRow,
    }));
}

// Lista de usuarios para la UI (sin hash).
export async function getUsuarios(): Promise<Usuario[]> {
  const raw = await getUsuariosRaw();
  return raw.map(({ usuario, nombre, rol, activo }) => ({ usuario, nombre, rol, activo }));
}

export async function contarUsuarios(): Promise<number> {
  const raw = await getUsuariosRaw();
  return raw.length;
}

// Devuelve la fila cruda de un usuario activo (para verificar credenciales).
export async function buscarUsuario(usuario: string): Promise<UsuarioRaw | null> {
  const objetivo = usuario.trim().toLowerCase();
  const raw = await getUsuariosRaw();
  return raw.find((u) => u.usuario.toLowerCase() === objetivo && u.activo) || null;
}

export async function crearUsuario(u: {
  usuario: string;
  hash: string;
  nombre: string;
  rol: RolUsuario;
}): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await ensureUsuariosSheet(sheets);

  const existentes = await getUsuariosRaw();
  const usuario = u.usuario.trim();
  if (existentes.some((e) => e.usuario.toLowerCase() === usuario.toLowerCase())) {
    throw new Error('Ya existe un usuario con ese nombre');
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_USUARIOS}!A:E`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[usuario, u.hash, u.nombre, u.rol, 'TRUE']] },
  });
}

// Activa o desactiva un usuario (no se borra la fila para conservar el histórico).
export async function setUsuarioActivo(usuario: string, activo: boolean): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const raw = await getUsuariosRaw();
  const objetivo = raw.find((u) => u.usuario.toLowerCase() === usuario.trim().toLowerCase());
  if (!objetivo) throw new Error('No se encontró el usuario');

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_USUARIOS}!E${objetivo.sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[activo ? 'TRUE' : 'FALSE']] },
  });
}
