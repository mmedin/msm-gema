import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { MisTareas } from './pages/MisTareas';
import { MiArea } from './pages/MiArea';
import { SituacionGeneral } from './pages/SituacionGeneral';
import { IncidentesAvisos } from './pages/IncidentesAvisos';
import { CentrosEvacuados } from './pages/CentrosEvacuados';
import { MapaOperativo } from './pages/MapaOperativo';
import { AdminUsuarios } from './pages/AdminUsuarios';
import { Shield } from 'lucide-react';

const VALID_TABS = [
  'situacion',
  'incidentes',
  'mis-tareas',
  'mi-area',
  'centros',
  'mapa',
  'admin',
];

function getTabFromUrl(): string | null {
  const path = window.location.pathname.replace(/^\/+/, '').split('/')[0];
  if (path && VALID_TABS.includes(path)) {
    return path;
  }
  const hash = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  if (hash && VALID_TABS.includes(hash)) {
    return hash;
  }
  return null;
}

export const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>(() => getTabFromUrl() || 'situacion');

  const getDefaultTabForUser = useCallback(() => {
    if (!user) return 'situacion';
    if (user.role === 'OPERACION') return 'mis-tareas';
    if (user.role === 'COORDINACION' && user.coordination_scope === 'AREA') return 'mi-area';
    return 'situacion';
  }, [user]);

  // Sincronizar tab inicial o redirigir según rol al autenticar
  useEffect(() => {
    if (!user) return;

    const requestedTab = getTabFromUrl();
    const defaultTab = getDefaultTabForUser();

    if (!requestedTab) {
      setCurrentTab(defaultTab);
      window.history.replaceState(null, '', `/${defaultTab}`);
    } else {
      // Validar permisos de acceso para la ruta solicitada
      if (requestedTab === 'admin' && user.role !== 'ADMINISTRADOR') {
        setCurrentTab(defaultTab);
        window.history.replaceState(null, '', `/${defaultTab}`);
      } else {
        setCurrentTab(requestedTab);
      }
    }
  }, [user, getDefaultTabForUser]);

  // Escuchar eventos de navegación del navegador (Atrás / Adelante)
  useEffect(() => {
    const handlePopState = () => {
      const tab = getTabFromUrl();
      if (tab) {
        setCurrentTab(tab);
      } else if (user) {
        const defaultTab = getDefaultTabForUser();
        setCurrentTab(defaultTab);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, getDefaultTabForUser]);

  // Función de navegación con actualización del historial
  const handleNavigate = useCallback(
    (tab: string) => {
      if (tab === currentTab) return;
      setCurrentTab(tab);
      window.history.pushState(null, '', `/${tab}`);
    },
    [currentTab]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center animate-bounce">
          <Shield className="w-7 h-7 text-black fill-current" />
        </div>
        <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">
          Cargando GEMA (Gestión de Eventos Meteorológicos Adversos)...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen flex bg-[#0a0e17] text-slate-100 antialiased selection:bg-amber-500 selection:text-black">
      {/* Barra lateral de escritorio */}
      <Sidebar currentTab={currentTab} setCurrentTab={handleNavigate} />

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Barra superior con alertas y estado */}
        <Navbar />

        {/* Área de Contenido con Scroll Independiente */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 md:pb-8">
          {currentTab === 'mis-tareas' && <MisTareas />}
          {currentTab === 'mi-area' && <MiArea />}
          {currentTab === 'situacion' && <SituacionGeneral />}
          {currentTab === 'incidentes' && <IncidentesAvisos />}
          {currentTab === 'centros' && <CentrosEvacuados />}
          {currentTab === 'mapa' && <MapaOperativo />}
          {currentTab === 'admin' && <AdminUsuarios />}
        </main>

        {/* Barra táctil móvil inferior */}
        <BottomNav currentTab={currentTab} setCurrentTab={handleNavigate} />
      </div>
    </div>
  );
};
