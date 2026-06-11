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
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Usuarios</h1>

      {mensaje && (
        <p
          className={`mb-4 text-sm rounded-lg px-3 py-2 ${
            mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {mensaje.texto}
        </p>
      )}

      {/* Alta de usuario */}
      <form onSubmit={crear} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
        <h2 className="font-semibold text-gray-700 mb-4">Nuevo usuario</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as RolUsuario)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={creando}
          className="mt-4 rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {creando ? 'Creando…' : 'Crear usuario'}
        </button>
      </form>

      {/* Lista */}
      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : usuarios.length === 0 ? (
        <p className="text-gray-500">No hay usuarios.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Usuario</th>
                <th className="text-left px-4 py-2 font-medium">Nombre</th>
                <th className="text-left px-4 py-2 font-medium">Rol</th>
                <th className="text-left px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((u) => (
                <tr key={u.usuario}>
                  <td className="px-4 py-2 font-medium text-gray-800">{u.usuario}</td>
                  <td className="px-4 py-2 text-gray-600">{u.nombre}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {u.rol === 'admin' ? 'Administrador' : 'Vendedor'}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        u.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => toggleActivo(u)}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
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
