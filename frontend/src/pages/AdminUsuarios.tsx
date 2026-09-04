import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { User, Area, UserRole, CoordinationScope } from '../types';
import { Modal } from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { Users, UserPlus, KeyRound, Check, X, Shield, ShieldCheck } from 'lucide-react';

export const AdminUsuarios: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Formulario de creación
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    password: '',
    role: 'OPERACION' as UserRole,
    coordination_scope: '' as '' | CoordinationScope,
    area_id: '',
    can_triage: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const loadUsersAndAreas = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, areasData] = await Promise.all([api.getUsers(), api.getAreas()]);
      setUsers(usersData);
      setAreas(areasData);
      if (areasData.length > 0 && !formData.area_id) {
        setFormData((prev) => ({ ...prev, area_id: areasData[0].id }));
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar usuarios y áreas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsersAndAreas();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password || !formData.name.trim()) {
      toast.warning('Todos los campos obligatorios deben ser completados');
      return;
    }

    if (!formData.username.includes('.')) {
      toast.warning('El nombre de usuario debe seguir estrictamente el formato nombre.apellido (sin correos)');
      return;
    }

    try {
      setSubmitting(true);
      await api.createUser({
        ...formData,
        coordination_scope: formData.coordination_scope || null,
        area_id: formData.area_id || null,
      });
      toast.success(`Usuario ${formData.username} creado exitosamente`);
      setShowCreateModal(false);
      setFormData({
        username: '',
        name: '',
        password: '',
        role: 'OPERACION',
        coordination_scope: '',
        area_id: areas[0]?.id || '',
        can_triage: false,
      });
      await loadUsersAndAreas();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear usuario');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser || !newPassword.trim()) return;

    try {
      setSubmitting(true);
      await api.updateUser(resetUser.id, { password: newPassword.trim() });
      toast.success(`Contraseña actualizada con éxito para ${resetUser.username}`);
      setResetUser(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Error al restablecer contraseña');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await api.updateUser(user.id, { active: !user.active });
      toast.success(`Usuario ${user.username} ${user.active ? 'desactivado' : 'activado'} correctamente`);
      await loadUsersAndAreas();
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar estado');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            Administración de Usuarios y Cuentas
          </h2>
          <p className="text-xs text-slate-400">
            Control de altas, roles, áreas y reseteo directo de contraseñas (sin emails)
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-touch px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-lg shadow-purple-600/20 flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Nuevo Usuario</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Tabla de Usuarios */}
      <div className="bg-[#101726] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#0a0e1a] text-slate-400 uppercase font-black">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Nombre Completo</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Área Asignada</th>
                <th className="px-4 py-3 text-center">Triage P1-P4</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-mono font-bold text-amber-400">
                    {u.username}
                  </td>
                  <td className="px-4 py-3 font-bold text-white">{u.name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold uppercase text-[10px]">
                      {u.role} {u.coordination_scope ? `(${u.coordination_scope})` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {u.area?.name || <span className="text-slate-500">Sin área</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.can_triage ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[10px] bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        <ShieldCheck className="w-3 h-3" /> Habilitado
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleActive(u)}
                      className={`px-2 py-0.5 rounded font-black text-[10px] uppercase transition-colors ${
                        u.active
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-red-500/20 hover:text-red-400'
                          : 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-emerald-500/20 hover:text-emerald-400'
                      }`}
                    >
                      {u.active ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setResetUser(u);
                        setNewPassword('');
                      }}
                      className="btn-touch px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold inline-flex items-center gap-1"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>Reset Clave</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo Usuario */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Crear Nuevo Usuario Municipal"
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Nombre de Usuario (formato estricto nombre.apellido)
            </label>
            <input
              type="text"
              required
              placeholder="ej: juan.perez"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-purple-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Nombre y Apellido Completo
            </label>
            <input
              type="text"
              required
              placeholder="ej: Juan Pérez"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Contraseña Inicial
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Rol</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-purple-500"
              >
                <option value="OPERACION">OPERACIÓN (Cuadrilla)</option>
                <option value="COORDINACION">COORDINACIÓN</option>
                <option value="CONSULTA">CONSULTA (Observatorio)</option>
                <option value="ADMINISTRADOR">ADMINISTRADOR</option>
              </select>
            </div>

            {formData.role === 'COORDINACION' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Alcance</label>
                <select
                  value={formData.coordination_scope}
                  onChange={(e) =>
                    setFormData({ ...formData, coordination_scope: e.target.value as CoordinationScope })
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-purple-500"
                >
                  <option value="AREA">Área Específica</option>
                  <option value="GENERAL">General (Crisis Municipal)</option>
                </select>
              </div>
            )}
          </div>

          {formData.role !== 'ADMINISTRADOR' && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Área Municipal de Pertenencia
              </label>
              <select
                value={formData.area_id}
                onChange={(e) => setFormData({ ...formData, area_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-purple-500"
              >
                <option value="">-- Sin Área (General) --</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.role === 'COORDINACION' && (
            <label className="flex items-center gap-2 text-xs text-amber-400 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={formData.can_triage}
                onChange={(e) => setFormData({ ...formData, can_triage: e.target.checked })}
                className="rounded bg-slate-900 border-slate-700 text-amber-500"
              />
              <span>Autorización nominal para Triage P1 a P4 (Defensa Civil)</span>
            </label>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="btn-touch px-4 py-2 rounded-xl text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-touch px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-md"
            >
              {submitting ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Reseteo Directo de Clave */}
      <Modal
        isOpen={!!resetUser}
        onClose={() => setResetUser(null)}
        title={`Restablecer Contraseña: ${resetUser?.username}`}
        maxWidth="sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-xs text-slate-300">
            Ingrese la nueva clave para el usuario. Se actualizará inmediatamente sin requerir correo:
          </p>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Nueva Contraseña</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setResetUser(null)}
              className="btn-touch px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-touch px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md"
            >
              {submitting ? 'Guardando...' : 'Guardar Nueva Clave'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
