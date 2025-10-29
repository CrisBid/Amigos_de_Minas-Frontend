// src/components/Sponsorship/StatusSelect.tsx
'use client';

import * as React from 'react';
import { LOGISTICS_FLOW, STATUS_PT, type SponsorshipStatus } from '@/lib/sponsorship-status';

type Props = {
  value?: SponsorshipStatus | '';
  onChange: (s: SponsorshipStatus | '') => void;
  placeholder?: string;
  includeEmpty?: boolean; // para filtros
  className?: string;
};

export function StatusSelect({ value = '', onChange, placeholder = 'Status', includeEmpty = true, className }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange((e.target.value || '') as SponsorshipStatus | '')}
      className={`border rounded-lg px-3 py-2 text-sm bg-white ${className || ''}`}
    >
      {includeEmpty && <option value="">{placeholder}</option>}
      {LOGISTICS_FLOW.map((s) => (
        <option key={s} value={s}>{STATUS_PT[s]}</option>
      ))}
    </select>
  );
}
