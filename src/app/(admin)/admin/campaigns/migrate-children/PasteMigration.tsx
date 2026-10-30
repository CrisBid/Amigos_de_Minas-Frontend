'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardPaste, ImagePlus, Loader2, Trash2, X } from 'lucide-react';

type Campaign = { id: string; name: string; slug: string; year?: number | null };
type City = { id: string; name: string; state?: string | null };
type CommunityOpt = { id: string; name: string; cityId?: string | null };

type Candidate = {
  id: string;
  name: string;
  birthDate?: string | null;
  motherName?: string | null;
  cityName?: string | null;
  city?: { id: string; name: string } | null;
  community?: { id: string; name: string } | null;
  inSource: boolean;
  alreadyInTarget: boolean;
  currentPublicId: number | null;
  targetPublicId: number | null;
  currentGift: string | null;
  targetGift: string | null;
  currentPhotoUrl: string | null;
  targetPhotoUrl: string | null;
};

type UsedId = { publicId: number; childId: string; name: string };

type ColumnMap = { name: number; publicId: number; wantedGift: number; birthDate: number; motherName: number };

type SheetRow = {
  line: number;
  name: string;
  sheetId: number | null;
  gift: string;
  birthDate: string | null; // yyyy-mm-dd
  birthText: string;
  motherName: string;
};

type Frame = { id: string; active?: boolean; config?: unknown };

type Progress = { phase: 'migrando' | 'fotos'; done: number; total: number };

type Summary = { migrated: number; photos: number; errors: string[] };

type MatchKind = 'exact' | 'approx' | 'ambiguous' | 'none' | 'manual';

const NONE = -1;
const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** Formato da planilha da associação: ID | CRIANÇA | NASCIM | IDADE | PRESENTE | MÃE */
const SHEET_LAYOUT: ColumnMap = { publicId: 0, name: 1, birthDate: 2, wantedGift: 4, motherName: 5 };

const HEADER_ALIASES: Record<keyof ColumnMap, string[]> = {
  publicId: ['id', 'publicid', 'codigo', 'cod', 'numero', 'n', 'no', 'id novo', 'novo id'],
  name: ['crianca', 'nome', 'name', 'nome da crianca', 'child'],
  birthDate: ['nascim', 'nasc', 'nascimento', 'data de nascimento', 'data nasc', 'dn'],
  wantedGift: ['presente', 'presente desejado', 'wantedgift', 'pedido', 'desejo', 'presente novo', 'novo presente'],
  motherName: ['mae', 'nome da mae', 'mother', 'responsavel'],
};

/** "05/03/2017", "5/3/17" ou "2017-03-05" → "2017-03-05". */
function parseSheetDate(raw?: string): string | null {
  const s = (raw ?? '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!br) return null;
  const [, d, m, y] = br;
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  const date = new Date(Date.UTC(year, Number(m) - 1, Number(d)));
  if (date.getUTCDate() !== Number(d) || date.getUTCMonth() !== Number(m) - 1) return null;
  return date.toISOString().slice(0, 10);
}

const formatDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

async function extractError(res: Response, fallback: string) {
  try {
    const body = await res.json();
    if (body?.message) return Array.isArray(body.message) ? body.message.join(' ') : String(body.message);
  } catch {
    // sem corpo JSON
  }
  return fallback;
}

const normalize = (s?: string | null) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const nameTokens = (s?: string | null) => normalize(s).split(' ').filter((t) => t.length > 1 && !STOPWORDS.has(t));

/**
 * Quão bem o nome da planilha bate com o do cadastro:
 * 3 = igual, 2 = um nome contém todas as palavras do outro (abreviado), 1 = mesmo primeiro e último nome.
 */
function nameScore(sheet: string[], cand: string[]) {
  if (!sheet.length || !cand.length) return 0;
  if (sheet.join(' ') === cand.join(' ')) return 3;
  const [short, long] = sheet.length <= cand.length ? [sheet, cand] : [cand, sheet];
  if (short.length >= 2 && short.every((t) => long.includes(t))) return 2;
  if (sheet.length >= 2 && cand.length >= 2 && sheet[0] === cand[0] && sheet[sheet.length - 1] === cand[cand.length - 1]) return 1;
  return 0;
}

/** Lê o texto copiado do Excel/Google Sheets (TSV, com células entre aspas quando têm quebra de linha). */
function parseClipboardTable(text: string): string[][] {
  const src = text.replace(/\r\n?/g, '\n');
  const sep = src.includes('\t') ? '\t' : (src.split('\n')[0].match(/;/g)?.length ?? 0) > 0 ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell.trim()); cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim()); cell = '';
      rows.push(row); row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.length > 0));
}

