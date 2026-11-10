'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, CheckCircle2, ChevronLeft, ChevronRight, ClipboardPaste, GitCompareArrows,
  Link2, Loader2, RefreshCw, Search, UserPlus, X,
} from 'lucide-react';
import CampaignFilter, { useAdminCampaign } from '@/components/Admin/CampaignFilter';
import LocationFilter, { EMPTY_LOCATION, type LocationValue } from '@/components/Admin/LocationFilter';
import { composeConfigForFrame } from '@/components/media/composeConfig';
import { apiPath } from '@/lib/api';
import {
  autoMapColumns, inferCategoryFromGift, matchCategory, normalizeText, parseClipboardTable, parseSheetAge, parseSheetDate,
  type CategoryHints,
} from '@/lib/sheetImport';
import {
  computeChanges, FIELD_LABEL, FIELD_ORDER, formatDate, updateFields, type Change, type FieldKey, type SheetRow, type Snapshot,
} from './diff';

/* ===================== Tipos ===================== */

type SheetField = 'publicId' | 'name' | 'birthDate' | 'age' | 'wantedGift' | 'category' | 'motherName' | 'description';
type ColumnMap = Partial<Record<SheetField, string>>;

const SHEET_FIELDS: { key: SheetField; label: string; required?: boolean }[] = [
  { key: 'publicId', label: 'ID', required: true },
  { key: 'name', label: 'Nome', required: true },
  { key: 'wantedGift', label: 'Presente' },
  { key: 'category', label: 'Categoria' },
  { key: 'birthDate', label: 'Nascimento' },
  { key: 'age', label: 'Idade' },
  { key: 'motherName', label: 'Mãe' },
  { key: 'description', label: 'Observações' },
];

const ALIASES: Record<SheetField, string[]> = {
  publicId: ['id', 'publicid', 'codigo', 'cod', 'numero', 'num', 'n', 'no', 'id crianca', 'n crianca'],
  name: ['crianca', 'nome', 'nome da crianca', 'nome crianca', 'name', 'child', 'aluno'],
  birthDate: ['nascim', 'nasc', 'nascimento', 'data de nascimento', 'data nascimento', 'data nasc', 'dt nasc', 'birthdate', 'dn'],
  age: ['idade', 'age', 'anos'],
  wantedGift: ['presente', 'presente desejado', 'wantedgift', 'pedido', 'desejo', 'brinquedo'],
  category: ['categoria', 'category', 'grupo', 'tipo'],
  motherName: ['mae', 'nome da mae', 'mother', 'mothername', 'responsavel'],
  description: ['descricao', 'description', 'obs', 'observacao', 'observacoes'],
};

type PreviewRow = {
  key: string;
  action: 'update' | 'create';
  matchedBy: 'campaignId' | 'mainId' | 'name' | 'manual' | null;
  child: Snapshot | null;
  candidates: Snapshot[];
  warnings: string[];
};

/** Ajustes feitos na tela, por linha (`photo`: enviar ou não a foto, acima da regra geral) */
type Decision = { skip?: boolean; asNew?: boolean; linkTo?: Snapshot; fieldsOff?: FieldKey[]; photo?: boolean };

type Mode = 'both' | 'updates' | 'creates';

/** Foto escolhida × foto que a criança já tem (comparando o arquivo, byte a byte) */
type PhotoStatus = 'same' | 'different' | 'reused' | 'missing' | 'new';
type PhotoState = PhotoStatus | 'none' | 'checking';
const PHOTO_LABEL: Record<PhotoStatus, string> = {
  same: 'Igual à desta campanha',
  different: 'Diferente da desta campanha',
  reused: 'Igual à de outra campanha',
  missing: 'Sem foto ainda',
  new: 'Criança nova',
};
const PHOTO_HINT: Record<PhotoStatus, string> = {
  same: 'o mesmo arquivo já enviado nesta campanha',
  different: 'já tem foto nesta campanha, e esta é outra',
  reused: 'nesta campanha não tem foto; é o mesmo arquivo de uma campanha anterior',
  missing: 'nenhuma foto, nem de outra campanha igual a esta',
  new: 'cadastro novo',
};
const PHOTO_ORDER: PhotoStatus[] = ['different', 'missing', 'reused', 'new', 'same'];
// padrão: não reenviar o mesmo arquivo; o resto vai
const DEFAULT_PHOTO_SEND: Record<PhotoStatus, boolean> = { same: false, different: true, reused: true, missing: true, new: true };

type ServerHash = { current: { hash: string } | null; other: { hash: string; campaignName: string | null } | null };

type ListFilter = 'all' | 'changes' | 'new' | 'same' | 'warnings' | 'skipped' | `photo:${PhotoStatus}`;

const MATCHED_LABEL: Record<NonNullable<PreviewRow['matchedBy']>, string> = {
  campaignId: 'pelo ID nesta campanha',
  mainId: 'pelo ID do cadastro e o nome',
  name: 'pelo nome, na cidade',
  manual: 'escolhida por você',
};

const PAGE = 40;
const CHUNK = 150;
const btn = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40';
const columnLetter = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const canonical = (v: string) => (/^\d+$/.test(v.trim()) ? String(parseInt(v, 10)) : v.trim());

/* ===================== Página ===================== */

