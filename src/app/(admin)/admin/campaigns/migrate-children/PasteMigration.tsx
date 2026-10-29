'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardPaste, ImagePlus, Loader2, Trash2, X } from 'lucide-react';

type Campaign = { id: string; name: string; slug: string; year?: number | null };

type PreviewItem = {
  id: string;
  publicId: number;
  name: string;
  cityName?: string | null;
  city?: { id: string; name: string } | null;
  community?: { id: string; name: string } | null;
  inSource: boolean;
  alreadyInTarget: boolean;
  currentGift: string | null;
  targetGift: string | null;
  currentPhotoUrl: string | null;
  targetPhotoUrl: string | null;
};

type ColumnMap = { publicId: number; name: number; wantedGift: number };

type SheetRow = { line: number; publicId: number | null; name: string; gift: string };

type Frame = { id: string; active?: boolean; config?: unknown };

type Progress = { phase: 'migrando' | 'fotos'; done: number; total: number };

type Summary = { migrated: number; photos: number; errors: string[] };

const NONE = -1;

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
    .replace(/\s+/g, ' ')
    .trim();

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

function guessColumns(headers: string[] | null, rows: string[][]): ColumnMap {
  const width = Math.max(...rows.map((r) => r.length), headers?.length ?? 0);
  const cols = Array.from({ length: width }, (_, i) => i);

  if (headers) {
    const find = (alts: string[]) => cols.find((i) => alts.includes(normalize(headers[i]).replace(/[^a-z0-9 ]/g, '')));
    const publicId = find(['id', 'publicid', 'codigo', 'cod', 'numero', 'n', 'no']) ?? NONE;
    const name = find(['nome', 'name', 'crianca', 'nome da crianca', 'child']) ?? NONE;
    const wantedGift = find(['presente', 'presente desejado', 'wantedgift', 'pedido', 'desejo', 'presente novo', 'novo presente']) ?? NONE;
    if (publicId !== NONE) return { publicId, name, wantedGift };
  }

  // sem cabeçalho reconhecível: ID = primeira coluna numérica, nome = próxima de texto, presente = a seguinte
  const sample = rows.slice(0, 20);
  const numericShare = (i: number) => sample.filter((r) => isIdCell(r[i])).length / Math.max(sample.length, 1);
  const publicId = cols.find((i) => numericShare(i) >= 0.6) ?? 0;
  const textCols = cols.filter((i) => i !== publicId && numericShare(i) < 0.6);
  return { publicId, name: textCols[0] ?? NONE, wantedGift: textCols[1] ?? NONE };
}