const isIdCell = (s?: string) => /^\d{1,9}$/.test((s ?? '').trim());

/** Linha do cabeçalho (procurada nas primeiras linhas, para ignorar títulos acima dele), ou -1. */
function findHeaderRow(rows: string[][]) {
  return rows.slice(0, 5).findIndex((r) => r.some((c) => HEADER_ALIASES.name.includes(normalize(c))));
}

function columnsFromHeader(headers: string[]): ColumnMap {
  const find = (key: keyof ColumnMap) => headers.findIndex((h) => HEADER_ALIASES[key].includes(normalize(h)));
  return {
    publicId: find('publicId'),
    name: find('name'),
    birthDate: find('birthDate'),
    wantedGift: find('wantedGift'),
    motherName: find('motherName'),
  };
}

export default function PasteMigration({
  targetCampaign,
  sourceCampaignId,
  onMigrated,
}: {
  targetCampaign: Campaign;
  sourceCampaignId: string;
  onMigrated: () => Promise<void> | void;
}) {
  // ---- cidade / comunidade ----
  const [cities, setCities] = useState<City[]>([]);
  const [communities, setCommunities] = useState<CommunityOpt[]>([]);
  const [cityId, setCityId] = useState('');
  const [communityId, setCommunityId] = useState('');

  // ---- crianças da cidade/comunidade ----
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [usedTargetIds, setUsedTargetIds] = useState<UsedId[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);

  // ---- planilha ----
  const [rawText, setRawText] = useState('');
  const [headerRow, setHeaderRow] = useState(0); // índice da linha de cabeçalho, -1 = sem cabeçalho
  const [colMap, setColMap] = useState<ColumnMap>(SHEET_LAYOUT);

  // ajustes feitos na tela, por linha da planilha
  const [choice, setChoice] = useState<Record<number, string>>({});
  const [idEdits, setIdEdits] = useState<Record<number, string>>({});
  const [giftEdits, setGiftEdits] = useState<Record<number, string>>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [photos, setPhotos] = useState<Record<string, File>>({}); // por childId
  const [photoIssues, setPhotoIssues] = useState<string[]>([]);
  const [showMissing, setShowMissing] = useState(false);
  const [editingChild, setEditingChild] = useState<Set<number>>(new Set()); // linhas com a escolha da criança aberta

  const [frame, setFrame] = useState<Frame | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const bulkPhotoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/cities', { cache: 'no-store', credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setCities(Array.isArray(data) ? data : (data?.items ?? []));
        }
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    setCommunityId('');
    if (!cityId) { setCommunities([]); return; }
    (async () => {
      try {
        const url = new URL('/api/admin/communities', window.location.origin);
        url.searchParams.set('cityId', cityId);
        const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setCommunities(Array.isArray(data) ? data : (data?.items ?? []));
        }
      } catch {
        setCommunities([]);
      }
    })();
  }, [cityId]);

  async function loadCandidates() {
    if (!cityId) { setCandidates([]); setUsedTargetIds([]); return; }
    setLoadingCandidates(true);
    setCandidatesError(null);
    try {
      const qs = new URLSearchParams({ cityId });
      if (communityId) qs.set('communityId', communityId);
      if (sourceCampaignId) qs.set('sourceCampaignId', sourceCampaignId);
      const res = await fetch(`/api/admin/campaigns/${targetCampaign.id}/migration-candidates?${qs.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await extractError(res, 'Falha ao carregar as crianças.'));
      const json: { items: Candidate[]; usedTargetIds: UsedId[] } = await res.json();
      setCandidates(json.items ?? []);
      setUsedTargetIds(json.usedTargetIds ?? []);
    } catch (e) {
      setCandidatesError(e instanceof Error ? e.message : 'Falha ao carregar as crianças.');
    } finally {
      setLoadingCandidates(false);
    }
  }

  useEffect(() => {
    setChoice({});
    loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, communityId, sourceCampaignId, targetCampaign.id]);

  // ---- layout ativo da campanha de destino (a foto nova é composta com ele) ----
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/campaigns/${targetCampaign.id}/layouts`, { cache: 'no-store', credentials: 'include' });
        if (!res.ok) { setFrame(null); return; }
        const list: Frame[] = await res.json();
        setFrame(Array.isArray(list) ? list.find((f) => f.active) ?? null : null);
      } catch {
        setFrame(null);
      }
    })();
  }, [targetCampaign.id]);

  // ---- tabela colada ----
  const table = useMemo(() => parseClipboardTable(rawText), [rawText]);
  const headers = headerRow >= 0 ? table[headerRow] ?? [] : null;
  const dataRows = useMemo(() => table.slice(headerRow + 1), [table, headerRow]);
  const columnCount = Math.max(0, ...table.map((r) => r.length));
  const columnLabel = (i: number) => (headers?.[i] ? `${headers[i]} (col. ${i + 1})` : `Coluna ${i + 1}`);

  function handleTextChange(text: string) {
    setRawText(text);
    setSummary(null);
    setChoice({});
    setIdEdits({});
    setGiftEdits({});
    setExcluded(new Set());
    const parsed = parseClipboardTable(text);
    if (parsed.length === 0) return;
    const header = findHeaderRow(parsed);
    setHeaderRow(header);
    // com cabeçalho, segue os nomes das colunas; sem ele, assume o formato padrão da planilha
    setColMap(header >= 0 ? columnsFromHeader(parsed[header]) : SHEET_LAYOUT);
  }

  function toggleHeader(on: boolean) {
    setHeaderRow(on ? Math.max(findHeaderRow(table), 0) : -1);
  }

  const sheetRows: SheetRow[] = useMemo(() => {
    const cell = (r: string[], col: number) => (col === NONE ? '' : r[col] ?? '');
    return dataRows.map((r, idx) => {
      const rawId = cell(r, colMap.publicId);
      const birthText = cell(r, colMap.birthDate);
      return {
        line: headerRow + 2 + idx,
        name: cell(r, colMap.name),
        sheetId: isIdCell(rawId) ? parseInt(rawId, 10) : null,
        gift: cell(r, colMap.wantedGift),
        birthDate: parseSheetDate(birthText),
        birthText,
        motherName: cell(r, colMap.motherName),
      };
    }).filter((r) => r.name.trim()); // linhas sem nome (totais, rodapé) não entram
  }, [dataRows, colMap, headerRow]);

  const candidateById = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const candidateTokens = useMemo(
    () => candidates.map((c) => ({ c, tokens: nameTokens(c.name), mother: nameTokens(c.motherName) })),
    [candidates],
  );

  // ---- casamento automático: nome, com nascimento e mãe para desempatar ----
  const autoMatches = useMemo(() => {
    const result = new Map<number, { childId: string | null; kind: MatchKind; options: Candidate[] }>();
    for (const r of sheetRows) {
      const tokens = nameTokens(r.name);
      const mother = nameTokens(r.motherName);
      const scored = candidateTokens
        .map((x) => ({ ...x, score: nameScore(tokens, x.tokens) }))
        .filter((x) => x.score > 0);

      const sameBirth = (x: (typeof scored)[number]) => !!r.birthDate && x.c.birthDate?.slice(0, 10) === r.birthDate;
      const sameMother = (x: (typeof scored)[number]) => mother.length > 0 && nameScore(mother, x.mother) > 0;

      // 1) nome parecido + mesmo nascimento é o sinal mais forte
      let pick = scored.filter(sameBirth);
      if (pick.length !== 1) {
        // 2) melhor nota de nome, desempatando por mãe e depois por estar na campanha de origem
        const best = Math.max(0, ...scored.map((x) => x.score));
        pick = scored.filter((x) => x.score === best);
        for (const narrow of [sameMother, (x: (typeof scored)[number]) => x.c.inSource]) {
          if (pick.length <= 1) break;
          const narrowed = pick.filter(narrow);
          if (narrowed.length >= 1) pick = narrowed;
        }
      }

      if (pick.length === 1) {
        result.set(r.line, { childId: pick[0].c.id, kind: pick[0].score === 3 ? 'exact' : 'approx', options: pick.map((x) => x.c) });
      } else if (pick.length > 1) {
        result.set(r.line, { childId: null, kind: 'ambiguous', options: pick.map((x) => x.c) });
      } else {
        result.set(r.line, { childId: null, kind: 'none', options: [] });
      }
    }
    return result;
  }, [sheetRows, candidateTokens]);

  // ---- linhas finais (planilha + cadastro + ajustes) ----
  const rows = useMemo(() => {
    const base = sheetRows.map((r) => {
      const auto = autoMatches.get(r.line)!;
      const manual = r.line in choice;
      const childId = manual ? choice[r.line] || null : auto.childId;
      const child = childId ? candidateById.get(childId) ?? null : null;
      const kind: MatchKind = manual ? (childId ? 'manual' : 'none') : auto.kind;
      const idText = r.line in idEdits ? idEdits[r.line] : r.sheetId !== null ? String(r.sheetId) : '';
      const newId = isIdCell(idText) ? parseInt(idText, 10) : null;
      const gift = r.line in giftEdits ? giftEdits[r.line] : r.gift;
      return { ...r, auto, kind, child, idText, newId, gift };
    });

    // mesma criança em duas linhas: vale a primeira
    const firstLineByChild = new Map<string, number>();
    base.forEach((r) => { if (r.child && !firstLineByChild.has(r.child.id)) firstLineByChild.set(r.child.id, r.line); });

    const withState = base.map((r) => {
      const duplicateChild = !!r.child && firstLineByChild.get(r.child.id) !== r.line;
      const selected = !!r.child && !duplicateChild && !excluded.has(r.line);
      return { ...r, duplicateChild, selected };
    });

    // conflitos de ID: repetido entre as linhas marcadas, ou já usado por criança fora do lote
    const batchChildIds = new Set(withState.filter((r) => r.selected).map((r) => r.child!.id));
    const idCount = new Map<number, number>();
    withState.forEach((r) => { if (r.selected && r.newId !== null) idCount.set(r.newId, (idCount.get(r.newId) ?? 0) + 1); });

    return withState.map((r) => {
      let idProblem: string | null = null;
      if (r.selected && r.newId !== null) {
        const owner = usedTargetIds.find((u) => u.publicId === r.newId && !batchChildIds.has(u.childId));
        if ((idCount.get(r.newId) ?? 0) > 1) idProblem = 'ID repetido em outra linha';
        else if (owner) idProblem = `ID já usado nesta campanha por ${owner.name}`;
      } else if (r.selected && r.idText.trim()) {
        idProblem = 'ID inválido';
      }
      return { ...r, idProblem };
    });
  }, [sheetRows, autoMatches, choice, candidateById, idEdits, giftEdits, excluded, usedTargetIds]);

  const selectedRows = rows.filter((r) => r.selected);
  const blockingRows = selectedRows.filter((r) => r.idProblem);
  const selectedWithPhoto = selectedRows.filter((r) => photos[r.child!.id]);

  // crianças da origem nesta cidade/comunidade que não estão na planilha
  const missingFromSheet = useMemo(() => {
    if (!rawText) return [];
    const matched = new Set(rows.filter((r) => r.child).map((r) => r.child!.id));
    return candidates.filter((c) => c.inSource && !matched.has(c.id));
  }, [rows, candidates, rawText]);

  const counts = {
    exact: rows.filter((r) => r.kind === 'exact' || r.kind === 'manual').length,
    approx: rows.filter((r) => r.kind === 'approx').length,
    pending: rows.filter((r) => r.kind === 'ambiguous' || r.kind === 'none').length,
  };

  // ---- fotos ----
  const photoUrls = useMemo(() => {
    const urls: Record<string, string> = {};
    for (const [childId, file] of Object.entries(photos)) urls[childId] = URL.createObjectURL(file);
    return urls;
  }, [photos]);
  useEffect(() => () => Object.values(photoUrls).forEach((u) => URL.revokeObjectURL(u)), [photoUrls]);

  function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const byId = new Map<number, string>();
    const byName = new Map<string, string>();
    rows.forEach((r) => {
      if (!r.child) return;
      if (r.newId !== null) byId.set(r.newId, r.child.id);
      byName.set(normalize(r.child.name), r.child.id);
      if (r.name) byName.set(normalize(r.name), r.child.id);
    });
    // ID antigo como último recurso
    rows.forEach((r) => {
      if (r.child?.currentPublicId != null && !byId.has(r.child.currentPublicId)) byId.set(r.child.currentPublicId, r.child.id);
    });

    const next = { ...photos };
    const issues: string[] = [];
    Array.from(files).forEach((f) => {
      const base = f.name.replace(/\.[^.]+$/, '');
      const pid = base.match(/^(\d{1,9})/)?.[1];
      const childId = (pid ? byId.get(Number(pid)) : undefined) ?? byName.get(normalize(base));
      if (childId) next[childId] = f;
      else issues.push(f.name);
    });
    setPhotos(next);
    setPhotoIssues(issues);
  }

  function setRowPhoto(childId: string, file: File | null) {
    setPhotos((prev) => {
      const next = { ...prev };
      if (file) next[childId] = file; else delete next[childId];
      return next;
    });
  }

  function toggleRow(line: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line); else next.add(line);
      return next;
    });
  }

  function reset() {
    setRawText('');
    setChoice({});
    setEditingChild(new Set());
    setIdEdits({});
    setGiftEdits({});
    setExcluded(new Set());
    setPhotos({});
    setPhotoIssues([]);
  }

  // ---- migrar ----
  async function submit() {
    if (selectedRows.length === 0 || blockingRows.length > 0) return;
    const errors: string[] = [];
    let uploaded = 0;

    setProgress({ phase: 'migrando', done: 0, total: selectedRows.length });
    try {
      const res = await fetch(`/api/admin/campaigns/${targetCampaign.id}/included-children`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceCampaignId: sourceCampaignId || undefined,
          items: selectedRows.map((r) => ({ childId: r.child!.id, publicId: r.newId, wantedGift: r.gift.trim() || null })),
        }),
      });
      if (!res.ok) {
        alert(await extractError(res, 'Falha ao migrar crianças.'));
        return;
      }

      // fotos depois da migração, para a arte já sair com o ID e o presente novos
      setProgress({ phase: 'fotos', done: 0, total: selectedWithPhoto.length });
      for (const [idx, r] of selectedWithPhoto.entries()) {
        const child = r.child!;
        const fd = new FormData();
        fd.append('file', photos[child.id]);
        if (frame?.config) fd.append('Config', JSON.stringify(frame.config));
        const qs = new URLSearchParams({ campaignId: targetCampaign.id });
        if (frame?.id) qs.set('layoutId', frame.id);
        try {
          const up = await fetch(`/api/admin/children/${child.id}/photo?${qs.toString()}`, {
            method: 'POST',
            credentials: 'include',
            body: fd,
          });
          if (!up.ok) throw new Error(await extractError(up, 'falha no envio'));
          uploaded += 1;
        } catch (e) {
          errors.push(`Foto de ${child.name}: ${e instanceof Error ? e.message : 'falha no envio'}`);
        }
        setProgress({ phase: 'fotos', done: idx + 1, total: selectedWithPhoto.length });
      }

      setSummary({ migrated: selectedRows.length, photos: uploaded, errors });
      reset();
      await Promise.all([onMigrated(), loadCandidates()]);
    } finally {
      setProgress(null);
    }
  }

  const childOption = (o: Candidate) => (
    <option key={o.id} value={o.id}>
      {o.name}{o.currentPublicId != null ? ` (#${o.currentPublicId})` : ''}
      {!communityId && o.community?.name ? ` · ${o.community.name}` : ''}
    </option>
  );

  return (
    <div className="space-y-6 mb-8">
      {summary && (
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border-l-4 border-emerald-500">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                {summary.migrated} criança{summary.migrated === 1 ? '' : 's'} migrada{summary.migrated === 1 ? '' : 's'} para {targetCampaign.name}
                {summary.photos > 0 ? ` · ${summary.photos} foto${summary.photos === 1 ? '' : 's'} atualizada${summary.photos === 1 ? '' : 's'}` : ''}
              </p>
              {summary.errors.length > 0 && (
                <ul className="mt-2 text-sm text-red-700 list-disc pl-5 space-y-0.5">
                  {summary.errors.map((e) => <li key={e}>{e}</li>)}
                </ul>
              )}
            </div>
            <button onClick={() => setSummary(null)} className="p-1 text-gray-400 hover:text-gray-600" title="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Cidade / comunidade */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Cidade</label>
            <select
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="">Selecione…</option>
              {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Comunidade</label>
            <select
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg bg-white"
              disabled={!cityId || communities.length === 0}
            >
              <option value="">Todas as comunidades da cidade</option>
              {communities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {!cityId
            ? 'A busca na planilha é feita pelo nome, só entre as crianças da cidade/comunidade escolhida.'
            : loadingCandidates
              ? 'Carregando crianças…'
              : `${candidates.length} criança${candidates.length === 1 ? '' : 's'} nesta ${communityId ? 'comunidade' : 'cidade'}` +
                (sourceCampaignId ? ` · ${candidates.filter((c) => c.inSource).length} na campanha de origem` : '')}
        </p>
        {candidatesError && <div className="mt-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{candidatesError}</div>}
      </div>

      {/* Colar */}
      {cityId && (
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <ClipboardPaste className="w-4 h-4" /> Cole aqui as linhas da planilha (Ctrl+V)
            </label>
            {rawText && (
              <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Limpar
              </button>
            )}
          </div>
          <textarea
            value={rawText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={'Copie as linhas da planilha da comunidade (com ou sem o cabeçalho) e cole aqui.\n\nID\tCRIANÇA\tNASCIM\tIDADE\tPRESENTE\tMÃE\n15\tMaria Silva\t05/03/2017\t8\tBoneca\tAna Silva\n16\tJoão Souza\t12/09/2015\t10\tBola\tRita Souza'}
            className="w-full min-h-[140px] p-3 border border-gray-300 rounded-lg font-mono text-xs"
          />

          {table.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                Colunas: {headerRow >= 0 ? `cabeçalho na linha ${headerRow + 1}` : 'sem cabeçalho (formato padrão ID, CRIANÇA, NASCIM, IDADE, PRESENTE, MÃE)'}
                {colMap.name === NONE && <span className="text-red-700"> · coluna CRIANÇA não encontrada</span>}
              </summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {([
                  ['publicId', 'ID (campanha nova)'],
                  ['name', 'Criança'],
                  ['birthDate', 'Nascimento'],
                  ['wantedGift', 'Presente'],
                  ['motherName', 'Mãe'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">{label}</label>
                    <select
                      value={colMap[key]}
                      onChange={(e) => setColMap((m) => ({ ...m, [key]: Number(e.target.value) }))}
                      className="w-full p-2 border border-gray-300 rounded-lg bg-white text-sm"
                    >
                      <option value={NONE}>— nenhuma —</option>
                      {Array.from({ length: columnCount }, (_, i) => (
                        <option key={i} value={i}>{columnLabel(i)}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <label className="flex items-center gap-2 text-sm text-gray-700 sm:pt-6">
                  <input type="checkbox" checked={headerRow >= 0} onChange={(e) => toggleHeader(e.target.checked)} className="w-4 h-4" />
                  Tem cabeçalho
                </label>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Conferência */}
      {cityId && rows.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="text-sm text-gray-700 flex flex-wrap gap-x-3 gap-y-1">
              <span><strong>{rows.length}</strong> linha{rows.length === 1 ? '' : 's'}</span>
              <span className="text-emerald-700"><strong>{counts.exact}</strong> encontrada{counts.exact === 1 ? '' : 's'}</span>
              {counts.approx > 0 && <span className="text-amber-700"><strong>{counts.approx}</strong> por nome aproximado</span>}
              {counts.pending > 0 && <span className="text-red-700"><strong>{counts.pending}</strong> para escolher</span>}
              {blockingRows.length > 0 && <span className="text-red-700"><strong>{blockingRows.length}</strong> com problema de ID</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={bulkPhotoInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }}
              />
              <button
                onClick={() => bulkPhotoInput.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm"
                title="Os arquivos são associados pelo ID no início do nome (ex.: 15.jpg) ou pelo nome da criança"
              >
                <ImagePlus className="w-4 h-4" /> Adicionar fotos novas
              </button>
              <button
                onClick={submit}
                disabled={!!progress || loadingCandidates || selectedRows.length === 0 || blockingRows.length > 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60"
              >
                {progress ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {progress
                  ? progress.phase === 'migrando' ? 'Migrando…' : `Enviando fotos ${progress.done}/${progress.total}…`
                  : `Migrar ${selectedRows.length} criança${selectedRows.length === 1 ? '' : 's'}${selectedWithPhoto.length ? ` (${selectedWithPhoto.length} com foto nova)` : ''}`}
              </button>
            </div>
          </div>

          {photoIssues.length > 0 && (
            <div className="mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
              Não consegui associar {photoIssues.length} foto{photoIssues.length === 1 ? '' : 's'} a nenhuma linha: {photoIssues.join(', ')}.
              Use o ID da criança no início do nome do arquivo (ex.: <code>15.jpg</code>) ou escolha a foto na linha.
            </div>
          )}
          {!frame && (
            <p className="mb-3 text-xs text-gray-500">
              A campanha de destino não tem layout ativo: as fotos novas serão salvas sem moldura.
            </p>
          )}

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="px-2 py-2 w-8" />
                  <th className="px-2 py-2 text-left">Planilha</th>
                  <th className="px-2 py-2 text-left">Criança no cadastro</th>
                  <th className="px-2 py-2 text-left">ID novo</th>
                  <th className="px-2 py-2 text-left">Presente</th>
                  <th className="px-2 py-2 text-left">Foto</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const c = r.child;
                  const newPhoto = c ? photoUrls[c.id] : undefined;
                  const shownPhoto = newPhoto ?? c?.targetPhotoUrl ?? c?.currentPhotoUrl ?? null;
                  const showPicker = !c || r.kind === 'ambiguous' || editingChild.has(r.line);

                  const problems: { tone: 'red' | 'amber' | 'gray'; text: string }[] = [];
                  if (r.kind === 'none') problems.push({ tone: 'red', text: 'Nome não encontrado nesta cidade/comunidade — escolha a criança' });
                  if (r.kind === 'ambiguous' && !c) problems.push({ tone: 'red', text: `${r.auto.options.length} crianças com esse nome — escolha qual` });
                  if (r.kind === 'approx') problems.push({ tone: 'amber', text: 'Nome aproximado — confira' });
                  if (c && r.birthDate && c.birthDate && c.birthDate.slice(0, 10) !== r.birthDate) {
                    problems.push({ tone: 'amber', text: `Nascimento diferente: cadastro ${formatDate(c.birthDate)}` });
                  }
                  if (c && r.motherName && c.motherName && nameScore(nameTokens(r.motherName), nameTokens(c.motherName)) === 0) {
                    problems.push({ tone: 'amber', text: `Mãe diferente: cadastro “${c.motherName}”` });
                  }
                  if (r.duplicateChild) problems.push({ tone: 'red', text: 'Mesma criança de outra linha (vale a primeira)' });
                  if (c && sourceCampaignId && !c.inSource) problems.push({ tone: 'amber', text: 'Não está na campanha de origem' });
                  if (c?.alreadyInTarget) problems.push({ tone: 'gray', text: 'Já está na campanha de destino — atualiza ID/presente/foto' });

                  return (
                    <tr
                      key={r.line}
                      className={[
                        'border-b last:border-0 align-top',
                        !c || r.duplicateChild ? 'bg-red-50/40' : r.selected ? '' : 'opacity-50',
                      ].join(' ')}
                    >
                      <td className="px-2 py-3">
                        <input
                          type="checkbox"
                          checked={r.selected}
                          disabled={!c || r.duplicateChild}
                          onChange={() => toggleRow(r.line)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-2 py-3 min-w-[150px]">
                        <p className="text-gray-900">{r.name || '—'}</p>
                        {(r.birthText || r.motherName) && (
                          <p className="text-xs text-gray-500">
                            {r.birthText && <>nasc. {r.birthText}</>}
                            {r.birthText && r.motherName && ' · '}
                            {r.motherName && <>mãe {r.motherName}</>}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400">linha {r.line}</p>
                      </td>
                      <td className="px-2 py-3 min-w-[220px]">
                        {showPicker ? (
                          <select
                            value={c?.id ?? ''}
                            onChange={(e) => setChoice((prev) => ({ ...prev, [r.line]: e.target.value }))}
                            className={`w-full px-2 py-1.5 border rounded-lg bg-white text-sm ${c ? 'border-gray-300' : 'border-red-300'}`}
                          >
                            <option value="">— escolher criança —</option>
                            {r.auto.options.length > 0 && (
                              <optgroup label="Nomes parecidos">{r.auto.options.map(childOption)}</optgroup>
                            )}
                            <optgroup label="Todas">
                              {candidates.filter((o) => !r.auto.options.includes(o)).map(childOption)}
                            </optgroup>
                          </select>
                        ) : (
                          <p className="font-semibold text-gray-900">
                            {c?.name}{' '}
                            <button
                              onClick={() => setEditingChild((prev) => new Set(prev).add(r.line))}
                              className="text-xs font-normal text-blue-700 hover:underline"
                            >
                              trocar
                            </button>
                          </p>
                        )}
                        {c && (
                          <p className="text-xs text-gray-500 mt-1">
                            {c.community?.name ?? '—'} · ID anterior #{c.currentPublicId ?? '—'}
                          </p>
                        )}
                        {problems.map((p) => (
                          <p
                            key={p.text}
                            className={[
                              'text-xs mt-1 flex items-start gap-1',
                              p.tone === 'red' ? 'text-red-700' : p.tone === 'amber' ? 'text-amber-700' : 'text-gray-500',
                            ].join(' ')}
                          >
                            {p.tone !== 'gray' && <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />}
                            {p.text}
                          </p>
                        ))}
                      </td>
                      <td className="px-2 py-3 w-28">
                        {c && (
                          <>
                            <input
                              value={r.idText}
                              onChange={(e) => setIdEdits((prev) => ({ ...prev, [r.line]: e.target.value }))}
                              placeholder={c.targetPublicId != null ? String(c.targetPublicId) : 'mantém'}
                              inputMode="numeric"
                              className={`w-24 px-2 py-1.5 border rounded-lg text-sm font-mono ${r.idProblem ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                            />
                            {r.idProblem && <p className="text-xs text-red-700 mt-1">{r.idProblem}</p>}
                          </>
                        )}
                      </td>
                      <td className="px-2 py-3 min-w-[200px]">
                        {c ? (
                          <>
                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                              <span className="truncate max-w-[180px]" title={c.currentGift ?? ''}>{c.currentGift || 'sem presente'}</span>
                              <ArrowRight className="w-3 h-3 shrink-0" />
                            </p>
                            <input
                              value={r.gift}
                              onChange={(e) => setGiftEdits((g) => ({ ...g, [r.line]: e.target.value }))}
                              placeholder={c.targetGift ?? 'mantém o presente atual'}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                            />
                          </>
                        ) : (
                          <span className="text-gray-400">{r.gift || '—'}</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {c && (
                          <div className="flex items-center gap-2">
                            {shownPhoto ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={shownPhoto}
                                alt={c.name}
                                className={`w-12 h-16 object-cover rounded-md border ${newPhoto ? 'ring-2 ring-emerald-500' : 'opacity-70'}`}
                              />
                            ) : (
                              <div className="w-12 h-16 rounded-md border border-dashed grid place-content-center text-[10px] text-gray-400">sem foto</div>
                            )}
                            <div className="flex flex-col gap-1 text-xs">
                              <label className="cursor-pointer text-blue-700 hover:underline whitespace-nowrap">
                                {newPhoto ? 'Trocar' : 'Nova foto'}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => { setRowPhoto(c.id, e.target.files?.[0] ?? null); e.target.value = ''; }}
                                />
                              </label>
                              {newPhoto ? (
                                <button onClick={() => setRowPhoto(c.id, null)} className="text-left text-red-600 hover:underline">Remover</button>
                              ) : (
                                <span className="text-gray-400 whitespace-nowrap">{c.targetPhotoUrl ? 'foto da campanha' : 'foto atual'}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sourceCampaignId && missingFromSheet.length > 0 && (
            <div className="mt-4 text-sm text-gray-700 bg-gray-50 border rounded-xl p-3">
              <button onClick={() => setShowMissing((v) => !v)} className="font-medium hover:underline">
                {missingFromSheet.length} criança{missingFromSheet.length === 1 ? '' : 's'} da campanha de origem
                {communityId ? ' nesta comunidade' : ' nesta cidade'} não {missingFromSheet.length === 1 ? 'está' : 'estão'} na planilha
                {showMissing ? ' ▲' : ' ▼'}
              </button>
              {showMissing && (
                <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-gray-600">
                  {missingFromSheet.map((c) => (
                    <li key={c.id}>{c.name} <span className="text-gray-400">#{c.currentPublicId ?? '—'}</span></li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
