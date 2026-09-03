import React, { useState, useEffect } from 'react';
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

export const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('situacion');

  useEffect(() => {
    if (user) {
      if (user.role === 'OPERACION') {
        setCurrentTab('mis-tareas');
      } else if (user.role === 'COORDINACION' && user.coordination_scope === 'AREA') {
        setCurrentTab('mi-area');
      } else {
        setCurrentTab('situacion');
      }
    }
  }, [user?.role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center animate-bounce">
          <Shield className="w-7 h-7 text-black fill-current" />
        </div>
        <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">
          Cargando MSM-CRISIS (Plan B Operativo)...
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
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

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
        <BottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />
      </div>
    </div>
  );
};
