/* Conferência com a origem: lê as abas da planilha da campanha (blocos "COMUNIDADE:" com
   cabeçalho ID / CRIANÇA / NASCIM / IDADE / PRESENTE / MÃE) e a lista da pasta de fotos do
   Drive, e compara com as crianças do site. Só calcula — não grava nada. */

import { autoMapColumns, normalizeText, parseSheetAge, parseSheetDate } from './sheetImport';

export type SheetChild = {
  tab: string;
  line: number;
  community: string;
  publicId: string; // sem zeros à esquerda
  name: string;
  birthDate?: string; // yyyy-mm-dd
  age?: number;
  gift?: string;
  mother?: string;
};

export type DriveFile = {
  id: string;
  name: string;
  path: string[];
  mimeType: string;
  md5: string | null;
  size: number | null;
  modifiedTime: string;
};

/** Criança do site (listagem da campanha: ID e presente já são os desta campanha) */
export type SiteChild = {
  id: string;
  publicId: number;
  name: string;
  birthDate?: string | null;
  wantedGift?: string | null;
  cityId?: string | null;
  cityName?: string | null;
  city?: { id: string; name: string } | null;
  community?: { id: string; name: string } | null;
  sponsorships?: { status: string }[];
  images?: { id: string | null; placeholder?: boolean; createdAt?: string }[];
};

export type IssueKind =
  | 'new' | 'idMismatch' | 'otherChild' | 'removed' | 'changed'
  | 'photoNotOnSite' | 'photoNewer' | 'photoDifferent' | 'photoMissing' | 'orphanPhoto';

export type Issue = {
  kind: IssueKind;
  city: string;
  community: string;
  publicId: string;
  name: string;
  /** o que mudou (planilha × site) */
  details: { field: string; sheet: string; site: string }[];
  sheet?: SheetChild;
  site?: SiteChild;
  photo?: DriveFile;
};

export const ISSUE_LABEL: Record<IssueKind, string> = {
  new: 'Nova na planilha',
  idMismatch: 'Mesmo nome, outro ID',
  otherChild: 'ID com outra criança',
  removed: 'Saiu da planilha',
  changed: 'Dados diferentes',
  photoNotOnSite: 'Foto no Drive, não no site',
  photoNewer: 'Foto do Drive mais nova',
  photoDifferent: 'Foto diferente',
  photoMissing: 'Sem foto no Drive',
  orphanPhoto: 'Foto sem criança',
};

const ALIASES = {
  publicId: ['id', 'publicid', 'codigo', 'cod', 'numero', 'num', 'n', 'no', 'id crianca', 'n crianca'],
  name: ['crianca', 'nome', 'nome da crianca', 'nome crianca', 'name', 'aluno'],
  birthDate: ['nascim', 'nasc', 'nascimento', 'data de nascimento', 'data nascimento', 'dt nasc', 'dn'],
  age: ['idade', 'age', 'anos'],
  gift: ['presente', 'presente desejado', 'pedido', 'desejo', 'brinquedo'],
  mother: ['mae', 'nome da mae', 'responsavel'],
};

const canonical = (v: string) => (/^\d+$/.test(v) ? String(parseInt(v, 10)) : v);
const sameText = (a?: string | null, b?: string | null) =>
  (a ?? '').trim().replace(/\s+/g, ' ').toUpperCase() === (b ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/** Parecença de nomes (0 a 1) sem acento: Dice dos pares de letras */
export function nameSimilarity(a: string, b: string) {
  const x = normalizeText(a).replace(/ /g, ''), y = normalizeText(b).replace(/ /g, '');
  if (!x || !y) return 0;
  if (x === y) return 1;
  const pairs = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const p = s.slice(i, i + 2); m.set(p, (m.get(p) ?? 0) + 1); } return m; };
  const px = pairs(x), py = pairs(y);
  let hit = 0;
  for (const [p, n] of px) hit += Math.min(n, py.get(p) ?? 0);
  return (2 * hit) / (x.length - 1 + y.length - 1);
}

