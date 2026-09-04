import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string, duration: number = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: (msg: string, d?: number) => addToast('success', msg, d),
    error: (msg: string, d?: number) => addToast('error', msg, d),
    warning: (msg: string, d?: number) => addToast('warning', msg, d),
    info: (msg: string, d?: number) => addToast('info', msg, d),
  };

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-950/90 border-emerald-500/80 text-emerald-100',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
        };
      case 'error':
        return {
          bg: 'bg-red-950/90 border-red-500/80 text-red-100',
          icon: <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />,
        };
      case 'warning':
        return {
          bg: 'bg-amber-950/90 border-amber-500/80 text-amber-100',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
        };
      case 'info':
      default:
        return {
          bg: 'bg-slate-900/90 border-blue-500/80 text-blue-100',
          icon: <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />,
        };
    }
  };

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      {/* Contenedor flotante de Toasts */}
      <aside
        aria-label="Notificaciones del sistema"
        className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[9999] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((item) => {
          const style = getToastStyles(item.type);
          return (
            <div
              key={item.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all animate-fade-in ${style.bg}`}
            >
              {style.icon}
              <div className="flex-1 text-xs font-medium leading-relaxed break-words">
                {item.message}
              </div>
              <button
                onClick={() => removeToast(item.id)}
                className="p-1 -mr-1 -mt-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Cerrar notificación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </aside>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue['toast'] => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de un ToastProvider');
  }
  return context.toast;
};
