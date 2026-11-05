'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Camera, CheckCircle2, ChevronDown, ChevronUp, ImagePlus, Loader2, RefreshCw, Trash2, Upload, X, XCircle,
} from 'lucide-react';
import { composeConfigForFrame } from '@/components/media/composeConfig';
import { autoFrame, scanFaces } from '@/lib/faceFraming';
import { normalizeText } from '@/lib/sheetImport';
import type { LocationValue } from '@/components/Admin/LocationFilter';

type Child = {
  id: string;
  publicId: number;
  name: string;
  cityId?: string | null;
  cityName?: string | null;
  city?: { id: string; name: string } | null;
  community?: { id: string; name: string } | null;
};
type Frame = { id: string; active?: boolean; config?: unknown };

type RowStatus = 'ready' | 'uploading' | 'done' | 'error';
type Row = {
  key: string;
  file: File;
  preview: string;
  childId: string; // '' = sem criança associada
  how: 'id' | 'name' | 'manual' | null;
  note?: string; // por que não associou sozinho
  status: RowStatus;
  error?: string;
  sentAs?: string; // criança que recebeu a foto (ela sai da lista de pendentes)
};

/** "0669" e "669" são o mesmo ID */
const canonicalId = (v: unknown) => {
  const s = String(v ?? '').trim();
  return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s;
};