/** Nome da planilha confere com o cadastro? Aceita abreviações (mesmo primeiro nome ou um contido no outro). */
function namesMatch(sheet: string, system: string) {
  const a = normalize(sheet);
  const b = normalize(system);
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a) || a.split(' ')[0] === b.split(' ')[0];
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
  const [rawText, setRawText] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [colMap, setColMap] = useState<ColumnMap>({ publicId: 0, name: NONE, wantedGift: NONE });

  const [preview, setPreview] = useState<Map<number, PreviewItem>>(new Map());
  const [notFound, setNotFound] = useState<Set<number>>(new Set());
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // ajustes feitos na tela, por ID público
  const [giftEdits, setGiftEdits] = useState<Record<number, string>>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [photos, setPhotos] = useState<Record<number, File>>({});
  const [photoIssues, setPhotoIssues] = useState<string[]>([]);

  const [frame, setFrame] = useState<Frame | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const bulkPhotoInput = useRef<HTMLInputElement>(null);

  // ---- tabela colada ----
  const table = useMemo(() => parseClipboardTable(rawText), [rawText]);
  const headers = hasHeader ? table[0] ?? [] : null;
  const dataRows = useMemo(() => (hasHeader ? table.slice(1) : table), [table, hasHeader]);
  const columnCount = Math.max(0, ...table.map((r) => r.length));
  const columnLabel = (i: number) => (headers?.[i] ? `${headers[i]} (col. ${i + 1})` : `Coluna ${i + 1}`);

  function handleTextChange(text: string) {
    setRawText(text);
    setSummary(null);
    const parsed = parseClipboardTable(text);
    if (parsed.length === 0) return;
    // cabeçalho = primeira linha sem nenhuma célula que pareça ID
    const header = !parsed[0].some(isIdCell);
    setHasHeader(header);
    setColMap(guessColumns(header ? parsed[0] : null, header ? parsed.slice(1) : parsed));
  }

  const sheetRows: SheetRow[] = useMemo(
    () =>
      dataRows.map((r, idx) => {
        const rawId = colMap.publicId === NONE ? '' : r[colMap.publicId] ?? '';
        return {
          line: idx + 1 + (hasHeader ? 1 : 0),
          publicId: isIdCell(rawId) ? parseInt(rawId, 10) : null,
          name: colMap.name === NONE ? '' : r[colMap.name] ?? '',
          gift: colMap.wantedGift === NONE ? '' : r[colMap.wantedGift] ?? '',
        };
      }),
    [dataRows, colMap, hasHeader],
  );

  const publicIds = useMemo(
    () => Array.from(new Set(sheetRows.map((r) => r.publicId).filter((n): n is number => n !== null))),
    [sheetRows],
  );

  // ---- confere os IDs na base (com debounce) ----
  useEffect(() => {
    if (publicIds.length === 0) { setPreview(new Map()); setNotFound(new Set()); return; }
    const t = window.setTimeout(async () => {
      setChecking(true);
      setCheckError(null);
      try {
        const res = await fetch(`/api/admin/campaigns/${targetCampaign.id}/migration-preview`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ publicIds, sourceCampaignId: sourceCampaignId || undefined }),
        });
        if (!res.ok) throw new Error(await extractError(res, 'Falha ao conferir as crianças.'));
        const json: { items: PreviewItem[]; notFound: number[] } = await res.json();
        setPreview(new Map(json.items.map((i) => [i.publicId, i])));
        setNotFound(new Set(json.notFound));
      } catch (e) {
        setCheckError(e instanceof Error ? e.message : 'Falha ao conferir as crianças.');
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [publicIds, targetCampaign.id, sourceCampaignId]);

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

  // ---- linhas finais (planilha + cadastro) ----
  const rows = useMemo(() => {
    const seen = new Set<number>();
    return sheetRows.map((r) => {
      const duplicate = r.publicId !== null && seen.has(r.publicId);
      if (r.publicId !== null) seen.add(r.publicId);
      const match = r.publicId !== null && !duplicate ? preview.get(r.publicId) ?? null : null;
      const gift = r.publicId !== null && r.publicId in giftEdits ? giftEdits[r.publicId] : r.gift;
      const selectable = !!match;
      const selected = selectable && !excluded.has(r.publicId!);
      return { ...r, duplicate, match, gift, selectable, selected };
    });
  }, [sheetRows, preview, giftEdits, excluded]);

  const selectedRows = rows.filter((r) => r.selected);
  const selectedWithPhoto = selectedRows.filter((r) => photos[r.publicId!]);

  // ---- fotos ----
  const photoUrls = useMemo(() => {
    const urls: Record<number, string> = {};
    for (const [pid, file] of Object.entries(photos)) urls[Number(pid)] = URL.createObjectURL(file);
    return urls;
  }, [photos]);
  useEffect(() => () => Object.values(photoUrls).forEach((u) => URL.revokeObjectURL(u)), [photoUrls]);

  function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const byName = new Map<string, number>();
    rows.forEach((r) => {
      if (r.match) byName.set(normalize(r.match.name), r.match.publicId);
      if (r.publicId !== null && r.name) byName.set(normalize(r.name), r.publicId);
    });
    const known = new Set(rows.filter((r) => r.match).map((r) => r.publicId!));

    const next = { ...photos };
    const issues: string[] = [];
    Array.from(files).forEach((f) => {
      const base = f.name.replace(/\.[^.]+$/, '');
      const pid = base.match(/^(\d{1,9})/)?.[1];
      if (pid && known.has(Number(pid))) { next[Number(pid)] = f; return; }
      const byNamePid = byName.get(normalize(base));
      if (byNamePid !== undefined) { next[byNamePid] = f; return; }
      issues.push(f.name);
    });
    setPhotos(next);
    setPhotoIssues(issues);
  }

  function setRowPhoto(pid: number, file: File | null) {
    setPhotos((prev) => {
      const next = { ...prev };
      if (file) next[pid] = file; else delete next[pid];
      return next;
    });
  }

  function toggleRow(pid: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  }

  function reset() {
    setRawText('');
    setPreview(new Map());
    setNotFound(new Set());
    setGiftEdits({});
    setExcluded(new Set());
    setPhotos({});
    setPhotoIssues([]);
  }

  // ---- migrar ----
  async function submit() {
    if (selectedRows.length === 0) return;
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
          items: selectedRows.map((r) => ({ childId: r.match!.id, wantedGift: r.gift.trim() || null })),
        }),
      });
      if (!res.ok) {
        alert(await extractError(res, 'Falha ao migrar crianças.'));
        return;
      }

      // fotos depois da migração, para a arte já sair com o presente novo
      setProgress({ phase: 'fotos', done: 0, total: selectedWithPhoto.length });
      for (const [idx, r] of selectedWithPhoto.entries()) {
        const fd = new FormData();
        fd.append('file', photos[r.publicId!]);
        if (frame?.config) fd.append('Config', JSON.stringify(frame.config));
        const qs = new URLSearchParams({ campaignId: targetCampaign.id });
        if (frame?.id) qs.set('layoutId', frame.id);
        try {
          const up = await fetch(`/api/admin/children/${r.publicId}/photo?${qs.toString()}`, {
            method: 'POST',
            credentials: 'include',
            body: fd,
          });
          if (!up.ok) throw new Error(await extractError(up, 'falha no envio'));
          uploaded += 1;
        } catch (e) {
          errors.push(`Foto de #${r.publicId} (${r.match!.name}): ${e instanceof Error ? e.message : 'falha no envio'}`);
        }
        setProgress({ phase: 'fotos', done: idx + 1, total: selectedWithPhoto.length });
      }

      setSummary({ migrated: selectedRows.length, photos: uploaded, errors });
      reset();
      await onMigrated();
    } finally {
      setProgress(null);
    }
  }

  const missingIdRows = rows.filter((r) => r.publicId === null).length;
  const notFoundRows = rows.filter((r) => r.publicId !== null && notFound.has(r.publicId)).length;

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

      {/* Colar */}
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
          placeholder={'Selecione as colunas na planilha (ID, Nome, Presente), copie e cole aqui.\n\nID\tNome\tPresente\n898\tMaria Silva\tBoneca\n912\tJoão Souza\tBola'}
          className="w-full min-h-[140px] p-3 border border-gray-300 rounded-lg font-mono text-xs"
        />

        {table.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {([
              ['publicId', 'Coluna do ID'],
              ['name', 'Coluna do nome (conferência)'],
              ['wantedGift', 'Coluna do presente novo'],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">{label}</label>
                <select
                  value={colMap[key]}
                  onChange={(e) => setColMap((m) => ({ ...m, [key]: Number(e.target.value) }))}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white text-sm"
                >
                  {key !== 'publicId' && <option value={NONE}>— nenhuma —</option>}
                  {Array.from({ length: columnCount }, (_, i) => (
                    <option key={i} value={i}>{columnLabel(i)}</option>
                  ))}
                </select>
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm text-gray-700 sm:pt-6">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} className="w-4 h-4" />
              Primeira linha é cabeçalho
            </label>
          </div>
        )}
      </div>

      {/* Conferência */}
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="text-sm text-gray-700 space-x-3">
              <span><strong>{rows.length}</strong> linha{rows.length === 1 ? '' : 's'}</span>
              <span className="text-emerald-700"><strong>{selectedRows.length}</strong> para migrar</span>
              {notFoundRows > 0 && <span className="text-red-700"><strong>{notFoundRows}</strong> não encontrada{notFoundRows === 1 ? '' : 's'}</span>}
              {missingIdRows > 0 && <span className="text-red-700"><strong>{missingIdRows}</strong> sem ID</span>}
              {checking && <span className="inline-flex items-center gap-1 text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> conferindo…</span>}
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
                title="Os arquivos são associados pelo ID no início do nome (ex.: 898.jpg) ou pelo nome da criança"
              >
                <ImagePlus className="w-4 h-4" /> Adicionar fotos novas
              </button>
              <button
                onClick={submit}
                disabled={!!progress || checking || selectedRows.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60"
              >
                {progress ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {progress
                  ? progress.phase === 'migrando' ? 'Migrando…' : `Enviando fotos ${progress.done}/${progress.total}…`
                  : `Migrar ${selectedRows.length} criança${selectedRows.length === 1 ? '' : 's'}${selectedWithPhoto.length ? ` (${selectedWithPhoto.length} com foto nova)` : ''}`}
              </button>
            </div>
          </div>

          {checkError && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{checkError}</div>}
          {photoIssues.length > 0 && (
            <div className="mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
              Não consegui associar {photoIssues.length} foto{photoIssues.length === 1 ? '' : 's'} a nenhuma linha: {photoIssues.join(', ')}.
              Use o ID da criança no início do nome do arquivo (ex.: <code>898.jpg</code>) ou escolha a foto na linha.
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
                  <th className="px-2 py-2 text-left">ID</th>
                  <th className="px-2 py-2 text-left">Criança</th>
                  <th className="px-2 py-2 text-left">Presente</th>
                  <th className="px-2 py-2 text-left">Foto</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const m = r.match;
                  const pid = r.publicId;
                  const newPhoto = pid !== null ? photoUrls[pid] : undefined;
                  const shownPhoto = newPhoto ?? m?.targetPhotoUrl ?? m?.currentPhotoUrl ?? null;
                  const pending = pid !== null && !r.duplicate && !m && !notFound.has(pid);

                  const problems: { tone: 'red' | 'amber' | 'gray'; text: string }[] = [];
                  if (pid === null) problems.push({ tone: 'red', text: 'Linha sem ID válido' });
                  else if (r.duplicate) problems.push({ tone: 'red', text: 'ID repetido na planilha (vale a primeira linha)' });
                  else if (notFound.has(pid)) problems.push({ tone: 'red', text: 'ID não encontrado no cadastro' });
                  if (m && !namesMatch(r.name, m.name)) problems.push({ tone: 'amber', text: `Nome na planilha: “${r.name}”` });
                  if (m && sourceCampaignId && !m.inSource) problems.push({ tone: 'amber', text: 'Não está na campanha de origem' });
                  if (m?.alreadyInTarget) problems.push({ tone: 'gray', text: 'Já está na campanha de destino — atualiza presente/foto' });

                  return (
                    <tr
                      key={`${r.line}-${pid ?? 'x'}`}
                      className={[
                        'border-b last:border-0 align-top',
                        !r.selectable && !pending ? 'bg-red-50/40' : r.selected ? '' : 'opacity-50',
                      ].join(' ')}
                    >
                      <td className="px-2 py-3">
                        <input
                          type="checkbox"
                          checked={r.selected}
                          disabled={!r.selectable}
                          onChange={() => toggleRow(pid!)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-2 py-3 font-mono text-gray-700 whitespace-nowrap">
                        {pid ?? '—'}
                        <div className="text-[10px] text-gray-400 font-sans">linha {r.line}</div>
                      </td>
                      <td className="px-2 py-3 min-w-[180px]">
                        {m ? (
                          <>
                            <p className="font-semibold text-gray-900">{m.name}</p>
                            <p className="text-xs text-gray-500">{m.community?.name ?? '—'} · {m.city?.name ?? m.cityName ?? '—'}</p>
                          </>
                        ) : (
                          <p className="text-gray-500">{r.name || '—'}</p>
                        )}
                        {pending && <p className="text-xs text-gray-400 mt-1">conferindo…</p>}
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
                      <td className="px-2 py-3 min-w-[220px]">
                        {m ? (
                          <>
                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                              <span className="truncate max-w-[200px]" title={m.currentGift ?? ''}>{m.currentGift || 'sem presente'}</span>
                              <ArrowRight className="w-3 h-3 shrink-0" />
                            </p>
                            <input
                              value={r.gift}
                              onChange={(e) => setGiftEdits((g) => ({ ...g, [pid!]: e.target.value }))}
                              placeholder={m.targetGift ?? 'mantém o presente atual'}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                            />
                          </>
                        ) : (
                          <span className="text-gray-400">{r.gift || '—'}</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {m && (
                          <div className="flex items-center gap-2">
                            {shownPhoto ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={shownPhoto}
                                alt={m.name}
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
                                  onChange={(e) => { setRowPhoto(pid!, e.target.files?.[0] ?? null); e.target.value = ''; }}
                                />
                              </label>
                              {newPhoto ? (
                                <button onClick={() => setRowPhoto(pid!, null)} className="text-left text-red-600 hover:underline">Remover</button>
                              ) : (
                                <span className="text-gray-400 whitespace-nowrap">{m.targetPhotoUrl ? 'foto da campanha' : 'foto atual'}</span>
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
        </div>
      )}
    </div>
  );
}
