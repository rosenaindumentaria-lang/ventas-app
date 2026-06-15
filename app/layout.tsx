import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { getSesion } from '@/lib/auth';
import NavBar from './components/NavBar';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Rosena Ventas',
  description: 'Gestión de ventas de Rosena Indumentaria',
  manifest: '/manifest.json',
  icons: {
    icon: '/rosena.jpeg',
    apple: '/rosena.jpeg',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion();

  return (
    <html lang="es">
      <body className={`${geist.className} bg-gray-50 min-h-screen`}>
        {sesion && <NavBar nombre={sesion.nombre} rol={sesion.rol} />}
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
