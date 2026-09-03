import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Incident, EvacuationCenter } from '../types';
import { Layers, MapPin, Home, AlertOctagon, CheckSquare, Eye, EyeOff } from 'lucide-react';

interface GeoLayerConfig {
  id: string;
  name: string;
  url: string;
  color: string;
  type: 'point' | 'line' | 'polygon';
  active: boolean;
  layerInstance?: L.GeoJSON | null;
  loaded: boolean;
  error?: boolean;
}

export const MapaOperativo: React.FC = () => {
  const { activeEvent } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [centers, setCenters] = useState<EvacuationCenter[]>([]);
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  // Capas GeoJSON de General San Martín
  const [geoLayers, setGeoLayers] = useState<GeoLayerConfig[]>([
    {
      id: 'cuenca-reconquista',
      name: 'Peligrosidad Cuenca Reconquista',
      url: '/datos-geo/peligrosidad-cuenca-reconquista.geojson',
      color: '#ef4444',
      type: 'polygon',
      active: true,
      loaded: false,
    },
    {
      id: 'arroyo-medrano',
      name: 'Arroyo Medrano (Traza)',
      url: '/datos-geo/arroyo-medrano-traza.geojson',
      color: '#3b82f6',
      type: 'line',
      active: true,
      loaded: false,
    },
    {
      id: 'anegamientos-com',
      name: 'Zona Anegamientos COM (Puntos)',
      url: '/datos-geo/zona-anegamientos-com.geojson',
      color: '#f59e0b',
      type: 'point',
      active: true,
      loaded: false,
    },
    {
      id: 'tramos-afectados',
      name: 'Tramos Afectados (Calles)',
      url: '/datos-geo/tramos-afectados.geojson',
      color: '#a855f7',
      type: 'line',
      active: false,
      loaded: false,
    },
  ]);

  const incidentsLayerGroupRef = useRef<L.LayerGroup>(L.layerGroup());
  const centersLayerGroupRef = useRef<L.LayerGroup>(L.layerGroup());

  // Inicialización del Mapa
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Coordenadas aproximadas de General San Martín (-34.572, -58.535)
      const map = L.map(mapContainerRef.current, {
        center: [-34.565, -58.535],
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Mapa base oscuro (CartoDB Dark Matter)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      incidentsLayerGroupRef.current.addTo(map);
      centersLayerGroupRef.current.addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      // Cleanup no destructivo
    };
  }, []);

  // Cargar datos operativos de incidentes y centros
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [incidentsData, centersData] = await Promise.all([
          api.getIncidents({ event_id: activeEvent?.id }),
          api.getEvacuationCenters(activeEvent?.id),
        ]);
        setIncidents(incidentsData);
        setCenters(centersData);
      } catch (err) {
        console.error('Error al cargar capas operativas:', err);
      }
    };

    fetchData();
  }, [activeEvent]);

  // Renderizar Pines de Incidentes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    incidentsLayerGroupRef.current.clearLayers();

    incidents.forEach((inc) => {
      if (inc.lat && inc.lng) {
        const prioColor = {
          P1: '#ef4444',
          P2: '#f97316',
          P3: '#eab308',
          P4: '#10b981',
        }[inc.priority || 'P3'];

        const customIcon = L.divIcon({
          className: 'custom-incident-marker',
          html: `
            <div style="
              background-color: ${prioColor};
              width: 28px;
              height: 28px;
              border-radius: 50%;
              border: 3px solid #ffffff;
              box-shadow: 0 0 10px ${prioColor};
              display: flex;
              align-items: center;
              justify-content: center;
              color: black;
              font-weight: 900;
              font-size: 10px;
              font-family: monospace;
            ">
              !
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([inc.lat, inc.lng], { icon: customIcon });

        marker.bindPopup(`
          <div style="font-family: sans-serif; color: #111827; min-width: 180px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <strong style="font-size: 11px; background: #e5e7eb; padding: 2px 5px; border-radius: 4px;">${inc.code}</strong>
              <span style="font-size: 10px; font-weight: bold; color: ${prioColor};">${inc.priority || 'Sin Triage'}</span>
            </div>
            <h4 style="font-size: 12px; font-weight: bold; margin: 4px 0;">${inc.title}</h4>
            <p style="font-size: 11px; color: #4b5563; margin: 0 0 4px 0;">${inc.location_text}</p>
            <div style="font-size: 10px; color: #6b7280;">Estado: <strong>${inc.status}</strong></div>
          </div>
        `);

        incidentsLayerGroupRef.current.addLayer(marker);
      }
    });
  }, [incidents]);

  // Renderizar Pines de Centros de Evacuados
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    centersLayerGroupRef.current.clearLayers();

    centers.forEach((c) => {
      if (c.lat && c.lng) {
        const isExceeded = c.capacity_exceeded;
        const color = isExceeded ? '#ef4444' : '#10b981';

        const customIcon = L.divIcon({
          className: 'custom-center-marker',
          html: `
            <div style="
              background-color: ${color};
              width: 32px;
              height: 32px;
              border-radius: 8px;
              border: 2px solid #ffffff;
              box-shadow: 0 0 10px ${color};
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 9px;
            ">
              <span style="font-size: 12px; line-height: 1;">🏠</span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([c.lat, c.lng], { icon: customIcon });

        marker.bindPopup(`
          <div style="font-family: sans-serif; color: #111827; min-width: 200px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <strong style="font-size: 12px; color: #047857;">REFUGIO</strong>
              <span style="font-size: 10px; font-weight: bold;">${c.stay_kind}</span>
            </div>
            <h4 style="font-size: 13px; font-weight: bold; margin: 2px 0;">${c.name}</h4>
            <p style="font-size: 11px; color: #4b5563; margin: 0 0 6px 0;">${c.address}</p>
            <div style="font-size: 11px; padding: 4px; background: #f3f4f6; border-radius: 4px;">
              Ocupación: <strong>${c.current_occupied || 0}</strong> / ${c.capacity} personas
              <br/>
              Plazas libres: <strong>${c.available_capacity ?? (c.capacity - (c.current_occupied || 0))}</strong>
            </div>
          </div>
        `);

        centersLayerGroupRef.current.addLayer(marker);
      }
    });
  }, [centers]);

  // Cargar y Alternar Capas GeoJSON
  const toggleGeoLayer = async (index: number) => {
    const layer = geoLayers[index];
    const newLayers = [...geoLayers];

    if (!mapInstanceRef.current) return;

    if (layer.active) {
      // Desactivar
      if (layer.layerInstance) {
        mapInstanceRef.current.removeLayer(layer.layerInstance);
      }
      newLayers[index].active = false;
      setGeoLayers(newLayers);
    } else {
      // Activar
      if (layer.layerInstance) {
        mapInstanceRef.current.addLayer(layer.layerInstance);
        newLayers[index].active = true;
        setGeoLayers(newLayers);
      } else {
        // Cargar GeoJSON por primera vez
        try {
          const res = await fetch(layer.url);
          if (!res.ok) throw new Error('No disponible');
          const geoData = await res.json();

          const leafletLayer = L.geoJSON(geoData, {
            style: () => ({
              color: layer.color,
              weight: layer.type === 'line' ? 3 : 2,
              opacity: 0.8,
              fillColor: layer.color,
              fillOpacity: 0.25,
            }),
            pointToLayer: (_feature, latlng) => {
              return L.circleMarker(latlng, {
                radius: 5,
                fillColor: layer.color,
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.8,
              });
            },
            onEachFeature: (feature, l) => {
              if (feature.properties) {
                const props = feature.properties;
                const title = props.nombre || props.Name || props.motivo || props.tipo || 'Capa San Martín';
                l.bindPopup(`
                  <div style="font-family: sans-serif; color: #111827; font-size: 11px;">
                    <strong>${title}</strong>
                    ${props.direccion ? `<br/>${props.direccion}` : ''}
                  </div>
                `);
              }
            },
          });

          leafletLayer.addTo(mapInstanceRef.current);
          newLayers[index].layerInstance = leafletLayer;
          newLayers[index].active = true;
          newLayers[index].loaded = true;
          setGeoLayers(newLayers);
        } catch (e) {
          console.warn(`No se pudo cargar la capa ${layer.name}:`, e);
          newLayers[index].error = true;
          newLayers[index].active = false;
          setGeoLayers(newLayers);
        }
      }
    }
  };

  // Cargar capas por defecto al inicio
  useEffect(() => {
    geoLayers.forEach((layer, idx) => {
      if (layer.active && !layer.loaded && !layer.error) {
        toggleGeoLayer(idx);
      }
    });
  }, []);

  return (
    <div className="relative w-full h-[calc(100vh-8.5rem)] md:h-[calc(100vh-6rem)] rounded-2xl overflow-hidden border border-slate-800 bg-[#0a0e17]">
      {/* Contenedor del Mapa Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Botón Flotante para Panel de Capas */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => setShowLayerPanel(!showLayerPanel)}
          className="btn-touch px-3.5 py-2.5 rounded-xl bg-[#0d1322]/90 hover:bg-slate-800 text-white border border-slate-700 shadow-xl flex items-center gap-2 text-xs font-bold backdrop-blur-sm"
        >
          <Layers className="w-4 h-4 text-amber-400" />
          <span>Capas Geo ({geoLayers.filter((l) => l.active).length})</span>
        </button>

        {/* Panel Desplegable de Capas GeoJSON de San Martín */}
        {showLayerPanel && (
          <div className="absolute right-0 mt-2 w-72 bg-[#0d1322]/95 border border-slate-700 rounded-2xl p-4 shadow-2xl backdrop-blur-md space-y-3 z-30 animate-fade-in text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-extrabold text-white text-xs uppercase tracking-wider">
                Capas de San Martín
              </span>
              <button
                onClick={() => setShowLayerPanel(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Capas Operativas Base */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between py-1 text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  Incidentes Activos ({incidents.filter((i) => i.lat && i.lng).length})
                </span>
                <span className="text-emerald-400 font-bold">Activo</span>
              </div>
              <div className="flex items-center justify-between py-1 text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500"></span>
                  Refugios ({centers.filter((c) => c.lat && c.lng).length})
                </span>
                <span className="text-emerald-400 font-bold">Activo</span>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-2 space-y-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Riesgo Hidrológico e Histórico:
              </p>
              {geoLayers.map((layer, index) => (
                <div
                  key={layer.id}
                  onClick={() => toggleGeoLayer(index)}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: layer.color }}
                    ></span>
                    <span className="truncate font-semibold text-slate-200">{layer.name}</span>
                  </div>
                  {layer.error ? (
                    <span className="text-red-400 text-[10px] font-bold">No disp.</span>
                  ) : layer.active ? (
                    <Eye className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Leyenda Inferior Flotante */}
      <div className="absolute bottom-4 left-4 z-20 hidden sm:flex items-center gap-3 bg-[#0d1322]/90 border border-slate-800 rounded-xl px-3 py-2 text-[11px] backdrop-blur-sm text-slate-300">
        <span className="font-bold text-white">Prioridades:</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> P1
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> P2
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span> P3
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> P4
        </span>
        <span className="h-3 w-px bg-slate-700"></span>
        <span className="flex items-center gap-1 text-emerald-400 font-bold">
          <span>🏠</span> Refugios
        </span>
      </div>
    </div>
  );
};
