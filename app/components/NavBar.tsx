'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

const LINKS = [
  { href: '/', label: 'Registrar Venta' },
  { href: '/historial', label: 'Historial' },
  { href: '/gastos', label: 'Gastos' },
  { href: '/movimientos', label: 'Movimientos' },
  { href: '/caja', label: 'Caja' },
  { href: '/reportes', label: 'Reportes' },
  { href: '/campanias', label: 'Campañas' },
];

// La pantalla de Gastos avisa por acá cuando se completa o descarta un
// pendiente, así el globito de la nav se actualiza sin recargar la página.
export const EVENTO_PENDIENTES = 'gastos-pendientes-actualizados';

// Globito rojo con la cantidad de gastos a medio registrar.
function Globo({ n }: { n: number }) {
  return (
    <span
      title={`${n} ${n === 1 ? 'gasto a medio registrar' : 'gastos a medio registrar'}`}
      className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-rojo px-1.5 text-[11px] font-bold leading-[18px] text-white"
    >
      {n}
    </span>
  );
}

export default function NavBar({ nombre, rol }: { nombre: string; rol: string }) {
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const pathname = usePathname();

  const links = rol === 'admin' ? [...LINKS, { href: '/usuarios', label: 'Usuarios' }] : LINKS;

  const contarPendientes = useCallback(() => {
    fetch('/api/gastos/pendientes')
      .then((r) => r.json())
      .then((data) => setPendientes(Array.isArray(data) ? data.length : 0))
      .catch(() => setPendientes(0));
  }, []);

  // Al cambiar de pantalla y cada vez que Gastos avisa que algo cambió.
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

  return (
    <nav className="bg-panel border-b border-borde">
      <div className="max-w-5xl mx-auto px-4">
        {/* Barra principal */}
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="shrink-0" onClick={() => setAbierto(false)}>
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
                {l.href === '/gastos' && pendientes > 0 && <Globo n={pendientes} />}
              </Link>
            ))}
          </div>

          {/* Usuario + salir en escritorio */}
          <div className="hidden md:flex items-center gap-3 text-sm">
            <span className="text-tinta-suave">
              {nombre}
              {rol === 'admin' && <span className="ml-1 text-tinta-tenue">(admin)</span>}
            </span>
            <button
              onClick={salir}
              disabled={saliendo}
              className="rounded bg-marca px-3 py-1 font-medium text-white hover:bg-marca-fuerte disabled:opacity-50 transition-colors"
            >
              {saliendo ? 'Saliendo…' : 'Salir'}
            </button>
          </div>

          {/* Botón hamburguesa en mobile */}
          <button
            onClick={() => setAbierto((v) => !v)}
            className="md:hidden relative p-2 -mr-2 text-tinta-media"
            aria-label={pendientes > 0 ? `Menú (${pendientes} gastos a medio registrar)` : 'Menú'}
            aria-expanded={abierto}
          >
            {/* En mobile los links están escondidos: el puntito avisa igual. */}
            {pendientes > 0 && !abierto && (
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-rojo ring-2 ring-panel" />
            )}
            {abierto ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="6" y1="18" x2="18" y2="6" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>

        {/* Menú desplegable en mobile */}
        {abierto && (
          <div className="md:hidden border-t border-borde-suave py-2">
            <div className="flex flex-col">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setAbierto(false)}
                  className={`py-2.5 inline-flex items-center gap-2 ${claseLink(l.href)}`}
                >
                  {l.label}
                  {l.href === '/gastos' && pendientes > 0 && <Globo n={pendientes} />}
                </Link>
              ))}
            </div>
            <div className="mt-2 pt-3 border-t border-borde-suave flex items-center justify-between">
              <span className="text-sm text-tinta-suave">
                {nombre}
                {rol === 'admin' && <span className="ml-1 text-tinta-tenue">(admin)</span>}
              </span>
              <button
                onClick={salir}
                disabled={saliendo}
                className="rounded bg-marca px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-fuerte disabled:opacity-50 transition-colors"
              >
                {saliendo ? 'Saliendo…' : 'Salir'}
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
