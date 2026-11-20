/* Colunas da exportação de apadrinhamentos (as mesmas do servidor, em
   src/modules/exports/utils/custom-export.util.ts do backend). */

export type ExportRow = {
  sponsorshipId: string;
  childId: string | null;
  /** criança da campanha ainda sem padrinho (linha sem apadrinhamento) */
  unsponsored?: boolean;
  publicId: number | null;
  childName: string;
  birthDate: string | null;
  age: number | null;
  gift: string | null;
  mother: string | null;
  city: string | null;
  community: string | null;
  school: string | null;
  sponsorId: string | null;
  sponsorName: string | null;
  sponsorEmail: string | null;
  sponsorPhone: string | null;
  method: string | null;
  donationAmount: number | null;
  status: string | null;
  statusLabel: string | null;
  collectionPoint: string | null;
  createdAt: string | null;
};

export type SponsorContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  children: number;
  communities: string[];
  collectionPoints: string[];
};

export type GroupBy = 'community' | 'city' | 'school' | 'sponsor' | 'collectionPoint' | 'none';

/** weight = largura relativa no PDF */
export const EXPORT_FIELDS: { key: string; label: string; weight: number; default?: boolean }[] = [
  { key: 'publicId', label: 'ID', weight: 0.6, default: true },
  { key: 'childName', label: 'Criança', weight: 2.2, default: true },
  { key: 'age', label: 'Idade', weight: 0.7, default: true },
  { key: 'place', label: 'Comunidade / cidade', weight: 1.8, default: true },
  { key: 'gift', label: 'Presente', weight: 2.2, default: true },
  { key: 'sponsorName', label: 'Padrinho', weight: 2, default: true },
  { key: 'birthDate', label: 'Nascimento', weight: 1 },
  { key: 'mother', label: 'Mãe', weight: 2 },
  { key: 'city', label: 'Cidade', weight: 1.4 },
  { key: 'community', label: 'Comunidade', weight: 1.5 },
  { key: 'school', label: 'Escola', weight: 1.5 },
  { key: 'sponsorEmail', label: 'E-mail do padrinho', weight: 2.2 },
  { key: 'sponsorPhone', label: 'Telefone do padrinho', weight: 1.3 },
  { key: 'method', label: 'Forma', weight: 0.9 },
  { key: 'donationAmount', label: 'Valor PIX', weight: 0.9 },
  { key: 'statusLabel', label: 'Status', weight: 1.2 },
  { key: 'collectionPoint', label: 'Ponto de coleta', weight: 1.8 },
  { key: 'createdAt', label: 'Apadrinhado em', weight: 1 },
];
export const DEFAULT_FIELDS = EXPORT_FIELDS.filter((f) => f.default).map((f) => f.key);
export const FIELD_LABEL = Object.fromEntries(EXPORT_FIELDS.map((f) => [f.key, f.label])) as Record<string, string>;

export const GROUP_LABEL: Record<GroupBy, string> = {
  community: 'Comunidade',
  city: 'Cidade',
  school: 'Comunidade › escola',
  sponsor: 'Padrinho',
  collectionPoint: 'Ponto de coleta',
  none: 'Sem agrupar',
};

const br = (iso: string | null) => {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

export function cellText(r: ExportRow, key: string): string {
  switch (key) {
    case 'place': return [r.community, r.city].filter(Boolean).join(' / ');
    case 'birthDate': return br(r.birthDate);
    case 'createdAt': return br(r.createdAt);
    case 'method': return r.method === 'PIX' ? 'PIX' : r.method === 'GIFT' ? 'Presente' : '';
    case 'age': return r.age != null ? `${r.age} ${r.age === 1 ? 'ano' : 'anos'}` : '';
    case 'sponsorName': return r.unsponsored ? 'Sem padrinho' : r.sponsorName ?? '';
    case 'donationAmount': return r.donationAmount != null ? r.donationAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
    default: {
      const v = (r as Record<string, unknown>)[key];
      return v == null ? '' : String(v);
    }
  }
}

export function groupLabel(r: ExportRow, by: GroupBy): string {
  switch (by) {
    case 'community': return r.community ? `${r.community}${r.city ? ` (${r.city})` : ''}` : `Sem comunidade${r.city ? ` (${r.city})` : ''}`;
    case 'city': return r.city || 'Sem cidade';
    // a mesma escola pode atender várias comunidades: cada comunidade fica com o seu grupo
    case 'school': return `${r.community || 'Sem comunidade'}${r.city ? ` (${r.city})` : ''} › ${r.school || 'Sem escola declarada'}`;
    case 'sponsor': return r.unsponsored ? FREE_LABEL : r.sponsorName || 'Sem padrinho';
    case 'collectionPoint': return r.unsponsored ? FREE_LABEL : r.collectionPoint || 'Sem ponto de coleta';
    default: return 'Apadrinhamentos';
  }
}

export const FREE_LABEL = 'Crianças sem padrinho';

const cmp = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true });

