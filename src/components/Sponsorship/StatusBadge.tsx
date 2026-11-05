// src/components/Sponsorship/StatusBadge.tsx
'use client';

import React from 'react';
import { STATUS_PT, type SponsorshipStatus } from '@/lib/sponsorship-status';
import { FLOW_STEPS, STATUS_STYLE, TOTAL_STEPS } from './statusStyle';

/** Pílula do status: cor e ícone próprios de cada etapa */
export default function StatusBadge({
  status, className, solid, size = 'sm',
}: {
  status: SponsorshipStatus;
  className?: string;
  solid?: boolean;
  size?: 'sm' | 'md';
}) {
  const st = STATUS_STYLE[status];
  if (!st) {
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset bg-gray-100 text-gray-800 ring-gray-200 ${className || ''}`}>{status}</span>;
  }
  const Icon = st.icon;
  const sz = size === 'md' ? 'px-3 py-1 text-sm gap-1.5' : 'px-2.5 py-0.5 text-xs gap-1';
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${sz} ${solid ? st.solid : st.soft} ${className || ''}`}
      title={st.hint}
    >
      <Icon className={size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      {STATUS_PT[status] ?? status}
    </span>
  );
}

/** Trilha das 6 etapas: mostra em que ponto do caminho até a entrega o apadrinhamento está */
export function StatusSteps({ status, className }: { status: SponsorshipStatus; className?: string }) {
  const st = STATUS_STYLE[status];
  const current = st?.step ?? null;
  if (current === null) {
    return <div className={`h-1.5 rounded-full ${st?.bar ?? 'bg-gray-300'} opacity-40 ${className || ''}`} title={st?.hint} />;
  }
  return (
    <div className={`flex items-center gap-0.5 ${className || ''}`} title={`Etapa ${current} de ${TOTAL_STEPS} · ${st.hint}`}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i < current ? st.bar : 'bg-gray-200'}`} />
      ))}
    </div>
  );
}

/** Barra empilhada com a distribuição dos status (e legenda opcional ao passar o mouse) */
export function StatusDistribution({
  counts, className, onSelect,
}: {
  counts: Partial<Record<SponsorshipStatus, number>>;
  className?: string;
  onSelect?: (s: SponsorshipStatus) => void;
}) {
  const order: SponsorshipStatus[] = [...FLOW_STEPS, 'ENDED', 'CANCELLED'];
  const total = order.reduce((a, s) => a + (counts[s] ?? 0), 0);
  if (!total) return <div className={`h-2.5 rounded-full bg-gray-100 ${className || ''}`} />;
  return (
    <div className={`flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 ${className || ''}`}>
      {order.filter((s) => counts[s]).map((s) => {
        const n = counts[s] ?? 0;
        const Seg = onSelect ? 'button' : 'span';
        return (
          <Seg
            key={s}
            type={onSelect ? 'button' : undefined}
            onClick={onSelect ? () => onSelect(s) : undefined}
            className={`${STATUS_STYLE[s].bar} h-full transition-opacity hover:opacity-80 border-r border-white/60 last:border-r-0`}
            style={{ width: `${(n / total) * 100}%` }}
            title={`${STATUS_PT[s]}: ${n} (${Math.round((n / total) * 100)}%)`}
          />
        );
      })}
    </div>
  );
}
