import React from 'react';
import { Priority } from '../types';
import { Clock, AlertTriangle } from 'lucide-react';

interface Props {
  lastActivityAt: string;
  priority?: Priority | null;
}

export const InactivityBadge: React.FC<Props> = ({ lastActivityAt, priority }) => {
  if (!lastActivityAt) return null;

  const now = new Date().getTime();
  const last = new Date(lastActivityAt).getTime();
  const diffMinutes = Math.floor((now - last) / (1000 * 60));

  const isCritical = (priority === 'P1' || priority === 'P2') && diffMinutes >= 30;
  const isWarning = (priority === 'P3' || priority === 'P4') && diffMinutes >= 120;

  if (!isCritical && !isWarning) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
        <Clock className="w-3 h-3" />
        hace {diffMinutes < 1 ? 'instantes' : `${diffMinutes}m`}
      </span>
    );
  }

  const formatElapsed = (m: number) => {
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${remM}m`;
  };

  if (isCritical) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-500 font-bold text-xs animate-pulse">
        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
        Inactividad: {formatElapsed(diffMinutes)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/80 font-bold text-xs">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
      Inactividad: {formatElapsed(diffMinutes)}
    </span>
  );
};