/** ordem dentro do grupo; "sponsor" = por padrinho (as sem padrinho no fim) e, dentro dele, por ID */
export type SortBy = 'name' | 'id' | 'sponsor';

/** Dentro do grupo: por nome da criança ou pelo ID */
const byId = (x: ExportRow, y: ExportRow) => (x.publicId ?? 1e9) - (y.publicId ?? 1e9) || cmp(x.childName ?? '', y.childName ?? '');
const byRow = (sortBy: SortBy) => (x: ExportRow, y: ExportRow) =>
  sortBy === 'id' ? byId(x, y)
  : sortBy === 'sponsor' ? Number(!!x.unsponsored) - Number(!!y.unsponsored) || cmp(x.sponsorName ?? '', y.sponsorName ?? '') || byId(x, y)
  : cmp(x.childName ?? '', y.childName ?? '');

export function groupRows(rows: ExportRow[], by: GroupBy, sortBy: SortBy = 'name') {
  const map = new Map<string, { label: string; sort: string; rows: ExportRow[] }>();
  for (const r of rows) {
    const label = groupLabel(r, by);
    // as sem padrinho (quando o grupo é padrinho ou ponto de coleta) ficam no fim
    const sort = label === FREE_LABEL ? '\uffff'
      : by === 'community' ? `${r.city ?? '~'}|${r.community ?? '~'}`
      : by === 'school' ? `${r.city ?? '~'}|${r.community ?? '~'}|${r.school ?? '\uffff'}`
      : label;
    const g = map.get(label) ?? { label, sort, rows: [] };
    g.rows.push(r);
    map.set(label, g);
  }
  return [...map.values()]
    .sort((a, b) => cmp(a.sort, b.sort))
    .map((g) => ({ label: g.label, rows: [...g.rows].sort(byRow(sortBy)) }));
}

export type SponsorInGroup = { id: string; name: string; email: string | null; phone: string | null; children: number; ids: number[] };

/**
 * Padrinhos separados por grupo: comunidade (padrão) ou, se a lista estiver separada por
 * cidade/escola/ponto de coleta, o mesmo grupo dela. Quem apadrinha em mais de uma comunidade
 * aparece em cada uma, com as crianças daquela comunidade.
 */
export function sponsorGroups(rows: ExportRow[], by: GroupBy, sortBy: SortBy = 'name') {
  const sponsorBy: GroupBy = by === 'city' || by === 'school' || by === 'collectionPoint' ? by : 'community';
  return groupRows(rows.filter((r) => r.sponsorId), sponsorBy, sortBy).map((g) => {
    const map = new Map<string, SponsorInGroup>();
    for (const r of g.rows) {
      const s = map.get(r.sponsorId!) ?? { id: r.sponsorId!, name: r.sponsorName ?? '', email: r.sponsorEmail, phone: r.sponsorPhone, children: 0, ids: [] };
      s.children++;
      if (r.publicId != null) s.ids.push(r.publicId);
      map.set(r.sponsorId!, s);
    }
    const sponsors = [...map.values()]
      .map((s) => ({ ...s, ids: [...s.ids].sort((a, b) => a - b) }))
      .sort((a, b) => cmp(a.name, b.name));
    return { label: g.label, sponsors };
  });
}

export type GiftCount = { gift: string; count: number; ids: number[] };

/**
 * Resumo dos presentes: em cada comunidade (ou no mesmo grupo da lista, se for cidade/escola/
 * ponto de coleta), quantos de cada presente — o mesmo presente escrito igual é somado,
 * sem diferença de maiúsculas e espaços. Ordem: mais pedidos primeiro.
 */