/** Crianças de uma aba: blocos "COMUNIDADE:", cada um com seu cabeçalho */
export function parseCampaignTab(tab: string, rows: string[][]): SheetChild[] {
  const out: SheetChild[] = [];
  const byId = new Map<string, SheetChild>();
  let community = '';
  let cols: Partial<Record<keyof typeof ALIASES, number>> | null = null;

  rows.forEach((r, i) => {
    const first = normalizeText(r[0] ?? '');
    if (first.startsWith('comunidade')) {
      community = r.slice(1).map((c) => (c ?? '').trim()).find((c) => c) ?? '';
      return;
    }
    const map = autoMapColumns(r.map((c) => c ?? ''), ALIASES);
    if (map.name && map.publicId) {
      cols = Object.fromEntries(Object.entries(map).map(([k, h]) => [k, r.indexOf(h as string)])) as typeof cols;
      return;
    }
    if (!cols) return;
    const cell = (k: keyof typeof ALIASES) => { const idx = cols![k]; return idx != null && idx >= 0 ? (r[idx] ?? '').trim() : ''; };
    const idRaw = cell('publicId').replace(/\.0+$/, '');
    const name = cell('name');
    if (!/^\d{1,9}$/.test(idRaw) || name.length < 2) return;
    // "SEM FOTO" na coluna de presente é marcação da planilha, não presente
    const giftRaw = cell('gift');
    const gift = normalizeText(giftRaw) === 'sem foto' ? '' : giftRaw;
    const child: SheetChild = {
      tab,
      line: i + 1,
      community,
      publicId: canonical(idRaw),
      name,
      birthDate: parseSheetDate(cell('birthDate')) ?? undefined,
      age: parseSheetAge(cell('age')),
      gift: gift || undefined,
      mother: cell('mother') || undefined,
    };
    const prev = byId.get(child.publicId);
    if (prev && normalizeText(prev.name) === normalizeText(child.name)) return; // a mesma linha colada duas vezes
    byId.set(child.publicId, child);
    out.push(child);
  });
  return out;
}

/** Aba ↔ cidade do site: "MISSÕES" é "São João Das Missões", "BONITO" é "Bonito" */
export function matchTabToCity(tab: string, cities: string[]): string | null {
  const t = normalizeText(tab).split(' ').filter((w) => w.length > 2);
  if (!t.length) return null;
  const hits = cities.filter((c) => {
    const words = normalizeText(c).split(' ');
    return t.every((w) => words.includes(w)) || normalizeText(c).split(' ').filter((w) => w.length > 2).every((w) => t.includes(w));
  });
  return hits.length === 1 ? hits[0] : null;
}

const cityOf = (c: SiteChild) => c.city?.name ?? c.cityName ?? '';
const photoId = (f: DriveFile) => f.name.replace(/\.[^.]+$/, '').match(/^(\d{1,9})/)?.[1];
const isImage = (f: DriveFile) => f.mimeType.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);
const sitePhoto = (c?: SiteChild) => c?.images?.find((i) => i.id && !i.placeholder) ?? null;

/**
 * Compara a planilha (abas já ligadas às cidades) e o Drive com o site.
 * `tabCity`: aba → nome da cidade no site (abas sem cidade ficam de fora).
 * `siteMd5`: MD5 da foto do site por id da criança, quando já calculado.
 */
