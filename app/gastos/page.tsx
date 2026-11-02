import { redirect } from 'next/navigation';

// Gastos y Movimientos se unificaron en una sola pantalla. Queda la ruta vieja
// para que los favoritos y los links guardados no den 404.
export default function Gastos() {
  redirect('/movimientos');
}
