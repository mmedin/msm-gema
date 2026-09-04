import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Incident, Notice, Priority } from '../types';
import { PriorityBadge } from '../components/PriorityBadge';
import { InactivityBadge } from '../components/InactivityBadge';
import { NoticeModal } from '../components/NoticeModal';
import { LinkNoticeModal } from '../components/LinkNoticeModal';
import { NewTaskModal } from '../components/NewTaskModal';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';
import { usePolling } from '../hooks/usePolling';
import {
  AlertOctagon,
  PlusCircle,
  Link2,
  CheckCircle2,
  Trash2,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Image as ImageIcon,
  Check,
} from 'lucide-react';

export const IncidentesAvisos: React.FC = () => {
  const { activeEvent, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'incidentes' | 'avisos'>('incidentes');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [prioFilter, setPrioFilter] = useState<string>('TODOS');
  const [statusFilter, setStatusFilter] = useState<string>('ABIERTOS');
  const [loading, setLoading] = useState(true);

  // Modales
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [linkNotice, setLinkNotice] = useState<Notice | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Operaciones de Triage y Cierre
  const [triagePrio, setTriagePrio] = useState<Priority>('P2');
  const [closingIncident, setClosingIncident] = useState(false);
  const [closeWarning, setCloseWarning] = useState<string | null>(null);
  const [discardNoticeTarget, setDiscardNoticeTarget] = useState<Notice | null>(null);
  const [discarding, setDiscarding] = useState(false);

  const toast = useToast();
  const canTriage = !!user?.can_triage;
  const isGeneralCoordOrAdmin =
    (user?.role === 'COORDINACION' && user?.coordination_scope === 'GENERAL') ||
    user?.role === 'ADMINISTRADOR';

  const loadData = async () => {
    try {
      setLoading(true);
      const [incidentsData, noticesData] = await Promise.all([
        api.getIncidents({ event_id: activeEvent?.id }),
        api.getNotices({ event_id: activeEvent?.id }),
      ]);
      setIncidents(incidentsData);
      setNotices(noticesData);

      // Si hay un incidente seleccionado, actualizar su detalle
      if (selectedIncident) {
        const fresh = await api.getIncidentById(selectedIncident.id);
        setSelectedIncident(fresh);
      }
    } catch (err) {
      console.error('Error al cargar datos:', err);
    } finally {
      setLoading(false);
    }
  };

  usePolling(loadData, 20000, [activeEvent?.id]);

  // Convertir aviso directamente a nuevo incidente
  const handleConvertNotice = async (noticeId: string) => {
    try {
      await api.convertNotice(noticeId, {});
      toast.success('Aviso convertido a nuevo incidente correctamente');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Error al convertir aviso a incidente');
    }
  };

  // Confirmar y descartar aviso
  const handleConfirmDiscard = async () => {
    if (!discardNoticeTarget) return;
    try {
      setDiscarding(true);
      await api.discardNotice(discardNoticeTarget.id);
      toast.success('Aviso descartado');
      setDiscardNoticeTarget(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Error al descartar aviso');
    } finally {
      setDiscarding(false);
    }
  };

  // Triage de incidente
  const handleTriageSubmit = async (prio: Priority) => {
    if (!selectedIncident || !canTriage) return;
    try {
      const updated = await api.triageIncident(selectedIncident.id, prio);
      setSelectedIncident({ ...selectedIncident, priority: updated.priority, status: updated.status });
      toast.success(`Incidente clasificado con prioridad ${prio}`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Error al clasificar prioridad');
    }
  };

  // Resolver / Cerrar incidente
  const handleCloseIncident = async (newStatus: 'RESUELTO' | 'CERRADO', force: boolean = false) => {
    if (!selectedIncident) return;
    try {
      setClosingIncident(true);
      setCloseWarning(null);
      await api.updateIncidentStatus(selectedIncident.id, {
        status: newStatus,
        force,
      });
      toast.success(`Incidente ${newStatus === 'RESUELTO' ? 'resuelto' : 'cerrado'} exitosamente`);
      await loadData();
      setSelectedIncident(null);
    } catch (err: any) {
      if (err.status === 409 && err.data?.requiresConfirmation) {
        setCloseWarning(
          `Atención: Quedan ${err.data.openTasksCount} tarea(s) pendientes de resolución o verificación en este incidente. ¿Desea forzar el cierre de todas maneras?`
        );
      } else {
        toast.error(err.message || 'Error al cambiar estado del incidente');
      }
    } finally {
      setClosingIncident(false);
    }
  };

  // Filtrado de incidentes
  const filteredIncidents = incidents.filter((inc) => {
    if (prioFilter !== 'TODOS' && inc.priority !== prioFilter) return false;
    if (statusFilter === 'ABIERTOS' && (inc.status === 'RESUELTO' || inc.status === 'CERRADO')) return false;
    if (statusFilter === 'CERRADOS' && inc.status !== 'RESUELTO' && inc.status !== 'CERRADO') return false;
    return true;
  });

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-16">
      {/* Barra de Encabezado y Acción Principal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <AlertOctagon className="w-6 h-6 text-amber-400" />
            Incidentes y Avisos
          </h2>
          <p className="text-xs text-slate-400">
            Registro, triage P1-P4, deduplicación y derivación a áreas
          </p>
        </div>

        <button
          onClick={() => setShowNoticeModal(true)}
          className="btn-touch px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Registrar Aviso</span>
        </button>
      </div>

      {/* Selector de Pestaña: Incidentes / Avisos */}
      <div className="flex border-b border-slate-800 space-x-1">
        <button
          onClick={() => setActiveTab('incidentes')}
          className={`btn-touch px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'incidentes'
              ? 'border-amber-500 text-amber-400 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Incidentes Operativos ({incidents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('avisos')}
          className={`btn-touch px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'avisos'
              ? 'border-amber-500 text-amber-400 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Avisos Recibidos ({notices.length})</span>
          {notices.filter((n) => n.status === 'RECIBIDO').length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black">
              {notices.filter((n) => n.status === 'RECIBIDO').length} nuevos
            </span>
          )}
        </button>
      </div>

      {/* PESTAÑA 1: INCIDENTES */}
      {activeTab === 'incidentes' && (
        <div className="space-y-3">
          {/* Filtros rápidos de Incidentes */}
          <div className="flex flex-wrap items-center gap-2 bg-[#0c121f] p-2 rounded-xl border border-slate-800/80 text-xs">
            <span className="text-slate-400 font-bold px-2">Prioridad:</span>
            {['TODOS', 'P1', 'P2', 'P3', 'P4'].map((p) => (
              <button
                key={p}
                onClick={() => setPrioFilter(p)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  prioFilter === p
                    ? 'bg-amber-500 text-black'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}

            <div className="h-4 w-px bg-slate-800 mx-1"></div>

            <span className="text-slate-400 font-bold px-2">Estado:</span>
            {['ABIERTOS', 'CERRADOS', 'TODOS'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  statusFilter === s
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Listado de Incidentes */}
          {loading && incidents.length === 0 ? (
            <div className="py-12 text-center text-slate-400">Cargando incidentes...</div>
          ) : filteredIncidents.length === 0 ? (
            <div className="py-12 text-center bg-[#101726] rounded-2xl border border-slate-800 p-8">
              <CheckCircle2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-white">No hay incidentes con los filtros seleccionados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredIncidents.map((inc) => (
                <div
                  key={inc.id}
                  onClick={async () => {
                    const full = await api.getIncidentById(inc.id);
                    setSelectedIncident(full);
                  }}
                  className="p-4 rounded-2xl bg-[#101726] border border-slate-800 hover:border-amber-500/70 cursor-pointer transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-amber-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                        {inc.code}
                      </span>
                      <PriorityBadge priority={inc.priority} size="sm" />
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                        {inc.status}
                      </span>
                    </div>
                    <InactivityBadge lastActivityAt={inc.last_activity_at} priority={inc.priority} />
                  </div>

                  <h3 className="text-base font-black text-white line-clamp-1">{inc.title}</h3>

                  <div className="flex items-start gap-1.5 text-xs text-slate-300">
                    <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span className="truncate">{inc.location_text}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <div>
                      <span>Tareas: <strong className="text-white">{inc._count?.tasks ?? 0}</strong></span>
                      <span className="mx-2">•</span>
                      <span>Avisos: <strong className="text-white">{inc._count?.notices ?? 0}</strong></span>
                    </div>
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      Ver detalle <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: AVISOS RECIBIDOS */}
      {activeTab === 'avisos' && (
        <div className="space-y-3">
          {loading && notices.length === 0 ? (
            <div className="py-12 text-center text-slate-400">Cargando avisos...</div>
          ) : notices.length === 0 ? (
            <div className="py-12 text-center bg-[#101726] rounded-2xl border border-slate-800 p-8">
              <p className="text-sm font-bold text-white">No hay avisos registrados en este evento</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map((n) => {
                const isReceived = n.status === 'RECIBIDO';
                return (
                  <div
                    key={n.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isReceived ? 'bg-[#12192b] border-amber-500/40' : 'bg-[#101726] border-slate-800 opacity-80'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-800 text-amber-400 uppercase">
                          {n.channel}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">Fuente: {n.source}</span>
                        {n.life_risk === 'SI' && (
                          <span className="text-xs font-black px-2 py-0.5 rounded bg-red-600/30 text-red-400 border border-red-500">
                            Riesgo de Vida
                          </span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                            n.status === 'RECIBIDO'
                              ? 'bg-amber-500 text-black'
                              : n.status === 'CONVERTIDO'
                              ? 'bg-blue-600/30 text-blue-300'
                              : n.status === 'VINCULADO'
                              ? 'bg-emerald-600/30 text-emerald-300'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {n.status}
                        </span>
                      </div>

                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(n.received_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-white mb-2">{n.description}</p>

                    <div className="flex items-center gap-1.5 text-xs text-slate-300 mb-3">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      <span>{n.location_text}</span>
                      {n.location_pending && (
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-950 px-1.5 py-0.5 rounded">
                          Ubicación pendiente
                        </span>
                      )}
                    </div>

                    {/* Foto si existe */}
                    {n.evidence_filename && (
                      <div className="mb-3">
                        <button
                          type="button"
                          onClick={() => setImagePreviewUrl(`/uploads/${n.evidence_filename}`)}
                          className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"
                        >
                          <ImageIcon className="w-4 h-4" />
                          Ver foto de evidencia adjunta
                        </button>
                      </div>
                    )}

                    {/* Incidente vinculado si ya fue procesado */}
                    {n.incident && (
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center justify-between mb-2">
                        <span>
                          Vinculado a Incidente:{' '}
                          <strong className="text-amber-400">{n.incident.code}</strong> - {n.incident.title}
                        </span>
                        <PriorityBadge priority={n.incident.priority} size="sm" />
                      </div>
                    )}

                    {/* Acciones para avisos nuevos */}
                    {isReceived && (
                      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleConvertNotice(n.id)}
                          className="btn-touch px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow"
                        >
                          Crear nuevo incidente
                        </button>
                        <button
                          onClick={() => setLinkNotice(n)}
                          className="btn-touch px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow flex items-center gap-1"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          Vincular a incidente existente
                        </button>
                        <button
                          onClick={() => setDiscardNoticeTarget(n)}
                          title="Descartar aviso"
                          className="btn-touch px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 text-xs font-semibold ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Ficha Completa de Incidente */}
      <Modal
        isOpen={!!selectedIncident}
        onClose={() => {
          setSelectedIncident(null);
          setCloseWarning(null);
        }}
        title={`Incidente: ${selectedIncident?.code || ''}`}
        maxWidth="xl"
      >
        {selectedIncident && (
          <div className="space-y-4">
            {/* Cabecera del Incidente */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={selectedIncident.priority} size="md" />
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-white font-bold uppercase">
                    {selectedIncident.status}
                  </span>
                </div>
                <InactivityBadge
                  lastActivityAt={selectedIncident.last_activity_at}
                  priority={selectedIncident.priority}
                />
              </div>

              <h3 className="text-lg font-black text-white leading-snug">
                {selectedIncident.title}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed bg-[#0a0e1a] p-3 rounded-xl border border-slate-800">
                {selectedIncident.description}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="font-bold">{selectedIncident.location_text}</span>
              </div>
            </div>

            {/* SECCIÓN DE TRIAGE P1 a P4 (Defensa Civil / can_triage) */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Clasificación de Prioridad (Triage Defensa Civil)
                </span>
                {selectedIncident.triage_by && (
                  <span className="text-[11px] text-slate-400">
                    Clasificado por {selectedIncident.triage_by.name}
                  </span>
                )}
              </div>

              {canTriage ? (
                <div className="grid grid-cols-4 gap-2">
                  {(['P1', 'P2', 'P3', 'P4'] as Priority[]).map((p) => {
                    const isSelected = selectedIncident.priority === p;
                    const colors = {
                      P1: isSelected ? 'bg-red-600 text-white border-red-400' : 'bg-slate-800 text-red-400 border-slate-700',
                      P2: isSelected ? 'bg-orange-600 text-white border-orange-400' : 'bg-slate-800 text-orange-400 border-slate-700',
                      P3: isSelected ? 'bg-yellow-500 text-black border-yellow-300 font-black' : 'bg-slate-800 text-yellow-400 border-slate-700',
                      P4: isSelected ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800 text-emerald-400 border-slate-700',
                    }[p];
                    return (
                      <button
                        key={p}
                        onClick={() => handleTriageSubmit(p)}
                        className={`btn-touch py-2 rounded-lg font-black text-xs border transition-all ${colors}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Solo personal de Coordinación autorizado nominalmente (Defensa Civil) puede modificar la prioridad.
                </p>
              )}
            </div>

            {/* SECCIÓN DE TAREAS DERIVADAS (Etapa 1 & 2) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">
                  Tareas Derivadas a Dependencias ({selectedIncident.tasks?.length || 0})
                </span>
                {isGeneralCoordOrAdmin && (
                  <button
                    onClick={() => setShowNewTaskModal(true)}
                    className="btn-touch px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1 shadow"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    + Derivar Tarea a Área
                  </button>
                )}
              </div>

              {selectedIncident.tasks && selectedIncident.tasks.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedIncident.tasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-amber-400">{t.code}</span>
                          <span className="font-bold text-slate-200">{t.area?.name}</span>
                          <PriorityBadge priority={t.priority} size="sm" />
                        </div>
                        <p className="text-slate-300 truncate mt-0.5">{t.action}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase flex-shrink-0">
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-2">No hay tareas derivadas aún para este incidente.</p>
              )}
            </div>

            {/* SECCIÓN DE AVISOS ASOCIADOS */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-200">
                Avisos Vecinales Vinculados ({selectedIncident.notices?.length || 0})
              </span>
              {selectedIncident.notices && selectedIncident.notices.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedIncident.notices.map((n) => (
                    <div
                      key={n.id}
                      className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{n.description}</span>
                      <span className="text-slate-500 text-[11px] flex-shrink-0">{n.channel}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-1">No hay avisos directos vinculados.</p>
              )}
            </div>

            {/* ALERTA DE CIERRE CON TAREAS ABIERTAS */}
            {closeWarning && (
              <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500 text-amber-200 text-xs space-y-2">
                <p className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  {closeWarning}
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setCloseWarning(null)}
                    className="btn-touch px-3 py-1 rounded bg-slate-800 text-slate-300 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleCloseIncident('CERRADO', true)}
                    className="btn-touch px-3 py-1 rounded bg-red-600 text-white font-bold text-xs"
                  >
                    Forzar Cierre de Incidente
                  </button>
                </div>
              </div>
            )}

            {/* BOTONES DE RESOLUCIÓN Y CIERRE (Solo Coordinador General o Admin) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                {isGeneralCoordOrAdmin && selectedIncident.status !== 'CERRADO' && (
                  <>
                    <button
                      onClick={() => handleCloseIncident('RESUELTO')}
                      disabled={closingIncident}
                      className="btn-touch px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      Resolver Incidente
                    </button>
                    <button
                      onClick={() => handleCloseIncident('CERRADO')}
                      disabled={closingIncident}
                      className="btn-touch px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
                    >
                      Cerrar Incidente
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => setSelectedIncident(null)}
                className="btn-touch px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium ml-auto"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Registrar Nuevo Aviso */}
      <NoticeModal
        isOpen={showNoticeModal}
        onClose={() => setShowNoticeModal(false)}
        onSuccess={loadData}
      />

      {/* Modal Vincular Aviso a Incidente */}
      <LinkNoticeModal
        notice={linkNotice}
        isOpen={!!linkNotice}
        onClose={() => setLinkNotice(null)}
        onSuccess={loadData}
      />

      {/* Modal Derivar Tarea (Etapa 1) */}
      {selectedIncident && (
        <NewTaskModal
          incidentId={selectedIncident.id}
          defaultPriority={selectedIncident.priority}
          isOpen={showNewTaskModal}
          onClose={() => setShowNewTaskModal(false)}
          onSuccess={async () => {
            const fresh = await api.getIncidentById(selectedIncident.id);
            setSelectedIncident(fresh);
            await loadData();
          }}
        />
      )}

      {/* Modal Preview de Foto */}
      <Modal
        isOpen={!!imagePreviewUrl}
        onClose={() => setImagePreviewUrl(null)}
        title="Foto de Evidencia"
        maxWidth="lg"
      >
        {imagePreviewUrl && (
          <div className="space-y-3">
            <img
              src={imagePreviewUrl}
              alt="Evidencia fotográfica"
              className="w-full h-auto rounded-xl object-contain max-h-[70vh] bg-black border border-slate-800"
            />
            <div className="flex justify-end">
              <button
                onClick={() => setImagePreviewUrl(null)}
                className="btn-touch px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Confirmación para Descartar Aviso */}
      <ConfirmModal
        isOpen={!!discardNoticeTarget}
        title="Descartar Aviso Operativo"
        message={`¿Confirma que desea descartar el aviso en "${discardNoticeTarget?.location_text || ''}"? Este aviso quedará desestimado del registro activo.`}
        confirmText="Descartar Aviso"
        cancelText="Cancelar"
        variant="danger"
        loading={discarding}
        onConfirm={handleConfirmDiscard}
        onCancel={() => setDiscardNoticeTarget(null)}
      />
    </div>
  );
};
