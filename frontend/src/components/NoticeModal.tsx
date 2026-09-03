import React, { useState } from 'react';
import { Modal } from './Modal';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Camera, MapPin, AlertTriangle, Send } from 'lucide-react';

interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NoticeModal: React.FC<NoticeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { activeEvent } = useAuth();
  const [channel, setChannel] = useState('LINEA_103');
  const [source, setSource] = useState('Vecino');
  const [contact, setContact] = useState('');
  const [locationText, setLocationText] = useState('');
  const [locationPending, setLocationPending] = useState(false);
  const [lifeRisk, setLifeRisk] = useState('NO');
  const [trend, setTrend] = useState('EMPEORA');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent) {
      setError('No hay un evento activo seleccionado.');
      return;
    }
    if (!description.trim()) {
      setError('La descripción del aviso es obligatoria.');
      return;
    }
    if (!locationPending && !locationText.trim()) {
      setError('Debe indicar la ubicación o marcar "Ubicación pendiente".');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.append('event_id', activeEvent.id);
      formData.append('channel', channel);
      formData.append('source', source);
      if (contact) formData.append('contact', contact);
      formData.append('location_text', locationPending ? 'Ubicación pendiente de confirmación' : locationText);
      formData.append('location_pending', String(locationPending));
      formData.append('life_risk', lifeRisk);
      formData.append('trend', trend);
      formData.append('description', description);
      if (file) {
        formData.append('photo', file);
      }

      await api.createNotice(formData);

      // Reset
      setDescription('');
      setLocationText('');
      setContact('');
      setFile(null);
      setLocationPending(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar aviso');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="+ Registrar Aviso Operativo" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-950/80 border border-red-500 text-red-200 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Canal y Fuente */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Canal de Entrada</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-amber-500"
            >
              <option value="LINEA_103">Línea 103 (Defensa Civil)</option>
              <option value="CAV_147">CAV 147 (Atención Vecinal)</option>
              <option value="TELEFONO">Teléfono directo</option>
              <option value="WHATSAPP">WhatsApp operativo</option>
              <option value="RADIO">Radio UHF / VHF</option>
              <option value="CAMPO">Relevamiento de Campo</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Fuente / Contacto</label>
            <input
              type="text"
              placeholder="Ej: Vecino / Operador"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Teléfono o detalle del contacto */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">Teléfono o Dato de Contacto (Opcional)</label>
          <input
            type="text"
            placeholder="Ej: 11-4567-8901 (para repreguntar)"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-amber-500"
          />
        </div>

        {/* Ubicación */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              Ubicación o Esquina en San Martín
            </label>
            <label className="flex items-center gap-1.5 text-xs text-amber-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={locationPending}
                onChange={(e) => setLocationPending(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
              />
              Ubicación pendiente
            </label>
          </div>
          <input
            type="text"
            disabled={locationPending}
            placeholder={locationPending ? 'Ubicación pendiente de confirmación en campo' : 'Ej: Alvear y Lavalle, Villa Ballester'}
            value={locationPending ? '' : locationText}
            onChange={(e) => setLocationText(e.target.value)}
            className={`w-full px-3 py-2 bg-slate-900 border rounded-lg text-white text-sm outline-none focus:border-amber-500 ${
              locationPending ? 'opacity-50 border-slate-800' : 'border-slate-700'
            }`}
          />
        </div>

        {/* Riesgo de Vida y Tendencia */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              ¿Riesgo de Vida?
            </label>
            <select
              value={lifeRisk}
              onChange={(e) => setLifeRisk(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg font-bold text-sm outline-none border ${
                lifeRisk === 'SI'
                  ? 'bg-red-950/80 border-red-500 text-red-300'
                  : 'bg-slate-900 border-slate-700 text-white'
              }`}
            >
              <option value="NO">NO - Sin riesgo inminente</option>
              <option value="SI">SÍ - Riesgo inminente</option>
              <option value="DESCONOCIDO">DESCONOCIDO</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Tendencia de la Situación</label>
            <select
              value={trend}
              onChange={(e) => setTrend(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-amber-500"
            >
              <option value="EMPEORA">EMPEORA (Agua subiendo / cables chispeando)</option>
              <option value="ESTABLE">ESTABLE</option>
              <option value="MEJORA">MEJORA</option>
              <option value="DESCONOCIDA">DESCONOCIDA</option>
            </select>
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">Descripción de lo Observado</label>
          <textarea
            rows={3}
            placeholder="Detalle concreto: anegamiento de vereda, rama caída, postes inclinados, etc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-amber-500 resize-none"
          />
        </div>

        {/* Foto de Evidencia Opcional */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-slate-400" />
            Foto de Evidencia (Opcional - máx. 15MB)
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0]);
              }
            }}
            className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-amber-400 hover:file:bg-slate-700 cursor-pointer"
          />
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="btn-touch px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-touch px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Registrando...' : 'Registrar Aviso'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
