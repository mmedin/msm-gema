import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  CheckSquare,
  LayoutDashboard,
  AlertOctagon,
  Home,
  Map as MapIcon,
  Users,
  LogOut,
  FolderKanban,
  Shield,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab }) => {
  const { user, activeEvent, logout } = useAuth();

  const isOperator = user?.role === 'OPERACION';
  const isCoordArea = user?.role === 'COORDINACION' && user?.coordination_scope === 'AREA';
  const isCoordGeneral = user?.role === 'COORDINACION' && user?.coordination_scope === 'GENERAL';
  const isAdmin = user?.role === 'ADMINISTRADOR';

  const menuItems = [
    { id: 'mis-tareas', label: 'Mis Tareas', icon: CheckSquare, show: true },
    { id: 'mi-area', label: 'Mi Área', icon: FolderKanban, show: isCoordArea || isCoordGeneral || isAdmin },
    { id: 'situacion', label: 'Situación General', icon: LayoutDashboard, show: true },
    { id: 'incidentes', label: 'Incidentes y Avisos', icon: AlertOctagon, show: true },
    { id: 'centros', label: 'Centros de Evacuados', icon: Home, show: true },
    { id: 'mapa', label: 'Mapa Operativo', icon: MapIcon, show: true },
    { id: 'admin', label: 'Usuarios y Sistema', icon: Users, show: isAdmin },
  ];

  return (
    <aside
      id="sidebar"
      className="hidden md:flex flex-col w-64 bg-[#0d1322] border-r border-slate-800 flex-shrink-0 select-none"
    >
      {/* Encabezado Institucional San Martín */}
      <div className="p-5 border-b border-slate-800/80 bg-[#0a0e1a]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center font-black text-black text-lg shadow-lg shadow-amber-500/20">
            <Shield className="w-6 h-6 text-black fill-current" />
          </div>
          <div>
            <h1 className="font-extrabold text-white text-base tracking-tight leading-none">
              GEMA
            </h1>
            <p className="text-[11px] font-semibold text-amber-400/90 tracking-wider uppercase mt-1">
              Gral. San Martín
            </p>
          </div>
        </div>

        {/* Evento Activo Banner */}
        {activeEvent && (
          <div className="mt-3 p-2.5 rounded-lg bg-slate-900/90 border border-slate-700/60">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>EVENTO ACTIVO</span>
              <span className="font-mono text-amber-400 font-bold">{activeEvent.code}</span>
            </div>
            <p className="text-xs font-semibold text-slate-200 truncate mt-0.5">
              {activeEvent.description}
            </p>
          </div>
        )}
      </div>

      {/* Navegación Principal */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {menuItems
          .filter((item) => item.show)
          .map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-all text-left ${
                  isActive
                    ? 'bg-amber-500 text-black font-bold shadow-lg shadow-amber-500/20'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-black' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
      </nav>

      {/* Perfil de Usuario y Cierre de Sesión */}
      <div className="p-3 border-t border-slate-800 bg-[#0a0e1a]">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-bold text-white truncate">{user?.name}</p>
            <p className="text-[11px] text-slate-400 truncate">
              {user?.area?.name || user?.role}
              {user?.can_triage ? ' • Triage' : ''}
            </p>
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
