'use client';

import { useState } from 'react';

export default function UserMenu({ nombre, rol }: { nombre: string; rol: string }) {
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    // Recarga completa para que el Proxy redirija a /login.
    window.location.href = '/login';
  }

  return (
    <div className="ml-auto flex items-center gap-3 text-sm">
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
  );
}