export function compareSource(input: {
  sheet: SheetChild[];
  tabCity: Record<string, string>;
  site: SiteChild[];
  drive: DriveFile[];
  siteMd5?: Record<string, string | null>;
}): Issue[] {
  const issues: Issue[] = [];
  const checkedCities = new Set(Object.values(input.tabCity));

  // fotos do Drive por ID (a mais recente, se repetida)
  const photos = new Map<string, DriveFile>();
  for (const f of input.drive.filter(isImage)) {
    const id = photoId(f);
    if (!id) continue;
    const k = canonical(id);
    const prev = photos.get(k);
    if (!prev || prev.modifiedTime < f.modifiedTime) photos.set(k, f);
  }

  const siteByKey = new Map<string, SiteChild>(); // cidade|ID
  for (const c of input.site) siteByKey.set(`${normalizeText(cityOf(c))}|${c.publicId}`, c);
  const seenSite = new Set<string>();
  const sheetIds = new Set<string>();

  for (const row of input.sheet) {
    const city = input.tabCity[row.tab];
    if (!city) continue;
    sheetIds.add(row.publicId);
    const site = siteByKey.get(`${normalizeText(city)}|${row.publicId}`);
    const base = { city, community: row.community, publicId: row.publicId, name: row.name, sheet: row };

    if (!site) {
      // mesmo nome com outro ID na cidade?
      const twin = input.site.find((c) => normalizeText(cityOf(c)) === normalizeText(city) && nameSimilarity(c.name, row.name) >= 0.9);
      issues.push(twin
        ? { ...base, kind: 'idMismatch', site: twin, details: [{ field: 'ID', sheet: row.publicId, site: String(twin.publicId) }] }
        : { ...base, kind: 'new', details: [] });
      if (twin) seenSite.add(twin.id);
    } else {
      seenSite.add(site.id);
      if (nameSimilarity(site.name, row.name) < 0.75) {
        issues.push({ ...base, kind: 'otherChild', site, details: [{ field: 'Nome', sheet: row.name, site: site.name }] });
      } else {
        const details: Issue['details'] = [];
        if (!sameText(site.name, row.name)) details.push({ field: 'Nome', sheet: row.name, site: site.name });
        if (row.gift && !sameText(site.wantedGift, row.gift)) details.push({ field: 'Presente', sheet: row.gift, site: site.wantedGift ?? '' });
        const siteBirth = site.birthDate ? site.birthDate.slice(0, 10) : '';
        if (row.birthDate && row.birthDate !== siteBirth) details.push({ field: 'Nascimento', sheet: row.birthDate, site: siteBirth });
        if (row.community && normalizeText(row.community) !== normalizeText(site.community?.name ?? '')) {
          details.push({ field: 'Comunidade', sheet: row.community, site: site.community?.name ?? '' });
        }
        if (details.length) issues.push({ ...base, kind: 'changed', site, details });
      }
    }

    // foto
    const photo = photos.get(row.publicId);
    const current = sitePhoto(site);
    if (!photo) {
      issues.push({ ...base, kind: 'photoMissing', site, details: [] });
    } else if (site && !current) {
      issues.push({ ...base, kind: 'photoNotOnSite', site, photo, details: [] });
    } else if (site && current) {
      const md5 = input.siteMd5?.[site.id];
      if (md5 !== undefined && photo.md5) {
        if (md5 !== photo.md5) issues.push({ ...base, kind: 'photoDifferent', site, photo, details: [{ field: 'Foto', sheet: photo.modifiedTime.slice(0, 10), site: (current.createdAt ?? '').slice(0, 10) }] });
      } else if (current.createdAt && photo.modifiedTime > current.createdAt) {
        issues.push({ ...base, kind: 'photoNewer', site, photo, details: [{ field: 'Foto', sheet: photo.modifiedTime.slice(0, 10), site: current.createdAt.slice(0, 10) }] });
      }
    }
  }

  // no site e não na planilha (só nas cidades conferidas)
  for (const c of input.site) {
    const city = cityOf(c);
    if (!checkedCities.has(city) || seenSite.has(c.id)) continue;
    issues.push({ kind: 'removed', city, community: c.community?.name ?? '', publicId: String(c.publicId), name: c.name, site: c, details: [] });
  }

  // fotos cujo ID não está na planilha
  for (const [id, f] of photos) {
    if (sheetIds.has(id)) continue;
    issues.push({ kind: 'orphanPhoto', city: f.path[0] ?? '', community: f.path[1] ?? '', publicId: id, name: f.name, photo: f, details: [] });
  }
  return issues;
}

/** Linhas no formato da planilha, para colar na tela de Atualização de crianças */
export function toSheetTsv(rows: SheetChild[]) {
  const br = (iso?: string) => { const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  return [
    ['ID', 'CRIANÇA', 'NASCIM', 'IDADE', 'PRESENTE', 'MÃE'].join('\t'),
    ...rows.map((r) => [r.publicId, r.name, br(r.birthDate), r.age ?? '', r.gift ?? '', r.mother ?? ''].join('\t')),
  ].join('\n');
}
