import type { Metadata, Viewport } from 'next';
import { Geist, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { getSesion } from '@/lib/auth';
import NavBar from './components/NavBar';

// Geist para operar (formularios, tablas, navegación) y una serif de alto
// contraste solo para cifras grandes y títulos de sección. Van como variables
// CSS porque quien decide dónde se usa cada una es el @theme de globals.css.
const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
});

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

export const viewport: Viewport = {
  themeColor: '#f2eee7',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion();

  return (
    <html lang="es">
      <body className={`${geist.variable} ${serif.variable} min-h-screen`}>
        {sesion && <NavBar nombre={sesion.nombre} rol={sesion.rol} />}
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
