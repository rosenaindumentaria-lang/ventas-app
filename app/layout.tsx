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
    // La pestaña usa la inicial y no el logotipo entero: "ROSENA" a 16px es una
    // mancha ilegible. El logotipo completo se sigue usando en el icono de la
    // pantalla de inicio (apple-touch y manifest), donde sí hay lugar.
    icon: '/icon-rosena.png',
    apple: '/apple-touch-icon.png',
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
