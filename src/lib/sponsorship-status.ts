export type SponsorshipStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'IN_PURCHASE'
  | 'PACKED'
  | 'BOXED'
  | 'AWAITING_DELIVERY'
  | 'COMPLETED'
  | 'ENDED'
  | 'CANCELLED';

export const STATUS_PT: Record<SponsorshipStatus, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  IN_PURCHASE: 'Em compra',
  PACKED: 'Embalado',
  BOXED: 'Encaixotado',
  AWAITING_DELIVERY: 'Aguardando entrega',
  COMPLETED: 'Concluído',
  ENDED: 'Encerrado',
  CANCELLED: 'Cancelado',
};

// caixinhas/pílulas (ajuste para suas variantes/util se usar shadcn/ui)
export type BadgeTone =
  | 'gray' | 'zinc' | 'slate'
  | 'blue' | 'sky' | 'indigo' | 'violet'
  | 'amber' | 'yellow'
  | 'emerald' | 'green'
  | 'red';

export const STATUS_BADGE: Record<SponsorshipStatus, BadgeTone> = {
  PENDING: 'amber',
  IN_PROGRESS: 'blue',
  IN_PURCHASE: 'indigo',
  PACKED: 'violet',
  BOXED: 'zinc',
  AWAITING_DELIVERY: 'emerald',
  COMPLETED: 'green',
  ENDED: 'zinc',
  CANCELLED: 'red',
};

// grupos úteis
export const IN_PROGRESS_GROUP: SponsorshipStatus[] = [
  'IN_PROGRESS', 'IN_PURCHASE', 'PACKED', 'BOXED', 'AWAITING_DELIVERY',
];

export const ACTIVE_STATUSES: SponsorshipStatus[] = [
  'PENDING', ...IN_PROGRESS_GROUP, 'COMPLETED',
];

export const CLOSED_STATUSES: SponsorshipStatus[] = ['ENDED', 'CANCELLED'];

// ordem do fluxo (para ordenar/timeline)
export const LOGISTICS_FLOW: SponsorshipStatus[] = [
  'PENDING','IN_PROGRESS','IN_PURCHASE','PACKED','BOXED','AWAITING_DELIVERY','COMPLETED','ENDED','CANCELLED'
];

export function isInProgress(s?: SponsorshipStatus | null): boolean {
  return !!s && IN_PROGRESS_GROUP.includes(s);
}
export function isClosed(s?: SponsorshipStatus | null): boolean {
  return !!s && CLOSED_STATUSES.includes(s);
}

// compara por "etapa" do fluxo (útil para ordenar colunas por status)
export function compareByFlow(a?: SponsorshipStatus | null, b?: SponsorshipStatus | null): number {
  const idx = (s?: SponsorshipStatus | null) => (s ? LOGISTICS_FLOW.indexOf(s) : -1);
  return idx(a) - idx(b);
}
