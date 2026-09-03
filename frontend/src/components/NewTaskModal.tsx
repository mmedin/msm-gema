import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { api } from '../api';
import { Area, Priority } from '../types';
import { PlusCircle, Send } from 'lucide-react';

interface NewTaskModalProps {
  incidentId: string;
  defaultPriority?: Priority | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  incidentId,
  defaultPriority,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaId, setAreaId] = useState('');
  const [action, setAction] = useState('');
  const [priority, setPriority] = useState<Priority>(defaultPriority || 'P2');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAreas();
      if (defaultPriority) setPriority(defaultPriority);
    }
  }, [isOpen, defaultPriority]);

  const loadAreas = async () => {
    try {
      const data = await api.getAreas();
      setAreas(data);
      if (data.length > 0 && !areaId) {
        setAreaId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action.trim()) {
      setError('Debe detallar la acción operativa a realizar');
      return;
    }
    if (!areaId) {
      setError('Debe seleccionar el área operativa responsable');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await api.createTask({
        incident_id: incidentId,
        area_id: areaId,
        action: action.trim(),
        priority,
      });
      setAction('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al derivar tarea');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Etapa 1: Derivar Tarea a Área Sectorial" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-950/80 border border-red-500 text-red-200 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Área Operativa */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">
            Área Responsable
          </label>
          <select
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-amber-500"
          >
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>

        {/* Prioridad */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">Prioridad de la Tarea</label>
          <div className="grid grid-cols-4 gap-2">
            {(['P1', 'P2', 'P3', 'P4'] as Priority[]).map((p) => {
              const active = priority === p;
              const colorMap = {
                P1: active ? 'bg-red-600 text-white border-red-400' : 'bg-slate-900 border-slate-700 text-red-400',
                P2: active ? 'bg-orange-600 text-white border-orange-400' : 'bg-slate-900 border-slate-700 text-orange-400',
                P3: active ? 'bg-yellow-500 text-black border-yellow-300' : 'bg-slate-900 border-slate-700 text-yellow-400',
                P4: active ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-900 border-slate-700 text-emerald-400',
              }[p];

              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`btn-touch py-2 rounded-lg font-bold text-xs border transition-all ${colorMap}`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Acción */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">
            Acción u Orden Operativa
          </label>
          <textarea
            rows={3}
            placeholder="Ej: Retiro y trozado de árbol caído sobre calzada y despeje de cables"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-amber-500 resize-none"
          />
        </div>

        {/* Botones */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="btn-touch px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-touch px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Derivando...' : 'Derivar Tarea'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
