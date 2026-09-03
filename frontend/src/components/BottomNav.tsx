import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  CheckSquare,
  LayoutDashboard,
  AlertOctagon,
  Map as MapIcon,
  Menu,
  Home,
  Users,
  FolderKanban,
  LogOut,
  X,
} from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setCurrentTab }) => {
  const { user, logout } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isCoordArea = user?.role === 'COORDINACION' && user?.coordination_scope === 'AREA';
  const isCoordGeneral = user?.role === 'COORDINACION' && user?.coordination_scope === 'GENERAL';
  const isAdmin = user?.role === 'ADMINISTRADOR';

  const navItems = [
    { id: 'mis-tareas', label: 'Mis Tareas', icon: CheckSquare },
    { id: 'situacion', label: 'Situación', icon: LayoutDashboard },
    { id: 'incidentes', label: 'Incidentes', icon: AlertOctagon },
    { id: 'mapa', label: 'Mapa', icon: MapIcon },
  ];

  return (
    <>
      {/* Modal / Menú 'Más' para Móvil */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/80 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-[#101726] border-t border-slate-700 rounded-t-2xl p-4 space-y-2 animate-slide-up pb-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-bold text-sm text-slate-200">Más opciones</span>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(isCoordArea || isCoordGeneral || isAdmin) && (
              <button
                onClick={() => {
                  setCurrentTab('mi-area');
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-left font-medium text-slate-200"
              >
                <FolderKanban className="w-5 h-5 text-amber-400" />
                <span>Gestión Mi Área</span>
              </button>
            )}

            <button
              onClick={() => {
                setCurrentTab('centros');
                setShowMoreMenu(false);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-left font-medium text-slate-200"
            >
              <Home className="w-5 h-5 text-emerald-400" />
              <span>Centros de Evacuados</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => {
                  setCurrentTab('admin');
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-left font-medium text-slate-200"
              >
                <Users className="w-5 h-5 text-purple-400" />
                <span>Administración de Usuarios</span>
              </button>
            )}

            <button
              onClick={() => {
                setShowMoreMenu(false);
                logout();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-red-500/10 text-left font-medium mt-2"
            >
              <LogOut className="w-5 h-5" />
              <span>Cerrar sesión ({user?.username})</span>
            </button>
          </div>
        </div>
      )}

      {/* Barra táctil fija inferior */}
      <div
        id="bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d1322]/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-around px-2 py-2 select-none safe-area-pb"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setCurrentTab(item.id);
                setShowMoreMenu(false);
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all ${
                isActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110 text-amber-400' : ''}`} />
              <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
            </button>
          );
        })}

        <button
          onClick={() => setShowMoreMenu(true)}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all ${
            ['centros', 'admin', 'mi-area'].includes(currentTab)
              ? 'text-amber-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">Más</span>
        </button>
      </div>
    </>
  );
};
