import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { EvacuationCenter, OccupancyDirection, EvacuationOccupancyLog } from '../types';
import { OccupancyModal } from '../components/OccupancyModal';
import {
  Home,
  UserPlus,
  UserMinus,
  AlertTriangle,
  MapPin,
  Bed,
  CheckCircle,
  Clock,
  History,
} from 'lucide-react';

export const CentrosEvacuados: React.FC = () => {
  const { activeEvent } = useAuth();
  const [centers, setCenters] = useState<EvacuationCenter[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<EvacuationCenter | null>(null);
  const [direction, setDirection] = useState<OccupancyDirection>('INGRESO');
  const [showModal, setShowModal] = useState(false);
  const [logs, setLogs] = useState<Record<string, EvacuationOccupancyLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCenters = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getEvacuationCenters(activeEvent?.id);
      setCenters(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar centros de evacuados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCenters();
    const interval = setInterval(loadCenters, 20000);
    return () => clearInterval(interval);
  }, [activeEvent]);

  const handleOpenOccupancy = (center: EvacuationCenter, dir: OccupancyDirection) => {
    setSelectedCenter(center);
    setDirection(dir);
    setShowModal(true);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Home className="w-6 h-6 text-emerald-400" />
            Centros de Evacuados y Alojamiento
          </h2>
          <p className="text-xs text-slate-400">
            Control de plazas y flujo numérico (+/-) en refugios de General San Martín
          </p>
        </div>

        <button
          onClick={loadCenters}
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

      {/* Grid de Centros de Evacuados */}
      {loading && centers.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">Cargando centros de evacuados...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {centers.map((center) => {
            const occupied = center.current_occupied || 0;
            const percentage = center.percentage || 0;
            const isExceeded = center.capacity_exceeded;
            const available = center.available_capacity ?? Math.max(0, center.capacity - occupied);

            return (
              <div
                key={center.id}
                className="p-5 rounded-2xl bg-[#101726] border border-slate-800 flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Cabecera del Centro */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-slate-800 text-amber-400 mr-2">
                        {center.stay_kind === 'PERNOCTA' ? 'Pernocta' : 'Transitorio'}
                      </span>
                      {isExceeded && (
                        <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-500 animate-pulse">
                          Capacidad Excedida
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-black text-slate-400">
                      Cap: {center.capacity}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-white">{center.name}</h3>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span>{center.address}</span>
                  </div>

                  {center.equipment_notes && (
                    <p className="text-xs text-slate-400 mt-2 bg-[#0c121f] p-2 rounded-lg border border-slate-800/80">
                      <strong className="text-slate-300">Equipamiento:</strong> {center.equipment_notes}
                    </p>
                  )}

                  {/* Barra Visual de Ocupación */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="font-bold text-slate-300">
                        Ocupación: <strong className="text-white text-sm">{occupied}</strong> / {center.capacity}
                      </span>
                      <span
                        className={`font-black ${
                          isExceeded
                            ? 'text-red-400'
                            : percentage > 85
                            ? 'text-orange-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {percentage}% ocupado ({available} libres)
                      </span>
                    </div>

                    <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isExceeded
                            ? 'bg-red-500'
                            : percentage > 85
                            ? 'bg-orange-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Botones Rápidos de Ingreso y Egreso */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => handleOpenOccupancy(center, 'INGRESO')}
                    className="btn-touch py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ Ingreso</span>
                  </button>

                  <button
                    onClick={() => handleOpenOccupancy(center, 'EGRESO')}
                    disabled={occupied === 0}
                    className="btn-touch py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <UserMinus className="w-4 h-4" />
                    <span>- Egreso</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Movimiento de Ocupación */}
      <OccupancyModal
        center={selectedCenter}
        direction={direction}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={loadCenters}
      />
    </div>
  );
};
