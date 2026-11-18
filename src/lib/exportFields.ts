/* Colunas da exportação de apadrinhamentos (as mesmas do servidor, em
   src/modules/exports/utils/custom-export.util.ts do backend). */

export type ExportRow = {
  sponsorshipId: string;
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
  school: 'Escola',
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
    case 'school': return r.school || 'Sem escola';
    case 'sponsor': return r.sponsorName || 'Sem padrinho';
    case 'collectionPoint': return r.collectionPoint || 'Sem ponto de coleta';
    default: return 'Apadrinhamentos';
  }
}

const cmp = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true });

export type SortBy = 'name' | 'id';

/** Dentro do grupo: por nome da criança ou pelo ID */
const byRow = (sortBy: SortBy) => (x: ExportRow, y: ExportRow) =>
  sortBy === 'id' ? (x.publicId ?? 1e9) - (y.publicId ?? 1e9) || cmp(x.childName ?? '', y.childName ?? '') : cmp(x.childName ?? '', y.childName ?? '');

export function groupRows(rows: ExportRow[], by: GroupBy, sortBy: SortBy = 'name') {
  const map = new Map<string, { label: string; sort: string; rows: ExportRow[] }>();
  for (const r of rows) {
    const label = groupLabel(r, by);
    const sort = by === 'community' ? `${r.city ?? '~'}|${r.community ?? '~'}` : label;
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
  return groupRows(rows, giftBy, 'id').map((g) => {
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
