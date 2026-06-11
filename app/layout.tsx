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
          <nav className="bg-indigo-700 text-white shadow-md">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
              <span className="font-bold text-lg tracking-tight">📦 Rosena</span>
              <Link href="/" className="hover:text-indigo-200 transition-colors text-sm font-medium">
                Registrar Venta
              </Link>
              <Link href="/historial" className="hover:text-indigo-200 transition-colors text-sm font-medium">
                Historial
              </Link>
              <Link href="/gastos" className="hover:text-indigo-200 transition-colors text-sm font-medium">
                Gastos
              </Link>
              <Link href="/caja" className="hover:text-indigo-200 transition-colors text-sm font-medium">
                Caja
              </Link>
              <Link href="/reportes" className="hover:text-indigo-200 transition-colors text-sm font-medium">
                Reportes
              </Link>
              {sesion.rol === 'admin' && (
                <Link href="/usuarios" className="hover:text-indigo-200 transition-colors text-sm font-medium">
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