export function giftSummary(rows: ExportRow[], by: GroupBy) {
  const giftBy: GroupBy = by === 'city' || by === 'school' || by === 'collectionPoint' ? by : 'community';
  // só as apadrinhadas: é a lista do que será comprado/entregue
  return groupRows(rows.filter((r) => !r.unsponsored), giftBy, 'id').map((g) => {
    const map = new Map<string, GiftCount>();
    for (const r of g.rows) {
      const text = (r.gift ?? '').trim().replace(/\s+/g, ' ');
      const key = text.toUpperCase() || '~';
      const item = map.get(key) ?? { gift: text ? text.toUpperCase() : '(sem presente informado)', count: 0, ids: [] };
      item.count++;
      if (r.publicId != null) item.ids.push(r.publicId);
      map.set(key, item);
    }
    const gifts = [...map.values()].sort((a, b) => b.count - a.count || cmp(a.gift, b.gift));
    return { label: g.label, total: g.rows.length, gifts };
  });
}

/* —— padrinhos e pontos de coleta do conjunto exportado —— */

/** Colunas da lista de padrinhos (página/aba final) */
export const SPONSOR_FIELDS: { key: string; label: string; width: number; weight: number; default?: boolean }[] = [
  { key: 'name', label: 'Padrinho', width: 30, weight: 2.2, default: true },
  { key: 'count', label: 'Crianças', width: 10, weight: 0.8, default: true },
  { key: 'method', label: 'Forma', width: 20, weight: 1.4, default: true },
  { key: 'email', label: 'E-mail', width: 32, weight: 2.2, default: true },
  { key: 'phone', label: 'Telefone', width: 18, weight: 1.3, default: true },
  { key: 'pixAmount', label: 'Valor PIX', width: 12, weight: 1 },
  { key: 'points', label: 'Pontos de coleta', width: 30, weight: 2 },
  { key: 'communities', label: 'Comunidades', width: 34, weight: 2.2 },
  { key: 'ids', label: 'IDs das crianças', width: 34, weight: 2 },
];
export const DEFAULT_SPONSOR_FIELDS = SPONSOR_FIELDS.filter((f) => f.default).map((f) => f.key);

export type SponsorStats = {
  id: string; name: string; email: string | null; phone: string | null;
  count: number; gift: number; pix: number; pixAmount: number;
  points: string[]; communities: string[]; ids: number[];
};

/** Um padrinho por linha, com o que ele tem neste conjunto */
export function sponsorStats(rows: ExportRow[]): SponsorStats[] {
  const map = new Map<string, SponsorStats & { _p: Set<string>; _c: Set<string> }>();
  for (const r of rows) {
    if (r.unsponsored || !r.sponsorId) continue;
    const s = map.get(r.sponsorId) ?? {
      id: r.sponsorId, name: r.sponsorName ?? '', email: r.sponsorEmail, phone: r.sponsorPhone,
      count: 0, gift: 0, pix: 0, pixAmount: 0, points: [], communities: [], ids: [], _p: new Set<string>(), _c: new Set<string>(),
    };
    s.count++;
    if (r.method === 'PIX') { s.pix++; s.pixAmount += r.donationAmount ?? 0; } else s.gift++;
    if (r.collectionPoint) s._p.add(r.collectionPoint);
    if (r.community || r.city) s._c.add(groupLabel(r, 'community'));
    if (r.publicId != null) s.ids.push(r.publicId);
    map.set(r.sponsorId, s);
  }
  return [...map.values()]
    .map(({ _p, _c, ...s }) => ({ ...s, points: [..._p].sort(cmp), communities: [..._c].sort(cmp), ids: [...s.ids].sort((a, b) => a - b) }))
    .sort((a, b) => cmp(a.name, b.name));
}

/** "2 presentes · 1 PIX" */
export const methodText = (gift: number, pix: number) =>
  [gift ? `${gift} presente${gift === 1 ? '' : 's'}` : '', pix ? `${pix} PIX` : ''].filter(Boolean).join(' · ');

export function sponsorCell(s: SponsorStats, key: string): string | number {
  switch (key) {
    case 'name': return s.name;
    case 'count': return s.count;
    case 'method': return methodText(s.gift, s.pix);
    case 'email': return s.email ?? '';
    case 'phone': return s.phone ?? '';
    case 'pixAmount': return s.pixAmount ? s.pixAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
    case 'points': return s.points.join('; ');
    case 'communities': return s.communities.join('; ');
    case 'ids': return s.ids.join(', ');
    default: return '';
  }
}

