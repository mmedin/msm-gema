import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { AlertTriangle, Shield, RefreshCw } from 'lucide-react';
import { SmnAlert, EventStatus } from '../types';

export const Navbar: React.FC = () => {
  const { activeEvent, user, refreshActiveEvent } = useAuth();
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false);

  const isGeneralCoordOrAdmin =
    (user?.role === 'COORDINACION' && user?.coordination_scope === 'GENERAL') ||
    user?.role === 'ADMINISTRADOR';

  const getAlertBadge = (alert?: SmnAlert) => {
    switch (alert) {
      case 'ROJA':
        return 'bg-red-500 text-white font-black animate-pulse border-red-400';
      case 'NARANJA':
        return 'bg-orange-500 text-black font-extrabold border-orange-400';
      case 'AMARILLA':
        return 'bg-yellow-400 text-black font-extrabold border-yellow-300';
      default:
        return 'bg-slate-700 text-slate-200 border-slate-600';
    }
  };

  const handleAlertChange = async (newAlert: SmnAlert) => {
    if (!activeEvent || !isGeneralCoordOrAdmin) return;
    try {
      setIsUpdatingEvent(true);
      await api.updateEvent(activeEvent.id, { smn_alert: newAlert });
      await refreshActiveEvent();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingEvent(false);
    }
  };

  const handleStatusChange = async (newStatus: EventStatus) => {
    if (!activeEvent || !isGeneralCoordOrAdmin) return;
    try {
      setIsUpdatingEvent(true);
      await api.updateEvent(activeEvent.id, { status: newStatus });
      await refreshActiveEvent();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingEvent(false);
    }
  };

  return (
    <header className="h-14 bg-[#0a0e1a] border-b border-slate-800 flex items-center justify-between px-3 sm:px-6 select-none flex-shrink-0 z-30">
      {/* Móvil Logo / Título */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-black text-black">
          <Shield className="w-5 h-5 text-black fill-current" />
        </div>
        <span className="font-extrabold text-sm text-white">MSM-CRISIS</span>
      </div>

      {/* Info Evento Activo & Alerta SMN */}
      <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-1">
        {activeEvent ? (
          <>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Evento:</span>
              <span className="font-mono text-xs font-bold text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {activeEvent.code}
              </span>
            </div>

            {/* Selector o badge de alerta SMN */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Alerta SMN:</span>
              {isGeneralCoordOrAdmin ? (
                <select
                  value={activeEvent.smn_alert}
                  disabled={isUpdatingEvent}
                  onChange={(e) => handleAlertChange(e.target.value as SmnAlert)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-bold uppercase cursor-pointer outline-none transition-all ${getAlertBadge(
                    activeEvent.smn_alert
                  )}`}
                >
                  <option value="SIN_ALERTA" className="bg-slate-900 text-white">Sin Alerta</option>
                  <option value="AMARILLA" className="bg-slate-900 text-yellow-400">Alerta Amarilla</option>
                  <option value="NARANJA" className="bg-slate-900 text-orange-400">Alerta Naranja</option>
                  <option value="ROJA" className="bg-slate-900 text-red-500">Alerta Roja</option>
                </select>
              ) : (
                <span className={`text-xs px-2.5 py-1 rounded-lg border font-bold uppercase ${getAlertBadge(activeEvent.smn_alert)}`}>
                  {activeEvent.smn_alert}
                </span>
              )}
            </div>

            {/* Fase del evento */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Fase:</span>
              {isGeneralCoordOrAdmin ? (
                <select
                  value={activeEvent.status}
                  disabled={isUpdatingEvent}
                  onChange={(e) => handleStatusChange(e.target.value as EventStatus)}
                  className="text-xs px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-bold uppercase cursor-pointer outline-none"
                >
                  <option value="PREPARACION">Preparación</option>
                  <option value="RESPUESTA">Respuesta</option>
                  <option value="RECUPERACION">Recuperación</option>
                  <option value="CERRADO">Cerrado</option>
                </select>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-semibold uppercase">
                  {activeEvent.status}
                </span>
              )}
            </div>
          </>
        ) : (
          <span className="text-xs text-amber-400/80 font-medium">Sin evento activo</span>
        )}
      </div>

      {/* Indicador en vivo de Polling */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-950/40 px-2 py-1 rounded-full border border-emerald-800/60">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="hidden sm:inline">En vivo</span>
        </div>
      </div>
    </header>
  );
};
