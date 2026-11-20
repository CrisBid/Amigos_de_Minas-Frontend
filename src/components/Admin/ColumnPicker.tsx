'use client';

import { ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';

/* Escolher e ordenar colunas de forma compacta: as escolhidas em ordem (setas para mover, × para
   tirar) e as outras como "+ coluna". */

export default function ColumnPicker({
  title, hint, all, value, onChange, defaults, locked = [],
}: {
  title: string;
  hint?: string;
  all: { key: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  defaults: string[];
  /** colunas que não podem sair (ex.: o nome) */
  locked?: string[];
}) {
  const label = (k: string) => all.find((f) => f.key === k)?.label ?? k;
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-gray-800">{title}</span>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
        <button type="button" onClick={() => onChange(defaults)} className="ml-auto inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">
          <RotateCcw className="w-3 h-3" /> padrão
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((k, i) => (
          <span key={k} className="inline-flex items-center gap-0.5 rounded-full border border-emerald-300 bg-emerald-50 pl-1 pr-1.5 py-0.5 text-xs text-emerald-900">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 rounded hover:bg-white disabled:opacity-30" aria-label={`Mover ${label(k)} para a esquerda`}><ChevronLeft className="w-3 h-3" /></button>
            <span className="font-medium">{i + 1}. {label(k)}</span>
            <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} className="p-0.5 rounded hover:bg-white disabled:opacity-30" aria-label={`Mover ${label(k)} para a direita`}><ChevronRight className="w-3 h-3" /></button>
            {!locked.includes(k) && (
              <button type="button" onClick={() => onChange(value.filter((x) => x !== k))} className="p-0.5 rounded hover:bg-white" aria-label={`Tirar ${label(k)}`}><X className="w-3 h-3" /></button>
            )}
          </span>
        ))}
        {all.filter((f) => !value.includes(f.key)).map((f) => (
          <button key={f.key} type="button" onClick={() => onChange([...value, f.key])} className="rounded-full border border-dashed border-gray-300 bg-white px-2.5 py-0.5 text-xs text-gray-600 hover:border-emerald-400 hover:text-emerald-800">
            + {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
