import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const getVariantElements = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />,
          btnClass: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />,
          btnClass: 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20',
        };
      case 'primary':
      default:
        return {
          icon: <HelpCircle className="w-6 h-6 text-blue-400 flex-shrink-0" />,
          btnClass: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20',
        };
    }
  };

  const { icon, btnClass } = getVariantElements();

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} maxWidth="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
          {icon}
          <div className="text-sm text-slate-200 leading-relaxed font-medium">
            {message}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-touch px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`btn-touch px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 ${btnClass}`}
          >
            {loading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
