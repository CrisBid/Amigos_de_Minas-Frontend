// src/components/Sponsorship/StatusBadge.tsx
'use client';

import React from 'react';
import { STATUS_PT, STATUS_BADGE, type SponsorshipStatus } from '@/lib/sponsorship-status';

const toneToClass: Record<string, string> = {
  amber:   'bg-amber-100 text-amber-800 ring-amber-200',
  yellow:  'bg-yellow-100 text-yellow-800 ring-yellow-200',
  blue:    'bg-blue-100 text-blue-800 ring-blue-200',
  indigo:  'bg-indigo-100 text-indigo-800 ring-indigo-200',
  violet:  'bg-violet-100 text-violet-800 ring-violet-200',
  emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  green:   'bg-green-100 text-green-800 ring-green-200',
  red:     'bg-red-100 text-red-800 ring-red-200',
  zinc:    'bg-zinc-100 text-zinc-800 ring-zinc-200',
  gray:    'bg-gray-100 text-gray-800 ring-gray-200',
  slate:   'bg-slate-100 text-slate-800 ring-slate-200',
};

export default function StatusBadge({ status, className }: { status: SponsorshipStatus; className?: string }) {
  const tone = STATUS_BADGE[status] || 'gray';
  const cls = toneToClass[tone] || toneToClass.gray;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls} ${className || ''}`}>
      {STATUS_PT[status] ?? status}
    </span>
  );
}
