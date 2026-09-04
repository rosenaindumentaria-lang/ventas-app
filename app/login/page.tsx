'use client';

import { useEffect, useState } from 'react';

export default function LoginPage() {
  const [modo, setModo] = useState<'cargando' | 'login' | 'setup'>('cargando');
  const [usuario, setUsuario] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => setModo(data.hayUsuarios ? 'login' : 'setup'))
      .catch(() => setModo('login'));
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);

    const endpoint = modo === 'setup' ? '/api/auth/setup' : '/api/auth/login';
    const body = modo === 'setup' ? { usuario, nombre, password } : { usuario, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión');
        setEnviando(false);
        return;
      }
      // Recarga completa para que el Proxy y el layout tomen la nueva sesión.
      window.location.href = '/';
    } catch {
      setError('No se pudo conectar. Intentá de nuevo.');
      setEnviando(false);
    }
  }

  if (modo === 'cargando') {
    return <p className="text-center text-tinta-suave mt-12">Cargando…</p>;
  }

  const esSetup = modo === 'setup';

  return (
    <div className="max-w-sm mx-auto mt-12">
      <div className="text-center mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Rosena" className="h-16 w-auto mx-auto mb-3" />
        <p className="text-sm text-tinta-suave mt-1">
          {esSetup ? 'Creá el primer usuario administrador' : 'Ingresá para continuar'}
        </p>
      </div>

      <form onSubmit={enviar} className="panel p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-tinta-media mb-1">Usuario</label>
          <input
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoFocus
            autoComplete="username"
            className="w-full rounded-panel border border-borde px-3 py-2 text-sm focus:border-marca focus:ring-1 focus:ring-marca outline-none"
            required
          />
        </div>

        {esSetup && (
          <div>
            <label className="block text-sm font-medium text-tinta-media mb-1">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre para mostrar"
              className="w-full rounded-panel border border-borde px-3 py-2 text-sm focus:border-marca focus:ring-1 focus:ring-marca outline-none"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-tinta-media mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={esSetup ? 'new-password' : 'current-password'}
            className="w-full rounded-panel border border-borde px-3 py-2 text-sm focus:border-marca focus:ring-1 focus:ring-marca outline-none"
            required
          />
        </div>

        {error && <p className="text-sm text-rojo">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-panel bg-marca text-white py-2 font-medium hover:bg-marca-fuerte disabled:opacity-50 transition-colors"
        >
          {enviando ? 'Procesando…' : esSetup ? 'Crear y entrar' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
