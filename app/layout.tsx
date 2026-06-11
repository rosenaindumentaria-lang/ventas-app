import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { getSesion } from '@/lib/auth';
import UserMenu from './components/UserMenu';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Ventas App',
  description: 'Gestión de ventas de tu emprendimiento',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion();

  return (
    <html lang="es">
      <body className={`${geist.className} bg-gray-50 min-h-screen`}>
        {sesion && (
          <nav className="bg-white border-b border-stone-200 shadow-sm">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
              <Link href="/" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Rosena" className="h-7 w-auto" />
              </Link>
              <Link href="/" className="text-stone-600 hover:text-[#6b4423] transition-colors text-sm font-medium">
                Registrar Venta
              </Link>
              <Link href="/historial" className="text-stone-600 hover:text-[#6b4423] transition-colors text-sm font-medium">
                Historial
              </Link>
              <Link href="/gastos" className="text-stone-600 hover:text-[#6b4423] transition-colors text-sm font-medium">
                Gastos
              </Link>
              <Link href="/caja" className="text-stone-600 hover:text-[#6b4423] transition-colors text-sm font-medium">
                Caja
              </Link>
              <Link href="/reportes" className="text-stone-600 hover:text-[#6b4423] transition-colors text-sm font-medium">
                Reportes
              </Link>
              {sesion.rol === 'admin' && (
                <Link href="/usuarios" className="text-stone-600 hover:text-[#6b4423] transition-colors text-sm font-medium">
                  Usuarios
                </Link>
              )}
              <UserMenu nombre={sesion.nombre} rol={sesion.rol} />
            </div>
          </nav>
        )}
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