export default function UpdateChildrenPage() {
  const { campaigns, campaignId, setCampaignId } = useAdminCampaign();
  const [location, setLocation] = useState<LocationValue>(EMPTY_LOCATION);
  const [names, setNames] = useState<{ community?: string; school?: string }>({});
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // planilha
  const [raw, setRaw] = useState('');
  const [colMap, setColMap] = useState<ColumnMap>({});
  const [hints, setHints] = useState<CategoryHints | null>(null);

  // conferência
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [preview, setPreview] = useState<Record<string, PreviewRow>>({});
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [mode, setMode] = useState<Mode>('both');
  const [fieldsOn, setFieldsOn] = useState<Set<FieldKey>>(new Set(FIELD_ORDER));
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // fotos e aplicação
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoSend, setPhotoSend] = useState<Record<PhotoStatus, boolean>>(DEFAULT_PHOTO_SEND);
  const [fileHashes, setFileHashes] = useState<Record<string, string>>({});
  const [serverHashes, setServerHashes] = useState<Record<string, ServerHash>>({});
  const [hashing, setHashing] = useState(false);
  const fileHashCache = useRef(new WeakMap<File, string>());
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ updated: number; created: number; photos: number; errors: string[] } | null>(null);

  useEffect(() => {
    fetch(apiPath('/children/category-hints'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setHints)
      .catch(() => setHints(null));
  }, []);

  // nomes da comunidade/escola escolhidas (para mostrar a mudança de local)
  useEffect(() => {
    const name = (path: string) => fetch(path, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => j?.name as string | undefined).catch(() => undefined);
    (async () => {
      setNames({
        community: location.communityId ? await name(`/api/admin/communities/${location.communityId}`) : undefined,
        school: location.schoolId ? await name(`/api/admin/schools/${location.schoolId}`) : undefined,
      });
    })();
  }, [location.communityId, location.schoolId]);

  /* ---------- planilha ---------- */

  // cabeçalho = primeira linha (das 15 primeiras) onde reconheço ID e nome; títulos e "COMUNIDADE:" acima ficam de fora
  const table = useMemo(() => parseClipboardTable(raw), [raw]);
  const headerIndex = useMemo(() => {
    for (let i = 0; i < Math.min(15, table.length); i++) {
      const m = autoMapColumns(table[i], ALIASES);
      if (m.name && m.publicId) return i;
    }
    return 0;
  }, [table]);
  const headers = useMemo(() => {
    const seen = new Map<string, number>();
    return (table[headerIndex] ?? []).map((h, i) => {
      const base = h || `Coluna ${columnLetter(i)}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return n > 1 ? `${base} (${n})` : base;
    });
  }, [table, headerIndex]);
  // colunas com dado (a planilha tem várias colunas em branco)
  const filledColumns = useMemo(
    () => headers.map((_, i) => table.slice(headerIndex + 1).some((r) => (r[i] ?? '').trim())),
    [headers, table, headerIndex],
  );

  useEffect(() => {
    if (!headers.length) { setColMap({}); return; }
    setColMap(autoMapColumns(headers, ALIASES));
  }, [headers]);

  /** Linhas da planilha: só as que têm ID numérico e nome; mesma criança repetida vira uma só */
  function readRows(): { rows: SheetRow[]; errors: string[]; notices: string[] } {
    const idx = (k: SheetField) => (colMap[k] ? headers.indexOf(colMap[k]!) : -1);
    const cell = (r: string[], k: SheetField) => { const i = idx(k); return i >= 0 ? (r[i] ?? '').trim() : ''; };
    const errors: string[] = [];
    const notices: string[] = [];
    const byId = new Map<string, SheetRow>();
    const out: SheetRow[] = [];

    table.forEach((r, i) => {
      if (i <= headerIndex) return;
      const idRaw = cell(r, 'publicId').replace(/\.0+$/, '');
      const name = cell(r, 'name');
      if (!/^\d{1,9}$/.test(idRaw) || name.length < 2) return; // títulos, "COMUNIDADE:", cabeçalhos repetidos, linhas vazias
      const line = i + 1;
      const birthRaw = cell(r, 'birthDate');
      const birthDate = birthRaw ? parseSheetDate(birthRaw) ?? undefined : undefined;
      if (birthRaw && !birthDate) errors.push(`Linha ${line} (${name}): data de nascimento não reconhecida "${birthRaw}".`);
      const gift = cell(r, 'wantedGift') || undefined;
      const catRaw = cell(r, 'category') || undefined;
      const row: SheetRow = {
        key: `L${line}`,
        line,
        publicId: canonical(idRaw),
        name,
        birthDate,
        age: parseSheetAge(cell(r, 'age')),
        motherName: cell(r, 'motherName') || undefined,
        wantedGift: gift,
        // categoria na grafia que já existe no site
        category: catRaw ? matchCategory(catRaw, hints)?.category ?? catRaw : undefined,
        description: cell(r, 'description') || undefined,
      };

      const first = byId.get(row.publicId);
      if (!first) { byId.set(row.publicId, row); out.push(row); return; }
      if (normalizeText(first.name) === normalizeText(row.name)) {
        (['birthDate', 'age', 'motherName', 'wantedGift', 'category', 'description'] as const).forEach((k) => {
          if (first[k] == null && row[k] != null) (first as any)[k] = row[k];
        });
        notices.push(`Linha ${line} repete a linha ${first.line} (ID ${row.publicId}, ${row.name}) — juntadas.`);
      } else {
        errors.push(`ID ${row.publicId} aparece para duas crianças: linha ${first.line} (${first.name}) e linha ${line} (${row.name}). Corrija na planilha.`);
      }
    });
    return { rows: out, errors, notices };
  }

  const parsed = useMemo(readRows, [table, headerIndex, headers, colMap, hints]); // eslint-disable-line react-hooks/exhaustive-deps

  async function validate() {
    setError(null);
    if (parsed.errors.some((e) => e.startsWith('ID '))) { setError('Corrija os IDs repetidos antes de continuar.'); return; }
    setValidating(true);
    try {
      const res = await fetch('/api/admin/children/bulk/update/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rows: parsed.rows,
          context: { campaignId, cityId: location.cityId, communityId: location.communityId || null, schoolId: location.schoolId || null },
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(Array.isArray(j?.message) ? j.message.join(' ') : j?.message || `Erro ${res.status}`);
      setRows(parsed.rows);
      setPreview(Object.fromEntries((j.rows as PreviewRow[]).map((p) => [p.key, p])));
      setDecisions({});
      setPage(1);
      setListFilter('all');
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao validar a planilha.');
    } finally {
      setValidating(false);
    }
  }

  /* ---------- conferência ---------- */

  // fotos: pelo número no nome do arquivo (ID da planilha) ou pelo nome da criança
  const photoByKey = useMemo(() => {
    const byId = new Map(rows.map((r) => [r.publicId, r.key]));
    const byName = new Map(rows.map((r) => [normalizeText(r.name), r.key]));
    const map: Record<string, File> = {};
    for (const f of photos) {
      const base = f.name.replace(/\.[^.]+$/, '');
      const id = base.match(/^(\d{1,9})/)?.[1];
      const key = (id && byId.get(canonical(id))) || byName.get(normalizeText(base));
      if (key) map[key] = f;
    }
    return map;
  }, [photos, rows]);
  const unmatchedPhotos = photos.length - Object.keys(photoByKey).length;

  // criança atual de cada linha com foto (a ligação pode mudar na tela)
  const childOfRow = (key: string) => {
    const d = decisions[key];
    return d?.asNew ? null : d?.linkTo ?? preview[key]?.child ?? null;
  };
  const photoChildIds = useMemo(
    () => [...new Set(Object.keys(photoByKey).map((k) => childOfRow(k)?.id).filter((id): id is string => !!id))].sort().join(','),
    [photoByKey, decisions, preview], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // impressão digital dos arquivos (no navegador) e das fotos atuais (no servidor)
  useEffect(() => {
    let alive = true;
    (async () => {
      const keys = Object.keys(photoByKey);
      if (!keys.length) { setFileHashes({}); return; }
      setHashing(true);
      try {
        const out: Record<string, string> = {};
        for (const key of keys) {
          const f = photoByKey[key];
          let h = fileHashCache.current.get(f);
          if (!h) {
            const digest = await crypto.subtle.digest('SHA-256', await f.arrayBuffer());
            h = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
            fileHashCache.current.set(f, h);
          }
          out[key] = h;
          if (!alive) return;
        }
        setFileHashes(out);

        const missing = photoChildIds.split(',').filter((id) => id && !(id in serverHashes));
        for (let i = 0; i < missing.length; i += 400) {
          const part = missing.slice(i, i + 400);
          const res = await fetch('/api/admin/children/bulk/update/photo-hashes', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ campaignId, childIds: part }),
          });
          const j = res.ok ? await res.json() : null;
          if (!alive) return;
          const got: Record<string, ServerHash> = j?.hashes ?? {};
          // quem não voltou não tem foto nenhuma
          setServerHashes((prev) => ({ ...prev, ...Object.fromEntries(part.map((id) => [id, got[id] ?? { current: null, other: null }])) }));
        }
      } catch {
        setError('Não consegui comparar as fotos com as atuais. As fotos de quem já existe ficam marcadas como diferentes.');
      } finally {
        if (alive) setHashing(false);
      }
    })();
    return () => { alive = false; };
  }, [photoByKey, photoChildIds, campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  const photoStateOf = (key: string, child: Snapshot | null): PhotoState => {
    if (!photoByKey[key]) return 'none';
    if (!child) return 'new';
    const fh = fileHashes[key];
    const sh = serverHashes[child.id];
    if (!fh || !sh) return hashing ? 'checking' : 'different';
    if (sh.current) return sh.current.hash === fh ? 'same' : 'different';
    if (sh.other?.hash === fh) return 'reused';
    return 'missing';
  };

  const target = { communityId: location.communityId || undefined, communityName: names.community, schoolId: location.schoolId || undefined, schoolName: names.school };

  type View = RowView;

  const views: View[] = useMemo(() => rows.map((row) => {
    const p = preview[row.key];
    const d = decisions[row.key] ?? {};
    const child = d.asNew ? null : d.linkTo ?? p?.child ?? null;
    const kind: View['kind'] = child ? 'update' : 'create';
    const changes = child ? computeChanges(row, child, target) : [];
    const selected = changes.filter((c) => fieldsOn.has(c.field) && !d.fieldsOff?.includes(c.field));
    const photoState = photoStateOf(row.key, child);
    const modeOk = !(mode === 'updates' && kind === 'create') && !(mode === 'creates' && kind === 'update');
    const photoChoice = photoState === 'none' || photoState === 'checking' ? false : d.photo ?? photoSend[photoState];
    const sendPhoto = !d.skip && modeOk && photoChoice;
    let reason: string | undefined;
    if (d.skip) reason = 'deixada de fora';
    else if (mode === 'updates' && kind === 'create') reason = 'nova (modo: só atualizar)';
    else if (mode === 'creates' && kind === 'update') reason = 'já existe (modo: só novas)';
    else if (kind === 'update' && !selected.length && !sendPhoto) reason = changes.length ? 'nenhuma mudança marcada' : 'sem diferenças';
    return { row, p, d, kind, child, changes, selected, included: !reason, reason, photoState, sendPhoto };
  }), [rows, preview, decisions, mode, fieldsOn, names, photoByKey, fileHashes, serverHashes, hashing, photoSend]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const byField = Object.fromEntries(FIELD_ORDER.map((f) => [f, 0])) as Record<FieldKey, number>;
    const byPhoto = Object.fromEntries(PHOTO_ORDER.map((s) => [s, 0])) as Record<PhotoStatus, number>;
    let updates = 0, creates = 0, same = 0, warnings = 0, skipped = 0, withChanges = 0, photosToSend = 0;
    for (const v of views) {
      if (v.kind === 'update') { if (v.changes.length) withChanges++; else same++; }
      v.changes.forEach((c) => { byField[c.field]++; });
      if (v.photoState !== 'none' && v.photoState !== 'checking') byPhoto[v.photoState]++;
      if (v.sendPhoto) photosToSend++;
      if (v.p?.warnings.length || (v.kind === 'create' && v.p?.candidates.length)) warnings++;
      if (!v.included) skipped++;
      else if (v.kind === 'create') creates++;
      else if (v.selected.length) updates++;
    }
    return { byField, byPhoto, updates, creates, same, warnings, skipped, withChanges, photosToSend };
  }, [views]);

  const shown = useMemo(() => {
    const q = normalizeText(search);
    return views.filter((v) => {
      if (q && !normalizeText(`${v.row.publicId} ${v.row.name} ${v.child?.name ?? ''}`).includes(q)) return false;
      switch (listFilter) {
        case 'changes': return v.kind === 'update' && v.changes.length > 0;
        case 'new': return v.kind === 'create';
        case 'same': return v.kind === 'update' && !v.changes.length;
        case 'warnings': return !!(v.p?.warnings.length || (v.kind === 'create' && v.p?.candidates.length));
        case 'skipped': return !v.included;
        case 'all': return true;
        default: return v.photoState === listFilter.slice(6);
      }
    });
  }, [views, listFilter, search]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const decide = (key: string, patch: Partial<Decision>) => setDecisions((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  /** Seleção em massa: vale para todas as linhas do filtro e da busca atuais (todas as páginas) */
  function decideShown(patch: (v: View) => Partial<Decision> | null) {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const v of shown) {
        const p = patch(v);
        if (p) next[v.row.key] = { ...next[v.row.key], ...p };
      }
      return next;
    });
  }

  // mudar a regra geral de um tipo de foto desfaz as escolhas individuais desse tipo
  function setPhotoRule(status: PhotoStatus, send: boolean) {
    setPhotoSend((prev) => ({ ...prev, [status]: send }));
    setDecisions((prev) => {
      const next = { ...prev };
      for (const v of views) if (v.photoState === status && next[v.row.key]?.photo !== undefined) next[v.row.key] = { ...next[v.row.key], photo: undefined };
      return next;
    });
  }
  const toggleField = (f: FieldKey) => setFieldsOn((prev) => { const n = new Set(prev); if (n.has(f)) n.delete(f); else n.add(f); return n; });


  /* ---------- aplicar ---------- */

  async function apply() {
    const included = views.filter((v) => v.included);
    // só quem tem mudança de dado marcada; quem só vai receber foto não precisa gravar nada antes
    const updates = included.filter((v) => v.kind === 'update' && v.selected.length > 0).map((v) => ({
      key: v.row.key,
      childId: v.child!.id,
      fields: updateFields(v.row, v.selected.map((c) => c.field)),
    }));
    const creates = included.filter((v) => v.kind === 'create').map((v) => ({
      ...v.row,
      category: v.row.category ?? inferCategoryFromGift(v.row.wantedGift, hints)?.category,
    }));
    const photoRows = views.filter((v) => v.sendPhoto);
    const skippedPhotos = views.filter((v) => v.photoState !== 'none' && !v.sendPhoto).length;
    const msg =
      `Confirmar?\n\n• ${updates.length} criança(s) com dados atualizados\n• ${creates.length} criança(s) nova(s)` +
      `\n• ${photoRows.length} foto(s) enviada(s)` +
      (skippedPhotos ? `\n• ${skippedPhotos} foto(s) não enviada(s) (iguais ou desmarcadas)` : '');
    if (!confirm(msg)) return;

    const errors: string[] = [];
    const ids: Record<string, string> = {};
    let updated = 0, created = 0, uploaded = 0;
    const lineOf = (key: string) => { const r = rows.find((x) => x.key === key); return r ? `Linha ${r.line} (${r.publicId} ${r.name})` : key; };
    const context = { campaignId, cityId: location.cityId, communityId: location.communityId || null, schoolId: location.schoolId || null };

    try {
      // em partes, para não estourar o tempo de uma requisição só
      const work = [...updates.map((u) => ({ u })), ...creates.map((c) => ({ c }))];
      setProgress({ label: 'Gravando', done: 0, total: work.length });
      for (let i = 0; i < work.length; i += CHUNK) {
        const part = work.slice(i, i + CHUNK);
        const res = await fetch('/api/admin/children/bulk/update/apply', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            context,
            updates: part.flatMap((x) => ('u' in x ? [x.u] : [])),
            creates: part.flatMap((x) => ('c' in x ? [x.c] : [])),
          }),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok) {
          errors.push(`Lote ${i / CHUNK + 1}: ${j?.message ?? `erro ${res.status}`}`);
        } else {
          updated += j.updated.length;
          created += j.created.length;
          Object.assign(ids, j.ids);
          (j.errors as { key: string; message: string }[]).forEach((e) => errors.push(`${lineOf(e.key)}: ${e.message}`));
        }
        setProgress({ label: 'Gravando', done: Math.min(work.length, i + CHUNK), total: work.length });
      }

      // fotos, com o layout da cidade nesta campanha
      const toUpload = photoRows.map((v) => ({ v, childId: ids[v.row.key] ?? (v.kind === 'update' ? v.child!.id : undefined) })).filter((x) => x.childId);
      if (toUpload.length) {
        const [rf, rc] = await Promise.all([
          fetch(`/api/admin/campaigns/${campaignId}/layouts`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])),
          fetch(`/api/admin/campaigns/${campaignId}/city-layouts`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])),
        ]);
        const frameId = (rc as { cityId: string; frameId: string }[]).find((l) => l.cityId === location.cityId)?.frameId;
        const frame = (rf as { id: string; active?: boolean; config?: unknown }[]).find((f) => f.id === frameId)
          ?? (rf as { id: string; active?: boolean; config?: unknown }[]).find((f) => f.active) ?? null;
        setProgress({ label: 'Enviando fotos', done: 0, total: toUpload.length });
        for (const [i, { v, childId }] of toUpload.entries()) {
          try {
            const fd = new FormData();
            fd.append('file', photoByKey[v.row.key]);
            fd.append('Config', JSON.stringify(composeConfigForFrame(frame?.config)));
            const qs = new URLSearchParams({ campaignId });
            if (frame?.id) qs.set('layoutId', frame.id);
            const r = await fetch(`/api/admin/children/${childId}/photo?${qs}`, { method: 'POST', body: fd });
            if (!r.ok) throw new Error(`erro ${r.status}`);
            uploaded++;
          } catch (e) {
            errors.push(`Foto de ${lineOf(v.row.key)}: ${e instanceof Error ? e.message : 'falha'}`);
          }
          setProgress({ label: 'Enviando fotos', done: i + 1, total: toUpload.length });
        }
      }
    } finally {
      setProgress(null);
      setResult({ updated, created, photos: uploaded, errors });
      setStep(4);
    }
  }

  function restart() {
    setRaw(''); setRows([]); setPreview({}); setDecisions({}); setPhotos([]); setResult(null); setError(null); setStep(2);
  }

  /* ===================== Tela ===================== */

  const canStep2 = !!campaignId && !!location.cityId;
  const missingRequired = SHEET_FIELDS.filter((f) => f.required && !colMap[f.key]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Link href="/admin/children" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-2">
            <ArrowLeft className="w-4 h-4" /> Crianças
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Atualização de crianças</h1>
          <p className="text-gray-600 mt-1">Cole a planilha, confira o que muda em cada criança e escolha o que aplicar. Nada é gravado antes da sua confirmação.</p>
        </div>
      </div>

      {/* passos */}
      <ol className="grid grid-cols-4 gap-2 text-xs sm:text-sm">
        {['Campanha e local', 'Planilha', 'Conferir', 'Resultado'].map((label, i) => (
          <li key={label} className={`rounded-xl px-3 py-2 border ${step === i + 1 ? 'bg-blue-600 text-white border-blue-600' : step > i + 1 ? 'bg-blue-50 text-blue-800 border-blue-100' : 'bg-white text-gray-500 border-gray-200'}`}>
            <span className="font-bold mr-1">{i + 1}.</span>{label}
          </li>
        ))}
      </ol>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* 1. campanha e local */}
      {step === 1 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <CampaignFilter campaigns={campaigns} value={campaignId} onChange={setCampaignId} className="max-w-md" />
          <LocationFilter value={location} onChange={setLocation} />
          <div className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3 space-y-1">
            <p>A <b>cidade</b> é obrigatória: as crianças são procuradas nela (e as novas são cadastradas nela).</p>
            <p><b>Comunidade e escola</b> são opcionais. Se escolher, quem estiver em outra aparece com a mudança &quot;Comunidade / escola&quot; para você decidir.</p>
          </div>
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} disabled={!canStep2} className={`${btn} bg-blue-600 text-white`}>
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* 2. planilha */}
      {step === 2 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-gray-800 flex items-center gap-2"><ClipboardPaste className="w-4 h-4" /> Cole aqui as linhas da planilha (com o cabeçalho)</span>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={8}
              placeholder={'ID\tCRIANÇA\tNASCIM\tIDADE\tPRESENTE\tMÃE\n0001\tANA JÚLIA DA SILVA\t28/02/2020\t6\tKIT MAQUIAGEM\tMARIA'}
              className="mt-1 w-full border border-gray-300 rounded-xl p-3 font-mono text-xs"
            />
          </label>

          {headers.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Colunas</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SHEET_FIELDS.map((f) => (
                  <label key={f.key} className="text-xs text-gray-600">
                    {f.label}{f.required ? ' *' : ''}
                    <select
                      value={colMap[f.key] ?? ''}
                      onChange={(e) => setColMap((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
                      className={`mt-0.5 w-full border rounded-lg px-2 py-1.5 bg-white text-sm ${f.required && !colMap[f.key] ? 'border-red-300' : 'border-gray-300'}`}
                    >
                      <option value="">— não usar —</option>
                      {headers.map((h, i) => (
                        <option key={h} value={h} disabled={!filledColumns[i]}>{columnLetter(i)} · {h}{filledColumns[i] ? '' : ' (vazia)'}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {parsed.rows.length} criança(s) lida(s). Títulos, linhas &quot;COMUNIDADE:&quot; e cabeçalhos repetidos são ignorados.
                Coluna sem valor numa linha não apaga o que já está no cadastro.
              </p>
              {(parsed.errors.length > 0 || parsed.notices.length > 0) && (
                <ul className="mt-2 text-xs space-y-0.5 max-h-40 overflow-y-auto">
                  {parsed.errors.map((e) => <li key={e} className="text-red-700">• {e}</li>)}
                  {parsed.notices.map((e) => <li key={e} className="text-blue-700">• {e}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-between gap-2">
            <button onClick={() => setStep(1)} className={`${btn} border border-gray-200 bg-white text-gray-700`}><ArrowLeft className="w-4 h-4" /> Voltar</button>
            <button onClick={validate} disabled={validating || !parsed.rows.length || missingRequired.length > 0} className={`${btn} bg-blue-600 text-white`}>
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompareArrows className="w-4 h-4" />}
              Validar {parsed.rows.length || ''} criança(s)
            </button>
          </div>
        </section>
      )}

      {/* 3. conferir */}
      {step === 3 && (
        <>
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Já existem" value={counts.withChanges + counts.same} hint={`${counts.withChanges} com diferenças · ${counts.same} iguais`} tone="text-blue-700" />
              <Stat label="Novas" value={views.filter((v) => v.kind === 'create').length} hint="não encontradas na cidade" tone="text-emerald-700" />
              <Stat label="Para conferir" value={counts.warnings} hint="avisos e nomes parecidos" tone="text-amber-700" />
              <Stat label="Vão ser gravadas" value={counts.updates + counts.creates} hint={`${counts.updates} atualizações · ${counts.creates} novas`} tone="text-gray-900" />
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">O que fazer</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  ['both', 'Atualizar e cadastrar', 'As que já existem e as novas'],
                  ['updates', 'Só atualizar', 'Só as que já existem'],
                  ['creates', 'Só cadastrar novas', 'Não mexe nas que já existem'],
                ] as [Mode, string, string][]).map(([key, title, text]) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={`text-left rounded-xl border p-3 ${mode === key ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="font-semibold text-gray-900 text-sm">{title}</div>
                    <div className="text-xs text-gray-600">{text}</div>
                  </button>
                ))}
              </div>
            </div>

            {mode !== 'creates' && (
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Tipos de atualização a aplicar</p>
                <div className="flex flex-wrap gap-2">
                  {FIELD_ORDER.filter((f) => counts.byField[f] > 0).map((f) => (
                    <label key={f} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm cursor-pointer ${fieldsOn.has(f) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                      <input type="checkbox" className="hidden" checked={fieldsOn.has(f)} onChange={() => toggleField(f)} />
                      {fieldsOn.has(f) ? <CheckCircle2 className="w-4 h-4" /> : <span className="w-4 h-4 rounded-full border border-gray-400" />}
                      {FIELD_LABEL[f]} <span className="opacity-75">({counts.byField[f]})</span>
                    </label>
                  ))}
                  {FIELD_ORDER.every((f) => !counts.byField[f]) && <span className="text-sm text-gray-500">Nenhuma diferença entre a planilha e o cadastro.</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">Desmarcar um tipo deixa esse campo como está em todas as crianças. Dá para desmarcar campo por campo em cada criança também.</p>
              </div>
            )}

            <div className="rounded-xl border border-dashed border-gray-300 p-3">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer">
                <Camera className="w-4 h-4" /> Fotos (opcional)
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { setPhotos(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
                <span className="text-blue-700 font-normal underline">{photos.length ? 'trocar arquivos' : 'escolher arquivos'}</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                O arquivo é ligado à criança pelo ID no começo do nome (ex.: &quot;0669.jpg&quot;) ou pelo nome. A foto vale para esta campanha, com o layout da cidade.
                {photos.length > 0 && <> <b>{Object.keys(photoByKey).length}</b> ligada(s){unmatchedPhotos > 0 && <>, <b className="text-amber-700">{unmatchedPhotos} sem criança</b></>}.</>}
              </p>

              {Object.keys(photoByKey).length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    Enviar a foto quando ela for:
                    {hashing && <span className="text-xs font-normal text-gray-500 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> comparando com as atuais…</span>}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {PHOTO_ORDER.map((st) => (
                      <label key={st} className={`flex items-start gap-2 rounded-lg border p-2 cursor-pointer ${photoSend[st] ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-white'}`}>
                        <input type="checkbox" className="mt-0.5" checked={photoSend[st]} onChange={(e) => setPhotoRule(st, e.target.checked)} />
                        <span className="text-sm">
                          <b>{PHOTO_LABEL[st]}</b> <span className="text-gray-500">({counts.byPhoto[st]})</span>
                          <span className="block text-xs text-gray-500">{PHOTO_HINT[st]}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    A comparação é do arquivo exato: a mesma foto salva de novo ou recortada conta como diferente. Dá para mudar foto por foto em cada criança.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* lista */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {([
                ['all', 'Todas', views.length],
                ['changes', 'Com diferenças', counts.withChanges],
                ['new', 'Novas', views.filter((v) => v.kind === 'create').length],
                ['same', 'Iguais', counts.same],
                ['warnings', 'Para conferir', counts.warnings],
                ['skipped', 'Fora do envio', counts.skipped],
              ] as [ListFilter, string, number][]).map(([key, label, n]) => (
                <button key={key} onClick={() => { setListFilter(key); setPage(1); }} className={`px-3 py-1.5 rounded-full text-sm border ${listFilter === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-700'}`}>
                  {label} <b>{n}</b>
                </button>
              ))}
              <div className="relative ml-auto w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar ID ou nome" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm" />
              </div>
            </div>

            {Object.keys(photoByKey).length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600 inline-flex items-center gap-1"><Camera className="w-4 h-4" /> Fotos:</span>
                {PHOTO_ORDER.filter((st) => counts.byPhoto[st] > 0).map((st) => {
                  const key = `photo:${st}` as ListFilter;
                  return (
                    <button key={st} onClick={() => { setListFilter(key); setPage(1); }} className={`px-3 py-1.5 rounded-full text-sm border ${listFilter === key ? 'bg-violet-700 text-white border-violet-700' : 'bg-white border-violet-200 text-violet-800'}`}>
                      {PHOTO_LABEL[st]} <b>{counts.byPhoto[st]}</b>
                    </button>
                  );
                })}
              </div>
            )}

            {shown.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                <span className="text-sm text-gray-700">Para as <b>{shown.length}</b> deste filtro:</span>
                <MassButton onClick={() => decideShown(() => ({ skip: false }))}>Incluir</MassButton>
                <MassButton onClick={() => decideShown(() => ({ skip: true }))}>Deixar de fora</MassButton>
                {shown.some((v) => v.changes.length) && (
                  <>
                    <MassButton onClick={() => decideShown((v) => (v.changes.length ? { fieldsOff: [] } : null))}>Marcar todas as mudanças</MassButton>
                    <MassButton onClick={() => decideShown((v) => (v.changes.length ? { fieldsOff: v.changes.map((c) => c.field) } : null))}>Desmarcar as mudanças</MassButton>
                  </>
                )}
                {shown.some((v) => v.photoState !== 'none') && (
                  <>
                    <MassButton onClick={() => decideShown((v) => (v.photoState !== 'none' ? { photo: true } : null))}>Enviar as fotos</MassButton>
                    <MassButton onClick={() => decideShown((v) => (v.photoState !== 'none' ? { photo: false } : null))}>Não enviar as fotos</MassButton>
                  </>
                )}
              </div>
            )}

            {shown.slice((page - 1) * PAGE, page * PAGE).map((v) => (
              <RowCard
                key={v.row.key}
                v={v}
                file={photoByKey[v.row.key]}
                campaignId={campaignId}
                otherCampaign={v.child ? serverHashes[v.child.id]?.other?.campaignName ?? null : null}
                onDecide={(patch) => decide(v.row.key, patch)}
              />
            ))}
            {!shown.length && <p className="text-center text-gray-500 py-10 bg-white rounded-2xl border border-gray-100">Nenhuma linha neste grupo.</p>}

            {pages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg border bg-white disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm text-gray-700">Página {page} de {pages}</span>
                <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="p-2 rounded-lg border bg-white disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
          </section>

          {/* barra de confirmação */}
          <div className="sticky bottom-4 z-10">
            <div className="bg-white border border-gray-200 shadow-xl rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-800">
                <b>{counts.updates}</b> com dados atualizados · <b>{counts.creates}</b> nova(s)
                {Object.keys(photoByKey).length > 0 && <> · <b>{counts.photosToSend}</b> de {Object.keys(photoByKey).length} foto(s)</>}
              </span>
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setStep(2)} className={`${btn} border border-gray-200 bg-white text-gray-700`}><ArrowLeft className="w-4 h-4" /> Planilha</button>
                <button
                  onClick={apply}
                  disabled={!!progress || hashing || counts.updates + counts.creates + counts.photosToSend === 0}
                  title={hashing ? 'Aguarde a comparação das fotos' : undefined}
                  className={`${btn} bg-emerald-600 text-white`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirmar e gravar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 4. resultado */}
      {step === 4 && result && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold text-emerald-700">
            <CheckCircle2 className="w-6 h-6" /> Concluído
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Atualizadas" value={result.updated} tone="text-blue-700" />
            <Stat label="Cadastradas" value={result.created} tone="text-emerald-700" />
            <Stat label="Fotos enviadas" value={result.photos} tone="text-gray-900" />
          </div>
          {result.errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-800 mb-1">{result.errors.length} problema(s)</p>
              <ul className="text-xs text-red-800 space-y-0.5 max-h-60 overflow-y-auto">{result.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={restart} className={`${btn} bg-blue-600 text-white`}><RefreshCw className="w-4 h-4" /> Nova planilha</button>
            <Link href="/admin/children" className={`${btn} border border-gray-200 bg-white text-gray-700`}>Ver crianças</Link>
          </div>
        </section>
      )}

      {progress && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3">
            <p className="font-semibold text-gray-900 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {progress.label}…</p>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
            </div>
            <p className="text-sm text-gray-600">{progress.done} de {progress.total}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== Partes ===================== */

function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <p className="text-xs text-gray-600">{label}</p>
      <p className={`text-2xl font-bold ${tone}`}>{value.toLocaleString('pt-BR')}</p>
      {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

type RowView = {
  row: SheetRow; p: PreviewRow; d: Decision; kind: 'update' | 'create'; child: Snapshot | null;
  changes: Change[]; selected: Change[]; included: boolean; reason?: string;
  photoState: PhotoState; sendPhoto: boolean;
};

function MassButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-100">
      {children}
    </button>
  );
}

/** Foto atual × foto escolhida, lado a lado */
function PhotoCompare({ v, file, campaignId, otherCampaign, onDecide }: {
  v: RowView; file: File; campaignId: string; otherCampaign: string | null; onDecide: (patch: Partial<Decision>) => void;
}) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const st = v.photoState;
  // miniatura da foto atual: a desta campanha; sem ela, a mais recente de outra campanha
  const current = v.child && (st === 'same' || st === 'different' || st === 'reused')
    ? apiPath(`/children/${v.child.id}/thumb?w=240${st === 'reused' ? '' : `&campaignId=${campaignId}`}`)
    : null;
  const tone =
    st === 'same' ? 'bg-gray-100 text-gray-700 border-gray-200'
      : st === 'different' ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-violet-50 text-violet-800 border-violet-200';

  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Camera className="w-4 h-4 text-gray-500" />
        {st === 'checking' ? (
          <span className="text-xs text-gray-500 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> comparando…</span>
        ) : st !== 'none' && (
          <span className={`text-xs px-2 py-0.5 rounded-full border ${tone}`}>
            {PHOTO_LABEL[st]}{st === 'reused' && otherCampaign ? ` (${otherCampaign})` : ''}
          </span>
        )}
        <label className="ml-auto inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={v.sendPhoto} disabled={st === 'checking' || !!v.d.skip} onChange={(e) => onDecide({ photo: e.target.checked })} />
          Enviar foto
        </label>
      </div>
      <div className="flex gap-3">
        <figure className="w-24 sm:w-28 shrink-0">
          <div className="aspect-square rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center text-[11px] text-gray-400 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {current ? <img src={current} alt="Foto atual" className="w-full h-full object-cover" loading="lazy" /> : 'sem foto'}
          </div>
          <figcaption className="text-[11px] text-gray-500 mt-1">Atual</figcaption>
        </figure>
        <figure className="w-24 sm:w-28 shrink-0">
          <div className={`aspect-square rounded-lg bg-gray-100 overflow-hidden ${v.sendPhoto ? 'ring-2 ring-emerald-500' : 'opacity-60'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview && <img src={preview} alt="Foto escolhida" className="w-full h-full object-cover" />}
          </div>
          <figcaption className="text-[11px] text-gray-500 mt-1 truncate" title={file.name}>{file.name}</figcaption>
        </figure>
      </div>
    </div>
  );
}

/** Uma linha da planilha: ficha atual × planilha, lado a lado, com o que vai ser aplicado */
function RowCard({ v, file, campaignId, otherCampaign, onDecide }: {
  v: RowView; file?: File; campaignId: string; otherCampaign: string | null; onDecide: (patch: Partial<Decision>) => void;
}) {
  const hasPhoto = !!file;
  const { row, p, d, kind, child } = v;
  const off = new Set(d.fieldsOff ?? []);
  const place = child ? [child.communityName, child.schoolName].filter(Boolean).join(' · ') : '';

  return (
    <div className={`bg-white rounded-2xl border shadow-sm ${v.included ? 'border-gray-100' : 'border-dashed border-gray-300 opacity-75'}`}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100">
        <span className="text-xs text-gray-500">linha {row.line}</span>
        <span className="font-semibold text-gray-900">{row.publicId} · {row.name}</span>
        {kind === 'update' ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
            Já existe{p?.matchedBy || d.linkTo ? ` — achada ${MATCHED_LABEL[d.linkTo ? 'manual' : p.matchedBy!]}` : ''}
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">Nova</span>
        )}
        {kind === 'update' && !v.changes.length && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Sem diferenças</span>}
        {hasPhoto && (
          <span className={`text-xs px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${v.sendPhoto ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-gray-50 text-gray-500 border-gray-200 line-through'}`}>
            <Camera className="w-3 h-3" /> foto
          </span>
        )}
        {!v.included && v.reason && <span className="text-xs text-gray-500">· fora do envio: {v.reason}</span>}
        <label className="ml-auto inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={!d.skip} onChange={(e) => onDecide({ skip: !e.target.checked })} /> Incluir
        </label>
      </div>

      <div className="px-4 py-3 space-y-3">
        {file && <PhotoCompare v={v} file={file} campaignId={campaignId} otherCampaign={otherCampaign} onDecide={onDecide} />}

        {(p?.warnings ?? []).map((w) => (
          <p key={w} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {w}
          </p>
        ))}

        {kind === 'update' && child && (
          <>
            <p className="text-xs text-gray-500">
              No cadastro: <b className="text-gray-700">{child.publicId}</b> (ID principal)
              {child.campaignPublicId != null && <> · <b className="text-gray-700">{child.campaignPublicId}</b> nesta campanha</>}
              {place && <> · {place}</>}
              {!child.giftFromCampaign && child.wantedGift && <> · presente atual é de outra campanha</>}
            </p>
            {v.changes.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="py-1 pr-2 w-8"></th>
                      <th className="py-1 pr-3">Campo</th>
                      <th className="py-1 pr-3">No cadastro</th>
                      <th className="py-1">Na planilha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.changes.map((c) => {
                      const applies = v.selected.some((s) => s.field === c.field);
                      return (
                        <tr key={c.field} className="border-t border-gray-50 align-top">
                          <td className="py-1.5 pr-2">
                            <input
                              type="checkbox"
                              checked={!off.has(c.field)}
                              onChange={(e) => {
                                const next = new Set(off);
                                if (e.target.checked) next.delete(c.field); else next.add(c.field);
                                onDecide({ fieldsOff: [...next] });
                              }}
                              title="Aplicar esta mudança"
                            />
                          </td>
                          <td className="py-1.5 pr-3 text-gray-600 whitespace-nowrap">{FIELD_LABEL[c.field]}</td>
                          <td className={`py-1.5 pr-3 ${applies ? 'text-red-700 line-through decoration-red-300' : 'text-gray-700'}`}>{c.from || <i className="text-gray-400 no-underline">vazio</i>}</td>
                          <td className={`py-1.5 ${applies ? 'text-emerald-800 font-medium bg-emerald-50' : 'text-gray-500'}`}>{c.to}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button onClick={() => onDecide({ asNew: true, linkTo: undefined })} className="text-xs text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
                <UserPlus className="w-3.5 h-3.5" /> Não é esta criança — cadastrar como nova
              </button>
              {d.linkTo && (
                <button onClick={() => onDecide({ linkTo: undefined })} className="text-xs text-blue-700 hover:underline">
                  Desfazer a ligação com {d.linkTo.name}
                </button>
              )}
            </div>
          </>
        )}

        {kind === 'create' && (
          <>
            <p className="text-sm text-gray-700">
              {[row.wantedGift && `Presente: ${row.wantedGift}`, row.birthDate && `Nasc.: ${formatDate(row.birthDate)}`, typeof row.age === 'number' && `${row.age} anos`, row.motherName && `Mãe: ${row.motherName}`]
                .filter(Boolean).join(' · ') || 'Sem outros dados na planilha.'}
            </p>
            {(p?.candidates ?? []).length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                <p className="text-xs font-semibold text-amber-900 mb-1">Parecidas já cadastradas nesta cidade — se for uma delas, ligue para atualizar em vez de criar outra:</p>
                <ul className="space-y-1">
                  {p.candidates.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 text-xs text-gray-800">
                      <span><b>{c.name}</b> · ID {c.campaignPublicId ?? c.publicId}{c.communityName ? ` · ${c.communityName}` : ''}{c.birthDate ? ` · nasc. ${formatDate(c.birthDate)}` : ''}{c.inCampaign ? ' · já nesta campanha' : ''}</span>
                      <button onClick={() => onDecide({ linkTo: c, asNew: false })} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-300 bg-white hover:bg-amber-100">
                        <Link2 className="w-3 h-3" /> É esta
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {d.asNew && p?.child && (
              <button onClick={() => onDecide({ asNew: false })} className="text-xs text-blue-700 hover:underline">Desfazer: é {p.child.name}</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
