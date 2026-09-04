import React, { useState } from 'react';
import { api } from '../api';
import { Task, TaskStatus } from '../types';
import { PriorityBadge } from '../components/PriorityBadge';
import { InactivityBadge } from '../components/InactivityBadge';
import { Modal } from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { usePolling } from '../hooks/usePolling';
import {
  CheckCircle2,
  Truck,
  Play,
  AlertTriangle,
  MapPin,
  CheckSquare,
  RotateCcw,
  Navigation,
} from 'lucide-react';

export const MisTareas: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  // Modales
  const [resolveTask, setResolveTask] = useState<Task | null>(null);
  const [resultNotes, setResultNotes] = useState('');
  const [impedimentTask, setImpedimentTask] = useState<Task | null>(null);
  const [impedimentReason, setImpedimentReason] = useState('');
  const [impedimentNextAction, setImpedimentNextAction] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTasks = async () => {
    try {
      const data = await api.getTasks({ my_tasks: true });
      setTasks(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar tareas asignadas');
    } finally {
      setLoading(false);
    }
  };

  usePolling(loadTasks, 20000, []);

  const handleQuickTransition = async (task: Task, targetStatus: TaskStatus) => {
    try {
      setSubmitting(true);
      await api.transitionTask(task.id, { status: targetStatus });
      toast.success(`Estado actualizado a ${targetStatus}`);
      await loadTasks();
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar estado');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveTask) return;
    if (!resultNotes.trim()) {
      toast.warning('Debe detallar el resultado de la tarea');
      return;
    }

    try {
      setSubmitting(true);
      await api.transitionTask(resolveTask.id, {
        status: 'RESUELTA',
        result_notes: resultNotes.trim(),
      });
      toast.success('Tarea resuelta con éxito');
      setResolveTask(null);
      setResultNotes('');
      await loadTasks();
    } catch (err: any) {
      toast.error(err.message || 'Error al resolver la tarea');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImpedimentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!impedimentTask) return;
    if (!impedimentReason.trim() || !impedimentNextAction.trim()) {
      toast.warning('Debe ingresar el motivo y la próxima acción requerida');
      return;
    }

    try {
      setSubmitting(true);
      await api.transitionTask(impedimentTask.id, {
        status: 'IMPEDIDA',
        impediment_reason: impedimentReason.trim(),
        impediment_next_action: impedimentNextAction.trim(),
      });
      toast.success('Impedimento registrado correctamente');
      setImpedimentTask(null);
      setImpedimentReason('');
      setImpedimentNextAction('');
      await loadTasks();
    } catch (err: any) {
      toast.error(err.message || 'Error al reportar impedimento');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-16">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-amber-400" />
            Mis Tareas Asignadas
          </h2>
          <p className="text-xs text-slate-400">
            Órdenes operativas nominales asignadas a tu cuadrilla
          </p>
        </div>
        <button
          onClick={loadTasks}
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

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Cargando tus tareas de campo...</div>
      ) : tasks.length === 0 ? (
        <div className="py-16 text-center bg-[#101726] rounded-2xl border border-slate-800 p-8">
          <CheckCircle2 className="w-12 h-12 text-emerald-400/60 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No tenés tareas activas pendientes</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Cuando el Coordinador de tu Área te asigne una orden operativa, aparecerá aquí con botones de acción rápida.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isImpeded = task.status === 'IMPEDIDA';
            const isAssigned = task.status === 'ASIGNADA' || task.status === 'CREADA';
            const isAccepted = task.status === 'ACEPTADA';
            const isDispatched = task.status === 'EN_DESPLAZAMIENTO';
            const isExecuting = task.status === 'EN_EJECUCION';
            const isResolved = task.status === 'RESUELTA';

            return (
              <div
                key={task.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  isImpeded
                    ? 'bg-red-950/20 border-red-500/60 shadow-lg shadow-red-950/30'
                    : task.priority === 'P1'
                    ? 'bg-[#12192b] border-red-500/40'
                    : 'bg-[#101726] border-slate-800'
                }`}
              >
                {/* Cabecera de la Tarjeta */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-amber-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                      {task.code}
                    </span>
                    <PriorityBadge priority={task.priority} size="sm" />
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded font-black uppercase tracking-wider ${
                        isImpeded
                          ? 'bg-red-500 text-white'
                          : isResolved
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : isExecuting
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>

                  <InactivityBadge lastActivityAt={task.last_activity_at} priority={task.priority} />
                </div>

                {/* Acción Operativa Requerida */}
                <h3 className="text-base sm:text-lg font-black text-white leading-snug mb-2">
                  {task.action}
                </h3>

                {/* Ubicación e Incidente Padre */}
                <div className="p-3 rounded-xl bg-[#0a0e1a] border border-slate-800/80 mb-3.5 space-y-1.5 text-xs">
                  <div className="flex items-start gap-2 text-slate-200">
                    <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span className="font-bold">{task.incident?.location_text || 'Ubicación a coordinar'}</span>
                  </div>
                  {task.incident && (
                    <div className="text-slate-400 pl-6 text-[11px]">
                      Incidente: <span className="font-semibold text-slate-300">{task.incident.code}</span> • {task.incident.title}
                    </div>
                  )}
                  {task.incident?.lat && task.incident?.lng && (
                    <div className="pl-6 pt-1">
                      <a
                        href={`https://maps.google.com/?q=${task.incident.lat},${task.incident.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-semibold"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Abrir en Navegador GPS
                      </a>
                    </div>
                  )}
                </div>

                {/* Alerta de Impedimento si la hubiera */}
                {isImpeded && (
                  <div className="mb-3.5 p-3 rounded-xl bg-red-950/60 border border-red-500/80 text-xs text-red-200 space-y-1">
                    <p className="font-black text-red-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      Impedimento Reportado:
                    </p>
                    <p>{task.impediment_reason}</p>
                    <p className="text-red-300/80 font-medium">Próxima acción: {task.impediment_next_action}</p>
                  </div>
                )}

                {/* Resultado si ya está resuelta */}
                {isResolved && (
                  <div className="mb-3.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/60 text-xs text-emerald-200">
                    <span className="font-bold">Resultado registrado:</span> {task.result_notes}
                    <p className="text-slate-400 text-[11px] mt-1">Pendiente de verificación por Coordinación</p>
                  </div>
                )}

                {/* Botones de Acción Táctil para Operadores */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Si está asignada -> Aceptar */}
                  {isAssigned && (
                    <button
                      onClick={() => handleQuickTransition(task, 'ACEPTADA')}
                      disabled={submitting}
                      className="btn-touch flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm shadow-md flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Aceptar Tarea
                    </button>
                  )}

                  {/* Si está aceptada -> En desplazamiento */}
                  {isAccepted && (
                    <button
                      onClick={() => handleQuickTransition(task, 'EN_DESPLAZAMIENTO')}
                      disabled={submitting}
                      className="btn-touch flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2"
                    >
                      <Truck className="w-5 h-5" />
                      En Camino
                    </button>
                  )}

                  {/* Si está en desplazamiento -> En ejecución */}
                  {isDispatched && (
                    <button
                      onClick={() => handleQuickTransition(task, 'EN_EJECUCION')}
                      disabled={submitting}
                      className="btn-touch flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2"
                    >
                      <Play className="w-5 h-5" />
                      En Ejecución
                    </button>
                  )}

                  {/* Si está en ejecución -> Resolver */}
                  {isExecuting && (
                    <button
                      onClick={() => {
                        setResolveTask(task);
                        setResultNotes('');
                      }}
                      className="btn-touch flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Resolver Tarea
                    </button>
                  )}

                  {/* Si está impedida -> Reanudar */}
                  {isImpeded && (
                    <button
                      onClick={() => handleQuickTransition(task, 'EN_EJECUCION')}
                      disabled={submitting}
                      className="btn-touch flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Reanudar Tarea
                    </button>
                  )}

                  {/* Reportar impedimento (disponible mientras no esté resuelta ni verificada) */}
                  {!isResolved && !isImpeded && (
                    <button
                      onClick={() => {
                        setImpedimentTask(task);
                        setImpedimentReason('');
                        setImpedimentNextAction('');
                      }}
                      className="btn-touch px-4 py-3 rounded-xl bg-slate-800 hover:bg-red-950/80 hover:border-red-500 border border-slate-700 text-slate-300 hover:text-red-300 font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      Impedimento
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Resolver Tarea */}
      <Modal
        isOpen={!!resolveTask}
        onClose={() => setResolveTask(null)}
        title={`Resolver Tarea ${resolveTask?.code}`}
        maxWidth="md"
      >
        <form onSubmit={handleResolveSubmit} className="space-y-4">
          <p className="text-xs text-slate-300">
            Ingrese el informe breve del trabajo realizado en campo para que Coordinación pueda verificarlo:
          </p>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Resultado / Detalle Operativo
            </label>
            <textarea
              rows={3}
              required
              placeholder="Ej: Árbol trozado y retirado hacia banquina. Cables levantados y zona señalizada."
              value={resultNotes}
              onChange={(e) => setResultNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-emerald-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setResolveTask(null)}
              className="btn-touch px-4 py-2 rounded-xl text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-touch px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md"
            >
              {submitting ? 'Guardando...' : 'Confirmar Resolución'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Reportar Impedimento */}
      <Modal
        isOpen={!!impedimentTask}
        onClose={() => setImpedimentTask(null)}
        title={`Reportar Impedimento en ${impedimentTask?.code}`}
        maxWidth="md"
      >
        <form onSubmit={handleImpedimentSubmit} className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-500/80 text-xs text-amber-200">
            Indique la causa que frena la tarea para coordinar apoyo adicional (Edenor, Grúa, Bomberos, etc.).
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Motivo del Impedimento</label>
            <input
              type="text"
              required
              placeholder="Ej: Tendido con tensión activa / Falta motosierra de porte mayor"
              value={impedimentReason}
              onChange={(e) => setImpedimentReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Próxima Acción Requerida</label>
            <input
              type="text"
              required
              placeholder="Ej: Se solicita corte de energía a Edenor vía Defensa Civil"
              value={impedimentNextAction}
              onChange={(e) => setImpedimentNextAction(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-red-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setImpedimentTask(null)}
              className="btn-touch px-4 py-2 rounded-xl text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-touch px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-md"
            >
              {submitting ? 'Reportando...' : 'Marcar Tarea Impedida'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
