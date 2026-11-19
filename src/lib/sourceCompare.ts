/* Conferência com a origem: lê as abas da planilha da campanha (blocos "COMUNIDADE:" com
   cabeçalho ID / CRIANÇA / NASCIM / IDADE / PRESENTE / MÃE) e a lista da pasta de fotos do
   Drive, e compara com as crianças do site. Só calcula — não grava nada. */

import { autoMapColumns, normalizeText, parseSheetAge, parseSheetDate } from './sheetImport';

export type SheetChild = {
  tab: string;
  line: number;
  community: string;
  /** escola do cabeçalho da comunidade (coluna M) */
  school?: string;
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
  school?: { id: string; name: string } | null;
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
  /** escola que a criança deve ter, pela ligação "escola da planilha → escola do site" */
  schoolChoice?: SchoolChoice;
};

/** Escola escolhida (do site) ou nova, a criar com o nome da planilha */
export type SchoolChoice = { schoolId?: string | null; newName?: string | null };

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

const looksLikeSchool = (v: string) => /\b(escola|escolar|creche|colegio|centro|cei|ceim|cemei|e ?m|e ?e)\b/.test(normalizeText(v));

/** Crianças de uma aba: blocos "COMUNIDADE:", cada um com seu cabeçalho */
export function parseCampaignTab(tab: string, rows: string[][]): SheetChild[] {
  const out: SheetChild[] = [];
  const byId = new Map<string, SheetChild>();
  let community = '';
  let school = '';
  let cols: Partial<Record<keyof typeof ALIASES, number>> | null = null;

  rows.forEach((r, i) => {
    const first = normalizeText(r[0] ?? '');
    if (first.startsWith('comunidade')) {
      // cabeçalho: COMUNIDADE: | … | comunidade (D) | … | cidade (I) | … | escola (M)
      const vals = r.slice(1).map((c) => (c ?? '').trim()).filter(Boolean);
      community = vals[0] ?? '';
      const m = (r[12] ?? '').trim();
      school = m && normalizeText(m) !== normalizeText(community) ? m : (vals.slice(2).find(looksLikeSchool) ?? '');
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
      school: school || undefined,
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
  /** schoolKey(cidade, comunidade, escola da planilha) → id da escola do site | 'new' (criar) | '' (não definir) */
  schoolMap?: Record<string, string>;
  schoolNames?: Record<string, string>;
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
    const target = row.school ? input.schoolMap?.[schoolKey(city, row.community, row.school)] : undefined;
    const schoolChoice: SchoolChoice | undefined =
      target === 'new' ? { newName: row.school } : target ? { schoolId: target } : undefined;
    const base = { city, community: row.community, publicId: row.publicId, name: row.name, sheet: row, schoolChoice };

    if (!site) {
      // mesmo nome com outro ID na cidade?
      const twin = input.site.find((c) => normalizeText(cityOf(c)) === normalizeText(city) && nameSimilarity(c.name, row.name) >= 0.9);
      issues.push(twin
        ? { ...base, kind: 'idMismatch', site: twin, details: [{ field: 'ID', sheet: row.publicId, site: String(twin.publicId) }] }
        : { ...base, kind: 'new', photo: photos.get(row.publicId), details: [] });
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
        if (schoolChoice && (schoolChoice.newName || schoolChoice.schoolId !== site.school?.id)) {
          details.push({
            field: 'Escola',
            sheet: schoolChoice.newName ? `${schoolChoice.newName} (nova)` : input.schoolNames?.[schoolChoice.schoolId!] ?? row.school ?? '',
            site: site.school?.name ?? '',
          });
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

/* —— resolver: cada pendência vira um ajuste para o servidor —— */

export type SyncItem =
  | { op: 'create'; key: string; cityId: string; community?: string | null; school?: SchoolChoice | null; row: { publicId: string; name: string; birthDate?: string | null; age?: number | null; gift?: string | null; mother?: string | null }; photoFileId?: string | null; useChildId?: string | null; forceNew?: boolean }
  | { op: 'update'; key: string; childId: string; cityId?: string | null; fields: { name?: string; gift?: string; birthDate?: string; community?: string; school?: SchoolChoice } }
  | { op: 'renumber'; key: string; childId: string; publicId: number }
  | { op: 'photo'; key: string; childId: string; photoFileId: string }
  | { op: 'remove'; key: string; childId: string; sponsorship?: { id: string; decision: 'cancel' | 'replace'; replacementChildId?: string | null } | null };

/** Tipos que dá para resolver pela conferência */
export const RESOLVABLE: IssueKind[] = ['new', 'removed', 'idMismatch', 'changed', 'photoNotOnSite', 'photoNewer', 'photoDifferent'];

/** Identificador estável da pendência (para seleção) */
export function issueKey(i: Issue) {
  return `${i.kind}:${i.publicId}:${i.site?.id ?? (i.sheet ? `${i.sheet.tab}#${i.sheet.line}` : i.photo?.id ?? '')}`;
}

/** Tem padrinho de verdade (cancelado não conta) */
export const activeSponsorship = (c?: SiteChild) => c?.sponsorships?.find((s) => s.status !== 'CANCELLED') ?? null;

const FIELD: Record<string, 'name' | 'gift' | 'birthDate' | 'community'> = { Nome: 'name', Presente: 'gift', Nascimento: 'birthDate', Comunidade: 'community' };

/** A pendência como ajuste; null quando não dá para resolver por aqui */
export function issueToItem(i: Issue, cityIdByName: Record<string, string>): SyncItem | null {
  const key = issueKey(i);
  switch (i.kind) {
    case 'new': {
      const cityId = cityIdByName[i.city];
      if (!i.sheet || !cityId) return null;
      const r = i.sheet;
      return {
        op: 'create', key, cityId, community: r.community || null, school: i.schoolChoice ?? null,
        row: { publicId: r.publicId, name: r.name, birthDate: r.birthDate ?? null, age: r.age ?? null, gift: r.gift ?? null, mother: r.mother ?? null },
        photoFileId: i.photo?.id ?? null,
      };
    }
    case 'changed': {
      if (!i.site) return null;
      const fields: Extract<SyncItem, { op: 'update' }>['fields'] = {};
      for (const d of i.details) {
        if (d.field === 'Escola') { if (i.schoolChoice) fields.school = i.schoolChoice; continue; }
        if (FIELD[d.field] && d.sheet) fields[FIELD[d.field]] = d.sheet;
      }
      return { op: 'update', key, childId: i.site.id, cityId: i.site.city?.id ?? i.site.cityId ?? null, fields };
    }
    case 'idMismatch':
      return i.site && /^\d+$/.test(i.publicId) ? { op: 'renumber', key, childId: i.site.id, publicId: Number(i.publicId) } : null;
    case 'photoNotOnSite':
    case 'photoNewer':
    case 'photoDifferent':
      return i.site && i.photo ? { op: 'photo', key, childId: i.site.id, photoFileId: i.photo.id } : null;
    case 'removed':
      return i.site ? { op: 'remove', key, childId: i.site.id } : null;
    default:
      return null;
  }
}

/* —— escolas: escola do cabeçalho da planilha → escola do site —— */

export type SiteSchool = { id: string; name: string; cityId: string; communityIds: string[]; children?: number };

export type SchoolLink = {
  key: string;
  city: string;
  cityId: string | null;
  community: string;
  sheetSchool: string;
  count: number;
  /** sugestão automática: id da escola, 'new' (criar) ou '' (nenhuma) */
  suggestion: string;
  reason: string;
};

export const schoolKey = (city: string, community: string, school: string) =>
  `${normalizeText(city)}|${normalizeText(community)}|${normalizeText(school)}`;

const STOP = new Set(['escola', 'escolar', 'municipal', 'mun', 'estadual', 'est', 'e', 'm', 'de', 'da', 'do', 'das', 'dos', 'a', 'o']);
const core = (v: string) => normalizeText(v).split(' ').filter((w) => w && !STOP.has(w));
function near(a: string, b: string) {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  // no máximo uma letra diferente (troca, falta ou sobra)
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] <= 1;
}
/** quanto do nome da planilha aparece no nome do site (0 a 1), sem "escola municipal de…" */
export function schoolScore(sheet: string, site: string) {
  if (normalizeText(sheet) === normalizeText(site)) return 1;
  const A = core(sheet), B = core(site);
  if (!A.length || !B.length) return 0;
  return A.filter((w) => B.some((x) => near(w, x))).length / A.length;
}

/**
 * Pares cidade/comunidade/escola da planilha com a escola do site sugerida: igual no nome; ou a
 * parecida que as crianças daquela comunidade já usam no site; ou a parecida que atende a
 * comunidade; nada parecido na cidade → criar.
 */
export function suggestSchoolLinks(input: { sheet: SheetChild[]; tabCity: Record<string, string>; site: SiteChild[]; schools: SiteSchool[] }): SchoolLink[] {
  const cityIds: Record<string, string> = {};
  for (const c of input.site) { const n = cityOf(c); const id = c.city?.id ?? c.cityId; if (n && id) cityIds[normalizeText(n)] = id; }
  const pairs = new Map<string, Omit<SchoolLink, 'suggestion' | 'reason'>>();
  for (const r of input.sheet) {
    const city = input.tabCity[r.tab];
    if (!city || !r.school) continue;
    const key = schoolKey(city, r.community, r.school);
    const p = pairs.get(key) ?? { key, city, cityId: cityIds[normalizeText(city)] ?? null, community: r.community, sheetSchool: r.school, count: 0 };
    p.count++;
    pairs.set(key, p);
  }
  return [...pairs.values()].map((p) => {
    const inCity = input.schools.filter((s) => s.cityId === p.cityId);
    const exact = inCity.find((s) => normalizeText(s.name) === normalizeText(p.sheetSchool));
    if (exact) return { ...p, suggestion: exact.id, reason: 'mesmo nome' };
    // escolas que as crianças desta comunidade já usam no site, e a comunidade no site
    const used = new Map<string, number>();
    let communityId: string | null = null;
    for (const c of input.site) {
      if (normalizeText(cityOf(c)) !== normalizeText(p.city) || normalizeText(c.community?.name ?? '') !== normalizeText(p.community)) continue;
      communityId ??= c.community?.id ?? null;
      if (c.school?.id) used.set(c.school.id, (used.get(c.school.id) ?? 0) + 1);
    }
    const ranked = inCity
      .map((s) => ({ s, score: schoolScore(p.sheetSchool, s.name), used: used.get(s.id) ?? 0, serves: !!communityId && s.communityIds.includes(communityId) }))
      .filter((x) => x.score >= 0.5)
      .sort((a, b) => b.used - a.used || Number(b.serves) - Number(a.serves) || b.score - a.score || a.s.name.length - b.s.name.length);
    const best = ranked[0];
    if (!best) return { ...p, suggestion: 'new', reason: 'nenhuma parecida na cidade' };
    const reason = best.used ? `já usada por ${best.used} criança(s) desta comunidade` : best.serves ? 'parecida e atende a comunidade' : 'nome parecido';
    return { ...p, suggestion: best.s.id, reason };
  }).sort((a, b) => a.city.localeCompare(b.city, 'pt-BR') || a.community.localeCompare(b.community, 'pt-BR'));
}

/* —— cadastros que faltam: comunidades e escolas da planilha que não existem no site —— */

export type SiteCommunity = { id: string; name: string; cityId: string; deletedAt?: string | null };

export type MissingCommunity = {
  key: string; city: string; cityId: string; sheetName: string; name: string; count: number;
  status: 'missing' | 'deleted';
  /** parecida no site (pode ser a mesma escrita de outro jeito) */
  similar?: string;
};
export type MissingSchool = {
  key: string; city: string; cityId: string; sheetName: string; name: string; count: number;
  /** comunidades (da planilha) que a escola atende */
  communities: string[];
  /** ligações comunidade → escola que passam a usar a escola criada */
  linkKeys: string[];
};

const CONNECTORS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
/** "ESCOLA MUNICIPAL DO SUMIDOURO" → "Escola Municipal do Sumidouro" ("JUSTA II" → "Justa II") */
export function titleCase(v: string) {
  return v.trim().replace(/\s+/g, ' ').toLowerCase().split(' ').map((w, i) => {
    if (/^(i{1,3}|iv|v|vi{1,3}|ix|x)$/.test(w)) return w.toUpperCase();
    if (i > 0 && CONNECTORS.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

export function findMissing(input: {
  sheet: SheetChild[];
  tabCity: Record<string, string>;
  cityIds: Record<string, string>; // nome da cidade → id
  communities: SiteCommunity[];
  schoolLinks: SchoolLink[];
  schoolMap: Record<string, string>;
}) {
  // comunidades
  const pairs = new Map<string, { city: string; cityId: string; sheetName: string; count: number }>();
  for (const r of input.sheet) {
    const city = input.tabCity[r.tab];
    const cityId = city ? input.cityIds[city] : undefined;
    if (!city || !cityId || !r.community) continue;
    const key = `${cityId}|${normalizeText(r.community)}`;
    const p = pairs.get(key) ?? { city, cityId, sheetName: r.community, count: 0 };
    p.count++;
    pairs.set(key, p);
  }
  const communities: MissingCommunity[] = [];
  for (const [key, p] of pairs) {
    const inCity = input.communities.filter((c) => c.cityId === p.cityId);
    const same = inCity.filter((c) => normalizeText(c.name) === normalizeText(p.sheetName));
    if (same.some((c) => !c.deletedAt)) continue;
    // muito parecida: o sistema já liga sozinho (mesma regra do servidor)
    const close = inCity.filter((c) => !c.deletedAt && nameSimilarity(c.name, p.sheetName) >= 0.88);
    if (!same.length && close.length === 1) continue;
    const best = inCity.filter((c) => !c.deletedAt)
      .map((c) => ({ c, s: nameSimilarity(c.name, p.sheetName) }))
      .sort((a, b) => b.s - a.s)[0];
    communities.push({
      key, city: p.city, cityId: p.cityId, sheetName: p.sheetName, count: p.count,
      name: same[0]?.name ?? titleCase(p.sheetName),
      status: same.length ? 'deleted' : 'missing',
      similar: best && best.s >= 0.6 ? best.c.name : undefined,
    });
  }

  // escolas: as ligações marcadas como "criar escola nova", juntando a mesma escola de várias comunidades
  const schools = new Map<string, MissingSchool>();
  for (const l of input.schoolLinks) {
    if (input.schoolMap[l.key] !== 'new' || !l.cityId) continue;
    const key = `${l.cityId}|${normalizeText(l.sheetSchool)}`;
    const s = schools.get(key) ?? { key, city: l.city, cityId: l.cityId, sheetName: l.sheetSchool, name: titleCase(l.sheetSchool), count: 0, communities: [], linkKeys: [] };
    s.count += l.count;
    if (!s.communities.some((c) => normalizeText(c) === normalizeText(l.community))) s.communities.push(l.community);
    s.linkKeys.push(l.key);
    schools.set(key, s);
  }
  const byPlace = (a: { city: string; sheetName: string }, b: { city: string; sheetName: string }) =>
    a.city.localeCompare(b.city, 'pt-BR') || a.sheetName.localeCompare(b.sheetName, 'pt-BR');
  return { communities: communities.sort(byPlace), schools: [...schools.values()].sort(byPlace) };
}