async function runPool<T>(items: T[], size: number, fn: (it: T) => Promise<void>, onStep: (done: number) => void) {
  let next = 0, done = 0;
  const worker = async () => {
    while (next < items.length) {
      const it = items[next++];
      try { await fn(it); } finally { onStep(++done); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

/**
 * Envio das fotos que faltam: cada arquivo é associado à criança pelo número no início do nome
 * ("123.jpg", "123 - Maria.jpg") ou pelo nome da criança; o que sobrar dá para escolher na mão.
 * A foto é montada com o layout da cidade na campanha, como no envio individual.
 */
export default function BulkPhotoUpload({
  campaignId, location, locationLabel, q, onUploaded,
}: {
  campaignId: string;
  location: LocationValue;
  locationLabel: string;
  q: string;
  onUploaded: () => void;
}) {
  const [missing, setMissing] = useState<Child[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [frameByCity, setFrameByCity] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [autoFace, setAutoFace] = useState(true);
  const [job, setJob] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const cancelRef = useRef(false);
  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = rows;

  // todas as crianças sem foto nesta campanha e neste filtro
  const loadMissing = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const all: Child[] = [];
      for (let skip = 0; ; skip += 100) {
        const qs = new URLSearchParams({ campaignId, photo: 'without', skip: String(skip), take: '100' });
        if (location.cityId) qs.set('cityId', location.cityId);
        if (location.communityId) qs.set('communityId', location.communityId);
        if (location.schoolId) qs.set('schoolId', location.schoolId);
        if (q.trim()) qs.set('q', q.trim());
        const r = await fetch(`/api/admin/children?${qs}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`Erro ${r.status} ao carregar as crianças sem foto`);
        const j = await r.json();
        all.push(...(j.items ?? []));
        if (!j.hasMore || !(j.items ?? []).length) break;
      }
      setMissing(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar');
      setMissing([]);
    } finally {
      setLoading(false);
    }
  }, [campaignId, location.cityId, location.communityId, location.schoolId, q]);

  useEffect(() => { loadMissing(); }, [loadMissing]);

  useEffect(() => {
    (async () => {
      const [rf, rc] = await Promise.all([
        fetch(`/api/admin/campaigns/${campaignId}/layouts`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/admin/campaigns/${campaignId}/city-layouts`, { cache: 'no-store' }).catch(() => null),
      ]);
      setFrames(rf?.ok ? await rf.json() : []);
      const byCity: { cityId: string; frameId: string }[] = rc?.ok ? await rc.json() : [];
      setFrameByCity(Object.fromEntries(byCity.map((l) => [l.cityId, l.frameId])));
    })();
  }, [campaignId]);

  // libera as miniaturas ao sair
  useEffect(() => () => rowsRef.current.forEach((r) => URL.revokeObjectURL(r.preview)), []);

  const byId = useMemo(() => new Map(missing.map((c) => [c.id, c])), [missing]);

  /** Acha a criança do arquivo: número no início do nome, senão o nome (igual ou só um início único) */
  const matchFile = useCallback((fileName: string): Pick<Row, 'childId' | 'how' | 'note'> => {
    const base = fileName.replace(/\.[^.]+$/, '');
    const num = base.match(/^\s*(\d{1,12})(?!\d)/);
    if (num) {
      const pid = canonicalId(num[1]);
      const hit = missing.filter((c) => canonicalId(c.publicId) === pid);
      if (hit.length === 1) return { childId: hit[0].id, how: 'id' };
      // número sem criança: não tenta pelo nome para não trocar de criança
      if (!hit.length) return { childId: '', how: null, note: `ID ${pid} não está entre as crianças sem foto${locationLabel ? ` de ${locationLabel}` : ''}` };
    }
    const name = normalizeText(base.replace(/^\s*\d+\s*[-_.]?\s*/, ''));
    if (name.length >= 3) {
      const exact = missing.filter((c) => normalizeText(c.name) === name);
      if (exact.length === 1) return { childId: exact[0].id, how: 'name' };
      if (exact.length > 1) return { childId: '', how: null, note: 'Mais de uma criança com esse nome' };
      const prefix = missing.filter((c) => normalizeText(c.name).startsWith(`${name} `));
      if (prefix.length === 1 && name.includes(' ')) return { childId: prefix[0].id, how: 'name' };
    }
    return { childId: '', how: null, note: 'Não achei a criança pelo nome do arquivo' };
  }, [missing, locationLabel]);

  function addFiles(list: FileList | File[]) {
    const images = Array.from(list).filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setMessage(null);
    setRows((prev) => {
      const known = new Set(prev.map((r) => `${r.file.name}:${r.file.size}`));
      const fresh = images
        .filter((f) => !known.has(`${f.name}:${f.size}`))
        .map<Row>((file) => ({
          key: `${file.name}:${file.size}:${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
          status: 'ready',
          ...matchFile(file.name),
        }));
      return [...prev, ...fresh].sort((a, b) => a.file.name.localeCompare(b.file.name, 'pt-BR', { numeric: true }));
    });
  }

  // a lista de crianças chega depois dos arquivos: refaz as associações automáticas pendentes
  useEffect(() => {
    setRows((prev) => prev.map((r) => (r.status === 'ready' && r.how !== 'manual' ? { ...r, note: undefined, ...matchFile(r.file.name) } : r)));
  }, [matchFile]);

  const removeRow = (key: string) => setRows((prev) => {
    const r = prev.find((x) => x.key === key);
    if (r) URL.revokeObjectURL(r.preview);
    return prev.filter((x) => x.key !== key);
  });
  const clearAll = () => { rows.forEach((r) => URL.revokeObjectURL(r.preview)); setRows([]); setMessage(null); };
  const clearDone = () => setRows((prev) => {
    prev.filter((r) => r.status === 'done').forEach((r) => URL.revokeObjectURL(r.preview));
    return prev.filter((r) => r.status !== 'done');
  });
  const assign = (key: string, childId: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, childId, how: childId ? 'manual' : null, note: undefined, status: r.status === 'error' ? 'ready' : r.status, error: undefined } : r)));

  // mesma criança em mais de um arquivo: nenhum deles é enviado até resolver
  const pending = rows.filter((r) => r.status !== 'done');
  const dupCount = new Map<string, number>();
  for (const r of pending) if (r.childId) dupCount.set(r.childId, (dupCount.get(r.childId) ?? 0) + 1);
  const isDup = (r: Row) => !!r.childId && (dupCount.get(r.childId) ?? 0) > 1;
  const sendable = pending.filter((r) => r.childId && byId.has(r.childId) && !isDup(r));
  const unmatched = pending.filter((r) => !r.childId).length;
  const dups = pending.filter(isDup).length;
  const doneCount = rows.filter((r) => r.status === 'done').length;

  const takenIds = useMemo(() => new Set(rows.filter((r) => r.childId).map((r) => r.childId)), [rows]);
  const stillMissing = missing.filter((c) => !takenIds.has(c.id));

  const frameFor = (c: Child) => {
    const cityId = c.city?.id ?? c.cityId ?? '';
    return frames.find((f) => f.id === frameByCity[cityId]) ?? frames.find((f) => f.active) ?? null;
  };

  async function uploadRow(r: Row) {
    const child = byId.get(r.childId);
    if (!child) throw new Error('Criança não encontrada');
    const frame = frameFor(child);
    let config = composeConfigForFrame(frame?.config);
    if (autoFace) {
      // sem rosto encontrado: envia com o enquadramento padrão do layout
      try { config = autoFrame(config, await scanFaces(r.preview)) ?? config; } catch { /* segue com o padrão */ }
    }
    const fd = new FormData();
    fd.append('file', r.file);
    fd.append('Config', JSON.stringify(config));
    const qs = new URLSearchParams({ campaignId });
    if (frame?.id) qs.set('layoutId', frame.id);
    const res = await fetch(`/api/admin/children/${encodeURIComponent(child.id)}/photo?${qs}`, { method: 'POST', body: fd });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      let msg = '';
      try { const j = JSON.parse(t); msg = Array.isArray(j?.message) ? j.message.join(' ') : String(j?.message ?? ''); } catch { msg = t.slice(0, 120); }
      throw new Error(msg || `Erro ${res.status}`);
    }
  }

  async function sendAll() {
    const targets = sendable;
    if (!targets.length) return;
    cancelRef.current = false;
    setMessage(null);
    setJob({ done: 0, total: targets.length });
    let ok = 0, failed = 0;
    const setRow = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    try {
      await runPool(targets, 2, async (r) => {
        if (cancelRef.current) return;
        setRow(r.key, { status: 'uploading', error: undefined });
        try {
          await uploadRow(r);
          const c = byId.get(r.childId);
          setRow(r.key, { status: 'done', sentAs: c ? label(c) : undefined });
          ok++;
        } catch (e) {
          setRow(r.key, { status: 'error', error: e instanceof Error ? e.message : 'Falha no envio' });
          failed++;
        }
      }, (d) => setJob((j) => j && { ...j, done: d }));
    } finally {
      setJob(null);
      setMessage(`${ok} foto(s) enviada(s)${failed ? ` · ${failed} com erro (veja na lista e tente de novo)` : ''}${cancelRef.current ? ' · envio interrompido' : ''}.`);
      if (ok) {
        onUploaded();
        // quem recebeu foto sai da lista de pendentes
        const sent = new Set(rowsRef.current.filter((x) => x.status === 'done').map((x) => x.childId));
        setMissing((prev) => prev.filter((c) => !sent.has(c.id)));
      }
    }
  }

  const label = (c: Child) => `${c.publicId} · ${c.name}`;
  const place = (c: Child) => [c.community?.name, c.city?.name ?? c.cityName].filter(Boolean).join(' · ');

  return (
    <div className="space-y-4">
      <div className="bg-white/80 rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            <Camera className="w-4 h-4" />
            {loading ? 'Carregando…' : `${missing.length} criança(s) sem foto${locationLabel ? ` · ${locationLabel}` : ' · todas as cidades'}`}
          </span>
          <button onClick={loadMissing} disabled={loading || !!job} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          {!!missing.length && (
            <button onClick={() => setShowMissing((s) => !s)} className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 ml-auto">
              {showMissing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showMissing ? 'Ocultar' : 'Ver'} quem ainda falta ({stillMissing.length})
            </button>
          )}
        </div>

        {showMissing && (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/60 p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-xs">
            {stillMissing.length ? stillMissing.map((c) => (
              <Link key={c.id} href={`/admin/children/${c.id}`} className="truncate text-gray-700 hover:underline" title={place(c)}>
                <span className="font-semibold text-gray-500">{c.publicId}</span> · {c.name}
              </Link>
            )) : <span className="text-gray-500">Todas as crianças sem foto já têm um arquivo na lista.</span>}
          </div>
        )}

        {/* área de soltar arquivos */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!job) addFiles(e.dataTransfer.files); }}
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center cursor-pointer transition ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:bg-gray-50'
          } ${job ? 'pointer-events-none opacity-50' : ''}`}
        >
          <ImagePlus className="w-8 h-8 text-gray-400" />
          <span className="text-sm font-semibold text-gray-800">Arraste as fotos aqui ou clique para escolher</span>
          <span className="text-xs text-gray-500">
            Nomeie cada arquivo com o ID da criança na campanha (<strong>123.jpg</strong>, <strong>123 - Maria.jpg</strong>) ou com o nome completo dela.
          </span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={sendAll}
            disabled={!!job || loading || !sendable.length}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-40"
          >
            <Upload className="w-4 h-4" /> Enviar {sendable.length} foto(s)
          </button>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={autoFace} onChange={(e) => setAutoFace(e.target.checked)} disabled={!!job} />
            Enquadrar pelo rosto automaticamente
          </label>
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
            {!!rows.length && <span>{rows.length} arquivo(s)</span>}
            {!!unmatched && <span className="text-amber-700">{unmatched} sem criança</span>}
            {!!dups && <span className="text-red-700">{dups} repetido(s)</span>}
            {!!doneCount && <button onClick={clearDone} disabled={!!job} className="hover:text-gray-800 underline disabled:opacity-40">Tirar enviadas</button>}
            {!!rows.length && <button onClick={clearAll} disabled={!!job} className="hover:text-gray-800 underline disabled:opacity-40">Limpar tudo</button>}
          </div>
        </div>

        {job && (
          <div className="flex items-center gap-3 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-gray-700">Enviando fotos: {job.done}/{job.total}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-md">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${(job.done / Math.max(1, job.total)) * 100}%` }} />
            </div>
            <button onClick={() => { cancelRef.current = true; }} className="text-xs text-gray-500 hover:text-gray-800">Parar</button>
          </div>
        )}
        {message && (
          <div className="flex items-start gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> <span className="flex-1">{message}</span>
            <button onClick={() => setMessage(null)}><X className="w-4 h-4" /></button>
          </div>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <p className="text-xs text-gray-500">
          A foto é montada com o layout da cidade na campanha. Só aparecem aqui as crianças <strong>sem foto</strong> nesta campanha e nos filtros acima;
          para trocar uma foto existente, use a página da criança.
        </p>
      </div>

      {/* arquivos e associações */}
      {!!rows.length && (
        <div className="bg-white/80 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {rows.map((r) => {
              const child = byId.get(r.childId);
              const dup = r.status !== 'done' && isDup(r);
              const options = missing.filter((c) => c.id === r.childId || !takenIds.has(c.id));
              return (
                <li key={r.key} className={`flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-2.5 ${r.status === 'done' ? 'bg-emerald-50/40' : ''}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.preview} alt={r.file.name} className="w-14 h-14 rounded-lg object-cover bg-gray-100 shrink-0" />
                  <div className="min-w-0 w-full sm:w-56 shrink-0">
                    <p className="text-sm font-medium text-gray-900 truncate" title={r.file.name}>{r.file.name}</p>
                    <p className="text-xs text-gray-500">{(r.file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    {r.status === 'done' ? (
                      <p className="text-sm text-gray-800 truncate">{r.sentAs ?? (child ? label(child) : 'Enviada')}</p>
                    ) : (
                      <select
                        value={r.childId}
                        onChange={(e) => assign(r.key, e.target.value)}
                        disabled={!!job}
                        className={`w-full px-3 py-2 bg-white border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
                          !r.childId ? 'border-amber-300' : dup ? 'border-red-300' : 'border-gray-200'
                        }`}
                      >
                        <option value="">— escolha a criança —</option>
                        {options.map((c) => <option key={c.id} value={c.id}>{label(c)}{place(c) ? ` (${place(c)})` : ''}</option>)}
                      </select>
                    )}
                    <p className="mt-0.5 text-xs truncate">
                      {r.status === 'error' ? <span className="text-red-700">{r.error}</span>
                        : dup ? <span className="text-red-700">Outro arquivo também está com esta criança</span>
                        : !r.childId ? <span className="text-amber-700">{r.note ?? 'Escolha a criança'}</span>
                        : child ? <span className="text-gray-500">{place(child)}{r.how === 'id' ? ' · pelo ID' : r.how === 'name' ? ' · pelo nome' : ''}</span>
                        : null}
                    </p>
                  </div>

                  <div className="w-24 shrink-0 flex items-center justify-end gap-2">
                    {r.status === 'uploading' && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
                    {r.status === 'done' && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Enviada</span>}
                    {r.status === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
                    {r.status === 'ready' && (dup || !r.childId) && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                    {r.status !== 'uploading' && r.status !== 'done' && (
                      <button onClick={() => removeRow(r.key)} disabled={!!job} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40" title="Tirar da lista">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
