import React from 'react';
import { Users, AlertCircle } from 'lucide-react';

export default function DuplicateBadge({ linkedCount, className = '' }) {
  if (!linkedCount || linkedCount <= 0) return null;

  return (
    <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 ${className}`}>
      <Users className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
      <span>{linkedCount} other{linkedCount > 1 ? 's' : ''} nearby also need this</span>
    </div>
  );
}
