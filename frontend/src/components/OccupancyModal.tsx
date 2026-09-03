import React, { useState } from 'react';
import { Modal } from './Modal';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { EvacuationCenter, OccupancyDirection } from '../types';
import { UserPlus, UserMinus, AlertTriangle } from 'lucide-react';

interface OccupancyModalProps {
  center: EvacuationCenter | null;
  direction: OccupancyDirection;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const OccupancyModal: React.FC<OccupancyModalProps> = ({
  center,
  direction,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeEvent } = useAuth();
  const [peopleCount, setPeopleCount] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!center) return null;

  const currentOccupied = center.current_occupied || 0;
  const count = parseInt(peopleCount, 10) || 0;
  const projected = direction === 'INGRESO' ? currentOccupied + count : currentOccupied - count;
  const willExceed = direction === 'INGRESO' && projected > center.capacity;
  const willBeNegative = direction === 'EGRESO' && projected < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent) {
      setError('No hay un evento activo seleccionado');
      return;
    }
    if (count <= 0) {
      setError('La cantidad debe ser mayor a 0');
      return;
    }
    if (willBeNegative) {
      setError(`No es posible registrar un egreso de ${count} personas. La ocupación actual es de ${currentOccupied}.`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await api.recordOccupancy(center.id, {
        event_id: activeEvent.id,
        direction,
        people_count: count,
        notes: notes.trim() || undefined,
      });

      setPeopleCount('1');
      setNotes('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar movimiento');
    } finally {
      setSubmitting(false);
    }
  };

  const isIngreso = direction === 'INGRESO';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isIngreso ? `+ Registrar Ingreso a ${center.name}` : `- Registrar Egreso de ${center.name}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-950/80 border border-red-500 text-red-200 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Estado actual y proyección */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
          <div className="flex justify-between text-slate-300">
            <span>Capacidad total del centro:</span>
            <span className="font-bold text-white">{center.capacity} plazas</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Ocupación actual:</span>
            <span className="font-bold text-amber-400">{currentOccupied} personas</span>
          </div>
          <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800">
            <span>Ocupación resultante:</span>
            <span
              className={`font-black ${
                projected < 0 ? 'text-red-400' : projected > center.capacity ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {projected} personas
            </span>
          </div>
        </div>

        {willExceed && (
          <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-500 text-amber-200 text-xs flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>Atención: Este ingreso superará la capacidad nominal del centro ({center.capacity} plazas).</span>
          </div>
        )}

        {/* Cantidad Numérica Estricta */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">
            Cantidad de Personas ({isIngreso ? 'a ingresar' : 'a egresar'})
          </label>
          <div className="flex items-center gap-2">
            {[1, 5, 10].map((quick) => (
              <button
                key={quick}
                type="button"
                onClick={() => setPeopleCount(String(quick))}
                className="btn-touch px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
              >
                +{quick}
              </button>
            ))}
            <input
              type="number"
              min="1"
              value={peopleCount}
              onChange={(e) => setPeopleCount(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-base font-bold text-center outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Observaciones (Sin Nombres ni DNI) */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">
            Observaciones operativas (Sin nombres ni DNI)
          </label>
          <input
            type="text"
            placeholder="Ej: Derivación cuadrilla Parques / Traslado preventivo"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-amber-500"
          />
        </div>

        {/* Acciones */}
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
            disabled={submitting || willBeNegative}
            className={`btn-touch px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 disabled:opacity-50 ${
              isIngreso
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
            }`}
          >
            {isIngreso ? <UserPlus className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
            {submitting ? 'Registrando...' : isIngreso ? 'Registrar Ingreso' : 'Registrar Egreso'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
