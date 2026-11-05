// src/components/Sponsorship/statusStyle.tsx
// Cor, ícone e etapa de cada status do apadrinhamento: um tom diferente para cada um,
// para dar para distinguir de longe (lista, filtros, barras).
import {
  Archive, CheckCircle2, Clock, Gift, HeartHandshake, Package, ShoppingCart, Truck, XCircle, type LucideIcon,
} from 'lucide-react';
import type { SponsorshipStatus } from '@/lib/sponsorship-status';

export type StatusStyle = {
  icon: LucideIcon;
  /** etapa no fluxo (1–7); encerrado/cancelado ficam fora do fluxo */
  step: number | null;
  hint: string;
  soft: string; // fundo claro + texto + borda
  solid: string; // fundo forte + texto branco
  bar: string; // cor de barras e pontos
  text: string;
  border: string; // borda lateral das linhas
};

// classes escritas por extenso para o Tailwind encontrar
export const STATUS_STYLE: Record<SponsorshipStatus, StatusStyle> = {
  PENDING: {
    icon: Clock, step: 1, hint: 'Aguardando aprovação',
    soft: 'bg-amber-50 text-amber-800 ring-amber-300', solid: 'bg-amber-500 text-white ring-amber-500',
    bar: 'bg-amber-500', text: 'text-amber-700', border: 'border-l-amber-500',
  },
  IN_PROGRESS: {
    icon: HeartHandshake, step: 2, hint: 'Aprovado, aguardando compra',
    soft: 'bg-sky-50 text-sky-800 ring-sky-300', solid: 'bg-sky-600 text-white ring-sky-600',
    bar: 'bg-sky-500', text: 'text-sky-700', border: 'border-l-sky-500',
  },
  IN_PURCHASE: {
    icon: ShoppingCart, step: 3, hint: 'Presente sendo comprado',
    soft: 'bg-indigo-50 text-indigo-800 ring-indigo-300', solid: 'bg-indigo-600 text-white ring-indigo-600',
    bar: 'bg-indigo-500', text: 'text-indigo-700', border: 'border-l-indigo-500',
  },
  PACKED: {
    icon: Gift, step: 4, hint: 'Presente embalado',
    soft: 'bg-violet-50 text-violet-800 ring-violet-300', solid: 'bg-violet-600 text-white ring-violet-600',
    bar: 'bg-violet-500', text: 'text-violet-700', border: 'border-l-violet-500',
  },
  BOXED: {
    icon: Package, step: 5, hint: 'Na caixa da comunidade',
    soft: 'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-300', solid: 'bg-fuchsia-600 text-white ring-fuchsia-600',
    bar: 'bg-fuchsia-500', text: 'text-fuchsia-700', border: 'border-l-fuchsia-500',
  },
  AWAITING_DELIVERY: {
    icon: Truck, step: 6, hint: 'A caminho da criança',
    soft: 'bg-orange-50 text-orange-800 ring-orange-300', solid: 'bg-orange-500 text-white ring-orange-500',
    bar: 'bg-orange-500', text: 'text-orange-700', border: 'border-l-orange-500',
  },
  COMPLETED: {
    icon: CheckCircle2, step: 7, hint: 'Presente entregue',
    soft: 'bg-emerald-50 text-emerald-800 ring-emerald-300', solid: 'bg-emerald-600 text-white ring-emerald-600',
    bar: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-l-emerald-500',
  },
  ENDED: {
    icon: Archive, step: null, hint: 'Vínculo encerrado',
    soft: 'bg-slate-100 text-slate-700 ring-slate-300', solid: 'bg-slate-600 text-white ring-slate-600',
    bar: 'bg-slate-400', text: 'text-slate-600', border: 'border-l-slate-400',
  },
  CANCELLED: {
    icon: XCircle, step: null, hint: 'Pedido cancelado',
    soft: 'bg-rose-50 text-rose-800 ring-rose-300', solid: 'bg-rose-600 text-white ring-rose-600',
    bar: 'bg-rose-500', text: 'text-rose-700', border: 'border-l-rose-500',
  },
};

/** Etapas do fluxo, em ordem (sem encerrado/cancelado) */
export const FLOW_STEPS: SponsorshipStatus[] = [
  'PENDING', 'IN_PROGRESS', 'IN_PURCHASE', 'PACKED', 'BOXED', 'AWAITING_DELIVERY', 'COMPLETED',
];
export const OFF_FLOW: SponsorshipStatus[] = ['ENDED', 'CANCELLED'];
