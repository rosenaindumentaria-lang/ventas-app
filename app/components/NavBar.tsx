'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const LINKS = [
  { href: '/', label: 'Registrar Venta' },
  { href: '/historial', label: 'Historial' },
  { href: '/gastos', label: 'Gastos' },
  { href: '/caja', label: 'Caja' },
  { href: '/reportes', label: 'Reportes' },
];

export default function NavBar({ nombre, rol }: { nombre: string; rol: string }) {
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const pathname = usePathname();

  const links = rol === 'admin' ? [...LINKS, { href: '/usuarios', label: 'Usuarios' }] : LINKS;

  async function salir() {
    setSaliendo(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  function claseLink(href: string) {
    const activo = pathname === href;
    return `transition-colors text-sm font-medium ${
      activo ? 'text-[#6b4423]' : 'text-stone-600 hover:text-[#6b4423]'
    }`;
  }

  return (
    <nav className="bg-white border-b border-stone-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4">
        {/* Barra principal */}
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="shrink-0" onClick={() => setAbierto(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Rosena" className="h-7 w-auto" />
          </Link>

          {/* Links en escritorio */}
          <div className="hidden md:flex items-center gap-6">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={claseLink(l.href)}>
                {l.label}
              </Link>
            ))}
          </div>

          {/* Usuario + salir en escritorio */}
          <div className="hidden md:flex items-center gap-3 text-sm">
            <span className="text-stone-500">
              {nombre}
              {rol === 'admin' && <span className="ml-1 text-stone-400">(admin)</span>}
            </span>
            <button
              onClick={salir}
              disabled={saliendo}
              className="rounded bg-[#6b4423] px-3 py-1 font-medium text-white hover:bg-[#553619] disabled:opacity-50 transition-colors"
            >
              {saliendo ? 'Saliendo…' : 'Salir'}
            </button>
          </div>

          {/* Botón hamburguesa en mobile */}
          <button
            onClick={() => setAbierto((v) => !v)}
            className="md:hidden p-2 -mr-2 text-stone-700"
            aria-label="Menú"
            aria-expanded={abierto}
          >
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
          <div className="md:hidden border-t border-stone-100 py-2">
            <div className="flex flex-col">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setAbierto(false)}
                  className={`py-2.5 ${claseLink(l.href)}`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="mt-2 pt-3 border-t border-stone-100 flex items-center justify-between">
              <span className="text-sm text-stone-500">
                {nombre}
                {rol === 'admin' && <span className="ml-1 text-stone-400">(admin)</span>}
              </span>
              <button
                onClick={salir}
                disabled={saliendo}
                className="rounded bg-[#6b4423] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#553619] disabled:opacity-50 transition-colors"
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
