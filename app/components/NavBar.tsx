'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

// Escritorio: todos los links arriba.
const LINKS = [
  { href: '/', label: 'Registrar Venta' },
  { href: '/articulos', label: 'Artículos' },
  { href: '/historial', label: 'Historial' },
  { href: '/movimientos', label: 'Movimientos' },
  { href: '/stock', label: 'Stock' },
  { href: '/caja', label: 'Caja' },
  { href: '/reportes', label: 'Reportes' },
];

// Celular: barra fija abajo con lo que se usa todos los días, al alcance del
// pulgar. El resto va en "Más". Los íconos son trazos simples para que no
// pesen ni dependan de una librería.
const TRAZOS = {
  venta: 'M6 6h15l-1.5 9h-12zM6 6 5 3H2M9 20a1 1 0 1 0 0 .01M17 20a1 1 0 1 0 0 .01',
  historial: 'M4 5h16M4 10h16M4 15h10M4 20h7',
  movimientos: 'M7 4v14m0 0-3-3m3 3 3-3M17 20V6m0 0-3 3m3-3 3 3',
  caja: 'M3 7h18v12H3zM3 7l2-3h14l2 3M16 13h2',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
} as const;

const TABS = [
  { href: '/', label: 'Venta', trazo: TRAZOS.venta },
  { href: '/historial', label: 'Historial', trazo: TRAZOS.historial },
  { href: '/movimientos', label: 'Movimientos', trazo: TRAZOS.movimientos },
  { href: '/caja', label: 'Caja', trazo: TRAZOS.caja },
];

// Lo que no entra en la barra de abajo.
const MAS_LINKS = [
  { href: '/articulos', label: 'Artículos' },
  { href: '/stock', label: 'Stock' },
  { href: '/reportes', label: 'Reportes' },
];

// La pantalla de Movimientos avisa por acá cuando se completa o descarta un
// pendiente, así el globito de la nav se actualiza sin recargar la página.
export const EVENTO_PENDIENTES = 'gastos-pendientes-actualizados';

// Globito rojo con la cantidad de gastos a medio registrar.
function Globo({ n, chico = false }: { n: number; chico?: boolean }) {
  return (
    <span
      title={`${n} ${n === 1 ? 'gasto a medio registrar' : 'gastos a medio registrar'}`}
      className={`inline-flex items-center justify-center rounded-full bg-rojo font-bold text-white ${
        chico
          ? 'absolute -right-2 -top-1 min-w-[16px] px-1 text-[10px] leading-4'
          : 'min-w-[18px] px-1.5 text-[11px] leading-[18px]'
      }`}
    >
      {n}
    </span>
  );
}

function Icono({ trazo }: { trazo: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={trazo} />
    </svg>
  );
}

export default function NavBar({ nombre, rol }: { nombre: string; rol: string }) {
  const [masAbierto, setMasAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const pathname = usePathname();

  const links = rol === 'admin' ? [...LINKS, { href: '/usuarios', label: 'Usuarios' }] : LINKS;
  const masLinks = rol === 'admin' ? [...MAS_LINKS, { href: '/usuarios', label: 'Usuarios' }] : MAS_LINKS;

  const contarPendientes = useCallback(() => {
    fetch('/api/gastos/pendientes')
      .then((r) => r.json())
      .then((data) => setPendientes(Array.isArray(data) ? data.length : 0))
      .catch(() => setPendientes(0));
  }, []);

  // Al cambiar de pantalla y cada vez que Movimientos avisa que algo cambió.
  useEffect(() => {
    contarPendientes();
  }, [contarPendientes, pathname]);

  useEffect(() => {
    window.addEventListener(EVENTO_PENDIENTES, contarPendientes);
    return () => window.removeEventListener(EVENTO_PENDIENTES, contarPendientes);
  }, [contarPendientes]);

  async function salir() {
    setSaliendo(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  function claseLink(href: string) {
    const activo = pathname === href;
    return `transition-colors text-sm font-medium ${
      activo ? 'text-marca' : 'text-tinta-media hover:text-marca'
    }`;
  }

  // "Más" se marca activo si estás en alguna de sus pantallas.
  const enMas = masLinks.some((l) => pathname === l.href);

  return (
    <>
      {/* Barra de arriba: en el celular, sólo el logo y quién está usando la app. */}
      <nav className="bg-panel border-b border-borde">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Rosena" className="h-7 w-auto" />
            </Link>

            {/* Links en escritorio */}
            <div className="hidden md:flex items-center gap-4 lg:gap-6">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`${claseLink(l.href)} inline-flex items-center gap-1.5`}
                >
                  {l.label}
                  {l.href === '/movimientos' && pendientes > 0 && <Globo n={pendientes} />}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className="text-tinta-suave">
                {nombre}
                {rol === 'admin' && <span className="ml-1 text-tinta-tenue hidden sm:inline">(admin)</span>}
              </span>
              <button
                onClick={salir}
                disabled={saliendo}
                className="hidden md:block rounded bg-marca px-3 py-1 font-medium text-white hover:bg-marca-fuerte disabled:opacity-50 transition-colors"
              >
                {saliendo ? 'Saliendo…' : 'Salir'}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Barra de abajo: sólo celular. */}
      <div className="md:hidden">
        {masAbierto && (
          <>
            <button
              aria-label="Cerrar menú"
              className="fixed inset-0 z-30 bg-tinta/30"
              onClick={() => setMasAbierto(false)}
            />
            <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 panel p-2 shadow-flotante">
              {masLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMasAbierto(false)}
                  className={`block rounded-panel px-3 py-3 ${claseLink(l.href)} ${
                    pathname === l.href ? 'bg-marca-suave' : ''
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              <button
                onClick={salir}
                disabled={saliendo}
                className="mt-1 w-full rounded-panel border-t border-borde-suave px-3 py-3 text-left text-sm font-medium text-rojo disabled:opacity-50"
              >
                {saliendo ? 'Saliendo…' : 'Salir'}
              </button>
            </div>
          </>
        )}

        <nav
          aria-label="Secciones"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-borde bg-panel pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="grid grid-cols-5">
            {TABS.map((t) => {
              const activo = pathname === t.href;
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    aria-current={activo ? 'page' : undefined}
                    className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                      activo ? 'text-marca' : 'text-tinta-suave'
                    }`}
                  >
                    <span className="relative">
                      <Icono trazo={t.trazo} />
                      {t.href === '/movimientos' && pendientes > 0 && <Globo n={pendientes} chico />}
                    </span>
                    {t.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                onClick={() => setMasAbierto((v) => !v)}
                aria-expanded={masAbierto}
                className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  enMas || masAbierto ? 'text-marca' : 'text-tinta-suave'
                }`}
              >
                <Icono trazo={TRAZOS.mas} />
                Más
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
}
