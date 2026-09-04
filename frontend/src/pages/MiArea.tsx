import React, { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Task, User } from '../types';
import { PriorityBadge } from '../components/PriorityBadge';
import { InactivityBadge } from '../components/InactivityBadge';
import { useToast } from '../context/ToastContext';
import { usePolling } from '../hooks/usePolling';
import {
  FolderKanban,
  UserCheck,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Clock,
  ShieldAlert,
} from 'lucide-react';

export const MiArea: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'distribuir' | 'curso' | 'verificar'>('distribuir');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [areaUsers, setAreaUsers] = useState<User[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const isGeneralCoord =
    user?.role === 'COORDINACION' && user?.coordination_scope === 'GENERAL';
  const isAdmin = user?.role === 'ADMINISTRADOR';

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Parámetros según la pestaña
      const params: Record<string, string | boolean> = {};
      if (user?.area_id && !isGeneralCoord && !isAdmin) {
        params.area_id = user.area_id;
      }

      if (activeTab === 'distribuir') {
        params.for_distribution = true;
      } else if (activeTab === 'verificar') {
        params.for_verification = true;
      } else {
        // En curso
        params.status = ''; // Cargamos todas y filtramos en cliente
      }

      const [tasksData, usersData] = await Promise.all([
        api.getTasks(params),
        api.getAssignableUsers(user?.area_id || undefined),
      ]);

      if (activeTab === 'curso') {
        setTasks(
          tasksData.filter(
            (t) =>
              t.assignee_id !== null &&
              ['ASIGNADA', 'ACEPTADA', 'EN_DESPLAZAMIENTO', 'EN_EJECUCION', 'IMPEDIDA'].includes(
                t.status
              )
          )
        );
      } else {
        setTasks(tasksData);
      }

      setAreaUsers(usersData);
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos del área');
    } finally {
      setLoading(false);
    }
  };

  usePolling(loadData, 20000, [activeTab]);

  // Etapa 2: Asignar ejecutor nominal
  const handleAssign = async (taskId: string) => {
    const assigneeId = selectedAssignees[taskId];
    if (!assigneeId) {
      toast.warning('Debe seleccionar un operario o autoasignarse');
      return;
    }

    try {
      setActionLoading(taskId);
      await api.assignTask(taskId, assigneeId);
      toast.success('Ejecutor asignado exitosamente');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Error al asignar ejecutor');
    } finally {
      setActionLoading(null);
    }
  };

  // Verificación cruzada (con chequeo de autoasignación)
  const handleVerify = async (task: Task) => {
    const wasSelfAssigned = Boolean(
      task.area_coordinator_id &&
      task.assignee_id &&
      task.area_coordinator_id === task.assignee_id
    );

    if (wasSelfAssigned && !isGeneralCoord && !isAdmin) {
      toast.warning(
        'Regla Operativa: Esta tarea fue resuelta por el propio Coordinador de Área (autoasignación). Únicamente la Coordinación General puede verificarla.'
      );
      return;
    }

    try {
      setActionLoading(task.id);
      await api.verifyTask(task.id);
      toast.success('Tarea verificada correctamente');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Error al verificar tarea');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-16">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-amber-400" />
            Gestión Sectorial: {user?.area?.name || 'Todas las Áreas'}
          </h2>
          <p className="text-xs text-slate-400">
            Distribución nominal de cuadrillas y verificación cruzada de resultados
          </p>
        </div>
        <button
          onClick={loadData}
          className="btn-touch px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
        >
          Actualizar
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Pestañas Operativas de Coordinación */}
      <div className="flex border-b border-slate-800 space-x-1">
        <button
          onClick={() => setActiveTab('distribuir')}
          className={`btn-touch px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'distribuir'
              ? 'border-amber-500 text-amber-400 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Por Distribuir</span>
          {activeTab === 'distribuir' && tasks.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black">
              {tasks.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('curso')}
          className={`btn-touch px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'curso'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>En Curso</span>
        </button>

        <button
          onClick={() => setActiveTab('verificar')}
          className={`btn-touch px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'verificar'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Por Verificar</span>
          {activeTab === 'verificar' && tasks.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-black">
              {tasks.length}
            </span>
          )}
        </button>
      </div>

      {/* Contenido de Tareas */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Cargando tareas del área...</div>
      ) : tasks.length === 0 ? (
        <div className="py-16 text-center bg-[#101726] rounded-2xl border border-slate-800 p-8">
          <CheckCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">
            {activeTab === 'distribuir'
              ? 'No hay tareas pendientes de distribución'
              : activeTab === 'verificar'
              ? 'No hay tareas resueltas pendientes de verificación'
              : 'No hay tareas activas en curso en este momento'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">El estado de la dependencia está al día.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const wasSelfAssigned = Boolean(
              task.area_coordinator_id &&
              task.assignee_id &&
              task.area_coordinator_id === task.assignee_id
            );

            return (
              <div
                key={task.id}
                className="p-4 sm:p-5 rounded-2xl bg-[#101726] border border-slate-800 space-y-3"
              >
                {/* Cabecera */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-amber-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                      {task.code}
                    </span>
                    <PriorityBadge priority={task.priority} size="sm" />
                    <span className="text-xs font-semibold text-slate-400">
                      Área: {task.area?.code}
                    </span>
                  </div>
                  <InactivityBadge lastActivityAt={task.last_activity_at} priority={task.priority} />
                </div>

                {/* Acción y Lugar */}
                <div>
                  <h4 className="text-base font-black text-white">{task.action}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span>{task.incident?.location_text}</span>
                    <span className="text-slate-600">•</span>
                    <span>Incidente {task.incident?.code}</span>
                  </div>
                </div>

                {/* Impedimento */}
                {task.status === 'IMPEDIDA' && (
                  <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/80 text-xs text-red-200">
                    <p className="font-bold flex items-center gap-1 text-red-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      Impedimento: {task.impediment_reason}
                    </p>
                    <p className="mt-0.5">Próxima acción: {task.impediment_next_action}</p>
                  </div>
                )}

                {/* Resultado */}
                {task.status === 'RESUELTA' && (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/60 text-xs text-emerald-200">
                    <p className="font-bold">Resultado informado por cuadrilla:</p>
                    <p className="mt-0.5">{task.result_notes}</p>
                    {task.assignee && (
                      <p className="text-slate-400 text-[11px] mt-1">
                        Resuelto por: {task.assignee.name}
                      </p>
                    )}
                  </div>
                )}

                {/* Pie de Acción según pestaña */}
                {activeTab === 'distribuir' && (
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <select
                        value={selectedAssignees[task.id] || ''}
                        onChange={(e) =>
                          setSelectedAssignees({ ...selectedAssignees, [task.id]: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold outline-none focus:border-amber-500"
                      >
                        <option value="">-- Seleccionar ejecutor nominal --</option>
                        {user && (
                          <option value={user.id} className="text-amber-400 font-bold">
                            ★ Autoasignarme a mí mismo ({user.name})
                          </option>
                        )}
                        {areaUsers
                          .filter((u) => u.id !== user?.id)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.username})
                            </option>
                          ))}
                      </select>
                    </div>
                    <button
                      onClick={() => handleAssign(task.id)}
                      disabled={actionLoading === task.id || !selectedAssignees[task.id]}
                      className="btn-touch px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shadow-md flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <UserCheck className="w-4 h-4" />
                      {actionLoading === task.id ? 'Asignando...' : 'Asignar a Cuadrilla'}
                    </button>
                  </div>
                )}

                {activeTab === 'curso' && (
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400">
                    <div>
                      <span>Ejecutor: </span>
                      <span className="font-bold text-white">
                        {task.assignee ? task.assignee.name : 'Sin asignar'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-800 font-bold text-slate-300 uppercase">
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                )}

                {activeTab === 'verificar' && (
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      {wasSelfAssigned ? (
                        <div className="flex items-center gap-1 text-xs text-amber-400 font-bold bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-500/40">
                          <ShieldAlert className="w-4 h-4 text-amber-400" />
                          <span>Autoasignada por Coord. de Área (Requiere verificación de Coord. General)</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Listo para verificación final
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleVerify(task)}
                      disabled={
                        actionLoading === task.id ||
                        (wasSelfAssigned && !isGeneralCoord && !isAdmin)
                      }
                      className={`btn-touch px-5 py-2 rounded-xl font-extrabold text-xs shadow-md flex items-center gap-1.5 disabled:opacity-40 ${
                        wasSelfAssigned && !isGeneralCoord && !isAdmin
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      {actionLoading === task.id ? 'Verificando...' : 'Verificar Tarea'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
