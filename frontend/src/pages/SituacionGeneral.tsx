import React, { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { DashboardStats } from '../types';
import { PriorityBadge } from '../components/PriorityBadge';
import { useToast } from '../context/ToastContext';
import { usePolling } from '../hooks/usePolling';
import {
  LayoutDashboard,
  Printer,
  Download,
  AlertTriangle,
  Clock,
  Home,
  CheckCircle,
  Activity,
  Layers,
  Building2,
} from 'lucide-react';

export const SituacionGeneral: React.FC = () => {
  const { activeEvent } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const loadStats = async () => {
    try {
      const data = await api.getDashboardStats(activeEvent?.id);
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al obtener métricas');
    } finally {
      setLoading(false);
    }
  };

  usePolling(loadStats, 20000, [activeEvent?.id]);

  // Exportar JSON completo del snapshot
  const handleDownloadSnapshot = async () => {
    try {
      setDownloading(true);
      const snapshot = await api.getDashboardSnapshot(activeEvent?.id);
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `corte-situacion-${activeEvent?.code || 'msm'}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Snapshot de situación descargado correctamente');
    } catch (err: any) {
      toast.error('Error al descargar JSON: ' + (err.message || 'Error desconocido'));
    } finally {
      setDownloading(false);
    }
  };

  // Imprimir Corte de Situación
  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="py-16 text-center text-slate-400">Cargando tablero operativo de crisis...</div>;
  }

  if (!stats) {
    return <div className="py-16 text-center text-slate-400">No hay datos de crisis disponibles</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Encabezado Ocultable en Impresión */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 no-print">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-amber-400" />
            Tablero de Situación General
          </h2>
          <p className="text-xs text-slate-400">
            Municipalidad de General San Martín • Centro de Operaciones de Emergencia (COE)
          </p>
        </div>

        {/* Botones de Exportación e Impresión */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDownloadSnapshot}
            disabled={downloading}
            className="btn-touch px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 border border-slate-700"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>{downloading ? 'Descargando...' : 'Descargar JSON'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="btn-touch px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Corte de Situación</span>
          </button>
        </div>
      </div>

      {/* Cabecera Oficial para Impresión (@media print) */}
      <div className="hidden print:block mb-6 border-b-2 border-black pb-3 print-only">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-black">
              CORTE OPERATIVO DE SITUACIÓN
            </h1>
            <p className="text-sm font-bold text-gray-700">Municipalidad de General San Martín</p>
            <p className="text-xs text-gray-600">GEMA • Gestión de Eventos Meteorológicos Adversos</p>
          </div>
          <div className="text-right text-xs text-gray-800 font-mono">
            <p><strong>Evento:</strong> {stats.event.code} - {stats.event.description}</p>
            <p><strong>Fase:</strong> {stats.event.status} | <strong>Alerta SMN:</strong> {stats.event.smn_alert}</p>
            <p><strong>Fecha/Hora emisión:</strong> {new Date(stats.generatedAt).toLocaleString('es-AR')}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Tarjetas KPI Superiores */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* P1 Críticos */}
        <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/60 print-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-red-400 uppercase tracking-wide">P1 Críticos</span>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse no-print"></span>
          </div>
          <div className="text-3xl font-black text-white mt-1.5 print-text-dark">
            {stats.metrics.activeP1Count}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Incidentes activos</p>
        </div>

        {/* P2 Altos */}
        <div className="p-4 rounded-2xl bg-orange-950/30 border border-orange-500/60 print-card">
          <span className="text-xs font-black text-orange-400 uppercase tracking-wide">P2 Altos</span>
          <div className="text-3xl font-black text-white mt-1.5 print-text-dark">
            {stats.metrics.activeP2Count}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Incidentes activos</p>
        </div>

        {/* Tareas Impedidas */}
        <div className="p-4 rounded-2xl bg-[#101726] border border-amber-500/60 print-card">
          <span className="text-xs font-black text-amber-400 uppercase tracking-wide">Impedidas</span>
          <div className="text-3xl font-black text-white mt-1.5 print-text-dark">
            {stats.metrics.impededTasksCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Tareas con freno</p>
        </div>

        {/* Tareas Sin Asignar */}
        <div className="p-4 rounded-2xl bg-[#101726] border border-slate-800 print-card">
          <span className="text-xs font-black text-slate-300 uppercase tracking-wide">Por Distribuir</span>
          <div className="text-3xl font-black text-white mt-1.5 print-text-dark">
            {stats.metrics.unassignedTasksCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Sin cuadrilla</p>
        </div>

        {/* Ocupación de Refugios */}
        <div className="p-4 rounded-2xl bg-[#101726] border border-emerald-500/60 print-card">
          <span className="text-xs font-black text-emerald-400 uppercase tracking-wide">Evacuados</span>
          <div className="text-3xl font-black text-white mt-1.5 print-text-dark">
            {stats.evacuation.totalOccupied}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            de {stats.evacuation.totalCapacity} ({stats.evacuation.percentage}%)
          </p>
        </div>

        {/* Inactividad Crítica */}
        <div
          className={`p-4 rounded-2xl border print-card ${
            stats.inactivityAlerts.criticalCount > 0
              ? 'bg-red-950/40 border-red-500 animate-pulse'
              : 'bg-[#101726] border-slate-800'
          }`}
        >
          <span className="text-xs font-black text-red-400 uppercase tracking-wide">Demoradas</span>
          <div className="text-3xl font-black text-white mt-1.5 print-text-dark">
            {stats.inactivityAlerts.criticalCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">&gt;30m sin actividad</p>
        </div>
      </div>

      {/* Alerta si hay Tareas o Incidentes con Demora Crítica */}
      {stats.inactivityAlerts.criticalCount > 0 && (
        <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/80 space-y-2 print-card">
          <h3 className="text-sm font-black text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Alerta de Semáforo Operativo: Casos P1/P2 con más de 30 minutos sin movimiento
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {stats.inactivityAlerts.inactiveP1P2Incidents.map((inc) => (
              <div
                key={inc.id}
                className="p-2 rounded-lg bg-black/40 border border-red-900 flex items-center justify-between gap-2"
              >
                <div className="truncate">
                  <span className="font-mono font-bold text-red-400 mr-1">{inc.code}</span>
                  <span className="text-slate-200">{inc.title}</span>
                </div>
                <PriorityBadge priority={inc.priority} size="sm" />
              </div>
            ))}
            {stats.inactivityAlerts.inactiveP1P2Tasks.map((t) => (
              <div
                key={t.id}
                className="p-2 rounded-lg bg-black/40 border border-red-900 flex items-center justify-between gap-2"
              >
                <div className="truncate">
                  <span className="font-mono font-bold text-red-400 mr-1">{t.code}</span>
                  <span className="text-slate-200">{t.action}</span>
                </div>
                <PriorityBadge priority={t.priority} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desglose Operativo por Área Sectorial */}
      <div className="bg-[#101726] border border-slate-800 rounded-2xl p-5 print-card">
        <h3 className="text-base font-black text-white mb-3 flex items-center gap-2 print-text-dark">
          <Building2 className="w-5 h-5 text-amber-400" />
          Desglose de Operaciones por Área Municipal
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#0a0e1a] text-slate-400 uppercase font-black print-bg-gray">
              <tr>
                <th className="px-3 py-2.5 rounded-l-lg">Área Responsable</th>
                <th className="px-3 py-2.5 text-center">Total Tareas</th>
                <th className="px-3 py-2.5 text-center">Por Distribuir</th>
                <th className="px-3 py-2.5 text-center">En Ejecución</th>
                <th className="px-3 py-2.5 text-center">Resueltas</th>
                <th className="px-3 py-2.5 text-center">Verificadas</th>
                <th className="px-3 py-2.5 text-center rounded-r-lg">Impedidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stats.areasBreakdown.map((a) => (
                <tr key={a.id} className="hover:bg-slate-900/40">
                  <td className="px-3 py-3 font-bold text-white print-text-dark">
                    {a.name} ({a.code})
                  </td>
                  <td className="px-3 py-3 text-center font-extrabold text-white print-text-dark">
                    {a.total}
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-amber-400">
                    {a.pendingDistribution}
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-blue-400">{a.inExecution}</td>
                  <td className="px-3 py-3 text-center font-bold text-emerald-400">{a.resolved}</td>
                  <td className="px-3 py-3 text-center font-bold text-emerald-300">{a.verified}</td>
                  <td className="px-3 py-3 text-center font-bold text-red-400">
                    {a.impeded > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-500">
                        {a.impeded}
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen de Avisos e Incidentes del Evento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#101726] border border-slate-800 rounded-2xl p-5 print-card">
          <h4 className="text-sm font-bold text-slate-300 mb-2 print-text-dark">
            Balance de Avisos Vecinales y Canales
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Total Avisos recibidos en el evento:</span>
              <span className="font-bold text-white print-text-dark">{stats.metrics.totalNotices}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Avisos pendientes de resolución/vinculación:</span>
              <span className="font-bold text-amber-400">{stats.metrics.pendingNotices}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Total Incidentes registrados:</span>
              <span className="font-bold text-white print-text-dark">{stats.metrics.totalIncidents}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#101726] border border-slate-800 rounded-2xl p-5 print-card">
          <h4 className="text-sm font-bold text-slate-300 mb-2 print-text-dark">
            Capacidad de Alojamiento y Evacuación
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Plazas ocupadas actualmente:</span>
              <span className="font-bold text-white print-text-dark">{stats.evacuation.totalOccupied}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Plazas libres disponibles:</span>
              <span className="font-bold text-emerald-400">{stats.evacuation.availableCapacity}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Capacidad total instalada:</span>
              <span className="font-bold text-white print-text-dark">{stats.evacuation.totalCapacity} plazas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pie de Firma Institucional para Impresión */}
      <div className="hidden print:block mt-12 pt-6 border-t border-gray-400 text-xs text-gray-700">
        <div className="flex justify-between items-end">
          <div>
            <p>Documento oficial emitido por el sistema GEMA (Gestión de Eventos Meteorológicos Adversos).</p>
            <p>Centro de Operaciones de Emergencia (COE) • Municipalidad de General San Martín</p>
          </div>
          <div className="text-center w-48 border-t border-gray-600 pt-1">
            <p className="font-bold">Firma y Sello Coordinador de Turno</p>
          </div>
        </div>
      </div>
    </div>
  );
};
