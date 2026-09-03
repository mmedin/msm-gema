import React from 'react';
import { Priority } from '../types';

interface Props {
  priority?: Priority | null;
  size?: 'sm' | 'md' | 'lg';
}

export const PriorityBadge: React.FC<Props> = ({ priority, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1 font-bold',
    lg: 'text-sm px-3 py-1.5 font-bold',
  }[size];

  switch (priority) {
    case 'P1':
      return (
        <span className={`inline-flex items-center gap-1 rounded bg-red-600/20 text-red-400 border border-red-500/40 uppercase tracking-wide ${sizeClasses}`}>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          P1 Crítica
        </span>
      );
    case 'P2':
      return (
        <span className={`inline-flex items-center gap-1 rounded bg-orange-600/20 text-orange-400 border border-orange-500/40 uppercase tracking-wide ${sizeClasses}`}>
          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
          P2 Alta
        </span>
      );
    case 'P3':
      return (
        <span className={`inline-flex items-center gap-1 rounded bg-yellow-600/20 text-yellow-300 border border-yellow-500/40 uppercase tracking-wide ${sizeClasses}`}>
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          P3 Media
        </span>
      );
    case 'P4':
      return (
        <span className={`inline-flex items-center gap-1 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 uppercase tracking-wide ${sizeClasses}`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          P4 Baja
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wide ${sizeClasses}`}>
          Sin triage
        </span>
      );
  }
};
