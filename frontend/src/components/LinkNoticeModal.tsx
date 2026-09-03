import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { api } from '../api';
import { Incident, Notice } from '../types';
import { PriorityBadge } from './PriorityBadge';
import { Link2, AlertCircle } from 'lucide-react';

interface LinkNoticeModalProps {
  notice: Notice | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const LinkNoticeModal: React.FC<LinkNoticeModalProps> = ({
  notice,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && notice) {
      loadOpenIncidents();
    }
  }, [isOpen, notice]);

  const loadOpenIncidents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getIncidents({ event_id: notice?.event_id });
      // Filtrar incidentes que no estén CERRADOS o RESUELTOS
      const open = data.filter((inc) => inc.status !== 'CERRADO' && inc.status !== 'RESUELTO');
      setIncidents(open);
    } catch (err: any) {
      setError(err.message || 'Error al cargar incidentes');
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (incidentId: string) => {
    if (!notice) return;
    try {
      setLinking(true);
      setError(null);
      await api.linkNotice(notice.id, incidentId);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al vincular el aviso al incidente');
    } finally {
      setLinking(false);
    }
  };

  if (!notice) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Vincular Aviso a Incidente Existente" maxWidth="xl">
      <div className="space-y-4">
        <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs text-slate-300">
          <p className="font-bold text-amber-400 mb-0.5">Aviso a vincular:</p>
          <p className="truncate font-medium">{notice.description}</p>
          <p className="text-slate-400 mt-1">Ubicación: {notice.location_text}</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/80 border border-red-500 text-red-200 text-xs font-medium">
            {error}
          </div>
        )}

        <p className="text-xs text-slate-400">
          Seleccione el incidente abierto al cual corresponde este aviso (ordenados por fecha más reciente):
        </p>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm">Cargando incidentes abiertos...</div>
        ) : incidents.length === 0 ? (
          <div className="py-8 text-center bg-slate-900/50 rounded-xl border border-slate-800">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No hay incidentes abiertos disponibles</p>
            <p className="text-xs text-slate-400 mt-1">
              Puede convertir este aviso directamente en un nuevo incidente desde el menú principal.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/60 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-black text-amber-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {inc.code}
                    </span>
                    <PriorityBadge priority={inc.priority} size="sm" />
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">
                      {inc.status}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white truncate">{inc.title}</h4>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{inc.location_text}</p>
                </div>
                <button
                  onClick={() => handleLink(inc.id)}
                  disabled={linking}
                  className="btn-touch px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  {linking ? 'Vinculando...' : 'Vincular'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="btn-touch px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
};