export type PointSummary = {
  label: string; kind: 'point' | 'pix' | 'none';
  children: number; sponsors: number; received: number; pending: number; communities: string[];
};
/** já recebidos no galpão ou entregues */
const RECEIVED_STATUS = ['PACKED', 'BOXED', 'COMPLETED'];

/** Resumo por ponto de coleta (PIX e presente sem ponto em linhas próprias; sem padrinho fica de fora) */
export function pointSummary(rows: ExportRow[]): PointSummary[] {
  const map = new Map<string, PointSummary & { _s: Set<string>; _c: Set<string> }>();
  for (const r of rows) {
    if (r.unsponsored) continue;
    const kind: PointSummary['kind'] = r.method === 'PIX' ? 'pix' : r.collectionPoint ? 'point' : 'none';
    const label = kind === 'pix' ? 'PIX (presente comprado pela equipe)' : kind === 'none' ? 'Presente sem ponto de coleta' : r.collectionPoint!;
    const p = map.get(label) ?? { label, kind, children: 0, sponsors: 0, received: 0, pending: 0, communities: [], _s: new Set<string>(), _c: new Set<string>() };
    p.children++;
    if (r.status && RECEIVED_STATUS.includes(r.status)) p.received++;
    if (r.status === 'PENDING') p.pending++;
    if (r.sponsorId) p._s.add(r.sponsorId);
    if (r.community || r.city) p._c.add(groupLabel(r, 'community'));
    map.set(label, p);
  }
  return [...map.values()]
    .map(({ _s, _c, ...p }) => ({ ...p, sponsors: _s.size, communities: [..._c].sort(cmp) }))
    .sort((a, b) => Number(a.kind !== 'point') - Number(b.kind !== 'point') || cmp(a.label, b.label));
}

/* —— colunas das listas do PDF de cartões —— */

/** O que dá para mostrar nas listas do PDF de cartões (weight = largura relativa) */
export const CARD_LIST_FIELDS: { key: string; label: string; weight: number }[] = [
  { key: 'id', label: 'ID', weight: 0.6 },
  { key: 'name', label: 'Criança', weight: 2 },
  { key: 'age', label: 'Idade', weight: 0.65 },
  { key: 'place', label: 'Comunidade / cidade', weight: 1.5 },
  { key: 'community', label: 'Comunidade', weight: 1.3 },
  { key: 'city', label: 'Cidade', weight: 1.2 },
  { key: 'school', label: 'Escola', weight: 1.6 },
  { key: 'gift', label: 'Presente', weight: 2 },
  { key: 'sponsor', label: 'Padrinho', weight: 1.6 },
  { key: 'method', label: 'Forma', weight: 0.8 },
  { key: 'collectionPoint', label: 'Ponto de coleta', weight: 1.6 },
  { key: 'status', label: 'Status', weight: 1.15 },
];
export const DEFAULT_LIST_COLUMNS = ['id', 'name', 'age', 'place', 'gift', 'status'];
export const DEFAULT_GENERAL_COLUMNS = ['id', 'name', 'age', 'place', 'gift', 'sponsor', 'status'];

/* —— legenda de cada cartão (abaixo da arte) —— */

/** O que pode aparecer abaixo da arte; idade, comunidade, cidade e local saem juntos numa linha */
export const CAPTION_FIELDS: { key: string; label: string }[] = [
  { key: 'name', label: 'Nome' },
  { key: 'id', label: 'ID' },
  { key: 'age', label: 'Idade' },
  { key: 'place', label: 'Comunidade ou cidade' },
  { key: 'community', label: 'Comunidade' },
  { key: 'city', label: 'Cidade' },
  { key: 'school', label: 'Escola' },
  { key: 'gift', label: 'Presente' },
  { key: 'sponsor', label: 'Padrinho' },
  { key: 'method', label: 'Forma' },
  { key: 'collectionPoint', label: 'Ponto de coleta' },
  { key: 'campaign', label: 'Campanha' },
  { key: 'status', label: 'Status (selo)' },
];
export const DEFAULT_CAPTION_FIELDS = ['name', 'id', 'age', 'place', 'gift', 'status'];

