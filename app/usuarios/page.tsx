'use client';

import { useEffect, useState } from 'react';
import type { Usuario, RolUsuario } from '@/lib/types';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Form de alta
  const [usuario, setUsuario] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<RolUsuario>('vendedor');
  const [creando, setCreando] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch('/api/usuarios');
      if (!res.ok) {
        const data = await res.json();
        setMensaje({ tipo: 'error', texto: data.error || 'No se pudo cargar la lista' });
        setUsuarios([]);
      } else {
        setUsuarios(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setCreando(true);
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, nombre, password, rol }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error || 'No se pudo crear el usuario' });
      } else {
        setMensaje({ tipo: 'ok', texto: `Usuario "${usuario}" creado` });
        setUsuario('');
        setNombre('');
        setPassword('');
        setRol('vendedor');
        cargar();
      }
    } finally {
      setCreando(false);
    }
  }

  async function toggleActivo(u: Usuario) {
    setMensaje(null);
    const res = await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: u.usuario, activo: !u.activo }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMensaje({ tipo: 'error', texto: data.error || 'No se pudo actualizar' });
    } else {
      cargar();
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-normal text-tinta mb-6">Usuarios</h1>

      {mensaje && (
        <p
          className={`mb-4 text-sm rounded-panel px-3 py-2 ${
            mensaje.tipo === 'ok' ? 'bg-verde-suave text-verde' : 'bg-rojo-suave text-rojo-fuerte'
          }`}
        >
          {mensaje.texto}
        </p>
      )}

      {/* Alta de usuario */}
      <form onSubmit={crear} className="panel p-5 mb-8">
        <h2 className="font-display text-lg font-normal text-tinta mb-4">Nuevo usuario</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-tinta-media mb-1">Usuario</label>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full rounded-panel border border-borde px-3 py-2 text-sm focus:border-marca focus:ring-1 focus:ring-marca outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-tinta-media mb-1">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-panel border border-borde px-3 py-2 text-sm focus:border-marca focus:ring-1 focus:ring-marca outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-tinta-media mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-panel border border-borde px-3 py-2 text-sm focus:border-marca focus:ring-1 focus:ring-marca outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-tinta-media mb-1">Rol</label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as RolUsuario)}
              className="w-full rounded-panel border border-borde px-3 py-2 text-sm focus:border-marca focus:ring-1 focus:ring-marca outline-none bg-panel"
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={creando}
          className="mt-4 rounded-panel bg-marca text-white px-4 py-2 text-sm font-medium hover:bg-marca-fuerte disabled:opacity-50 transition-colors"
        >
          {creando ? 'Creando…' : 'Crear usuario'}
        </button>
      </form>

      {/* Lista */}
      {loading ? (
        <p className="text-tinta-suave">Cargando…</p>
      ) : usuarios.length === 0 ? (
        <p className="text-tinta-suave">No hay usuarios.</p>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-tinta-media">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Usuario</th>
                <th className="text-left px-4 py-2 font-medium">Nombre</th>
                <th className="text-left px-4 py-2 font-medium">Rol</th>
                <th className="text-left px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde-suave">
              {usuarios.map((u) => (
                <tr key={u.usuario}>
                  <td className="px-4 py-2 font-medium text-tinta">{u.usuario}</td>
                  <td className="px-4 py-2 text-tinta-media">{u.nombre}</td>
                  <td className="px-4 py-2 text-tinta-media">
                    {u.rol === 'admin' ? 'Administrador' : 'Vendedor'}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 text-[11px] tracking-wider ${
                        u.activo ? 'bg-verde-suave text-verde' : 'bg-acento-suave text-tinta-media'
                      }`}
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => toggleActivo(u)}
                      className="text-marca hover:text-marca-fuerte text-sm font-medium"
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
