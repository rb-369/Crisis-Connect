import React from 'react';
import { Users } from 'lucide-react';

export default function DuplicateBadge({ linkedCount, className = '' }) {
  if (!linkedCount || linkedCount <= 0) return null;

  return (
    <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] ${className}`}>
      <Users className="w-3.5 h-3.5 text-[#D97706] animate-pulse" />
      <span>{linkedCount} other{linkedCount > 1 ? 's' : ''} nearby also need this</span>
    </div>
  );
}
