import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Por favor ingrese usuario y contraseña');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const setQuickUser = (user: string) => {
    setUsername(user);
    setPassword('crisis2026');
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] flex flex-col justify-center items-center px-4 py-8">
      {/* Contenedor Principal */}
      <div className="w-full max-w-md bg-[#101726] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        {/* Cabecera Institucional */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3">
            <Shield className="w-8 h-8 text-black fill-current" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">MSM-CRISIS</h1>
          <p className="text-xs font-bold text-amber-400 tracking-wider uppercase mt-0.5">
            Plan B Operativo • Gral. San Martín
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Plataforma municipal de coordinación en emergencias climáticas
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-500/80 text-red-200 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Usuario (formato nombre.apellido)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="ej: coord.general"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Contraseña</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-touch w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
          >
            <span>{loading ? 'Ingresando...' : 'Iniciar Sesión'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Accesos Rápidos de Prueba para Operadores */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center mb-2">
            Perfiles de Prueba Rápidos (clave: crisis2026):
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setQuickUser('coord.general')}
              className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left truncate font-mono text-[11px]"
            >
              coord.general
            </button>
            <button
              type="button"
              onClick={() => setQuickUser('defensa.civil')}
              className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left truncate font-mono text-[11px]"
            >
              defensa.civil
            </button>
            <button
              type="button"
              onClick={() => setQuickUser('parques.coord')}
              className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left truncate font-mono text-[11px]"
            >
              parques.coord
            </button>
            <button
              type="button"
              onClick={() => setQuickUser('parques.oper')}
              className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left truncate font-mono text-[11px]"
            >
              parques.oper
            </button>
            <button
              type="button"
              onClick={() => setQuickUser('higiene.oper')}
              className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left truncate font-mono text-[11px]"
            >
              higiene.oper
            </button>
            <button
              type="button"
              onClick={() => setQuickUser('admin.general')}
              className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left truncate font-mono text-[11px]"
            >
              admin.general
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
